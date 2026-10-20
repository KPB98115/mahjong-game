import { parseSessionCacheValue, type SessionCacheValue } from "../../../model/server/sessionCache";
import { redisDel, redisGet, redisSetEx } from "./client";
import { sessionCacheKey } from "./keys";

export async function getCachedSession(tokenHash: string): Promise<SessionCacheValue | undefined> {
  try {
    const raw = await redisGet(sessionCacheKey(tokenHash));
    if (raw === null) {
      return undefined;
    }
    return parseSessionCacheValue(raw);
  } catch {
    return undefined;
  }
}

export async function setCachedSession(
  tokenHash: string,
  value: SessionCacheValue,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redisSetEx(sessionCacheKey(tokenHash), JSON.stringify(value), ttlSeconds);
  } catch {
    // Postgres is the source of truth for sessions.
  }
}

export async function deleteCachedSession(tokenHash: string): Promise<void> {
  try {
    await redisDel(sessionCacheKey(tokenHash));
  } catch {
    // Postgres is the source of truth for sessions.
  }
}
