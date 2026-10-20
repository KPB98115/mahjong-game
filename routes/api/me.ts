import { type Context } from "hono";
import { defineHandler } from "void";
import { isResolveSessionErr } from "../../src/logic/server/auth/authLogic";
import { createAuthLogic } from "../../src/logic/server/auth/createAuthLogic";
import { failedEnvelope, successEnvelope } from "../../src/logic/server/http/envelope";
import { readJsonBody } from "../../src/logic/server/http/readJsonBody";
import { readSessionCookie, writeSessionCookie } from "../../src/logic/server/http/sessionCookie";
import { createUserLogic } from "../../src/logic/server/user/createUserLogic";
import { isUpsertAttributesErr } from "../../src/logic/server/user/userLogic";
import { ApiError, HttpStatus } from "../../src/types/server/api";

async function requireLiveSession(c: Context) {
  const authLogic = createAuthLogic();
  const resolved = await authLogic.resolveSession({
    rawToken: readSessionCookie(c),
    createIfMissing: false,
    now: new Date(),
  });
  if (isResolveSessionErr(resolved)) {
    return { ok: false as const, error: resolved };
  }
  if (resolved.refreshCookie) {
    writeSessionCookie(c, resolved.rawToken, resolved.cookieMaxAgeSeconds);
  }
  return { ok: true as const, resolved };
}

export const GET = defineHandler(async (c) => {
  const session = await requireLiveSession(c);
  if (!session.ok) {
    return c.json(failedEnvelope(session.error.error), session.error.status);
  }
  const profile = await createUserLogic().loadProfile(session.resolved.userId);
  return c.json(successEnvelope(profile), HttpStatus.Ok);
});

export const PATCH = defineHandler(async (c) => {
  const session = await requireLiveSession(c);
  if (!session.ok) {
    return c.json(failedEnvelope(session.error.error), session.error.status);
  }
  const body = await readJsonBody(c);
  if (!body.ok) {
    return c.json(failedEnvelope(ApiError.InvalidBody), HttpStatus.UnprocessableEntity);
  }
  const result = await createUserLogic().upsertAttributes(session.resolved.userId, body.value);
  if (isUpsertAttributesErr(result)) {
    return c.json(failedEnvelope(result.error), result.status);
  }
  return c.json(successEnvelope(result.profile), HttpStatus.Ok);
});
