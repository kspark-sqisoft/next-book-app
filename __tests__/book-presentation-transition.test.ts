import { expect, test } from "vitest";

import {
  clampBookPresentationTransitionMs,
  DEFAULT_BOOK_PRESENTATION_TRANSITION_MS,
  isBookPresentationTransitionId,
  normalizeBookPresentationTransition,
} from "@/lib/book-presentation-transition";

test("normalizeBookPresentationTransition 가 알 수 없는 값을 none 으로 만든다", () => {
  expect(normalizeBookPresentationTransition(undefined)).toBe("none");
  expect(normalizeBookPresentationTransition("")).toBe("none");
  expect(normalizeBookPresentationTransition("fade")).toBe("fade");
  expect(normalizeBookPresentationTransition("  slideLeft  ")).toBe(
    "slideLeft",
  );
  expect(normalizeBookPresentationTransition("nope")).toBe("none");
});

test("clampBookPresentationTransitionMs 가 범위를 제한한다", () => {
  expect(clampBookPresentationTransitionMs(450)).toBe(450);
  expect(clampBookPresentationTransitionMs(10)).toBe(80);
  expect(clampBookPresentationTransitionMs(99999)).toBe(2500);
  expect(clampBookPresentationTransitionMs(NaN)).toBe(
    DEFAULT_BOOK_PRESENTATION_TRANSITION_MS,
  );
});

test("isBookPresentationTransitionId", () => {
  expect(isBookPresentationTransitionId("zoomIn")).toBe(true);
  expect(isBookPresentationTransitionId("none")).toBe(true);
  expect(isBookPresentationTransitionId("fade")).toBe(true);
  expect(isBookPresentationTransitionId("invalid")).toBe(false);
});
