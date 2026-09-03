import { randomBytes } from "node:crypto";
import { join } from "node:path";

/** 서명 키 최소 길이 — 무차별 대입으로 복원 불가능한 수준 */
const MIN_SECRET_LEN = 32;

// 환경변수 문자열을 양의 정수로; 잘못된 값은 fallback
function positiveInt(v: string | undefined, fallback: number): number {
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const PORT = positiveInt(process.env.PORT, 3000);

export const DB_HOST = process.env.DB_HOST?.trim() || "localhost";
export const DB_PORT = positiveInt(process.env.DB_PORT, 5432);
export const DB_USERNAME = process.env.DB_USERNAME?.trim() || "reactauth";
export const DB_PASSWORD = process.env.DB_PASSWORD?.trim() || "reactauth";
export const DB_NAME = process.env.DB_NAME?.trim() || "reactauth";

// 콤마 구분 이메일 → 부트스트랩 시 관리자 역할 부여 후보
export const BOOTSTRAP_ADMIN_EMAILS = (
  process.env.BOOTSTRAP_ADMIN_EMAILS?.trim() ?? ""
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * 조직(대그룹·하위 공장 등) 트리 생성·조직 관리자 지정 전용 슈퍼 권한.
 * 미설정 시 기본: noa99kee@gmail.com
 */
export const SUPER_ORG_ADMIN_EMAILS = (
  process.env.SUPER_ORG_ADMIN_EMAILS?.trim() || "noa99kee@gmail.com"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// 정적 업로드 루트(프로덕션에서는 볼륨 마운트 경로로 덮어쓰기)
export const UPLOAD_ROOT =
  process.env.UPLOAD_ROOT?.trim() || join(process.cwd(), "uploads");

export const POST_IMAGES_SUBDIR = "posts";
export const POST_VIDEOS_SUBDIR = "post-videos";
export const POST_VIDEO_POSTERS_SUBDIR = "post-video-posters";
export const AVATARS_SUBDIR = "avatars";
export const BOOK_IMAGES_SUBDIR = "book-images";
export const BOOK_VIDEOS_SUBDIR = "book-videos";
export const BOOK_VIDEO_POSTERS_SUBDIR = "book-video-posters";
export const CAT_IMAGES_SUBDIR = "cat-images";

/**
 * 토큰 서명 키에는 기본값을 두지 않는다. 폴백이 있으면 환경변수를 빠뜨린 배포가
 * **공개된 키로 조용히 기동**하고, 그 키로 누구나 `role: "admin"` 토큰을 위조할 수 있다.
 * - 프로덕션: 미설정이거나 32자 미만이면 기동 실패(빠르고 시끄럽게).
 * - 개발·테스트: 값이 있으면 그대로 쓰고, 없으면 프로세스마다 임의 키를 만든다.
 *   재시작하면 세션이 끊기지만, 알려진 상수를 저장소에 박아 두는 것보다 안전하다.
 */
function requiredSecret(name: string): string {
  const v = process.env[name]?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (v && v.length >= MIN_SECRET_LEN) return v;
  if (isProd) {
    throw new Error(
      `${name} 가 설정되지 않았거나 ${MIN_SECRET_LEN}자 미만입니다. ` +
        `\`openssl rand -base64 48\` 등으로 생성해 환경변수로 주입하세요.`,
    );
  }
  if (v) {
    console.warn(
      `[env] ${name} 가 ${MIN_SECRET_LEN}자 미만입니다 — 개발 중에만 허용됩니다.`,
    );
    return v;
  }
  console.warn(
    `[env] ${name} 미설정 — 개발 전용 임시 키를 생성합니다(재시작 시 로그인 유지 안 됨).`,
  );
  return randomBytes(48).toString("base64");
}

export const JWT_ACCESS_SECRET = requiredSecret("JWT_ACCESS_SECRET");
export const JWT_REFRESH_SECRET = requiredSecret("JWT_REFRESH_SECRET");
export const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
export const JWT_REFRESH_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

/**
 * 액세스 JWT를 담는 httpOnly 쿠키. 서버 액션·서버 컴포넌트가 세션을 읽는 유일한 경로다
 * (`server/auth/session.ts`). REST 라우트는 계속 Authorization 헤더만 본다 — 쿠키를
 * REST 인증에 쓰면 CSRF 표면이 생기지만, 서버 액션은 Next가 Origin/Host를 대조한다.
 */
export const ACCESS_TOKEN_COOKIE =
  process.env.ACCESS_TOKEN_COOKIE ?? "access_token";

export const REFRESH_TOKEN_COOKIE =
  process.env.REFRESH_TOKEN_COOKIE ?? "refresh_token";
export const REFRESH_TOKEN_MAX_AGE_MS = positiveInt(
  process.env.REFRESH_COOKIE_MAX_AGE_MS,
  7 * 24 * 60 * 60 * 1000,
);

// CORS: 미설정이면 개발 편의상 전 허용(true)
export function corsOrigin(): true | string | string[] {
  const v = process.env.FRONTEND_ORIGIN?.trim();
  if (!v) return true;
  if (v.includes(",")) return v.split(",").map((s) => s.trim());
  return v;
}
