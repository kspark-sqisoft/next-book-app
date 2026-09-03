// 로그인: 액세스 JWT 는 JSON(클라이언트 Bearer·소켓 핸드셰이크용)과 httpOnly 쿠키(서버 액션·RSC용)
// 양쪽에, 리프레시는 httpOnly 쿠키에.
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import {
  accessTokenCookieHeader,
  refreshTokenCookieHeader,
} from "@/server/http/cookies";
import { assertRateLimit, clientIpFromRequest } from "@/server/http/rate-limit";
import { AuthService } from "@/server/services/auth.service";
import { ensureUserBootstraps } from "@/server/services/bootstrap";

export async function POST(request: Request) {
  try {
    // 브루트포스·bcrypt CPU 고갈 방지
    assertRateLimit(`signin:${clientIpFromRequest(request)}`, 10, 60_000);
    await ensureUserBootstraps();
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const auth = new AuthService();
    const { access_token, refresh_token } = await auth.signin(
      body.email ?? "",
      body.password ?? "",
    );
    const res = NextResponse.json({ access_token });
    res.headers.append("Set-Cookie", accessTokenCookieHeader(access_token));
    res.headers.append("Set-Cookie", refreshTokenCookieHeader(refresh_token));
    return res;
  } catch (e) {
    return handleRouteError(e);
  }
}
