"use client";

import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import {
  type BookEditorPageState,
  resolveEffectivePresentationTimingElementId,
} from "@/features/book/book-canvas";
import type { BookPresentationTransitionId } from "@/features/book/book-presentation-transition";

type MutateActivePage = (
  recipe: (page: Draft<BookEditorPageState>) => void,
) => void;

type UpdatePages = (
  recipe: (draft: Draft<BookEditorPageState>[]) => void,
) => void;

/**
 * 슬라이드 **한 장의 속성**(이름·배경·전환·재생 시간 기준)을 고치는 조작들.
 *
 * `usePageOperations` 가 페이지 배열을 더하고 지운다면 여기는 한 장의 내용을 다룬다.
 * 두 화면에 같은 복사본으로 있었다.
 */
export function usePageProperties(opts: {
  activePageIndex: number;
  pageCount: number;
  updatePages: UpdatePages;
  mutateActivePage: MutateActivePage;
}) {
  const { activePageIndex, pageCount, updatePages, mutateActivePage } = opts;

  const updateCurrentPageName = useCallback(
    (name: string) => {
      mutateActivePage((p) => {
        p.name = name;
      });
    },
    [mutateActivePage],
  );

  /** 현재 페이지가 아닌 슬라이드의 이름 — 지금은 AI 경로만 쓴다(내부 전용) */
  const updatePageNameAt = useCallback(
    (index: number, name: string) => {
      updatePages((draft) => {
        const p = draft[index];
        if (p) p.name = name;
      });
    },
    [updatePages],
  );

  /** AI 는 "몇 번째 슬라이드"를 1부터 센다. 번호를 주지 않으면 현재 페이지 */
  const applyPageTitleFromAi = useCallback(
    (name: string, opts?: { slideNumber?: number }) => {
      const n = opts?.slideNumber;
      if (n == null || !Number.isFinite(n)) {
        updatePageNameAt(activePageIndex, name);
        return;
      }
      if (pageCount === 0) return;
      const idx = Math.round(n) - 1;
      updatePageNameAt(Math.min(pageCount - 1, Math.max(0, idx)), name);
    },
    [activePageIndex, pageCount, updatePageNameAt],
  );

  const updateCurrentPageBackground = useCallback(
    (backgroundColor: string) => {
      mutateActivePage((p) => {
        p.backgroundColor = backgroundColor;
      });
    },
    [mutateActivePage],
  );

  const updatePresentationTransition = useCallback(
    (transition: BookPresentationTransitionId) => {
      mutateActivePage((p) => {
        p.presentationTransition = transition;
      });
    },
    [mutateActivePage],
  );

  const updatePresentationTransitionMs = useCallback(
    (ms: number) => {
      mutateActivePage((p) => {
        p.presentationTransitionMs = ms;
      });
    },
    [mutateActivePage],
  );

  /**
   * 슬라이드쇼에서 이 페이지에 머무는 시간의 기준이 될 요소.
   *
   * 지금 UI 는 목록에서 고른 유효한 id 만 넘기므로 아래 폴백은 도달하지 않는다. 그래서
   * 두 화면의 구현이 서로 달랐는데도 아무도 몰랐다 — 한쪽은 기존 선택을 유지하고
   * 다른 쪽은 첫 요소로 되돌렸다. 유지하는 쪽으로 맞춘다: 잘못된 값이 왔다고 해서
   * 사용자가 이미 고른 유효한 기준을 버릴 이유가 없다.
   */
  const updatePresentationTimingElementId = useCallback(
    (id: string | null) => {
      mutateActivePage((p) => {
        if (p.elements.length === 0) {
          p.presentationTimingElementId = null;
          return;
        }
        const trimmed = typeof id === "string" ? id.trim() : "";
        if (trimmed && p.elements.some((e) => e.id === trimmed)) {
          p.presentationTimingElementId = trimmed;
          return;
        }
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(
            p.elements,
            p.presentationTimingElementId,
          );
      });
    },
    [mutateActivePage],
  );

  return useMemo(
    () => ({
      updateCurrentPageName,
      applyPageTitleFromAi,
      updateCurrentPageBackground,
      updatePresentationTransition,
      updatePresentationTransitionMs,
      updatePresentationTimingElementId,
    }),
    [
      updateCurrentPageName,
      applyPageTitleFromAi,
      updateCurrentPageBackground,
      updatePresentationTransition,
      updatePresentationTransitionMs,
      updatePresentationTimingElementId,
    ],
  );
}
