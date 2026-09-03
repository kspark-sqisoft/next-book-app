"use client";

import { useCallback, useMemo } from "react";

import {
  applyAutoSlideNamesByIndex,
  type BookEditorPageState,
  createEmptyEditorPage,
  duplicateBookEditorPage,
  pageIndexAfterRemove,
} from "@/features/book/book-canvas";
import {
  closePageDelete,
  openPageDelete,
  setPageIndex,
  setSelectedIds,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/** 페이지 배열 전체를 한 번에 바꾸고 undo 한 칸을 남긴다 */
type CommitPages = (
  recipe: (prev: BookEditorPageState[]) => BookEditorPageState[],
) => void;

/**
 * 슬라이드(페이지) 자체를 더하고 지우고 복제하는 조작들.
 *
 * 이 65줄이 `BookDetailPage` 와 `BookEditorPage` 에 글자 단위로 같은 복사본으로 있었다.
 * 요소를 다루는 `useElementMutations`·`useWidgetInserters` 와 달리 여기는 **페이지 배열**
 * 이 대상이라 `commitPages`(통째 교체)를 쓴다.
 *
 * 세 조작이 공통으로 지키는 규칙 둘:
 * - 순서가 바뀌면 `sortOrder` 와 자동 이름을 다시 매긴다. 안 하면 사이드바의 "슬라이드 n"
 *   이 실제 위치와 어긋난다.
 * - 페이지를 옮긴 뒤 선택을 비운다. 남겨 두면 다른 페이지의 요소가 선택된 채로 남아
 *   인스펙터가 화면에 없는 것을 편집한다.
 */
export function usePageOperations(opts: {
  activePageIndex: number;
  commitPages: CommitPages;
}) {
  const { activePageIndex, commitPages } = opts;
  const pageDeleteIndex = useBookEditorUiStore((s) => s.pageDeleteIndex);

  const addPageAtInsertIndex = useCallback(
    (insertIndex: number) => {
      commitPages((prev) => {
        const idx = Math.max(0, Math.min(insertIndex, prev.length));
        const newPage = createEmptyEditorPage(0);
        const next = [...prev.slice(0, idx), newPage, ...prev.slice(idx)];
        return applyAutoSlideNamesByIndex(
          next.map((p, i) => ({ ...p, sortOrder: i })),
        );
      });
      setPageIndex(insertIndex);
      setSelectedIds([]);
    },
    [commitPages],
  );

  /** 확인 창을 거쳐서만 부른다(내부 전용). 마지막 한 장은 지우지 않는다 — 페이지가 0개인 편집 화면은 성립하지 않는다 */
  const removePageAt = useCallback(
    (index: number) => {
      let nextIdx = activePageIndex;
      commitPages((prev) => {
        if (prev.length <= 1 || index < 0 || index >= prev.length) return prev;
        const next = prev.filter((_, i) => i !== index);
        nextIdx = pageIndexAfterRemove(activePageIndex, index, prev.length);
        return applyAutoSlideNamesByIndex(next);
      });
      setPageIndex(nextIdx);
      setSelectedIds([]);
    },
    [activePageIndex, commitPages],
  );

  const requestRemovePageAt = useCallback((index: number) => {
    openPageDelete(index);
  }, []);

  const requestRemoveCurrentPageForAi = useCallback(() => {
    requestRemovePageAt(activePageIndex);
  }, [activePageIndex, requestRemovePageAt]);

  const confirmRemovePageAt = useCallback(() => {
    if (pageDeleteIndex != null) removePageAt(pageDeleteIndex);
    closePageDelete();
  }, [pageDeleteIndex, removePageAt]);

  const duplicatePageAt = useCallback(
    (index: number) => {
      commitPages((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const dup = duplicateBookEditorPage(prev[index]);
        const next = [
          ...prev.slice(0, index + 1),
          dup,
          ...prev.slice(index + 1),
        ];
        return applyAutoSlideNamesByIndex(
          next.map((p, i) => ({ ...p, sortOrder: i })),
        );
      });
      setPageIndex(index + 1);
      setSelectedIds([]);
    },
    [commitPages],
  );

  return useMemo(
    () => ({
      addPageAtInsertIndex,
      requestRemovePageAt,
      requestRemoveCurrentPageForAi,
      confirmRemovePageAt,
      duplicatePageAt,
    }),
    [
      addPageAtInsertIndex,
      requestRemovePageAt,
      requestRemoveCurrentPageForAi,
      confirmRemovePageAt,
      duplicatePageAt,
    ],
  );
}
