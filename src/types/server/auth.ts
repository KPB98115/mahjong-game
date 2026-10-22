import {
  type GameActionErr,
  type ResolveSessionOk,
  type SocketTicketOk,
} from "../../model/server/actionResult";

export enum CookieName {
  Session = "session",
}

export type ResolveSessionInput = {
  rawToken: string | undefined;
  createIfMissing: boolean;
  now: Date;
};

export type ResolveSessionResult = ResolveSessionOk | GameActionErr;

export type SocketTicketResult = SocketTicketOk | GameActionErr;

export function isResolveSessionErr(result: ResolveSessionResult): result is GameActionErr {
  return "error" in result;
}

export function isSocketTicketErr(result: SocketTicketResult): result is GameActionErr {
  return "error" in result;
}
