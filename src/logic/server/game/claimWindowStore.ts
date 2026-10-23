import { type ClaimAnswerKind } from "../../../types/server/claimAnswerKind";
import { type MeldType } from "../../../types/server/meldType";

export type ClaimAnswer =
  | { kind: ClaimAnswerKind.Pass }
  | { kind: ClaimAnswerKind.Win }
  | { kind: ClaimAnswerKind.Meld; meldType: MeldType; tileIds: string[] };

export type SeatClaimAnswer = {
  seatIndex: number;
  answer: ClaimAnswer;
};

export type ClaimWindowState = {
  roundId: string;
  discardTileId: string;
  answers: SeatClaimAnswer[];
};

export type ClaimWindowStore = {
  find(gameId: string): Promise<ClaimWindowState | undefined>;
  save(gameId: string, state: ClaimWindowState): Promise<void>;
  clear(gameId: string): Promise<void>;
};

export function createMemoryClaimWindowStore(): ClaimWindowStore {
  const windows = new Map<string, ClaimWindowState>();
  return {
    async find(gameId) {
      const state = windows.get(gameId);
      return state == null ? undefined : structuredClone(state);
    },
    async save(gameId, state) {
      windows.set(gameId, structuredClone(state));
    },
    async clear(gameId) {
      windows.delete(gameId);
    },
  };
}
