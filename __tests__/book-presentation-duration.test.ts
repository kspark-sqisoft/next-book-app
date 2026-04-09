import { expect, test } from "vitest";

import type { BookCanvasElement } from "@/lib/book-canvas";
import {
  computeSlidePresentationDurationSec,
  DEFAULT_PRESENTATION_SLIDE_SEC,
  DEFAULT_WIDGET_PRESENTATION_SEC,
} from "@/lib/book-presentation";

test("타이밍 레이어 없으면 슬라이드 기본 초", () => {
  expect(
    computeSlidePresentationDurationSec({
      elements: [],
      presentationTimingElementId: null,
    }),
  ).toBe(DEFAULT_PRESENTATION_SLIDE_SEC);
});

test("텍스트 위젯 presentationHoldSec 반영", () => {
  const elements: BookCanvasElement[] = [
    {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      text: "hi",
      fontSize: 16,
      fill: "#000",
      presentationHoldSec: 42,
    },
  ];
  expect(
    computeSlidePresentationDurationSec({
      elements,
      presentationTimingElementId: "t1",
    }),
  ).toBe(42);
});

test("hold 미지정 시 위젯 기본 초", () => {
  const elements: BookCanvasElement[] = [
    {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      text: "hi",
      fontSize: 16,
      fill: "#000",
    },
  ];
  expect(
    computeSlidePresentationDurationSec({
      elements,
      presentationTimingElementId: "t1",
    }),
  ).toBe(DEFAULT_WIDGET_PRESENTATION_SEC);
});
