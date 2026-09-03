import { parse, serialize } from "cookie";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "@/server/env";

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

/**
 * 액세스 JWT 쿠키. `maxAge`를 주지 않는 **세션 쿠키**다.
 *
 * 만료는 JWT의 `exp`가 정하고 `verifyAccessToken`이 강제하므로, 쿠키에까지 수명을 적으면
 * `JWT_ACCESS_EXPIRES_IN`("15m")과 두 곳에서 관리되어 어긋난다. 브라우저를 닫으면 사라지는
 * 동작은 기존 `sessionStorage` 보관과도 맞는다. 만료된 토큰이 담긴 채 남아 있어도
 * 서버가 401을 주고 클라이언트가 갱신하면 이 쿠키도 함께 새로 발급된다.
 */
export function accessTokenCookieHeader(token: string): string {
  return serialize(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** 로그아웃 시 만료시킴 */
export function clearAccessTokenCookieHeader(): string {
  return serialize(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
