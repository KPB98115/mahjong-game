import { parseJsonValue } from "../../model/server/jsonValue";
import { ApiStatus, HttpStatus } from "../../types/server/api";
import { type JsonValue } from "../../types/server/jsonValue";

export type FakeApiCall = {
  method: string;
  path: string;
  body: JsonValue | undefined;
  credentials: RequestCredentials | undefined;
};

export type FakeApiRoute = {
  method: string;
  path: string;
  status: number;
  body: JsonValue;
};

export type FakeFetch = {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  calls: FakeApiCall[];
};

export function createFakeFetch(routes: FakeApiRoute[]): FakeFetch {
  const calls: FakeApiCall[] = [];
  async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = requestUrl(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = new URL(url, "http://localhost").pathname;
    calls.push({
      method,
      path,
      body: await readBody(init),
      credentials: init?.credentials,
    });
    const route = routes.find((item) => item.method === method && item.path === path);
    if (route == null) {
      return jsonResponse(HttpStatus.NotFound, {
        status: ApiStatus.Failed,
        error: "gameNotFound",
      });
    }
    return jsonResponse(route.status, route.body);
  }
  fakeFetch.calls = calls;
  return fakeFetch;
}

export function successBody(data: JsonValue): JsonValue {
  return { status: ApiStatus.Success, data };
}

export function failedBody(error: string): JsonValue {
  return { status: ApiStatus.Failed, error };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

async function readBody(init: RequestInit | undefined): Promise<JsonValue | undefined> {
  if (init?.body == null) {
    return undefined;
  }
  if (typeof init.body !== "string") {
    return undefined;
  }
  return parseJsonValue(init.body);
}

function jsonResponse(status: number, body: JsonValue): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
