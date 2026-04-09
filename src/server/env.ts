import { join } from "node:path";

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

export const BOOTSTRAP_ADMIN_EMAILS = (
  process.env.BOOTSTRAP_ADMIN_EMAILS?.trim() ?? ""
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

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

export const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me";
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me";
export const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
export const JWT_REFRESH_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

export const REFRESH_TOKEN_COOKIE =
  process.env.REFRESH_TOKEN_COOKIE ?? "refresh_token";
export const REFRESH_TOKEN_MAX_AGE_MS = positiveInt(
  process.env.REFRESH_COOKIE_MAX_AGE_MS,
  7 * 24 * 60 * 60 * 1000,
);

export function corsOrigin(): true | string | string[] {
  const v = process.env.FRONTEND_ORIGIN?.trim();
  if (!v) return true;
  if (v.includes(",")) return v.split(",").map((s) => s.trim());
  return v;
}
