// @vitest-environment node
//
// jsdom의 TextEncoder는 다른 realm의 Uint8Array를 만들어 jose의 instanceof 검사를 통과하지
// 못한다("payload must be an instance of Uint8Array"). 어차피 서버 전용 모듈이므로 node에서 돈다.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAccessToken } from "@/server/auth/jwt";
import { UserRole } from "@/server/users/user-role";

/**
 * `cookies()`는 요청 컨텍스트를 요구하므로 모듈째 대체한다.
 * 검증하려는 것은 "쿠키에 무엇이 들어 있을 때 누구로 판정되는가"다.
 */
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

// `cache()`의 요청 단위 메모이즈가 테스트 간에 값을 물고 가지 않도록 통과시킨다.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { ACCESS_TOKEN_COOKIE } = await import("@/server/env");
const { getCurrentUser, requireAdmin, requireUser, userFromAccessToken } =
  await import("@/server/auth/session");

const payload = {
  sub: 7,
  email: "a@b.c",
  name: "테스터",
  role: UserRole.User,
};

beforeEach(() => cookieJar.clear());

describe("userFromAccessToken", () => {
  it("유효한 토큰을 페이로드로 되돌린다", async () => {
    const token = await signAccessToken(payload);
    expect(await userFromAccessToken(token)).toMatchObject(payload);
  });

  it("없거나 공백이면 null", async () => {
    for (const v of [undefined, null, "", "   "]) {
      expect(await userFromAccessToken(v)).toBeNull();
    }
  });

  it("변조된 토큰은 던지지 않고 null — 목록 등 선택 로그인 경로가 500으로 죽지 않아야 한다", async () => {
    const token = await signAccessToken(payload);
    expect(await userFromAccessToken(token.slice(0, -3) + "aaa")).toBeNull();
    expect(await userFromAccessToken("not.a.jwt")).toBeNull();
  });
});

describe("쿠키 기반 세션", () => {
  it("쿠키가 없으면 비로그인이고 requireUser 는 401", async () => {
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("쿠키의 토큰으로 신원을 판정한다", async () => {
    cookieJar.set(ACCESS_TOKEN_COOKIE, await signAccessToken(payload));
    expect(await getCurrentUser()).toMatchObject({ sub: 7, email: "a@b.c" });
    await expect(requireUser()).resolves.toMatchObject({ sub: 7 });
  });

  it("일반 사용자는 requireAdmin 에서 403 — 로그인만으로 전역 조작이 통과하면 안 된다", async () => {
    cookieJar.set(ACCESS_TOKEN_COOKIE, await signAccessToken(payload));
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("관리자는 requireAdmin 을 통과한다", async () => {
    cookieJar.set(
      ACCESS_TOKEN_COOKIE,
      await signAccessToken({ ...payload, role: UserRole.Admin }),
    );
    await expect(requireAdmin()).resolves.toMatchObject({
      role: UserRole.Admin,
    });
  });
});
