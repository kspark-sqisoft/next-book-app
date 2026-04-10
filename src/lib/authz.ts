// 클라이언트 권한 헬퍼: JWT user.role·sub 와 작성자 id 비교
import type { AuthUser } from "@/lib/api";

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

// 글·북·댓글: 본인 또는 admin
export function canEditAsOwnerOrAdmin(
  user: AuthUser | null,
  authorId: number,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return Number(user.sub) === Number(authorId);
}

// Cats UI 버튼 표시용: 로그인·관리자·소유자만 true
export function canEditCatAsOwnerOrAdmin(
  user: AuthUser | null,
  ownerId: number | null | undefined,
): boolean {
  if (!user) return false; // 비로그인
  if (isAdminUser(user)) return true;
  if (ownerId == null) return false; // 레거시 행은 관리자만(위에서 처리)
  return Number(user.sub) === Number(ownerId); // JWT sub와 owner 일치
}
