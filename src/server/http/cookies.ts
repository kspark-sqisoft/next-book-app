import { parse, serialize } from "cookie";

import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_MS } from "@/server/env";

// 표준 Request의 Cookie 헤더 파싱
export function getRequestCookie(
  request: Request,
  name: string,
): string | undefined {
  return parse(request.headers.get("cookie") ?? "")[name];
}

// Set-Cookie 한 줄 문자열(리프레시 JWT 저장)
export function refreshTokenCookieHeader(token: string): string {
  return serialize(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(REFRESH_TOKEN_MAX_AGE_MS / 1000),
    path: "/",
  });
}

// 로그아웃 시 만료시킴
export function clearRefreshTokenCookieHeader(): string {
  return serialize(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
