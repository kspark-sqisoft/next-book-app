import { expect, test } from "vitest";

import {
  catCreateSchema,
  loginSchema,
  postEditorSchema,
  signupSchema,
} from "@/lib/schemas/forms";

test("loginSchema", () => {
  expect(
    loginSchema.safeParse({ email: "a@b.co", password: "x" }).success,
  ).toBe(true);
  expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(
    false,
  );
});

test("signupSchema: 비밀번호 길이", () => {
  expect(
    signupSchema.safeParse({
      name: "u",
      email: "a@b.co",
      password: "12345",
    }).success,
  ).toBe(false);
  expect(
    signupSchema.safeParse({
      name: "u",
      email: "a@b.co",
      password: "123456",
    }).success,
  ).toBe(true);
});

test("postEditorSchema: 본문 평문 길이", () => {
  expect(
    postEditorSchema.safeParse({
      title: "t",
      content: "<p>hello</p>",
      category: "general",
    }).success,
  ).toBe(true);
  expect(
    postEditorSchema.safeParse({
      title: "t",
      content: "<p></p>",
      category: "general",
    }).success,
  ).toBe(false);
});

test("catCreateSchema: 나이 문자열", () => {
  expect(
    catCreateSchema.safeParse({ name: "n", breed: "x", age: "5" }).success,
  ).toBe(true);
  expect(
    catCreateSchema.safeParse({ name: "n", breed: "x", age: "99" }).success,
  ).toBe(false);
});
