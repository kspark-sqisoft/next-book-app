"use client";

import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import {
  applyAutoSlideNamesByIndex,
  type BookCanvasElement,
  type BookEditorPageState,
  createEmptyEditorPage,
} from "@/features/book/book-canvas";
import { setPageIndex, setSelectedIds } from "@/features/book/editor-ui-store";

type UpdatePages = (
  recipe: (draft: Draft<BookEditorPageState>[]) => void,
) => void;

type CommitPages = (
  recipe: (prev: BookEditorPageState[]) => BookEditorPageState[],
) => void;

/**
 * AI 어시스턴트가 문서를 고치는 경로.
 *
 * 사람이 직접 하는 조작과 두 가지가 다르다.
 *
 * 1. **슬라이드를 1부터 센다.** 사람은 화면에서 페이지를 고르고 조작하지만 AI 는
 *    "3번 슬라이드에" 처럼 번호로 말한다. 번호 → 인덱스 변환이 여기 모여 있다.
 * 2. **결과를 보여 줘야 한다.** AI 가 다른 슬라이드를 고쳤으면 그리로 옮겨 주지 않으면
 *    사용자에게는 아무 일도 안 일어난 것처럼 보인다.
 *
 * 두 화면에 같은 복사본으로 있었다.
 */
export function useAiDocumentEdits(opts: {
  activePageIndex: number;
  pageCount: number;
  updatePages: UpdatePages;
  commitPages: CommitPages;
  setSlideWidth: (v: number) => void;
  setSlideHeight: (v: number) => void;
}) {
  const {
    activePageIndex,
    pageCount,
    updatePages,
    commitPages,
    setSlideWidth,
    setSlideHeight,
  } = opts;

  /** 번호를 주면 그 슬라이드로 옮겨 가며 넣고, 주지 않으면 현재 슬라이드에 넣는다 */
  const applyAiElements = useCallback(
    (elements: BookCanvasElement[], opts?: { targetSlideNumber?: number }) => {
      if (elements.length === 0) return;
      const targeted =
        typeof opts?.targetSlideNumber === "number" &&
        Number.isFinite(opts.targetSlideNumber);
      let navigatedIdx: number | null = null;
      updatePages((draft) => {
        const maxIdx = Math.max(0, draft.length - 1);
        const idx = targeted
          ? Math.min(
              maxIdx,
              Math.max(0, Math.round(opts!.targetSlideNumber!) - 1),
            )
          : Math.min(Math.max(0, activePageIndex), maxIdx);
        const p = draft[idx];
        if (!p) return;
        for (const el of elements) p.elements.push(el);
        if (targeted) navigatedIdx = idx;
      });
      // 다른 슬라이드에 넣었으면 그리로 옮긴다 — 안 그러면 아무 일도 없어 보인다
      if (navigatedIdx != null) setPageIndex(navigatedIdx);
      setSelectedIds([elements[elements.length - 1]!.id]);
    },
    [activePageIndex, updatePages],
  );

  /** 한 번에 20장까지 — AI 가 큰 수를 말해도 문서가 통째로 불어나지 않게 */
  const addPagesFromAi = useCallback(
    (count: number) => {
      const n = Math.min(20, Math.max(1, Math.round(count)));
      commitPages((prev) => {
        const next = [...prev];
        for (let i = 0; i < n; i++)
          next.push(createEmptyEditorPage(next.length));
        return applyAutoSlideNamesByIndex(next);
      });
      setPageIndex(pageCount + n - 1);
      setSelectedIds([]);
    },
    [commitPages, pageCount],
  );

  const applySlideDimensionsFromAi = useCallback(
    (partial: { slideWidth?: number; slideHeight?: number }) => {
      if (typeof partial.slideWidth === "number")
        setSlideWidth(partial.slideWidth);
      if (typeof partial.slideHeight === "number")
        setSlideHeight(partial.slideHeight);
    },
    [setSlideHeight, setSlideWidth],
  );

  return useMemo(
    () => ({ applyAiElements, addPagesFromAi, applySlideDimensionsFromAi }),
    [applyAiElements, addPagesFromAi, applySlideDimensionsFromAi],
  );
}
