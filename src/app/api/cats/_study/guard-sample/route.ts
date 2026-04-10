// 학습용: 커스텀 헤더로 가드 패턴 시연(실제 Cats CRUD와는 별도)
import { NextResponse } from "next/server";

import { jsonError } from "@/server/http/api-response";

export async function GET(request: Request) {
  const v = request.headers.get("x-cats-study")?.trim().toLowerCase(); // 헤더 기반 스위치
  if (v !== "yes") {
    return jsonError(401, "Unauthorized"); // 헤더 없거나 값 불일치
  }
  return NextResponse.json({
    ok: true, // 가드 통과
    hint: "CatsStudyGuard 이후 컨트롤러까지 도달. 순서는 REQUEST_FLOW.md 참고.",
  });
}
