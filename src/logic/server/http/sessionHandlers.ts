import { type Context } from "hono";
import { sessionResponseSchema } from "../../../model/server/actionResult";
import { ApiError, HttpStatus } from "../../../types/server/api";
import { isResolveSessionErr, isSocketTicketErr } from "../../../types/server/auth";
import { type AuthLogic } from "../auth/authLogic";
import { type GamesLogic } from "../game/gamesLogic";
import { type SnapshotResult } from "../game/loadGameSnapshot";
import { type SeatsLogic } from "../game/seatsLogic";
import { isUpsertAttributesErr, type UserLogic } from "../user/userLogic";
import { isGameActionErr } from "./apiFailure";
import { failedEnvelope, successEnvelope } from "./envelope";
import { isUuid } from "./isUuid";
import { readJsonBody } from "./readJsonBody";
import { requireLiveSession } from "./requireLiveSession";
import { readSessionCookie, writeSessionCookie } from "./sessionCookie";

export async function postSession(c: Context, authLogic: AuthLogic, now: Date): Promise<Response> {
  const resolved = await authLogic.resolveSession({
    rawToken: readSessionCookie(c),
    createIfMissing: true,
    now,
  });
  if (isResolveSessionErr(resolved)) {
    return c.json(failedEnvelope(resolved.error), resolved.status);
  }
  writeSessionCookie(c, resolved.rawToken, resolved.cookieMaxAgeSeconds);
  return c.json(
    successEnvelope(sessionResponseSchema.parse({ userId: resolved.userId })),
    HttpStatus.Ok,
  );
}

export async function getMe(
  c: Context,
  authLogic: AuthLogic,
  userLogic: UserLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  const profile = await userLogic.loadProfile(session.userId);
  return c.json(successEnvelope(profile), HttpStatus.Ok);
}

export async function patchMe(
  c: Context,
  authLogic: AuthLogic,
  userLogic: UserLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  const body = await readJsonBody(c);
  if (!body.ok) {
    return c.json(failedEnvelope(ApiError.InvalidBody), HttpStatus.UnprocessableEntity);
  }
  const result = await userLogic.upsertAttributes(session.userId, body.value);
  if (isUpsertAttributesErr(result)) {
    return c.json(failedEnvelope(result.error), result.status);
  }
  return c.json(successEnvelope(result.profile), HttpStatus.Ok);
}

export async function postSocketTicket(
  c: Context,
  authLogic: AuthLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  const ticket = await authLogic.mintSocketTicket(session.userId);
  if (isSocketTicketErr(ticket)) {
    return c.json(failedEnvelope(ticket.error), ticket.status);
  }
  return c.json(successEnvelope({ ticket: ticket.ticket }), HttpStatus.Ok);
}

export async function postGame(
  c: Context,
  authLogic: AuthLogic,
  gamesLogic: GamesLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  const body = await readJsonBody(c);
  if (!body.ok) {
    return c.json(failedEnvelope(ApiError.InvalidBody), HttpStatus.UnprocessableEntity);
  }
  return snapshotResponse(c, await gamesLogic.create(session.userId, body.value));
}

export async function postJoinGame(
  c: Context,
  authLogic: AuthLogic,
  seatsLogic: SeatsLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  const body = await readJsonBody(c);
  if (!body.ok) {
    return c.json(failedEnvelope(ApiError.InvalidBody), HttpStatus.UnprocessableEntity);
  }
  return snapshotResponse(c, await seatsLogic.join(session.userId, body.value, now));
}

export async function getGame(
  c: Context,
  gameId: string,
  authLogic: AuthLogic,
  gamesLogic: GamesLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  if (!isUuid(gameId)) {
    return c.json(failedEnvelope(ApiError.GameNotFound), HttpStatus.NotFound);
  }
  return snapshotResponse(c, await gamesLogic.snapshot(gameId, session.userId));
}

export async function postNextWind(
  c: Context,
  gameId: string,
  authLogic: AuthLogic,
  gamesLogic: GamesLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  if (!isUuid(gameId)) {
    return c.json(failedEnvelope(ApiError.GameNotFound), HttpStatus.NotFound);
  }
  return snapshotResponse(c, await gamesLogic.agreeNextWind(gameId, session.userId, now));
}

export async function postAbortGame(
  c: Context,
  gameId: string,
  authLogic: AuthLogic,
  gamesLogic: GamesLogic,
  now: Date,
): Promise<Response> {
  const session = await requireLiveSession(c, authLogic, now);
  if (!session.ok) {
    return session.response;
  }
  if (!isUuid(gameId)) {
    return c.json(failedEnvelope(ApiError.GameNotAbortable), HttpStatus.Conflict);
  }
  const result = await gamesLogic.abort(gameId, session.userId, now);
  if (isGameActionErr(result)) {
    return c.json(failedEnvelope(result.error), result.status);
  }
  return c.json(successEnvelope(result), HttpStatus.Ok);
}

function snapshotResponse(c: Context, result: SnapshotResult): Response {
  if (isGameActionErr(result)) {
    return c.json(failedEnvelope(result.error), result.status);
  }
  return c.json(successEnvelope(result.snapshot), HttpStatus.Ok);
}
