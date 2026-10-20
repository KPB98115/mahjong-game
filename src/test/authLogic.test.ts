import { describe, expect, it } from "vitest";
import { isResolveSessionErr, isSocketTicketErr } from "../logic/server/auth/authLogic";
import { ApiError, HttpStatus } from "../types/server/api";
import {
  createAuthLogicForTest,
  createMemoryAuth,
  identityWindowMs,
  isBase64Url,
  seatedPastWindowTtlSeconds,
  sha256Hex,
} from "./fakeAuth";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const nowInsideWindow = new Date("2026-01-01T12:00:00.000Z");
const nowAtDeadline = new Date(createdAt.getTime() + identityWindowMs);
const rawToken = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("AuthLogic.resolveSession", () => {
  it("returns unauthorized 401 when the token is missing and createIfMissing is false", async () => {
    const { logic, auth } = createAuthLogicForTest();
    const result = await logic.resolveSession({
      rawToken: undefined,
      createIfMissing: false,
      now: nowInsideWindow,
    });
    expect(isResolveSessionErr(result)).toBe(true);
    if (!isResolveSessionErr(result)) {
      return;
    }
    expect(result.error).toBe(ApiError.Unauthorized);
    expect(result.status).toBe(HttpStatus.Unauthorized);
    expect(auth.insertOrder).toEqual([]);
  });

  it("mints a user then a session in one transaction when createIfMissing is true", async () => {
    const { logic, auth, redis } = createAuthLogicForTest();
    const result = await logic.resolveSession({
      rawToken: undefined,
      createIfMissing: true,
      now: createdAt,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    if (isResolveSessionErr(result)) {
      return;
    }
    expect(auth.insertOrder).toEqual(["tx", "user", "session"]);
    expect(result.refreshCookie).toBe(true);
    expect(result.cookieMaxAgeSeconds).toBe(86400);
    expect(result.rawToken).toHaveLength(43);
    expect(isBase64Url(result.rawToken)).toBe(true);
    const session = [...auth.sessions.values()][0];
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }
    expect(session.tokenHash).toBe(await sha256Hex(result.rawToken));
    expect(session.tokenHash).not.toBe(result.rawToken);
    expect(session.tokenHash).toBe(session.tokenHash.toLowerCase());
    expect(session.tokenHash).toHaveLength(64);
    expect(redis.sessions.get(session.tokenHash)?.value).toEqual({
      userId: result.userId,
      sessionId: result.sessionId,
    });
  });

  it("loads postgres by token hash on a redis miss and refills the cache with remaining ttl", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: false,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    const { logic, redis } = createAuthLogicForTest(auth);
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowInsideWindow,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    if (isResolveSessionErr(result)) {
      return;
    }
    expect(result.userId).toBe("user-1");
    expect(result.refreshCookie).toBe(false);
    expect(result.cookieMaxAgeSeconds).toBe(12 * 60 * 60);
    expect(auth.sessions.get("session-1")?.lastSeenAt).toEqual(nowInsideWindow);
    expect(redis.sessions.get(tokenHash)?.ttlSeconds).toBe(12 * 60 * 60);
  });

  it("uses findById when redis has a matching cache entry", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: false,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    let findByTokenHashCalls = 0;
    const originalFindByTokenHash = auth.authRepo.findByTokenHash.bind(auth.authRepo);
    auth.authRepo.findByTokenHash = async (hash) => {
      findByTokenHashCalls += 1;
      return originalFindByTokenHash(hash);
    };
    const { logic, redis } = createAuthLogicForTest(auth);
    redis.sessions.set(tokenHash, {
      value: { userId: "user-1", sessionId: "session-1" },
      ttlSeconds: 10,
    });
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowInsideWindow,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    expect(findByTokenHashCalls).toBe(0);
  });

  it("treats a redis cache mismatch as a dead token", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash: "other-hash",
      isExpired: false,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    const { logic, redis } = createAuthLogicForTest(auth);
    redis.sessions.set(tokenHash, {
      value: { userId: "user-1", sessionId: "session-1" },
      ttlSeconds: 10,
    });
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowInsideWindow,
    });
    expect(isResolveSessionErr(result)).toBe(true);
    if (!isResolveSessionErr(result)) {
      return;
    }
    expect(result.error).toBe(ApiError.Unauthorized);
    expect(redis.deleted).toContain(tokenHash);
  });

  it("drops redis and treats isExpired sessions as dead without minting", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: true,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    const { logic, redis } = createAuthLogicForTest(auth);
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowInsideWindow,
    });
    expect(isResolveSessionErr(result)).toBe(true);
    expect(auth.insertOrder).toEqual([]);
    expect(redis.deleted).toContain(tokenHash);
  });

  it("expires identity from users.createdAt after one day when the user is not seated", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: false,
      createdAt: nowAtDeadline,
      updatedAt: nowAtDeadline,
      lastSeenAt: nowAtDeadline,
    });
    const { logic, redis } = createAuthLogicForTest(auth);
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowAtDeadline,
    });
    expect(isResolveSessionErr(result)).toBe(true);
    expect(auth.sessions.get("session-1")?.isExpired).toBe(true);
    expect(redis.deleted).toContain(tokenHash);
  });

  it("keeps the uuid and refreshes ttl to 3600s when seated past the one-day window", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: false,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    auth.seatedUserIds.add("user-1");
    const { logic, redis } = createAuthLogicForTest(auth);
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowAtDeadline,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    if (isResolveSessionErr(result)) {
      return;
    }
    expect(result.userId).toBe("user-1");
    expect(result.refreshCookie).toBe(true);
    expect(result.cookieMaxAgeSeconds).toBe(seatedPastWindowTtlSeconds);
    expect(auth.sessions.get("session-1")?.isExpired).toBe(false);
    expect(redis.sessions.get(tokenHash)?.ttlSeconds).toBe(seatedPastWindowTtlSeconds);
  });

  it("uses a ttl of at least 1 second while the identity window is still open", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    const almostExpired = new Date(createdAt.getTime() + identityWindowMs - 400);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: false,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    const { logic, redis } = createAuthLogicForTest(auth);
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: almostExpired,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    if (isResolveSessionErr(result)) {
      return;
    }
    expect(result.cookieMaxAgeSeconds).toBe(1);
    expect(redis.sessions.get(tokenHash)?.ttlSeconds).toBe(1);
  });

  it("continues from postgres when session cache redis reads or writes fail", async () => {
    const auth = createMemoryAuth();
    const tokenHash = await sha256Hex(rawToken);
    auth.users.set("user-1", { uuid: "user-1", createdAt, updatedAt: createdAt });
    auth.sessions.set("session-1", {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      isExpired: false,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: createdAt,
    });
    const { logic, redis } = createAuthLogicForTest(auth);
    redis.failGet = true;
    redis.failSet = true;
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: false,
      now: nowInsideWindow,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    if (isResolveSessionErr(result)) {
      return;
    }
    expect(result.userId).toBe("user-1");
  });

  it("mints a new player for a dead token when createIfMissing is true", async () => {
    const { logic, auth } = createAuthLogicForTest();
    const result = await logic.resolveSession({
      rawToken,
      createIfMissing: true,
      now: createdAt,
    });
    expect(isResolveSessionErr(result)).toBe(false);
    if (isResolveSessionErr(result)) {
      return;
    }
    expect(result.userId).toBe("user-1");
    expect(result.refreshCookie).toBe(true);
    expect(auth.users.size).toBe(1);
  });
});

