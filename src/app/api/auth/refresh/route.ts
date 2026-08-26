// 액세스 토큰 갱신: 쿠키의 리프레시로 로테이션
import { NextResponse } from "next/server";

import { REFRESH_TOKEN_COOKIE } from "@/server/env";
import { handleRouteError } from "@/server/http/api-response";
import {
  getRequestCookie,
  refreshTokenCookieHeader,
} from "@/server/http/cookies";
import { AuthService } from "@/server/services/auth.service";
import { ensureUserBootstraps } from "@/server/services/bootstrap";

export async function POST(request: Request) {
  try {
    await ensureUserBootstraps();
    const token = getRequestCookie(request, REFRESH_TOKEN_COOKIE);
    if (!token) {
      return NextResponse.json(
        { statusCode: 401, message: "Unauthorized", error: "Unauthorized" },
        { status: 401 },
      );
    }
    const auth = new AuthService();
    const { access_token, refresh_token } = await auth.refresh(token);
    const res = NextResponse.json({ access_token });
    res.headers.append("Set-Cookie", refreshTokenCookieHeader(refresh_token));
    return res;
  } catch (e) {
    // 401이어도 쿠키는 지우지 않는다 — 동시 갱신 경쟁에서 진 응답이 방금 회전된
    // 정상 쿠키(Set-Cookie 순서상 나중 도착)를 지워 세션 전체가 풀리는 사고 방지.
    // 진짜 만료·폐기된 쿠키는 이후 갱신도 401이라 클라이언트가 로그아웃 처리한다.
    return handleRouteError(e);
  }
}
