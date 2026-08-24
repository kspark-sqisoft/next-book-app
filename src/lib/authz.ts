// 클라이언트 권한 헬퍼: JWT user.role·sub 와 작성자 id 비교
import type { AuthUser } from "@/lib/api";

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

/**
 * 조직 트리·조직 관리자 지정 슈퍼 권한(클라이언트 UI 표시용).
 * 서버는 `SUPER_ORG_ADMIN_EMAILS` 로 재검증한다.
 */
export function isSuperOrgAdminUser(
  user: AuthUser | null | undefined,
): boolean {
  const e = user?.email?.trim().toLowerCase() ?? "";
  if (!e) return false;
  const configured =
    typeof process.env.NEXT_PUBLIC_SUPER_ORG_ADMIN_EMAILS === "string"
      ? process.env.NEXT_PUBLIC_SUPER_ORG_ADMIN_EMAILS
      : "noa99kee@gmail.com";
  return configured
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
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

/**
 * 소유자가 있을 수도 없을 수도 있는 자원(플레이리스트·스케줄) 편집 UI:
 * 소유자 없음(공용) = 로그인 사용자 누구나, 그 외 소유자·관리자·공유받은 사용자.
 */
export function canEditOwnedOrShared(
  user: AuthUser | null,
  ownerId: number | null | undefined,
  sharedUserIds: readonly number[] | undefined,
  sharedToAll?: boolean,
): boolean {
  if (!user) return false;
  if (ownerId == null) return true;
  return canEditBookAsOwnerAdminOrShared(
    user,
    ownerId,
    sharedUserIds,
    sharedToAll,
  );
}

/** 삭제·공유 관리 UI: 소유자·관리자. 공용 항목은 관리자만 */
export function canManageOwned(
  user: AuthUser | null,
  ownerId: number | null | undefined,
): boolean {
  if (!user) return false;
  if (ownerId == null) return isAdminUser(user);
  return canEditAsOwnerOrAdmin(user, ownerId);
}

/** 북 편집 UI: 작성자·관리자 또는 공유받은 사용자(모든 사용자 공유 포함) */
export function canEditBookAsOwnerAdminOrShared(
  user: AuthUser | null,
  authorId: number,
  sharedUserIds: readonly number[] | undefined,
  sharedToAll?: boolean,
): boolean {
  if (canEditAsOwnerOrAdmin(user, authorId)) return true;
  if (!user) return false;
  if (sharedToAll === true) return true;
  return (sharedUserIds ?? []).some((id) => Number(id) === Number(user.sub));
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
