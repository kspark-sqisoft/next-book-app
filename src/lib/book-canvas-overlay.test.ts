// 공통(오버라이드) 위젯 대상 페이지 계산 테스트
import { describe, expect, it } from "vitest";

import {
  type BookCanvasElement,
  collectBookOverlayElements,
  resolveBookElementOverlayPages,
} from "@/lib/book-canvas";

function textEl(
  id: string,
  overlayPages?: "all" | number[],
  visible?: boolean,
): BookCanvasElement {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    text: id,
    fontSize: 28,
    fill: "#111827",
    ...(overlayPages !== undefined ? { overlayPages } : {}),
    ...(visible !== undefined ? { visible } : {}),
  } as BookCanvasElement;
}

describe("resolveBookElementOverlayPages", () => {
  it('"all"은 그대로, 배열은 정수만 중복 제거·정렬', () => {
    expect(resolveBookElementOverlayPages(textEl("a", "all"))).toBe("all");
    expect(
      resolveBookElementOverlayPages(textEl("a", [3, 1, 3, -1, 1.5])),
    ).toEqual([1, 3]);
  });

  it("없거나 빈 배열·잘못된 값은 null(일반 요소)", () => {
    expect(resolveBookElementOverlayPages(textEl("a"))).toBeNull();
    expect(resolveBookElementOverlayPages(textEl("a", []))).toBeNull();
    expect(
      resolveBookElementOverlayPages({
        overlayPages: "everything" as unknown as "all",
      }),
    ).toBeNull();
  });
});

describe("collectBookOverlayElements", () => {
  const pages = [
    { sortOrder: 0, elements: [textEl("clock", "all"), textEl("plain")] },
    { sortOrder: 1, elements: [textEl("news", [2])] },
    { sortOrder: 2, elements: [] },
  ];

  it('"all"은 원본 외 모든 페이지에, 배열은 지정 페이지에만', () => {
    expect(collectBookOverlayElements(pages, 0).map((e) => e.id)).toEqual([]);
    expect(collectBookOverlayElements(pages, 1).map((e) => e.id)).toEqual([
      "clock",
    ]);
    expect(collectBookOverlayElements(pages, 2).map((e) => e.id)).toEqual([
      "clock",
      "news",
    ]);
  });

  it("숨긴 요소(visible=false)는 제외", () => {
    const withHidden = [
      { sortOrder: 0, elements: [textEl("hidden", "all", false)] },
      { sortOrder: 1, elements: [] },
    ];
    expect(collectBookOverlayElements(withHidden, 1)).toEqual([]);
  });
});
