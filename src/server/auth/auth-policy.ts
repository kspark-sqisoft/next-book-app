// 서비스 레이어 공통: 관리자·리소스 소유자 판별(Cats 별도 헬퍼 포함)
import { UserRole } from "@/server/users/user-role";

export type AuthActor = { id: number; role: UserRole };

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.Admin;
}

export function canMutateOwnedResource(
  actor: AuthActor,
  ownerUserId: number,
): boolean {
  return isAdminRole(actor.role) || Number(actor.id) === Number(ownerUserId);
}

// Cats 서버 측 권한: 관리자는 항상 허용, owner null이면 일반 사용자 거부
export function canMutateCatResource(
  actor: AuthActor,
  ownerUserId: number | null | undefined,
): boolean {
  if (isAdminRole(actor.role)) return true; // 관리자 우회
  if (ownerUserId == null) return false; // 레거시 무소유 행은 사용자 불가
  return Number(actor.id) === Number(ownerUserId); // 소유자만
}
