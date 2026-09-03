import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  assertServerActionsEncryptionKey,
  inspectServerActionsEncryptionKey,
  SERVER_ACTIONS_ENCRYPTION_KEY_ENV as KEY,
} from "@/server/server-actions-encryption-key";

const key = (bytes: number) => randomBytes(bytes).toString("base64");

describe("inspectServerActionsEncryptionKey", () => {
  it("AES 키 길이(16·24·32바이트) base64 를 통과시킨다", () => {
    for (const bytes of [16, 24, 32]) {
      const r = inspectServerActionsEncryptionKey(key(bytes));
      expect(r).toEqual({ ok: true, bytes });
    }
  });

  it("미설정·공백을 missing 으로 판정한다", () => {
    for (const v of [undefined, null, "", "   "]) {
      expect(inspectServerActionsEncryptionKey(v)).toMatchObject({
        ok: false,
        problem: "missing",
      });
    }
  });

  it("base64 가 아닌 값을 거른다", () => {
    expect(inspectServerActionsEncryptionKey("not a key!")).toMatchObject({
      problem: "not-base64",
    });
  });

  it("길이가 AES 키가 아니면 거른다 — 실수로 넣은 짧은 문자열이 조용히 통과하지 않아야 한다", () => {
    // "abcd" 는 base64 문자만 쓰지만 디코드하면 3바이트다.
    expect(inspectServerActionsEncryptionKey("abcd")).toMatchObject({
      problem: "bad-length",
    });
    expect(inspectServerActionsEncryptionKey(key(48))).toMatchObject({
      problem: "bad-length",
    });
  });
});

describe("assertServerActionsEncryptionKey", () => {
  it("프로덕션에서 미설정이면 기동을 세운다", () => {
    expect(() =>
      assertServerActionsEncryptionKey({
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toThrow(/미설정/);
  });

  it("프로덕션에서 형식이 틀리면 기동을 세운다", () => {
    expect(() =>
      assertServerActionsEncryptionKey({
        NODE_ENV: "production",
        [KEY]: "abcd",
      } as NodeJS.ProcessEnv),
    ).toThrow(/AES/);
  });

  it("프로덕션에서 올바른 키는 통과한다", () => {
    expect(() =>
      assertServerActionsEncryptionKey({
        NODE_ENV: "production",
        [KEY]: key(32),
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("개발에서 미설정은 조용히 통과한다 — Next 가 빌드마다 키를 만들어 단일 프로세스에서는 무해하다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertServerActionsEncryptionKey({
        NODE_ENV: "development",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("개발에서 값이 있는데 형식이 틀리면 경고한다 — 그대로 프로덕션에 복사되면 기동이 막힌다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    assertServerActionsEncryptionKey({
      NODE_ENV: "development",
      [KEY]: "abcd",
    } as NodeJS.ProcessEnv);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
