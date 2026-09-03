import "server-only";

/**
 * 서버 액션·서버 컴포넌트의 세션 출처. 이 파일 밖에서 액세스 토큰을 읽지 않는다.
 *
 * 이전에는 클라이언트가 `sessionStorage`의 토큰을 서버 액션의 첫 인자로 넘기고 액션마다
 * `requireUserFromToken(accessToken)`을 다시 불렀다. 인자를 빠뜨려도 타입이 맞으면 통과했고,
 * 그래서 크레타 조회 29개가 무인증이던 사고(54f8488)가 났다. 이제 신원은 인자가 아니라
 * httpOnly 쿠키에서 나오므로 **호출자가 신원을 주장할 수 없다.**
 *
 * `cache()`는 요청 단위 메모이즈다. 한 요청에서 몇 번을 부르든 JWT 검증은 한 번이고,
 * 값을 컴포넌트 사이로 넘기는 대신 필요한 곳에서 다시 읽게 만든다.
 */
import { cookies } from "next/headers";
import { cache } from "react";

import { isAdminRole } from "@/server/auth/auth-policy";
import { verifyAccessToken } from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { ACCESS_TOKEN_COOKIE } from "@/server/env";
import { HttpError } from "@/server/http/http-error";

/**
 * 토큰 문자열 → 사용자. 서명·만료가 어긋나면 null.
 *
 * 쿠키 접근과 분리해 둔 이유는 테스트 때문이다 — `cookies()`는 요청 컨텍스트를 요구한다.
 */
export async function userFromAccessToken(
  token: string | null | undefined,
): Promise<JwtPayload | null> {
  const t = token?.trim();
  if (!t) return null;
  try {
    return await verifyAccessToken(t);
  } catch {
    return null;
  }
}

/** 선택 로그인: 비로그인이면 null (공개 목록 등) */
export const getCurrentUser = cache(async (): Promise<JwtPayload | null> => {
  const store = await cookies();
  return userFromAccessToken(store.get(ACCESS_TOKEN_COOKIE)?.value);
});

/** 필수 로그인 */
export async function requireUser(): Promise<JwtPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  return user;
}

/**
 * 관리자 전용. 소유자 개념이 없는 **전역·파괴적** 조작(화면 삭제, 태그 일괄 배포,
 * 긴급 알림)에 쓴다 — 이런 자원은 소유자 컬럼이 없어 "로그인 여부"만으로는
 * 아무 계정이나 전체 화면에 영향을 줄 수 있다.
 */
export async function requireAdmin(): Promise<JwtPayload> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) {
    throw new HttpError(403, "관리자만 할 수 있습니다.");
  }
  return user;
}
