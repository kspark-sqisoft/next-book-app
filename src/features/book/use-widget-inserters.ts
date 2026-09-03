"use client";

import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  type BookShapeKind,
  createBookShapeElement,
  placeBookShapeElementAtPointer,
} from "@/features/book/book-canvas";
import { setSelectedIds } from "@/features/book/editor-ui-store";
import {
  createAdSlotWidget,
  createCalendarWidget,
  createChartWidget,
  createDigitalClockWidget,
  createMapWidget,
  createNewsWidget,
  createQrWidget,
  createTextWidget,
  createTickerWidget,
  createWeatherWidget,
  createWebviewWidget,
  createYoutubeWidget,
} from "@/features/book/widget-factories";

type UpdatePages = (
  recipe: (draft: Draft<BookEditorPageState>[]) => void,
) => void;

/**
 * "위젯 하나를 현재 슬라이드에 놓고 선택한다"는 절차를 한 번만 구현한다.
 *
 * 이전에는 위젯 종류마다 `addXAt` 핸들러가 있었고 그 안에 같은 3줄이 반복됐다.
 * 그 핸들러 13개가 `BookDetailPage` 와 `BookEditorPage` 에 **글자 단위로 같은 복사본**으로
 * 존재했다(2026-09-02 리뷰의 "동명 핸들러 21개"). 종류별 차이는 기본값뿐이라
 * `widget-factories.ts` 로 빼고, 절차는 여기 하나로 모았다.
 */
export function useWidgetInserters(opts: {
  activePageIndex: number;
  updatePages: UpdatePages;
  slideWidth: number;
  slideHeight: number;
}) {
  const { activePageIndex, updatePages, slideWidth, slideHeight } = opts;

  /** 현재 슬라이드 맨 위에 올리고 선택 — 모든 삽입이 거쳐 가는 유일한 지점 */
  const appendElement = useCallback(
    (el: BookCanvasElement) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements.push(el as Draft<BookCanvasElement>);
      });
      setSelectedIds([el.id]);
    },
    [activePageIndex, updatePages],
  );

  /** 좌표를 받아 요소를 만드는 팩토리를 삽입 핸들러로 바꾼다 */
  const inserterFor = useCallback(
    (make: (x: number, y: number) => BookCanvasElement) =>
      (x: number, y: number) => {
        appendElement(make(x, y));
      },
    [appendElement],
  );

  /** 도형은 슬라이드 크기에 맞춰 만들고 포인터 위치로 옮긴 뒤 넣는다 */
  const addShapeAt = useCallback(
    (x: number, y: number, kind: BookShapeKind) => {
      const base = createBookShapeElement(kind, slideWidth, slideHeight);
      appendElement(
        placeBookShapeElementAtPointer(base, x, y, slideWidth, slideHeight),
      );
    },
    [appendElement, slideHeight, slideWidth],
  );

  const addFromElementsPanel = useCallback(
    (kind: BookShapeKind) => {
      appendElement(createBookShapeElement(kind, slideWidth, slideHeight));
    },
    [appendElement, slideHeight, slideWidth],
  );

  return useMemo(
    () => ({
      appendElement,
      addShapeAt,
      addFromElementsPanel,
      addTextAt: inserterFor(createTextWidget),
      addWeatherAt: inserterFor(createWeatherWidget),
      addDigitalClockAt: inserterFor(createDigitalClockWidget),
      addNewsAt: inserterFor(createNewsWidget),
      addTickerAt: inserterFor(createTickerWidget),
      addQrAt: inserterFor(createQrWidget),
      addWebviewAt: inserterFor(createWebviewWidget),
      addYoutubeAt: inserterFor(createYoutubeWidget),
      addMapAt: inserterFor(createMapWidget),
      addChartAt: inserterFor(createChartWidget),
      addCalendarAt: inserterFor(createCalendarWidget),
      addAdSlotAt: inserterFor(createAdSlotWidget),
    }),
    [appendElement, addShapeAt, addFromElementsPanel, inserterFor],
  );
}
