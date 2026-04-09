import { expect, test } from "vitest";

import {
  isPostCategoryId,
  POST_CATEGORY_LABELS,
  POST_CATEGORY_VALUES,
} from "@/lib/post-categories";

test("허용 카테고리 id 목록이 고정 순서를 유지한다", () => {
  expect(POST_CATEGORY_VALUES).toEqual([
    "tech",
    "life",
    "study",
    "chat",
    "general",
  ]);
});

test("isPostCategoryId 가 유효한 id만 통과시킨다", () => {
  expect(isPostCategoryId("tech")).toBe(true);
  expect(isPostCategoryId("general")).toBe(true);
  expect(isPostCategoryId("invalid")).toBe(false);
  expect(isPostCategoryId("")).toBe(false);
});

test("POST_CATEGORY_LABELS 가 한글 라벨을 제공한다", () => {
  expect(POST_CATEGORY_LABELS.tech).toBe("기술");
  expect(POST_CATEGORY_LABELS.general).toBe("일반");
});
