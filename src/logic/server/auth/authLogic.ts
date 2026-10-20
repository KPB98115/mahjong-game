import { type SessionCacheValue } from "../../../model/server/sessionCache";
import { ApiError, HttpStatus } from "../../../types/server/api";
import {
  isResolveSessionErr,
  isSocketTicketErr,
  type ResolveSessionInput,
  type ResolveSessionOk,
  type ResolveSessionResult,
  type SocketTicketResult,
} from "../../../types/server/auth";
import { type DbExecutor } from "../db/executor";
import { type SeatsRepo } from "../game/seatsRepo";
import { type UserRepo, type UserRow } from "../user/userRepo";
import { type AuthRepo, type SessionRow } from "./authRepo";

const identityWindowMs = 24 * 60 * 60 * 1000;
const seatedPastWindowTtlSeconds = 3600;
const minTtlSeconds = 1;

export type AuthRedis = {
  getSession(tokenHash: string): Promise<SessionCacheValue | undefined>;
  setSession(tokenHash: string, value: SessionCacheValue, ttlSeconds: number): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  setSocketTicket(ticket: string, userId: string): Promise<boolean>;
};

export type AuthTransaction = <T>(callback: (tx: DbExecutor) => Promise<T>) => Promise<T>;

export class AuthLogic {
  constructor(
    private authRepo: AuthRepo,
    private userRepo: UserRepo,
    private seatsRepo: SeatsRepo,
    private redis: AuthRedis,
    private runTransaction: AuthTransaction,
  ) {}

  async resolveSession(input: ResolveSessionInput): Promise<ResolveSessionResult> {
    const rawToken = input.rawToken;
    if (rawToken === undefined) {
      return this.missingOrDead(input.createIfMissing, input.now);
    }
    const tokenHash = await this.hashToken(rawToken);
    const cached = await this.readSessionCache(tokenHash);
    const loaded = await this.loadSessionAndUser(tokenHash, cached);
    if (loaded === undefined) {
      return this.missingOrDead(input.createIfMissing, input.now, tokenHash);
    }
    const { session, user } = loaded;
    if (session.isExpired) {
      await this.dropSessionCache(tokenHash);
      return this.missingOrDead(input.createIfMissing, input.now);
    }
    const seated = await this.userIsSeated(user.uuid);
    if (this.isPastIdentityWindow(user.createdAt, input.now) && !seated) {
      await this.authRepo.update(session.id, { isExpired: true, updatedAt: input.now });
      await this.dropSessionCache(tokenHash);
      return this.missingOrDead(input.createIfMissing, input.now);
    }
    const pastWindowSeated = this.isPastIdentityWindow(user.createdAt, input.now) && seated;
    const ttlSeconds = this.sessionTtlSeconds(user.createdAt, input.now, seated);
    if (!pastWindowSeated) {
      await this.authRepo.update(session.id, { lastSeenAt: input.now, updatedAt: input.now });
    }
    await this.writeSessionCache(
      tokenHash,
      { userId: user.uuid, sessionId: session.id },
      ttlSeconds,
    );
    return {
      userId: user.uuid,
      sessionId: session.id,
      rawToken,
      refreshCookie: pastWindowSeated,
      cookieMaxAgeSeconds: ttlSeconds,
    };
  }

  async mintSocketTicket(userId: string): Promise<SocketTicketResult> {
    const ticket = this.randomToken();
    const stored = await this.writeSocketTicket(ticket, userId);
    if (!stored) {
      return { error: ApiError.RedisUnavailable, status: HttpStatus.ServiceUnavailable };
    }
    return { ticket };
  }

  private async loadSessionAndUser(
    tokenHash: string,
    cached: SessionCacheValue | undefined,
  ): Promise<{ session: SessionRow; user: UserRow } | undefined> {
    if (cached !== undefined) {
      const session = await this.authRepo.findById(cached.sessionId);
      const user =
        session === undefined ? undefined : await this.userRepo.findByUuid(session.userId);
      if (
        session === undefined ||
        user === undefined ||
        session.tokenHash !== tokenHash ||
        session.userId !== cached.userId ||
        user.uuid !== cached.userId
      ) {
        return undefined;
      }
      return { session, user };
    }
    const session = await this.authRepo.findByTokenHash(tokenHash);
    const user = session === undefined ? undefined : await this.userRepo.findByUuid(session.userId);
    if (session === undefined || user === undefined) {
      return undefined;
    }
    return { session, user };
  }

  private async missingOrDead(
    createIfMissing: boolean,
    now: Date,
    tokenHash?: string,
  ): Promise<ResolveSessionResult> {
    if (tokenHash !== undefined) {
      await this.dropSessionCache(tokenHash);
    }
    if (!createIfMissing) {
      return { error: ApiError.Unauthorized, status: HttpStatus.Unauthorized };
    }
    return this.createPlayer(now);
  }

  private async createPlayer(now: Date): Promise<ResolveSessionOk> {
    const rawToken = this.randomToken();
    const tokenHash = await this.hashToken(rawToken);
    const created = await this.runTransaction(async (tx) => {
      const user = await this.userRepo.insert({ createdAt: now, updatedAt: now }, tx);
      const session = await this.authRepo.insert(
        {
          userId: user.uuid,
          tokenHash,
          isExpired: false,
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
        },
        tx,
      );
      return { user, session };
    });
    const ttlSeconds = this.sessionTtlSeconds(created.user.createdAt, now, false);
    await this.writeSessionCache(
      tokenHash,
      { userId: created.user.uuid, sessionId: created.session.id },
      ttlSeconds,
    );
    return {
      userId: created.user.uuid,
      sessionId: created.session.id,
      rawToken,
      refreshCookie: true,
      cookieMaxAgeSeconds: ttlSeconds,
    };
  }

  private async hashToken(rawToken: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
    return bytesToHex(new Uint8Array(digest));
  }

  private randomToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
  }

  private isPastIdentityWindow(createdAt: Date, now: Date): boolean {
    return now.getTime() >= createdAt.getTime() + identityWindowMs;
  }

  private sessionTtlSeconds(createdAt: Date, now: Date, seated: boolean): number {
    if (seated && this.isPastIdentityWindow(createdAt, now)) {
      return seatedPastWindowTtlSeconds;
    }
    const remainingMs = createdAt.getTime() + identityWindowMs - now.getTime();
    return Math.max(minTtlSeconds, Math.floor(remainingMs / 1000));
  }

  private async userIsSeated(userId: string): Promise<boolean> {
    const seated = await this.seatsRepo.findByUserId(userId);
    return seated.length > 0;
  }

  private async readSessionCache(tokenHash: string): Promise<SessionCacheValue | undefined> {
    try {
      return await this.redis.getSession(tokenHash);
    } catch {
      return undefined;
    }
  }

  private async writeSessionCache(
    tokenHash: string,
    value: SessionCacheValue,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.setSession(tokenHash, value, ttlSeconds);
    } catch {
      // Postgres is the source of truth for sessions.
    }
  }

  private async dropSessionCache(tokenHash: string): Promise<void> {
    try {
      await this.redis.deleteSession(tokenHash);
    } catch {
      // Postgres is the source of truth for sessions.
    }
  }

  private async writeSocketTicket(ticket: string, userId: string): Promise<boolean> {
    try {
      return await this.redis.setSocketTicket(ticket, userId);
    } catch {
      return false;
    }
  }
}

export { isResolveSessionErr, isSocketTicketErr };

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
