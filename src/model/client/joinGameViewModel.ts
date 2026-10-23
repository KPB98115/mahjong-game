import { type ApiError } from "../../types/server/api";

export type JoinGameViewModel = {
  referenceCode: string;
  error: ApiError | undefined;
};

export function emptyJoinGameViewModel(): JoinGameViewModel {
  return { referenceCode: "", error: undefined };
}

export function isJoinCode(value: string): boolean {
  if (value.length !== 5) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character == null || character < "0" || character > "9") {
      return false;
    }
  }
  return true;
}
