import { type z } from "zod";
import { parseApiEnvelope } from "../../../model/server/envelope";
import { parseJsonValue } from "../../../model/server/jsonValue";
import { ApiError, HttpStatus } from "../../../types/server/api";
import { type JsonValue } from "../../../types/server/jsonValue";

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ApiOk<T> = {
  ok: true;
  data: T;
};

export type ApiErr = {
  ok: false;
  error: ApiError;
  status: HttpStatus;
};

export type ApiResult<T> = ApiOk<T> | ApiErr;

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

export class ApiClient {
  constructor(readonly fetchFn: FetchFn = defaultFetch) {}

  async get<T>(path: string, dataSchema: z.ZodType<T>): Promise<ApiResult<T>> {
    return this.request(path, { method: "GET" }, dataSchema);
  }

  async post<T>(
    path: string,
    body: JsonValue | undefined,
    dataSchema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    return this.request(path, { method: "POST", body: encodeBody(body) }, dataSchema);
  }

  async patch<T>(
    path: string,
    body: JsonValue | undefined,
    dataSchema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    return this.request(path, { method: "PATCH", body: encodeBody(body) }, dataSchema);
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    dataSchema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    const fetchFn = this.fetchFn;
    const response = await fetchFn(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body == null ? {} : { "content-type": "application/json" }),
        ...headersRecord(init.headers),
      },
    });
    const raw = await response.text();
    const json = parseJsonValue(raw);
    if (json === undefined) {
      return invalidBody();
    }
    const envelope = parseApiEnvelope(json);
    if (envelope == null) {
      return invalidBody();
    }
    if (!envelope.ok) {
      return { ok: false, error: envelope.error, status: httpStatus(response.status) };
    }
    const data = dataSchema.safeParse(envelope.data);
    if (!data.success) {
      return invalidBody();
    }
    return { ok: true, data: data.data };
  }
}

function encodeBody(body: JsonValue | undefined): string | undefined {
  return body === undefined ? undefined : JSON.stringify(body);
}

function invalidBody(): ApiErr {
  return {
    ok: false,
    error: ApiError.InvalidBody,
    status: HttpStatus.UnprocessableEntity,
  };
}

function httpStatus(status: number): HttpStatus {
  if (status === HttpStatus.Unauthorized) {
    return HttpStatus.Unauthorized;
  }
  if (status === HttpStatus.Forbidden) {
    return HttpStatus.Forbidden;
  }
  if (status === HttpStatus.NotFound) {
    return HttpStatus.NotFound;
  }
  if (status === HttpStatus.Conflict) {
    return HttpStatus.Conflict;
  }
  if (status === HttpStatus.UnprocessableEntity) {
    return HttpStatus.UnprocessableEntity;
  }
  if (status === HttpStatus.ServiceUnavailable) {
    return HttpStatus.ServiceUnavailable;
  }
  return HttpStatus.UnprocessableEntity;
}

function headersRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (headers == null) {
    return {};
  }
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {};
    for (const [key, value] of headers) {
      record[key] = value;
    }
    return record;
  }
  return headers;
}
