// 리프레시 토큰은 DB 에 SHA-256 해시만 보관
import { createHash } from "node:crypto";

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
