import { NextResponse } from "next/server";
import { handleRouteError } from "@/server/http/api-response";
import {
  clearRefreshTokenCookieHeader,
  getRequestCookie,
} from "@/server/http/cookies";
import { REFRESH_TOKEN_COOKIE } from "@/server/env";
import { AuthService } from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    const token = getRequestCookie(request, REFRESH_TOKEN_COOKIE);
    if (token) {
      const auth = new AuthService();
      await auth.revokeRefreshToken(token);
    }
    const res = NextResponse.json({ ok: true });
    res.headers.append("Set-Cookie", clearRefreshTokenCookieHeader());
    return res;
  } catch (e) {
    return handleRouteError(e);
  }
}
