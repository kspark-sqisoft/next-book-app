import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import {
  clearRefreshTokenCookieHeader,
  getRequestCookie,
  refreshTokenCookieHeader,
} from "@/server/http/cookies";
import { REFRESH_TOKEN_COOKIE } from "@/server/env";
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
    const res = handleRouteError(e);
    if (res.status === 401) {
      res.headers.append("Set-Cookie", clearRefreshTokenCookieHeader());
    }
    return res;
  }
}
