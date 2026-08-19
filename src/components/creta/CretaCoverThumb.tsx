"use client";

// 크레타 공용 커버 썸네일: 북 첫 페이지 커버를 PNG 데이터 URL로 렌더.
// 커버가 없으면 어두운 그라데이션 자리표시자.
import { useMemo } from "react";

import { SafeImage } from "@/components/ui/safe-image";
import type { BookListCoverPreview } from "@/lib/api";
import { DEFAULT_SLIDE_HEIGHT, DEFAULT_SLIDE_WIDTH } from "@/lib/book-canvas";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { cn } from "@/lib/utils";

/** 목록 단위로 커버 → 데이터 URL 썸네일을 일괄 생성(clientKey → dataUrl) */
export function useCretaCoverThumbs(
  entries: { key: string; cover: BookListCoverPreview | null }[],
): Record<string, string> {
  const pages = useMemo(
    () =>
      entries
        .filter((e) => e.cover)
        .map((e) => {
          const c = e.cover!;
          return {
            clientKey: e.key,
            backgroundColor: c.backgroundColor,
            elements: c.elements,
            slideWidth: c.slideWidth,
            slideHeight: c.slideHeight,
          };
        }),
    [entries],
  );
  return useBookPageThumbnails(
    pages,
    DEFAULT_SLIDE_WIDTH,
    DEFAULT_SLIDE_HEIGHT,
  );
}

export function CretaCoverThumb({
  dataUrl,
  title,
  className,
}: {
  dataUrl: string | null | undefined;
  title: string;
  className?: string;
}) {
  if (dataUrl) {
    return (
      <SafeImage
        src={dataUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-md object-cover ring-1 ring-border",
          className,
        )}
        placeholderLabel={`「${title}」 커버`}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-950 text-[11px] font-semibold text-slate-400 ring-1 ring-border",
        className,
      )}
      aria-hidden
    >
      {title.trim().charAt(0) || "북"}
    </div>
  );
}
