import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { failedEnvelope, successEnvelope } from "../logic/server/http/envelope";
import { readJsonBody } from "../logic/server/http/readJsonBody";
import { readSessionCookie, writeSessionCookie } from "../logic/server/http/sessionCookie";
import { ApiError, ApiStatus } from "../types/server/api";
import { CookieName } from "../types/server/auth";

describe("envelope", () => {
  it("wraps success data with status success", () => {
    expect(successEnvelope({ userId: "user-1" })).toEqual({
      status: ApiStatus.Success,
      data: { userId: "user-1" },
    });
  });

  it("wraps failures with an enum error string and status failed", () => {
    expect(failedEnvelope(ApiError.Unauthorized)).toEqual({
      status: ApiStatus.Failed,
      error: "unauthorized",
    });
    expect(failedEnvelope(ApiError.InvalidBody).error).toBe("invalidBody");
    expect(failedEnvelope(ApiError.RedisUnavailable).error).toBe("redisUnavailable");
  });
});

describe("sessionCookie", () => {
  it("reads the session cookie and treats an empty value as missing", async () => {
    const app = new Hono();
    app.get("/", (c) => c.json({ token: readSessionCookie(c) ?? null }));
    const present = await app.request("http://localhost/", {
      headers: { cookie: `${CookieName.Session}=raw-token` },
    });
    const missing = await app.request("http://localhost/");
    const empty = await app.request("http://localhost/", {
      headers: { cookie: `${CookieName.Session}=` },
    });
    expect(await present.json()).toEqual({ token: "raw-token" });
    expect(await missing.json()).toEqual({ token: null });
    expect(await empty.json()).toEqual({ token: null });
  });

  it("writes an httpOnly session cookie with Path=/ and SameSite=Lax", async () => {
    const app = new Hono();
    app.get("/", (c) => {
      writeSessionCookie(c, "raw-token", 3600);
      return c.body("ok");
    });
    const httpResponse = await app.request("http://localhost/");
    const httpsResponse = await app.request("https://example.test/");
    const httpCookie = httpResponse.headers.get("set-cookie") ?? "";
    const httpsCookie = httpsResponse.headers.get("set-cookie") ?? "";
    expect(httpCookie.includes(`${CookieName.Session}=raw-token`)).toBe(true);
    expect(httpCookie.includes("HttpOnly")).toBe(true);
    expect(httpCookie.includes("Path=/")).toBe(true);
    expect(httpCookie.includes("SameSite=Lax")).toBe(true);
    expect(httpCookie.includes("Max-Age=3600")).toBe(true);
    expect(httpCookie.includes("Secure")).toBe(false);
    expect(httpsCookie.includes("Secure")).toBe(true);
  });
});

describe("readJsonBody", () => {
  it("returns the parsed object or ok false when the body is not json", async () => {
    const app = new Hono();
    app.post("/", async (c) => c.json(await readJsonBody(c)));
    const valid = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attributes: { displayName: "A" } }),
    });
    const invalid = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(await valid.json()).toEqual({ ok: true, value: { attributes: { displayName: "A" } } });
    expect(await invalid.json()).toEqual({ ok: false });
  });
});
