// 서버 액션에서 Bearer(클라이언트가 넘긴 accessToken 문자열) 검증
import { isAdminRole } from "@/server/auth/auth-policy";
import { verifyAccessToken } from "@/server/auth/jwt";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { HttpError } from "@/server/http/http-error";

// 라우트 파라미터·폼에서 온 id 정규화
export function assertPositiveIntId(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

// 선택 로그인: 토큰 없거나 무효면 null (목록 등에서 쓰임)
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

// 필수 로그인: 없으면 401 HttpError → 액션에서 메시지로 변환
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

/**
 * 관리자 전용. 소유자 개념이 없는 **전역·파괴적** 조작(화면 삭제, 태그 일괄 배포,
 * 긴급 알림)에 쓴다 — 이런 자원은 소유자 컬럼이 없어 "로그인 여부"만으로는
 * 아무 계정이나 전체 화면에 영향을 줄 수 있다.
 */
export async function requireAdminFromToken(
  accessToken: string | null | undefined,
): Promise<JwtPayload> {
  const user = await requireUserFromToken(accessToken);
  if (!isAdminRole(user.role)) {
    throw new HttpError(403, "관리자만 할 수 있습니다.");
  }
  return user;
}

// 서버 액션은 클라이언트에 Error 문자열만 던지는 패턴이 많음
export function rethrowActionError(e: unknown, logTag: string): never {
  if (e instanceof HttpError) {
    throw new Error(e.message);
  }
  console.error(`[${logTag}]`, e);
  throw new Error("요청에 실패했습니다.");
}
