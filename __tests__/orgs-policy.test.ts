import { expect, test } from "vitest";

import {
  normalizeOrgMemberRole,
  OrgMemberRole,
} from "@/server/orgs/org-member-role";
import { isSuperOrgAdminEmail } from "@/server/orgs/super-org-admin";

test("normalizeOrgMemberRole", () => {
  expect(normalizeOrgMemberRole("admin")).toBe(OrgMemberRole.Admin);
  expect(normalizeOrgMemberRole("member")).toBe(OrgMemberRole.Member);
  expect(normalizeOrgMemberRole("x")).toBe(OrgMemberRole.Member);
});

test("isSuperOrgAdminEmail matches configured super emails", () => {
  expect(isSuperOrgAdminEmail("noa99kee@gmail.com")).toBe(true);
  expect(isSuperOrgAdminEmail("NOA99KEE@GMAIL.COM")).toBe(true);
  expect(isSuperOrgAdminEmail("ks.park@sqisoft.com")).toBe(false);
  expect(isSuperOrgAdminEmail("")).toBe(false);
  expect(isSuperOrgAdminEmail(null)).toBe(false);
});
