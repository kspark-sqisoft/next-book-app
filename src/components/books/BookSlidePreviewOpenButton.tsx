"use client";

import { MonitorPlay } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * 슬라이드쇼를 새 탭으로 여는 버튼 한 쌍.
 *
 * "현재부터"는 파워포인트의 "현재 슬라이드부터"와 같은 동작이다. `currentIndex` 를 주지
 * 않으면(게스트 뷰처럼 페이지 개념이 없는 곳) 처음부터 여는 버튼 하나만 나온다.
 */
export function BookSlidePreviewOpenButton({
  bookId,
  currentIndex,
}: {
  bookId: number;
  currentIndex?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        asChild
        className="relative h-7 overflow-hidden border-0 bg-linear-to-br from-violet-600 via-fuchsia-600 to-rose-500 px-2.5 text-xs font-semibold leading-none text-white shadow-[0_2px_14px_-2px_rgba(124,58,237,0.55)] ring-1 ring-white/25 transition [text-shadow:0_1px_1px_rgba(0,0,0,0.2)] hover:brightness-110 hover:shadow-[0_4px_20px_-2px_rgba(168,85,247,0.55)] focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:from-violet-500 dark:via-fuchsia-600 dark:to-rose-600 dark:shadow-[0_2px_18px_-4px_rgba(167,139,250,0.45)]"
      >
        <Link
          href={`/books/${bookId}/preview`}
          target="_blank"
          rel="noreferrer"
        >
          <MonitorPlay
            className="mr-1.5 size-3.5 shrink-0 drop-shadow-sm"
            aria-hidden
          />
          미리보기
        </Link>
      </Button>
      {currentIndex != null ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          asChild
          className="h-7 px-2 text-xs"
          title="현재 페이지부터 미리보기 (파워포인트의 '현재 슬라이드부터')"
        >
          <Link
            href={`/books/${bookId}/preview?start=${currentIndex}`}
            target="_blank"
            rel="noreferrer"
          >
            <MonitorPlay className="mr-1.5 size-3.5 shrink-0" aria-hidden />
            현재부터
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
