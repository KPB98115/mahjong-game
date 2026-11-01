import { type SocketError } from "../../types/server/socketError";

export type PlayViewModel = {
  selectedTileIds: string[];
  pending: boolean;
  claimTimeoutMs: number | null;
  claimDiscardSeatIndex: number | null;
  claimTileCode: string | null;
  turnRemainingMs: number | null;
  error: SocketError | undefined;
};

export function emptyPlayViewModel(): PlayViewModel {
  return {
    selectedTileIds: [],
    pending: false,
    claimTimeoutMs: null,
    claimDiscardSeatIndex: null,
    claimTileCode: null,
    turnRemainingMs: null,
    error: undefined,
  };
}
