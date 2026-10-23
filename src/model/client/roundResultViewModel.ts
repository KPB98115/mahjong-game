import { type ApiError } from "../../types/server/api";

export type RoundResultViewModel = {
  error: ApiError | undefined;
  pending: boolean;
  nextWindEnabled: boolean;
};

export function emptyRoundResultViewModel(): RoundResultViewModel {
  return { error: undefined, pending: false, nextWindEnabled: true };
}
