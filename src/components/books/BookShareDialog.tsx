"use client";

// 북 공유 다이얼로그 — 공용 MemberShareDialog에 북 공유 API를 연결
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  MemberShareDialog,
  MemberSharePopover,
} from "@/components/share/MemberShareDialog";
import { type BookDetail, setBookShare, setBookShareAll } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number;
  bookTitle: string;
  authorId: number;
  /** 현재 공유된 사용자 id */
  sharedUserIds: readonly number[];
  /** 모든 사용자 공유 여부 */
  sharedToAll?: boolean;
  /** 공유가 바뀌면 갱신된 북 전달(상세 캐시 동기화) */
  onChanged?: (book: BookDetail) => void;
};

export function BookShareDialog({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  authorId,
  sharedUserIds,
  sharedToAll,
  onChanged,
}: Props) {
  const queryClient = useQueryClient();
  return (
    <MemberShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title="북 공유"
      description={`「${bookTitle}」을(를) 함께 편집할 회원을 고르세요. 공유받은 사용자는 이 북을 저장·편집할 수 있고, 삭제는 작성자만 할 수 있습니다.`}
      ownerId={authorId}
      sharedUserIds={sharedUserIds}
      sharedToAll={sharedToAll}
      onToggle={async (userId, shared) => {
        const book = await setBookShare(bookId, userId, shared);
        onChanged?.(book);
        void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      }}
      onToggleShareAll={async (shared) => {
        const book = await setBookShareAll(bookId, shared);
        onChanged?.(book);
        void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      }}
    />
  );
}

/** 공유 버튼(트리거) 바로 옆에 붙는 북 공유 팝오버 */
export function BookSharePopover({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  authorId,
  sharedUserIds,
  sharedToAll,
  onChanged,
  children,
}: Props & { children: ReactNode }) {
  const queryClient = useQueryClient();
  return (
    <MemberSharePopover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      title="북 공유"
      description={`「${bookTitle}」을(를) 함께 편집할 회원을 고르세요. 공유받은 사용자는 이 북을 저장·편집할 수 있고, 삭제는 작성자만 할 수 있습니다.`}
      ownerId={authorId}
      sharedUserIds={sharedUserIds}
      sharedToAll={sharedToAll}
      onToggle={async (userId, shared) => {
        const book = await setBookShare(bookId, userId, shared);
        onChanged?.(book);
        void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      }}
      onToggleShareAll={async (shared) => {
        const book = await setBookShareAll(bookId, shared);
        onChanged?.(book);
        void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      }}
    >
      {children}
    </MemberSharePopover>
  );
}
