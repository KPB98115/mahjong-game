import { actionErrorSchema, type GameActionErr } from "../../../model/server/actionResult";
import { ApiError, HttpStatus } from "../../../types/server/api";

const statusByError: Record<ApiError, HttpStatus> = {
  [ApiError.Unauthorized]: HttpStatus.Unauthorized,
  [ApiError.GameNotFound]: HttpStatus.NotFound,
  [ApiError.AlreadySeated]: HttpStatus.Conflict,
  [ApiError.GameFull]: HttpStatus.Conflict,
  [ApiError.GameNotWaiting]: HttpStatus.Conflict,
  [ApiError.GameNotCompleted]: HttpStatus.Conflict,
  [ApiError.NorthComplete]: HttpStatus.Conflict,
  [ApiError.GameNotAbortable]: HttpStatus.Conflict,
  [ApiError.InvalidBody]: HttpStatus.UnprocessableEntity,
  [ApiError.RulesetUnknown]: HttpStatus.UnprocessableEntity,
  [ApiError.InvalidClaimWindow]: HttpStatus.UnprocessableEntity,
  [ApiError.NotSeated]: HttpStatus.Forbidden,
  [ApiError.RedisUnavailable]: HttpStatus.ServiceUnavailable,
};

export function apiFailure(error: ApiError): GameActionErr {
  return actionErrorSchema.parse({ error, status: statusByError[error] });
}

export function isGameActionErr(result: object): result is GameActionErr {
  return "error" in result;
}
