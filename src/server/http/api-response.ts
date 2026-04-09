import { NextResponse } from "next/server";
import { HttpError } from "@/server/http/http-error";

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

export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return jsonError(e.status, e.message);
  }
  console.error("[api]", e);
  return jsonError(500, "Internal server error");
}
