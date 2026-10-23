import { type ApiError } from "../../types/server/api";
import { BotDifficulty } from "../../types/server/botDifficulty";

export type WaitingViewModel = {
  copied: boolean;
  botDifficulty: BotDifficulty;
  error: ApiError | undefined;
  pending: boolean;
};

export function emptyWaitingViewModel(): WaitingViewModel {
  return {
    copied: false,
    botDifficulty: BotDifficulty.Low,
    error: undefined,
    pending: false,
  };
}
