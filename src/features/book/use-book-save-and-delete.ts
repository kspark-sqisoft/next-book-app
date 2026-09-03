"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type BookEditorPageState,
  toBookPagePayloads,
} from "@/features/book/book-canvas";
import { isBookEditorTypingTarget } from "@/features/book/book-editor-keyboard";
import { deleteBook, updateBook } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";

/** 저장 여부를 가르는 값들. 참조 비교가 기준이라 `pages` 는 반드시 같은 배열이어야 한다 */
export type BookSaveSnapshot = {
  pages: BookEditorPageState[];
  title: string;
  slideWidth: number;
  slideHeight: number;
  presentationLoop: boolean;
};

/**
 * 북 저장·삭제와 그에 딸린 두 가지 안전장치.
 *
 * - **Ctrl+S**: 입력창에 타이핑 중이거나 다이얼로그가 떠 있으면 가로채지 않는다.
 * - **탭 닫기 경고**: 마지막 저장 시점 스냅샷과 참조 비교한다. undo 스택(`canUndo`)은
 *   저장 후에도 남아 있어 그걸 기준으로 쓰면 저장한 뒤에도 항상 경고가 뜬다.
 *
 * 삭제 확인 다이얼로그의 열림 상태도 여기서 갖는다. 그 다이얼로그가 떠 있는 동안에는
 * Ctrl+S 를 막아야 하는데, 상태를 화면에 두면 그 사실을 훅에 다시 알려 줘야 한다.
 */
export function useBookSaveAndDelete(opts: {
  bookId: number;
  /** 서버에서 받은 값 — 이 시점이 "저장됨"의 출발선 */
  initialSnapshot: BookSaveSnapshot;
  /** 지금 화면의 값 */
  current: BookSaveSnapshot;
  /** 다른 다이얼로그·전체 화면 편집기가 떠 있으면 Ctrl+S 를 넘긴다 */
  shortcutBlocked: boolean;
}) {
  const { bookId, initialSnapshot, current, shortcutBlocked } = opts;
  const router = useRouter();
  const queryClient = useQueryClient();

  const lastSavedRef = useRef(initialSnapshot);
  /**
   * 저장 요청에 실린 값 — 저장 중 추가 편집이 있으면 성공해도 그 편집은 미저장으로 남는다.
   * 처음에는 `lastSavedRef` 와 **같은 객체**를 가리킨다(참조 비교가 기준이라 중요하다).
   */
  const pendingSaveRef = useRef(initialSnapshot);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => {
      pendingSaveRef.current = current;
      return updateBook(bookId, {
        title: current.title.trim() || "제목 없음",
        slideWidth: current.slideWidth,
        slideHeight: current.slideHeight,
        presentationLoop: current.presentationLoop,
        pages: toBookPagePayloads(current.pages),
      });
    },
    onSuccess: (res) => {
      lastSavedRef.current = pendingSaveRef.current;
      void queryClient.setQueryData(bookKeys.detail(bookId), res);
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      toast.success("저장했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // useMutation 반환 객체는 매 렌더 새 참조 — ref로 참조해 리스너 재등록 반복을 막는다
  const saveMutationRef = useRef(saveMutation);
  useLayoutEffect(() => {
    saveMutationRef.current = saveMutation;
  });

  const blockShortcut = shortcutBlocked || deleteConfirmOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) return;
      if (isBookEditorTypingTarget(e.target)) return;
      if (blockShortcut) return;
      e.preventDefault();
      if (saveMutationRef.current.isPending) return;
      saveMutationRef.current.mutate();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [blockShortcut]);

  // 미저장 편집이 있으면 탭 닫기·새로고침 전에 경고
  const unsavedCheckRef = useRef<() => boolean>(() => false);
  useLayoutEffect(() => {
    unsavedCheckRef.current = () => {
      const saved = lastSavedRef.current;
      return (
        current.pages !== saved.pages ||
        current.title !== saved.title ||
        current.slideWidth !== saved.slideWidth ||
        current.slideHeight !== saved.slideHeight ||
        current.presentationLoop !== saved.presentationLoop
      );
    };
  });
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsavedCheckRef.current()) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (bid: number) => deleteBook(bid),
    onSuccess: (_data, deletedId) => {
      setDeleteConfirmOpen(false);
      void queryClient.removeQueries({ queryKey: bookKeys.detail(deletedId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      toast.success("북을 삭제했습니다.");
      router.replace("/books");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    saveMutation,
    deleteMutation,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
  };
}
