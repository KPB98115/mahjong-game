import {
  claimedPayloadSchema,
  claimWindowPayloadSchema,
  discardedPayloadSchema,
  drewPayloadSchema,
  joinedPayloadSchema,
  presencePayloadSchema,
  roundEndedPayloadSchema,
  selfHandPayloadSchema,
  turnPayloadSchema,
  type PlayEmit,
  type PublicStatePayload,
  type RoundEndedPayload,
} from "../../../model/server/playResult";
import { EmitTarget } from "../../../types/server/emitTarget";
import { type MeldType } from "../../../types/server/meldType";
import { type RoundPhase } from "../../../types/server/roundPhase";
import { SocketEvent } from "../../../types/server/socketEvent";
import { type HandTileRow } from "./handTilesRepo";

export function joinedEmit(gameId: string, seatIndex: number): PlayEmit {
  return {
    event: SocketEvent.Joined,
    target: EmitTarget.Seat,
    seatIndex,
    payload: joinedPayloadSchema.parse({ gameId, seatIndex }),
  };
}

export function selfHandEmit(seatIndex: number, tiles: HandTileRow[]): PlayEmit {
  return {
    event: SocketEvent.SelfHand,
    target: EmitTarget.Seat,
    seatIndex,
    payload: selfHandPayloadSchema.parse({
      tiles: tiles.map((tile) => ({
        tileId: tile.id,
        tileCode: tile.tileCode,
        sortIndex: tile.sortIndex,
        isDrawn: tile.isDrawn,
      })),
    }),
  };
}

export function drewEmit(
  seatIndex: number,
  tile: HandTileRow,
  wallCount: number,
  flowerCodes: string[],
): PlayEmit {
  return {
    event: SocketEvent.Drew,
    target: EmitTarget.Seat,
    seatIndex,
    payload: drewPayloadSchema.parse({
      tile: { tileId: tile.id, tileCode: tile.tileCode, isDrawn: true },
      wallCount,
      flowers: flowerCodes.map((tileCode) => ({ tileCode })),
    }),
  };
}

export function publicStateEmit(payload: PublicStatePayload): PlayEmit {
  return { event: SocketEvent.PublicState, target: EmitTarget.Room, payload };
}

export function discardedEmit(seatIndex: number, tileCode: string, tileId: string): PlayEmit {
  return {
    event: SocketEvent.Discarded,
    target: EmitTarget.Room,
    payload: discardedPayloadSchema.parse({ seatIndex, tileCode, tileId }),
  };
}

export function claimWindowEmit(
  discardSeatIndex: number,
  tileCode: string,
  timeoutMs: number | null,
): PlayEmit {
  return {
    event: SocketEvent.ClaimWindow,
    target: EmitTarget.Room,
    payload: claimWindowPayloadSchema.parse({ discardSeatIndex, tileCode, timeoutMs }),
  };
}

export function claimedEmit(seatIndex: number, kind: MeldType, tileCodes: string[]): PlayEmit {
  return {
    event: SocketEvent.Claimed,
    target: EmitTarget.Room,
    payload: claimedPayloadSchema.parse({ seatIndex, kind, tileCodes }),
  };
}

export function turnEmit(currentSeatIndex: number, phase: RoundPhase): PlayEmit {
  return {
    event: SocketEvent.Turn,
    target: EmitTarget.Room,
    payload: turnPayloadSchema.parse({ currentSeatIndex, phase }),
  };
}

export function roundEndedEmit(payload: RoundEndedPayload): PlayEmit {
  return {
    event: SocketEvent.RoundEnded,
    target: EmitTarget.Room,
    payload: roundEndedPayloadSchema.parse(payload),
  };
}

export function presenceEmit(seatIndex: number, connected: boolean): PlayEmit {
  return {
    event: SocketEvent.Presence,
    target: EmitTarget.Room,
    payload: presencePayloadSchema.parse({ seatIndex, connected }),
  };
}
