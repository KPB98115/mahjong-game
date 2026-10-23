import { type ApiError } from "../../types/server/api";

export type RegisterViewModel = {
  displayName: string;
  error: ApiError | undefined;
  pending: boolean;
};

export function emptyRegisterViewModel(): RegisterViewModel {
  return { displayName: "", error: undefined, pending: false };
}
