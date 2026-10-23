import { type SocketError } from "../../types/server/socketError";

export type PlayViewModel = {
  selectedTileIds: string[];
  pending: boolean;
  claimTimeoutMs: number | null;
  turnRemainingMs: number | null;
  error: SocketError | undefined;
};

export function emptyPlayViewModel(): PlayViewModel {
  return {
    selectedTileIds: [],
    pending: false,
    claimTimeoutMs: null,
    turnRemainingMs: null,
    error: undefined,
  };
}
