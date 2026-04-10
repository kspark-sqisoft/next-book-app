import { expect, test } from "vitest";

import {
  canMutateCatResource,
  canMutateOwnedResource,
  isAdminRole,
} from "@/server/auth/auth-policy";
import { UserRole } from "@/server/users/user-role";

test("isAdminRole", () => {
  expect(isAdminRole(UserRole.Admin)).toBe(true);
  expect(isAdminRole(UserRole.User)).toBe(false);
});

test("canMutateOwnedResource", () => {
  expect(canMutateOwnedResource({ id: 1, role: UserRole.User }, 1)).toBe(true);
  expect(canMutateOwnedResource({ id: 1, role: UserRole.User }, 2)).toBe(false);
  expect(canMutateOwnedResource({ id: 9, role: UserRole.Admin }, 1)).toBe(true);
});

// Cats 레거시 행(ownerId null): 유저는 거부, 관리자만 허용
test("canMutateCatResource: owner null 이면 일반 사용자 불가", () => {
  expect(canMutateCatResource({ id: 1, role: UserRole.User }, null)).toBe(
    false,
  );
  expect(canMutateCatResource({ id: 1, role: UserRole.Admin }, null)).toBe(
    true,
  );
});
