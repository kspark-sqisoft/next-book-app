import { expect, test } from "vitest";

import {
  AUTO_SLIDE_TITLE_RE,
  DEFAULT_PAGE_BACKGROUND,
  sanitizePageBackgroundColor,
  slideDisplayLabel,
} from "@/lib/book-canvas";

test("slideDisplayLabel", () => {
  expect(slideDisplayLabel("  제목  ", 0)).toBe("제목");
  expect(slideDisplayLabel("", 2)).toBe("슬라이드 3");
});

test("AUTO_SLIDE_TITLE_RE", () => {
  expect(AUTO_SLIDE_TITLE_RE.test("슬라이드 12")).toBe(true);
  expect(AUTO_SLIDE_TITLE_RE.test("커스텀")).toBe(false);
});

test("sanitizePageBackgroundColor", () => {
  expect(sanitizePageBackgroundColor("  #f0f0f0  ")).toBe("#f0f0f0");
  expect(sanitizePageBackgroundColor("url(javascript:1)")).toBe(
    DEFAULT_PAGE_BACKGROUND,
  );
});
