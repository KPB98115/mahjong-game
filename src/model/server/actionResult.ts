import { z } from "zod";
import { ApiError, ApiStatus, HttpStatus } from "../../types/server/api";

export const actionErrorSchema = z.object({
  error: z.enum(ApiError),
  status: z.union([
    z.literal(HttpStatus.Unauthorized),
    z.literal(HttpStatus.Forbidden),
    z.literal(HttpStatus.NotFound),
    z.literal(HttpStatus.Conflict),
    z.literal(HttpStatus.UnprocessableEntity),
    z.literal(HttpStatus.ServiceUnavailable),
  ]),
});

export const resolveSessionOkSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  rawToken: z.string(),
  refreshCookie: z.boolean(),
  cookieMaxAgeSeconds: z.number(),
});

export const sessionResponseSchema = z.object({
  userId: z.string(),
});

export const socketTicketSchema = z.object({
  ticket: z.string(),
});

export const abortGameResponseSchema = z.object({
  aborted: z.literal(true),
});

export const apiFailureSchema = z.object({
  status: z.literal(ApiStatus.Failed),
  error: z.enum(ApiError),
});

export type GameActionErr = z.infer<typeof actionErrorSchema>;
export type ResolveSessionOk = z.infer<typeof resolveSessionOkSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SocketTicketOk = z.infer<typeof socketTicketSchema>;
export type AbortGameResponse = z.infer<typeof abortGameResponseSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;
