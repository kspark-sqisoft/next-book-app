// 회원가입: 비밀번호 해시·사용자 행 생성(부트스트랩 후)
import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-response";
import { assertRateLimit, clientIpFromRequest } from "@/server/http/rate-limit";
import { AuthService } from "@/server/services/auth.service";
import { ensureUserBootstraps } from "@/server/services/bootstrap";

export async function POST(request: Request) {
  try {
    // 가입 스팸 방지
    assertRateLimit(`signup:${clientIpFromRequest(request)}`, 5, 60_000);
    await ensureUserBootstraps();
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const auth = new AuthService();
    const user = await auth.signup(
      body.email ?? "",
      body.password ?? "",
      body.name ?? "",
    );
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
