// 조직 멤버십 역할(플랫폼 UserRole 과 별개)
export enum OrgMemberRole {
  Admin = "admin",
  Member = "member",
}

export function normalizeOrgMemberRole(raw: unknown): OrgMemberRole {
  if (raw === OrgMemberRole.Admin || raw === "admin")
    return OrgMemberRole.Admin;
  return OrgMemberRole.Member;
}
