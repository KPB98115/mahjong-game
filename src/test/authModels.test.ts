import { describe, expect, it } from "vitest";
import { sessionCacheKey, socketTicketKey } from "../logic/server/redis/keys";
import { patchMeBodySchema } from "../model/server/playerProfile";
import { parseSessionCacheValue } from "../model/server/sessionCache";
import { CookieName } from "../types/server/auth";
import { RedisKeyPrefix } from "../types/server/redis";

describe("session cache json", () => {
  it("parses camelCase userId and sessionId", () => {
    expect(
      parseSessionCacheValue(JSON.stringify({ userId: "user-1", sessionId: "session-1" })),
    ).toEqual({
      userId: "user-1",
      sessionId: "session-1",
    });
  });

  it("treats corrupt, non-json, and snake_case payloads as a cache miss", () => {
    expect(parseSessionCacheValue("{")).toBeUndefined();
    expect(
      parseSessionCacheValue(JSON.stringify({ user_id: "user-1", session_id: "session-1" })),
    ).toBeUndefined();
    expect(
      parseSessionCacheValue(JSON.stringify({ userId: 1, sessionId: "session-1" })),
    ).toBeUndefined();
    expect(parseSessionCacheValue(JSON.stringify({ userId: "user-1" }))).toBeUndefined();
  });
});

describe("patch me body", () => {
  it("guards structure only and leaves displayName rules to UserLogic", () => {
    expect(patchMeBodySchema.safeParse({ attributes: { displayName: "" } }).success).toBe(true);
    expect(patchMeBodySchema.safeParse({ attributes: { locale: "en" } }).success).toBe(true);
    expect(patchMeBodySchema.safeParse({ attributes: { displayName: 1 } }).success).toBe(false);
    expect(patchMeBodySchema.safeParse({ displayName: "Kingston" }).success).toBe(false);
  });
});

describe("auth redis keys and cookie name", () => {
  it("uses the locked cookie name and redis key prefixes", () => {
    expect(CookieName.Session).toBe("session");
    expect(sessionCacheKey("abc")).toBe(`${RedisKeyPrefix.AuthSession}abc`);
    expect(sessionCacheKey("abc")).toBe("auth:session:abc");
    expect(socketTicketKey("ticket-1")).toBe("auth:socket_ticket:ticket-1");
  });
});
