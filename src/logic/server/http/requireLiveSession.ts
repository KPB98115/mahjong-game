import { type Context } from "hono";
import { isResolveSessionErr } from "../../../types/server/auth";
import { type AuthLogic } from "../auth/authLogic";
import { failedEnvelope } from "./envelope";
import { readSessionCookie, writeSessionCookie } from "./sessionCookie";

export type LiveSession = { ok: true; userId: string } | { ok: false; response: Response };

export async function requireLiveSession(
  c: Context,
  authLogic: AuthLogic,
  now: Date,
): Promise<LiveSession> {
  const resolved = await authLogic.resolveSession({
    rawToken: readSessionCookie(c),
    createIfMissing: false,
    now,
  });
  if (isResolveSessionErr(resolved)) {
    return { ok: false, response: c.json(failedEnvelope(resolved.error), resolved.status) };
  }
  if (resolved.refreshCookie) {
    writeSessionCookie(c, resolved.rawToken, resolved.cookieMaxAgeSeconds);
  }
  return { ok: true, userId: resolved.userId };
}
