import { type ApiError, type HttpStatus } from "./api";

export enum CookieName {
  Session = "session",
}

export type ResolveSessionInput = {
  rawToken: string | undefined;
  createIfMissing: boolean;
  now: Date;
};

export type ResolveSessionOk = {
  userId: string;
  sessionId: string;
  rawToken: string;
  refreshCookie: boolean;
  cookieMaxAgeSeconds: number;
};

export type ResolveSessionErr = {
  error: ApiError;
  status: HttpStatus;
};

export type ResolveSessionResult = ResolveSessionOk | ResolveSessionErr;

export type SessionResponse = {
  userId: string;
};

export type SocketTicketOk = {
  ticket: string;
};

export type SocketTicketErr = {
  error: ApiError;
  status: HttpStatus;
};

export type SocketTicketResult = SocketTicketOk | SocketTicketErr;

export function isResolveSessionErr(result: ResolveSessionResult): result is ResolveSessionErr {
  return "error" in result;
}

export function isSocketTicketErr(result: SocketTicketResult): result is SocketTicketErr {
  return "error" in result;
}
