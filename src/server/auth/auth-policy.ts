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

/** owner 가 null(레거시 행)이면 일반 사용자는 수정·삭제 불가 */
export function canMutateCatResource(
  actor: AuthActor,
  ownerUserId: number | null | undefined,
): boolean {
  if (isAdminRole(actor.role)) return true;
  if (ownerUserId == null) return false;
  return Number(actor.id) === Number(ownerUserId);
}
