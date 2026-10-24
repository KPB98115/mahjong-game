import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiClient } from "../../logic/client/http/apiClient";
import { ApiError, ApiStatus, HttpStatus } from "../../types/server/api";
import { createFakeFetch, failedBody, successBody } from "./fakeApi";

const userIdSchema = z.object({ userId: z.string() });

describe("ApiClient", () => {
  it("sends credentials include and parses success data with the route schema", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "POST",
        path: "/api/session",
        status: HttpStatus.Ok,
        body: successBody({ userId: "user-1" }),
      },
    ]);
    const client = new ApiClient(fetchFn);
    const result = await client.post("/api/session", undefined, userIdSchema);
    expect(result).toEqual({ ok: true, data: { userId: "user-1" } });
    expect(fetchFn.calls).toEqual([
      {
        method: "POST",
        path: "/api/session",
        body: undefined,
        credentials: "include",
      },
    ]);
  });

  it("maps a failed envelope and http status to the error enum", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "GET",
        path: "/api/me",
        status: HttpStatus.Unauthorized,
        body: failedBody(ApiError.Unauthorized),
      },
    ]);
    const client = new ApiClient(fetchFn);
    const result = await client.get("/api/me", userIdSchema);
    expect(result).toEqual({
      ok: false,
      error: ApiError.Unauthorized,
      status: HttpStatus.Unauthorized,
    });
  });

  it("does not call fetch with the ApiClient as this", async () => {
    const receivers: unknown[] = [];
    async function fakeFetch(this: unknown) {
      receivers.push(this);
      return new Response(JSON.stringify({ status: "success", data: { userId: "user-1" } }), {
        status: HttpStatus.Ok,
        headers: { "content-type": "application/json" },
      });
    }
    const client = new ApiClient(fakeFetch);
    await client.get("/api/me", userIdSchema);
    expect(receivers).toEqual([undefined]);
  });

  it("returns invalidBody when json, envelope, or data schema fail", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "GET",
        path: "/api/broken",
        status: HttpStatus.Ok,
        body: { status: ApiStatus.Success, data: { userId: 1 } },
      },
    ]);
    const client = new ApiClient(fetchFn);
    const result = await client.get("/api/broken", userIdSchema);
    expect(result).toEqual({
      ok: false,
      error: ApiError.InvalidBody,
      status: HttpStatus.UnprocessableEntity,
    });
  });
});
