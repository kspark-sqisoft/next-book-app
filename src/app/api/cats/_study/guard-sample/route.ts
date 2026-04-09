import { NextResponse } from "next/server";

import { jsonError } from "@/server/http/api-response";

export async function GET(request: Request) {
  const v = request.headers.get("x-cats-study")?.trim().toLowerCase();
  if (v !== "yes") {
    return jsonError(401, "Unauthorized");
  }
  return NextResponse.json({
    ok: true,
    hint: "CatsStudyGuard 이후 컨트롤러까지 도달. 순서는 REQUEST_FLOW.md 참고.",
  });
}
