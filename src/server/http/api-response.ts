// App Router Route Handler용 JSON 응답 헬퍼
import { NextResponse } from "next/server";

import { HttpError } from "@/server/http/http-error";

// Nest 스타일 error 필드용 짧은 영문 라벨
function statusText(status: number): string {
  if (status === 400) return "Bad Request";
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not Found";
  if (status === 409) return "Conflict";
  if (status === 502) return "Bad Gateway";
  if (status === 503) return "Service Unavailable";
  return "Error";
}

// 일관된 에러 JSON 바디 + status 코드
export function jsonError(
  status: number,
  message: string | string[],
  extra?: Record<string, string>,
): NextResponse {
  const msg = Array.isArray(message) ? message.join(", ") : message;
  return NextResponse.json(
    {
      statusCode: status,
      message: msg,
      error: statusText(status),
      ...extra,
    },
    { status },
  );
}

// try/catch 끝에서 unknown → NextResponse
export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return jsonError(e.status, e.message);
  }
  console.error("[api]", e);
  return jsonError(500, "Internal server error");
}
