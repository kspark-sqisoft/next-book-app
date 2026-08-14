// 위젯 복사/잘라내기/붙여넣기 — 앱 내부 클립보드(OS 클립보드 미사용, 입력창 텍스트 복사와 충돌 방지)
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { BookCanvasElement } from "@/lib/book-canvas";

/** 같은 페이지 연속 붙여넣기 시 계단식으로 밀어내는 간격(논리 px) */
export const BOOK_WIDGET_PASTE_OFFSET_PX = 16;

export type BookWidgetClipboardState = {
  /** 복사 시점의 깊은 복제본 — 붙여넣기마다 다시 복제·새 id 발급 */
  elements: BookCanvasElement[];
  sourcePageIndex: number;
  /** 마지막 붙여넣기 대상 페이지 — 같은 페이지 반복 붙여넣기의 오프셋 누적 기준 */
  lastPastePageIndex: number | null;
  lastPasteStepPx: number;
};

/** 원본과 완전히 독립되도록 요소·중첩 항목(미디어 재생목록) id를 모두 재발급 */
export function regenerateBookElementIds(
  el: BookCanvasElement,
): BookCanvasElement {
  const next = structuredClone(el);
  next.id = crypto.randomUUID();
  if (next.type === "mediaPlaylist" && next.mediaPlaylistItems) {
    next.mediaPlaylistItems = next.mediaPlaylistItems.map((it) => ({
      ...it,
      id: crypto.randomUUID(),
    }));
  }
  return next;
}

/**
 * 이번 붙여넣기의 오프셋: 원본 페이지 첫 붙여넣기는 +16, 다른 페이지 첫 붙여넣기는 원본 좌표(0),
 * 같은 페이지에 반복해서 붙여넣으면 겹치지 않게 계속 +16씩 밀어낸다.
 */
export function nextBookWidgetPasteStepPx(
  clip: Pick<
    BookWidgetClipboardState,
    "sourcePageIndex" | "lastPastePageIndex" | "lastPasteStepPx"
  >,
  targetPageIndex: number,
): number {
  if (clip.lastPastePageIndex === targetPageIndex) {
    return clip.lastPasteStepPx + BOOK_WIDGET_PASTE_OFFSET_PX;
  }
  return targetPageIndex === clip.sourcePageIndex
    ? BOOK_WIDGET_PASTE_OFFSET_PX
    : 0;
}

/** 붙여넣을 요소들 생성 — 새 id, 오프셋 적용, 캔버스(슬라이드) 안으로 클램프 */
export function placeBookWidgetPaste(
  elements: BookCanvasElement[],
  stepPx: number,
  slideWidth: number,
  slideHeight: number,
): BookCanvasElement[] {
  return elements.map((src) => {
    const el = regenerateBookElementIds(src);
    // 텍스트는 width/height가 선택 필드 — 클램프용 최소 크기만 가정
    const w =
      "width" in el && typeof el.width === "number" && el.width > 0
        ? el.width
        : 40;
    const h =
      "height" in el && typeof el.height === "number" && el.height > 0
        ? el.height
        : 40;
    const maxX = Math.max(0, slideWidth - Math.min(w, slideWidth));
    const maxY = Math.max(0, slideHeight - Math.min(h, slideHeight));
    el.x = Math.min(Math.max(0, el.x + stepPx), maxX);
    el.y = Math.min(Math.max(0, el.y + stepPx), maxY);
    return el;
  });
}

type UseBookWidgetClipboardOpts = {
  /** 캔버스에서 현재 선택된 요소 id들 */
  selectedIds: string[];
  activePageIndex: number;
  slideWidth: number;
  slideHeight: number;
  getActivePageElements: () => BookCanvasElement[];
  /** 현재 페이지 끝(맨 위 z)에 추가 — updatePages 히스토리를 타야 undo 가능 */
  appendElements: (els: BookCanvasElement[]) => void;
  removeElementsByIds: (ids: string[]) => void;
  setSelectedIds: (ids: string[]) => void;
};

export function useBookWidgetClipboard(opts: UseBookWidgetClipboardOpts) {
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const clipRef = useRef<BookWidgetClipboardState | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  const copyIds = useCallback((ids: string[]): boolean => {
    const o = optsRef.current;
    const idSet = new Set(ids);
    const els = o
      .getActivePageElements()
      .filter((el) => idSet.has(el.id))
      .map((el) => structuredClone(el));
    if (els.length === 0) return false;
    clipRef.current = {
      elements: els,
      sourcePageIndex: o.activePageIndex,
      lastPastePageIndex: null,
      lastPasteStepPx: 0,
    };
    setHasClipboard(true);
    return true;
  }, []);

  const cutIds = useCallback(
    (ids: string[]) => {
      if (!copyIds(ids)) return;
      optsRef.current.removeElementsByIds(ids);
    },
    [copyIds],
  );

  const copySelection = useCallback(() => {
    copyIds(optsRef.current.selectedIds);
  }, [copyIds]);

  const cutSelection = useCallback(() => {
    cutIds(optsRef.current.selectedIds);
  }, [cutIds]);

  /** 우클릭 메뉴: 클릭한 위젯이 현재 선택에 포함돼 있으면 선택 전체를 대상으로 */
  const idsForElement = (elementId: string): string[] => {
    const sel = optsRef.current.selectedIds;
    return sel.includes(elementId) ? sel : [elementId];
  };

  const copyElementOrSelection = useCallback(
    (elementId: string) => {
      copyIds(idsForElement(elementId));
    },
    [copyIds],
  );

  const cutElementOrSelection = useCallback(
    (elementId: string) => {
      cutIds(idsForElement(elementId));
    },
    [cutIds],
  );

  const paste = useCallback(() => {
    const clip = clipRef.current;
    if (!clip || clip.elements.length === 0) return;
    const o = optsRef.current;
    const step = nextBookWidgetPasteStepPx(clip, o.activePageIndex);
    const els = placeBookWidgetPaste(
      clip.elements,
      step,
      o.slideWidth,
      o.slideHeight,
    );
    o.appendElements(els);
    o.setSelectedIds(els.map((e) => e.id));
    clip.lastPastePageIndex = o.activePageIndex;
    clip.lastPasteStepPx = step;
  }, []);

  return {
    hasClipboard,
    copySelection,
    cutSelection,
    copyElementOrSelection,
    cutElementOrSelection,
    paste,
  };
}
