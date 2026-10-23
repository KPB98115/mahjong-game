import { db } from "void/db";
import { AuthLogic, type AuthRedis, type AuthTransaction } from "../logic/server/auth/authLogic";
import { type AuthRepo } from "../logic/server/auth/authRepo";
import { type SeatRow, type SeatsRepo } from "../logic/server/game/seatsRepo";
import { type UserRepo } from "../logic/server/user/userRepo";
import { type SessionCacheValue } from "../model/server/sessionCache";

export type FakeUser = {
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeSession = {
  id: string;
  userId: string;
  tokenHash: string;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
};

export type FakeAttribute = {
  id: string;
  userId: string;
  name: string;
  value: string;
};

export type FakeFigure = {
  id: string;
  userId: string;
  name: string;
  value: string;
};

export const identityWindowMs = 24 * 60 * 60 * 1000;
export const seatedPastWindowTtlSeconds = 3600;

export type MemoryRedis = {
  sessions: Map<string, { value: SessionCacheValue; ttlSeconds: number }>;
  tickets: Map<string, { userId: string; ttlSeconds: number }>;
  deleted: string[];
  failGet: boolean;
  failSet: boolean;
  failDelete: boolean;
  failTicket: boolean;
  redis: AuthRedis;
};

export function createMemoryRedis(): MemoryRedis {
  const sessions = new Map<string, { value: SessionCacheValue; ttlSeconds: number }>();
  const tickets = new Map<string, { userId: string; ttlSeconds: number }>();
  const deleted: string[] = [];
  const memory: MemoryRedis = {
    sessions,
    tickets,
    deleted,
    failGet: false,
    failSet: false,
    failDelete: false,
    failTicket: false,
    redis: {
      async getSession(tokenHash) {
        if (memory.failGet) {
          throw new Error("redis get failed");
        }
        return sessions.get(tokenHash)?.value;
      },
      async setSession(tokenHash, value, ttlSeconds) {
        if (memory.failSet) {
          throw new Error("redis set failed");
        }
        sessions.set(tokenHash, { value, ttlSeconds });
      },
      async deleteSession(tokenHash) {
        if (memory.failDelete) {
          throw new Error("redis delete failed");
        }
        sessions.delete(tokenHash);
        deleted.push(tokenHash);
      },
      async setSocketTicket(ticket, userId) {
        if (memory.failTicket) {
          throw new Error("redis ticket failed");
        }
        tickets.set(ticket, { userId, ttlSeconds: 60 });
        return true;
      },
    },
  };
  return memory;
}

export type MemoryAuth = {
  insertOrder: string[];
  users: Map<string, FakeUser>;
  sessions: Map<string, FakeSession>;
  seatedUserIds: Set<string>;
  figures: FakeFigure[];
  authRepo: AuthRepo;
  userRepo: UserRepo;
  seatsRepo: SeatsRepo;
  runTransaction: AuthTransaction;
};

export function createMemoryAuth(): MemoryAuth {
  const insertOrder: string[] = [];
  const users = new Map<string, FakeUser>();
  const sessions = new Map<string, FakeSession>();
  const seatedUserIds = new Set<string>();
  const attributes: FakeAttribute[] = [];
  const figures: FakeFigure[] = [];
  let userCount = 0;
  let sessionCount = 0;

  const authRepo: AuthRepo = {
    database: db,
    async insert(values) {
      insertOrder.push("session");
      sessionCount += 1;
      const row: FakeSession = {
        id: `session-${sessionCount}`,
        userId: values.userId,
        tokenHash: values.tokenHash,
        isExpired: values.isExpired ?? false,
        createdAt: values.createdAt ?? new Date(),
        updatedAt: values.updatedAt ?? new Date(),
        lastSeenAt: values.lastSeenAt ?? new Date(),
      };
      sessions.set(row.id, row);
      return row;
    },
    async findById(id) {
      return sessions.get(id);
    },
    async findByTokenHash(tokenHash) {
      for (const row of sessions.values()) {
        if (row.tokenHash === tokenHash) {
          return row;
        }
      }
      return undefined;
    },
    async update(id, values) {
      const row = sessions.get(id);
      if (row == null) {
        return undefined;
      }
      const updated: FakeSession = { ...row, ...values };
      sessions.set(id, updated);
      return updated;
    },
  };
  const userRepo: UserRepo = {
    database: db,
    async insert(values = {}) {
      insertOrder.push("user");
      userCount += 1;
      const row: FakeUser = {
        uuid: `user-${userCount}`,
        createdAt: values.createdAt ?? new Date(),
        updatedAt: values.updatedAt ?? new Date(),
      };
      users.set(row.uuid, row);
      return row;
    },
    async findByUuid(uuid) {
      return users.get(uuid);
    },
    async listAttributes(userId) {
      return attributes.filter((row) => row.userId === userId);
    },
    async listFigures(userId) {
      return figures.filter((row) => row.userId === userId);
    },
    async upsertAttribute(userId, name, value) {
      const existing = attributes.find((row) => row.userId === userId && row.name === name);
      if (existing != null) {
        existing.value = value;
        return existing;
      }
      const row: FakeAttribute = { id: `attr-${attributes.length + 1}`, userId, name, value };
      attributes.push(row);
      return row;
    },
    async upsertFigure(userId, name, value) {
      const existing = figures.find((row) => row.userId === userId && row.name === name);
      if (existing != null) {
        existing.value = value;
        return existing;
      }
      const row: FakeFigure = { id: `figure-${figures.length + 1}`, userId, name, value };
      figures.push(row);
      return row;
    },
  };
  const seatsRepo: SeatsRepo = {
    database: db,
    async insert(values) {
      const row: SeatRow = {
        id: values.id ?? `seat-${values.userId}`,
        gameId: values.gameId,
        seatIndex: values.seatIndex,
        userId: values.userId,
        runningScore: values.runningScore,
        nextWindAgreed: values.nextWindAgreed ?? false,
        botDifficulty: values.botDifficulty ?? null,
        createdAt: values.createdAt ?? new Date(),
      };
      seatedUserIds.add(values.userId);
      return row;
    },
    async findById() {
      return undefined;
    },
    async findByGameId() {
      return [];
    },
    async findByGameIdAndUserId() {
      return undefined;
    },
    async findByUserId(userId) {
      if (!seatedUserIds.has(userId)) {
        return [];
      }
      const row: SeatRow = {
        id: `seat-${userId}`,
        gameId: `game-${userId}`,
        seatIndex: 0,
        userId,
        runningScore: "0",
        nextWindAgreed: false,
        botDifficulty: null,
        createdAt: new Date(),
      };
      return [row];
    },
    async update() {
      return undefined;
    },
  };
  const memory: MemoryAuth = {
    insertOrder,
    users,
    sessions,
    seatedUserIds,
    figures,
    authRepo,
    userRepo,
    seatsRepo,
    async runTransaction(callback) {
      insertOrder.push("tx");
      return callback(db);
    },
  };
  return memory;
}

export function createAuthLogicForTest(
  auth = createMemoryAuth(),
  redis = createMemoryRedis(),
): {
  logic: AuthLogic;
  auth: MemoryAuth;
  redis: MemoryRedis;
} {
  return {
    logic: new AuthLogic(
      auth.authRepo,
      auth.userRepo,
      auth.seatsRepo,
      redis.redis,
      auth.runTransaction,
    ),
    auth,
    redis,
  };
}

export async function sha256Hex(rawToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function isBase64Url(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  for (const character of value) {
    const isUpper = character >= "A" && character <= "Z";
    const isLower = character >= "a" && character <= "z";
    const isDigit = character >= "0" && character <= "9";
    if (!isUpper && !isLower && !isDigit && character !== "-" && character !== "_") {
      return false;
    }
  }
  return true;
}

export function repeatCharacter(character: string, count: number): string {
  let value = "";
  for (let index = 0; index < count; index += 1) {
    value += character;
  }
  return value;
}

export function createUserRepoFake(initial?: {
  attributes?: FakeAttribute[];
  figures?: FakeFigure[];
}): {
  upserts: { userId: string; name: string; value: string }[];
  attributes: FakeAttribute[];
  figures: FakeFigure[];
  repo: UserRepo;
} {
  const attributes = initial?.attributes ?? [];
  const figures = initial?.figures ?? [];
  const upserts: { userId: string; name: string; value: string }[] = [];
  const repo: UserRepo = {
    database: db,
    async insert() {
      throw new Error("insert is not used by UserLogic");
    },
    async findByUuid() {
      return undefined;
    },
    async listAttributes() {
      return attributes;
    },
    async listFigures() {
      return figures;
    },
    async upsertAttribute(userId, name, value) {
      upserts.push({ userId, name, value });
      const existing = attributes.find((row) => row.userId === userId && row.name === name);
      if (existing != null) {
        existing.value = value;
        return existing;
      }
      const row: FakeAttribute = { id: `attr-${upserts.length}`, userId, name, value };
      attributes.push(row);
      return row;
    },
    async upsertFigure() {
      throw new Error("upsertFigure is not used by UserLogic");
    },
  };
  return {
    upserts,
    attributes,
    figures,
    repo,
  };
}
