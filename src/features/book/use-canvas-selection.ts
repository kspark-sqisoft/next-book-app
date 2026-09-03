"use client";

import { useCallback, useMemo } from "react";

import type { BookEditorPageState } from "@/features/book/book-canvas";
import {
  setSelectedIds,
  toggleSelectedId,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/**
 * 스토어의 선택 목록 중 **현재 페이지에 실제로 있는 것**만 추린다.
 *
 * 선택은 스토어에 남는데 페이지를 옮기거나 요소를 지우면 없는 id 가 섞인다. 캔버스·
 * 인스펙터·레이어 목록은 이 걸러진 목록을 봐야 사라진 요소를 편집하려 들지 않는다.
 *
 * `inspectorSelectionKey` 는 "속성 패널이 지금 보고 있는 하나"다 — 정확히 하나가 선택됐을
 * 때만 값이 있고, 플레이리스트 원격 명령을 비우는 기준으로 쓴다.
 *
 * `onCanvasSelect` 는 캔버스의 선택 이벤트 — `id: null` 은 빈 곳 클릭(선택 해제)이고,
 * shift 면 기존 선택에 더하고 뺀다. 두 화면에 같은 4줄로 있었다.
 */
export function useCanvasSelection(page: BookEditorPageState | undefined) {
  const selectedIds = useBookEditorUiStore((s) => s.selectedIds);

  const canvasSelectedIds = useMemo(() => {
    if (!page) return [];
    const onPage = new Set(page.elements.map((e) => e.id));
    return selectedIds.filter((id) => onPage.has(id));
  }, [selectedIds, page]);

  const inspectorSelectionKey = useMemo(
    () => (canvasSelectedIds.length === 1 ? (canvasSelectedIds[0] ?? "") : ""),
    [canvasSelectedIds],
  );

  const onCanvasSelect = useCallback(
    (d: { id: string | null; shiftKey?: boolean }) => {
      if (d.id === null) setSelectedIds([]);
      else toggleSelectedId(d.id, d.shiftKey);
    },
    [],
  );

  return { canvasSelectedIds, inspectorSelectionKey, onCanvasSelect };
}
