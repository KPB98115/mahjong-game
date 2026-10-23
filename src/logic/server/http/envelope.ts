import { apiFailureSchema, type ApiFailure } from "../../../model/server/actionResult";
import { ApiStatus, type ApiError, type ApiSuccess } from "../../../types/server/api";

export function successEnvelope<T>(data: T): ApiSuccess<T> {
  return { status: ApiStatus.Success, data };
}

export function failedEnvelope(error: ApiError): ApiFailure {
  return apiFailureSchema.parse({ status: ApiStatus.Failed, error });
}
