import {
  ApiStatus,
  type ApiError,
  type ApiFailure,
  type ApiSuccess,
} from "../../../types/server/api";

export function successEnvelope<T>(data: T): ApiSuccess<T> {
  return { status: ApiStatus.Success, data };
}

export function failedEnvelope(error: ApiError): ApiFailure {
  return { status: ApiStatus.Failed, error };
}
