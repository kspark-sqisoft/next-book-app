import { SUPER_ORG_ADMIN_EMAILS } from "@/server/env";

/** 조직 트리·조직 관리자 지정은 슈퍼 조직 관리자만 */
export function isSuperOrgAdminEmail(
  email: string | null | undefined,
): boolean {
  const e = email?.trim().toLowerCase() ?? "";
  if (!e) return false;
  return SUPER_ORG_ADMIN_EMAILS.includes(e);
}
