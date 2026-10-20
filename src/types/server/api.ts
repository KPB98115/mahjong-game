export enum ApiStatus {
  Success = "success",
  Failed = "failed",
}

export enum ApiError {
  Unauthorized = "unauthorized",
  GameNotFound = "gameNotFound",
  AlreadySeated = "alreadySeated",
  GameFull = "gameFull",
  GameNotWaiting = "gameNotWaiting",
  GameNotCompleted = "gameNotCompleted",
  NorthComplete = "northComplete",
  GameNotAbortable = "gameNotAbortable",
  InvalidBody = "invalidBody",
  RulesetUnknown = "rulesetUnknown",
  InvalidClaimWindow = "invalidClaimWindow",
  NotSeated = "notSeated",
  RedisUnavailable = "redisUnavailable",
}

export enum HttpStatus {
  Ok = 200,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  UnprocessableEntity = 422,
  ServiceUnavailable = 503,
}

export type ApiSuccess<T> = {
  status: ApiStatus.Success;
  data: T;
};

export type ApiFailure = {
  status: ApiStatus.Failed;
  error: ApiError;
};
