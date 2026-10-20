import { type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { CookieName } from "../../../types/server/auth";

export function readSessionCookie(c: Context): string | undefined {
  const rawToken = getCookie(c, CookieName.Session);
  if (rawToken === undefined || rawToken === "") {
    return undefined;
  }
  return rawToken;
}

export function writeSessionCookie(c: Context, rawToken: string, maxAgeSeconds: number): void {
  const url = new URL(c.req.url);
  setCookie(c, CookieName.Session, rawToken, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: url.protocol === "https:",
    maxAge: maxAgeSeconds,
  });
}
