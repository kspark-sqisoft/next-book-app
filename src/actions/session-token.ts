import { verifyAccessToken } from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { HttpError } from "@/server/http/http-error";

export function assertPositiveIntId(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

export async function getUserFromTokenOptional(
  accessToken: string | null | undefined,
): Promise<JwtPayload | null> {
  const t = accessToken?.trim();
  if (!t) return null;
  try {
    return await verifyAccessToken(t);
  } catch {
    return null;
  }
}

export async function requireUserFromToken(
  accessToken: string | null | undefined,
): Promise<JwtPayload> {
  const t = accessToken?.trim();
  if (!t) {
    throw new HttpError(401, "Unauthorized");
  }
  try {
    return await verifyAccessToken(t);
  } catch {
    throw new HttpError(401, "Unauthorized");
  }
}

export function rethrowActionError(e: unknown, logTag: string): never {
  if (e instanceof HttpError) {
    throw new Error(e.message);
  }
  console.error(`[${logTag}]`, e);
  throw new Error("요청에 실패했습니다.");
}
