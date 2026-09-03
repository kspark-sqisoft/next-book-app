// 서버 액션 공통 가드 — 입력 정규화와 오류 변환.
// 신원 확인은 여기 없다. 호출자가 넘긴 토큰이 아니라 쿠키에서 읽어야 하므로
// `@/server/auth/session` 의 requireUser·requireAdmin·getCurrentUser 를 쓴다.
import { HttpError } from "@/server/http/http-error";

// 라우트 파라미터·폼에서 온 id 정규화
export function assertPositiveIntId(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "유효하지 않은 id입니다.");
  }
  return n;
}

// 서버 액션은 클라이언트에 Error 문자열만 던지는 패턴이 많음
export function rethrowActionError(e: unknown, logTag: string): never {
  if (e instanceof HttpError) {
    throw new Error(e.message);
  }
  console.error(`[${logTag}]`, e);
  throw new Error("요청에 실패했습니다.");
}
