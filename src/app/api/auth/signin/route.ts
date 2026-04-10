// 로그인: 액세스 JWT 는 JSON, 리프레시는 httpOnly Set-Cookie
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { refreshTokenCookieHeader } from "@/server/http/cookies";
import { AuthService } from "@/server/services/auth.service";
import { ensureUserBootstraps } from "@/server/services/bootstrap";

export async function POST(request: Request) {
  try {
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
    res.headers.append("Set-Cookie", refreshTokenCookieHeader(refresh_token));
    return res;
  } catch (e) {
    return handleRouteError(e);
  }
}