describe("AuthLogic.mintSocketTicket", () => {
  it("stores a new random ticket for 60 seconds and does not reuse the session token", async () => {
    const { logic, redis } = createAuthLogicForTest();
    const minted = await logic.resolveSession({
      rawToken: undefined,
      createIfMissing: true,
      now: createdAt,
    });
    expect(isResolveSessionErr(minted)).toBe(false);
    if (isResolveSessionErr(minted)) {
      return;
    }
    const first = await logic.mintSocketTicket(minted.userId);
    const second = await logic.mintSocketTicket(minted.userId);
    expect(isSocketTicketErr(first)).toBe(false);
    expect(isSocketTicketErr(second)).toBe(false);
    if (isSocketTicketErr(first) || isSocketTicketErr(second)) {
      return;
    }
    expect(first.ticket).not.toBe(minted.rawToken);
    expect(second.ticket).not.toBe(first.ticket);
    expect(first.ticket).toHaveLength(43);
    expect(isBase64Url(first.ticket)).toBe(true);
    expect(redis.tickets.get(first.ticket)).toEqual({ userId: minted.userId, ttlSeconds: 60 });
  });

  it("returns redisUnavailable 503 when the ticket cannot be written", async () => {
    const { logic, redis } = createAuthLogicForTest();
    redis.failTicket = true;
    const result = await logic.mintSocketTicket("user-1");
    expect(isSocketTicketErr(result)).toBe(true);
    if (!isSocketTicketErr(result)) {
      return;
    }
    expect(result.error).toBe(ApiError.RedisUnavailable);
    expect(result.status).toBe(HttpStatus.ServiceUnavailable);
  });
});
