import { defineHandler } from "void";
import { isResolveSessionErr, isSocketTicketErr } from "../../src/logic/server/auth/authLogic";
import { createAuthLogic } from "../../src/logic/server/auth/createAuthLogic";
import { failedEnvelope, successEnvelope } from "../../src/logic/server/http/envelope";
import { readSessionCookie, writeSessionCookie } from "../../src/logic/server/http/sessionCookie";
import { HttpStatus } from "../../src/types/server/api";

export const POST = defineHandler(async (c) => {
  const authLogic = createAuthLogic();
  const resolved = await authLogic.resolveSession({
    rawToken: readSessionCookie(c),
    createIfMissing: false,
    now: new Date(),
  });
  if (isResolveSessionErr(resolved)) {
    return c.json(failedEnvelope(resolved.error), resolved.status);
  }
  if (resolved.refreshCookie) {
    writeSessionCookie(c, resolved.rawToken, resolved.cookieMaxAgeSeconds);
  }
  const ticket = await authLogic.mintSocketTicket(resolved.userId);
  if (isSocketTicketErr(ticket)) {
    return c.json(failedEnvelope(ticket.error), ticket.status);
  }
  return c.json(successEnvelope({ ticket: ticket.ticket }), HttpStatus.Ok);
});
