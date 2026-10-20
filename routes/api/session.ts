import { defineHandler } from "void";
import { isResolveSessionErr } from "../../src/logic/server/auth/authLogic";
import { createAuthLogic } from "../../src/logic/server/auth/createAuthLogic";
import { failedEnvelope, successEnvelope } from "../../src/logic/server/http/envelope";
import { readSessionCookie, writeSessionCookie } from "../../src/logic/server/http/sessionCookie";
import { HttpStatus } from "../../src/types/server/api";

export const POST = defineHandler(async (c) => {
  const authLogic = createAuthLogic();
  const resolved = await authLogic.resolveSession({
    rawToken: readSessionCookie(c),
    createIfMissing: true,
    now: new Date(),
  });
  if (isResolveSessionErr(resolved)) {
    return c.json(failedEnvelope(resolved.error), resolved.status);
  }
  writeSessionCookie(c, resolved.rawToken, resolved.cookieMaxAgeSeconds);
  return c.json(successEnvelope({ userId: resolved.userId }), HttpStatus.Ok);
});
