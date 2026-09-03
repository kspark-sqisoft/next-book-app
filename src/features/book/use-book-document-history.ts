import { type Draft, produce } from "immer";
import { useCallback, useState } from "react";

import type { BookEditorPageState } from "@/features/book/book-canvas";

const MAX_HISTORY = 80;

export function cloneBookPages(
  pages: BookEditorPageState[],
): BookEditorPageState[] {
  return structuredClone(pages);
}

type DocState = {
  pages: BookEditorPageState[];
  past: BookEditorPageState[][];
  future: BookEditorPageState[][];
};

/**
 * 북 페이지 배열에 대한 undo/redo. Immer 레시피는 `updatePages`, 전체 치환·함수형 갱신은 `commitPages`.
 */
export function useBookDocumentHistory(initialPages: BookEditorPageState[]) {
  const [doc, setDoc] = useState<DocState>(() => ({
    pages: initialPages,
    past: [],
    future: [],
  }));

  const updatePages = useCallback(
    (recipe: (draft: Draft<BookEditorPageState>[]) => void) => {
      setDoc(({ pages, past, future }) => {
        const next = produce(pages, recipe);
        if (next === pages) return { pages, past, future };
        return {
          pages: next,
          past: [...past.slice(-(MAX_HISTORY - 1)), cloneBookPages(pages)],
          future: [],
        };
      });
    },
    [],
  );

  const commitPages = useCallback(
    (fn: (prev: BookEditorPageState[]) => BookEditorPageState[]) => {
      setDoc(({ pages, past, future }) => {
        const next = fn(pages);
        if (next === pages) return { pages, past, future };
        return {
          pages: next,
          past: [...past.slice(-(MAX_HISTORY - 1)), cloneBookPages(pages)],
          future: [],
        };
      });
    },
    [],
  );

  /**
   * 히스토리에 남기지 않는 갱신 — 파생 상태 자동 교정(예: 삭제된 타이밍 요소 id 정리) 전용.
   * 사용자가 하지 않은 조작이 undo 스택에 끼어 Ctrl+Z가 한 번 헛도는 것을 막는다.
   */
  const updatePagesSilent = useCallback(
    (recipe: (draft: Draft<BookEditorPageState>[]) => void) => {
      setDoc(({ pages, past, future }) => {
        const next = produce(pages, recipe);
        if (next === pages) return { pages, past, future };
        return { pages: next, past, future };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setDoc(({ pages, past, future }) => {
      if (past.length === 0) return { pages, past, future };
      const prev = past[past.length - 1]!;
      return {
        pages: prev,
        past: past.slice(0, -1),
        future: [cloneBookPages(pages), ...future].slice(0, MAX_HISTORY),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setDoc(({ pages, past, future }) => {
      if (future.length === 0) return { pages, past, future };
      const nxt = future[0]!;
      return {
        pages: nxt,
        past: [...past.slice(-(MAX_HISTORY - 1)), cloneBookPages(pages)],
        future: future.slice(1),
      };
    });
  }, []);

  return {
    pages: doc.pages,
    updatePages,
    updatePagesSilent,
    commitPages,
    undo,
    redo,
    canUndo: doc.past.length > 0,
    canRedo: doc.future.length > 0,
  };
}
