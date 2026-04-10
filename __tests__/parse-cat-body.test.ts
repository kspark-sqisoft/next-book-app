import { expect, test } from "vitest";

// 파서 단위 테스트 대상
import {
  parseCreateCatBody,
  parseUpdateCatBody,
} from "@/server/cats/parse-cat-body";
import { HttpError } from "@/server/http/http-error";

// 이름 trim, 빈 품종 → mixed
test("parseCreateCatBody: 이름·품종 기본값", () => {
  expect(parseCreateCatBody({ name: "  나비  ", breed: "", age: 3 })).toEqual({
    name: "나비",
    age: 3,
    breed: "mixed",
  });
});

// age 키 생략 시 기본 1
test("parseCreateCatBody: age 생략 시 1", () => {
  expect(parseCreateCatBody({ name: "a", breed: "k" })).toEqual({
    name: "a",
    age: 1,
    breed: "k",
  });
});

// 상한 40 초과는 HttpError
test("parseCreateCatBody: 잘못된 age", () => {
  expect(() => parseCreateCatBody({ name: "a", age: 41 })).toThrow(HttpError);
});

// PATCH 성격: 최소 한 필드 없으면 400
test("parseUpdateCatBody: 필드 없으면 400", () => {
  expect(() => parseUpdateCatBody({})).toThrow(HttpError);
});

// breed만 보내고 공백이면 mixed로 정규화
test("parseUpdateCatBody: breed 빈 문자열은 mixed", () => {
  expect(parseUpdateCatBody({ breed: "   " })).toEqual({ breed: "mixed" });
});
