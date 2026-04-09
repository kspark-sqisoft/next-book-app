import { expect, test, vi } from "vitest";

import {
  normalizePostCategory,
  randomPostCategory,
} from "@/server/posts/post-categories";

test("normalizePostCategory", () => {
  expect(normalizePostCategory("TECH")).toBe("tech");
  expect(normalizePostCategory("")).toBe("general");
  expect(normalizePostCategory(null)).toBe("general");
  expect(normalizePostCategory("unknown")).toBe("general");
});

test("randomPostCategory 는 허용 id 중 하나", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  expect(randomPostCategory()).toBe("tech");
  vi.spyOn(Math, "random").mockReturnValue(0.999);
  expect(randomPostCategory()).toBe("general");
  vi.restoreAllMocks();
});
