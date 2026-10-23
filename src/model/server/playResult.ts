import { z } from "zod";
import { type EmitTarget } from "../../types/server/emitTarget";
import { MeldType } from "../../types/server/meldType";
import { RoundPhase } from "../../types/server/roundPhase";
import { RoundResultType } from "../../types/server/roundResultType";
import { type SocketError } from "../../types/server/socketError";
import { type SocketEvent } from "../../types/server/socketEvent";
import { WinKind } from "../../types/server/winKind";
import { gameSnapshotSchema, roundScoreSchema, scorePaymentSchema } from "./gameSnapshot";

export const gameActionSchema = z.object({
  gameId: z.uuid(),
});

export const discardActionSchema = z.object({
  gameId: z.uuid(),
  tileId: z.uuid(),
});

export const claimActionSchema = z.object({
  gameId: z.uuid(),
  kind: z.enum(MeldType),
  tileIds: z.array(z.uuid()),
});

export const joinedPayloadSchema = z.object({
  gameId: z.string(),
  seatIndex: z.number(),
});

export const selfHandPayloadSchema = z.object({
  tiles: z.array(
    z.object({
      tileId: z.string(),
      tileCode: z.string(),
      sortIndex: z.number(),
      isDrawn: z.boolean(),
    }),
  ),
});

export const drewPayloadSchema = z.object({
  tile: z.object({
    tileId: z.string(),
    tileCode: z.string(),
    isDrawn: z.literal(true),
  }),
  wallCount: z.number(),
  flowers: z.array(z.object({ tileCode: z.string() })),
});

export const publicStatePayloadSchema = gameSnapshotSchema.omit({ self: true });

export const discardedPayloadSchema = z.object({
  seatIndex: z.number(),
  tileCode: z.string(),
  tileId: z.string(),
});

export const claimWindowPayloadSchema = z.object({
  discardSeatIndex: z.number(),
  tileCode: z.string(),
  timeoutMs: z.number().nullable(),
});

export const claimedPayloadSchema = z.object({
  seatIndex: z.number(),
  kind: z.enum(MeldType),
  tileCodes: z.array(z.string()),
});

export const turnPayloadSchema = z.object({
  currentSeatIndex: z.number(),
  phase: z.enum(RoundPhase),
});

export const roundEndedPayloadSchema = z.object({
  resultType: z.enum(RoundResultType),
  winKind: z.enum(WinKind).nullable(),
  winnerSeatIndex: z.number().nullable(),
  scores: z.array(roundScoreSchema),
  payments: z.array(scorePaymentSchema),
});

export const presencePayloadSchema = z.object({
  seatIndex: z.number(),
  connected: z.boolean(),
});

export type GameAction = z.infer<typeof gameActionSchema>;
export type DiscardAction = z.infer<typeof discardActionSchema>;
export type ClaimAction = z.infer<typeof claimActionSchema>;
export type JoinedPayload = z.infer<typeof joinedPayloadSchema>;
export type SelfHandPayload = z.infer<typeof selfHandPayloadSchema>;
export type SelfHandTile = SelfHandPayload["tiles"][number];
export type DrewPayload = z.infer<typeof drewPayloadSchema>;
export type PublicStatePayload = z.infer<typeof publicStatePayloadSchema>;
export type DiscardedPayload = z.infer<typeof discardedPayloadSchema>;
export type ClaimWindowPayload = z.infer<typeof claimWindowPayloadSchema>;
export type ClaimedPayload = z.infer<typeof claimedPayloadSchema>;
export type TurnPayload = z.infer<typeof turnPayloadSchema>;
export type RoundEndedPayload = z.infer<typeof roundEndedPayloadSchema>;
export type PresencePayload = z.infer<typeof presencePayloadSchema>;

type SeatEmit<Event extends SocketEvent, Payload> = {
  event: Event;
  target: EmitTarget.Seat;
  seatIndex: number;
  payload: Payload;
};

type RoomEmit<Event extends SocketEvent, Payload> = {
  event: Event;
  target: EmitTarget.Room;
  payload: Payload;
};

export type PlayEmit =
  | SeatEmit<SocketEvent.Joined, JoinedPayload>
  | SeatEmit<SocketEvent.SelfHand, SelfHandPayload>
  | SeatEmit<SocketEvent.Drew, DrewPayload>
  | RoomEmit<SocketEvent.PublicState, PublicStatePayload>
  | RoomEmit<SocketEvent.Discarded, DiscardedPayload>
  | RoomEmit<SocketEvent.ClaimWindow, ClaimWindowPayload>
  | RoomEmit<SocketEvent.Claimed, ClaimedPayload>
  | RoomEmit<SocketEvent.Turn, TurnPayload>
  | RoomEmit<SocketEvent.RoundEnded, RoundEndedPayload>
  | RoomEmit<SocketEvent.Presence, PresencePayload>;

export type PlayResult = {
  gameId: string;
  emits: PlayEmit[];
};

export type PlayOutcome = { ok: true; result: PlayResult } | { ok: false; error: SocketError };
