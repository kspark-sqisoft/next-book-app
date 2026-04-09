import { parse, serialize } from "cookie";

import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_MS } from "@/server/env";

export function getRequestCookie(
  request: Request,
  name: string,
): string | undefined {
  return parse(request.headers.get("cookie") ?? "")[name];
}

export function refreshTokenCookieHeader(token: string): string {
  return serialize(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(REFRESH_TOKEN_MAX_AGE_MS / 1000),
    path: "/",
  });
}

export function clearRefreshTokenCookieHeader(): string {
  return serialize(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
