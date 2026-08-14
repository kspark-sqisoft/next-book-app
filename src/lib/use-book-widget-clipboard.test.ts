// 위젯 클립보드 순수 함수 검증 — id 재발급·오프셋 규칙·클램프
import { describe, expect, it } from "vitest";

import type { BookCanvasElement } from "@/lib/book-canvas";
import {
  BOOK_WIDGET_PASTE_OFFSET_PX,
  nextBookWidgetPasteStepPx,
  placeBookWidgetPaste,
  regenerateBookElementIds,
} from "@/lib/use-book-widget-clipboard";

const imageEl = (over: Partial<Extract<BookCanvasElement, { type: "image" }>> = {}) =>
  ({
    id: "img-1",
    type: "image",
    x: 100,
    y: 80,
    width: 200,
    height: 120,
    src: "/uploads/a.png",
    ...over,
  }) as Extract<BookCanvasElement, { type: "image" }>;

describe("regenerateBookElementIds", () => {
  it("새 id를 발급하고 원본은 건드리지 않는다", () => {
    const src = imageEl();
    const out = regenerateBookElementIds(src);
    expect(out.id).not.toBe(src.id);
    expect(src.id).toBe("img-1");
    // 깊은 독립성: 복제본 수정이 원본에 영향 없음
    out.x = 999;
    expect(src.x).toBe(100);
  });

  it("미디어 재생목록의 중첩 항목 id도 재발급한다", () => {
    const src: BookCanvasElement = {
      id: "pl-1",
      type: "mediaPlaylist",
      x: 0,
      y: 0,
      width: 480,
      height: 270,
      mediaPlaylistItems: [
        { id: "item-1", kind: "image", src: "/uploads/a.png" },
        { id: "item-2", kind: "video", src: "/uploads/b.mp4", posterSrc: null },
      ],
    };
    const out = regenerateBookElementIds(src);
    if (out.type !== "mediaPlaylist") throw new Error("타입 보존 실패");
    const ids = (out.mediaPlaylistItems ?? []).map((it) => it.id);
    expect(ids).not.toContain("item-1");
    expect(ids).not.toContain("item-2");
    expect(new Set(ids).size).toBe(2);
    // 원본 항목 id 불변
    expect(
      src.type === "mediaPlaylist" && src.mediaPlaylistItems?.[0]?.id,
    ).toBe("item-1");
  });
});

describe("nextBookWidgetPasteStepPx", () => {
  const base = {
    sourcePageIndex: 0,
    lastPastePageIndex: null,
    lastPasteStepPx: 0,
  };

  it("원본 페이지 첫 붙여넣기는 +16", () => {
    expect(nextBookWidgetPasteStepPx(base, 0)).toBe(BOOK_WIDGET_PASTE_OFFSET_PX);
  });

  it("다른 페이지 첫 붙여넣기는 원본 좌표(0)", () => {
    expect(nextBookWidgetPasteStepPx(base, 2)).toBe(0);
  });

  it("같은 페이지 반복 붙여넣기는 계단식 누적", () => {
    const afterFirst = {
      ...base,
      lastPastePageIndex: 0,
      lastPasteStepPx: BOOK_WIDGET_PASTE_OFFSET_PX,
    };
    expect(nextBookWidgetPasteStepPx(afterFirst, 0)).toBe(
      BOOK_WIDGET_PASTE_OFFSET_PX * 2,
    );
  });

  it("다른 페이지에 반복 붙여넣기도 두 번째부터 밀어낸다", () => {
    const afterFirstOnPage2 = {
      ...base,
      lastPastePageIndex: 2,
      lastPasteStepPx: 0,
    };
    expect(nextBookWidgetPasteStepPx(afterFirstOnPage2, 2)).toBe(
      BOOK_WIDGET_PASTE_OFFSET_PX,
    );
  });
});

describe("placeBookWidgetPaste", () => {
  it("오프셋을 적용하고 각 요소에 새 id를 발급한다", () => {
    const out = placeBookWidgetPaste([imageEl()], 16, 1280, 720);
    expect(out).toHaveLength(1);
    expect(out[0]!.x).toBe(116);
    expect(out[0]!.y).toBe(96);
    expect(out[0]!.id).not.toBe("img-1");
  });

  it("캔버스 밖으로 나가지 않게 클램프한다", () => {
    const nearEdge = imageEl({ x: 1200, y: 650 });
    const out = placeBookWidgetPaste([nearEdge], 16, 1280, 720);
    expect(out[0]!.x).toBe(1280 - 200);
    expect(out[0]!.y).toBe(720 - 120);
  });

  it("붙여넣기마다 서로 다른 id (연속 두 번)", () => {
    const clipEls = [imageEl()];
    const a = placeBookWidgetPaste(clipEls, 16, 1280, 720);
    const b = placeBookWidgetPaste(clipEls, 32, 1280, 720);
    expect(a[0]!.id).not.toBe(b[0]!.id);
  });
});
