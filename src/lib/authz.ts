import type { AuthUser } from "@/lib/api";

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

/** 글·북·댓글 등: 작성자 또는 관리자 */
export function canEditAsOwnerOrAdmin(
  user: AuthUser | null,
  authorId: number,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return Number(user.sub) === Number(authorId);
}

/** Cats: ownerId 없는 레거시 행은 관리자만 */
export function canEditCatAsOwnerOrAdmin(
  user: AuthUser | null,
  ownerId: number | null | undefined,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (ownerId == null) return false;
  return Number(user.sub) === Number(ownerId);
}
