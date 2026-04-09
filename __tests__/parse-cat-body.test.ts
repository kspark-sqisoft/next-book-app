import { expect, test } from "vitest";

import {
  parseCreateCatBody,
  parseUpdateCatBody,
} from "@/server/cats/parse-cat-body";
import { HttpError } from "@/server/http/http-error";

test("parseCreateCatBody: 이름·품종 기본값", () => {
  expect(parseCreateCatBody({ name: "  나비  ", breed: "", age: 3 })).toEqual({
    name: "나비",
    age: 3,
    breed: "mixed",
  });
});

test("parseCreateCatBody: age 생략 시 1", () => {
  expect(parseCreateCatBody({ name: "a", breed: "k" })).toEqual({
    name: "a",
    age: 1,
    breed: "k",
  });
});

test("parseCreateCatBody: 잘못된 age", () => {
  expect(() => parseCreateCatBody({ name: "a", age: 41 })).toThrow(HttpError);
});

test("parseUpdateCatBody: 필드 없으면 400", () => {
  expect(() => parseUpdateCatBody({})).toThrow(HttpError);
});

test("parseUpdateCatBody: breed 빈 문자열은 mixed", () => {
  expect(parseUpdateCatBody({ breed: "   " })).toEqual({ breed: "mixed" });
});
