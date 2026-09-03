"use client";

import { useCallback, useMemo } from "react";

import type { BookEditorPageState } from "@/features/book/book-canvas";
import { widgetDeleteTargetLabel } from "@/features/book/book-element-labels";
import {
  closeWidgetDelete,
  openWidgetDelete,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/**
 * 위젯 삭제는 확인 창을 거친다 — "요청 → 확인 → 제거" 세 단계.
 *
 * 요청 경로가 넷이다: 우클릭 메뉴·레이어 목록(요소 하나), 인스펙터의 삭제(선택 하나),
 * 다중 선택 인스펙터(선택 전부). 어느 경로든 실제 제거는 `confirmRemoveWidget` 한 곳에서만
 * 일어난다. 두 화면에 같은 복사본으로 있었다.
 */
export function useWidgetDeleteFlow(opts: {
  activePage: BookEditorPageState | undefined;
  /** 현재 페이지에 실제로 있는 선택만 */
  canvasSelectedIds: readonly string[];
  removeElementsByIds: (ids: string[]) => void;
}) {
  const { activePage, canvasSelectedIds, removeElementsByIds } = opts;
  const widgetDeleteIds = useBookEditorUiStore((s) => s.widgetDeleteIds);

  const requestRemoveWidget = useCallback((elementId: string) => {
    openWidgetDelete([elementId]);
  }, []);

  const confirmRemoveWidget = useCallback(() => {
    if (widgetDeleteIds.length > 0) removeElementsByIds(widgetDeleteIds);
    closeWidgetDelete();
  }, [widgetDeleteIds, removeElementsByIds]);

  /** 인스펙터의 삭제 — 정확히 하나 선택됐을 때만 */
  const removeSelected = useCallback(() => {
    if (canvasSelectedIds.length !== 1) return;
    requestRemoveWidget(canvasSelectedIds[0]!);
  }, [canvasSelectedIds, requestRemoveWidget]);

  const removeSelectedBulk = useCallback(() => {
    if (canvasSelectedIds.length === 0) return;
    openWidgetDelete([...canvasSelectedIds]);
  }, [canvasSelectedIds]);

  const widgetDeleteKindLabel = useMemo(
    () => widgetDeleteTargetLabel(widgetDeleteIds, activePage),
    [widgetDeleteIds, activePage],
  );

  return useMemo(
    () => ({
      widgetDeleteIds,
      widgetDeleteKindLabel,
      requestRemoveWidget,
      confirmRemoveWidget,
      removeSelected,
      removeSelectedBulk,
    }),
    [
      widgetDeleteIds,
      widgetDeleteKindLabel,
      requestRemoveWidget,
      confirmRemoveWidget,
      removeSelected,
      removeSelectedBulk,
    ],
  );
}
