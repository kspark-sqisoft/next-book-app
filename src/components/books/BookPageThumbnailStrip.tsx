"use client";

import { useEffect, useRef } from "react";

import { SlideCardPreview } from "@/components/books/BookPageSidebar";
import { cn } from "@/lib/utils";

/**
 * 모바일 보기 전용 — 캔버스 아래에 붙는 가로 썸네일 스트립.
 *
 * 좁은 화면에선 페이지 사이드바가 잠기므로(`panelsLocked`) 이동 수단이 상단 배지와
 * 스와이프뿐이다. 페이지가 많은 북은 "몇 번째로 가고 싶다"가 필요해서 카로우셀처럼
 * 3~4장만 보이는 띠를 두고, 탭하면 바로 그 페이지로 간다. 현재 페이지가 바뀌면
 * 스트립이 그 썸네일을 가운데로 스크롤한다.
 *
 * 편집 기능(순서 바꾸기·추가·삭제)은 없다 — 보기 전용 화면에만 쓴다.
 */
export function BookPageThumbnailStrip({
  pageCount,
  pageKeys,
  thumbnailsByKey,
  activeIndex,
  pageLabels,
  onSelectPage,
  slideWidth,
  slideHeight,
  className,
}: {
  pageCount: number;
  /** `thumbnailsByKey` 조회 키. 없으면 썸네일 없이 번호만 */
  pageKeys?: string[];
  thumbnailsByKey?: Record<string, string | undefined>;
  activeIndex: number;
  /** 비어 있으면 `슬라이드 N` */
  pageLabels?: string[];
  onSelectPage: (index: number) => void;
  slideWidth: number;
  slideHeight: number;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(
      `[data-strip-index="${activeIndex}"]`,
    );
    // jsdom 은 scrollIntoView 미구현
    if (typeof item?.scrollIntoView !== "function") return;
    item.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeIndex]);

  if (pageCount <= 1) return null;

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="페이지 썸네일"
      className={cn(
        "flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden border-t border-border bg-card/60 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const key = pageKeys?.[i];
        const thumbUrl = key ? thumbnailsByKey?.[key] : undefined;
        const active = i === activeIndex;
        return (
          <button
            key={key ?? `strip-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${i + 1}번째 페이지로 이동`}
            data-strip-index={i}
            onClick={() => onSelectPage(i)}
            className={cn(
              // 3~4장이 보이는 폭 — 다음 장이 살짝 걸쳐 보여 옆으로 넘길 수 있음을 알린다
              "w-[27%] shrink-0 snap-center rounded-lg text-left transition-opacity touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active ? "ring-2 ring-primary" : "opacity-70",
            )}
          >
            <SlideCardPreview
              thumbUrl={thumbUrl}
              index={i}
              label={pageLabels?.[i]?.trim() || `슬라이드 ${i + 1}`}
              slideWidth={slideWidth}
              slideHeight={slideHeight}
            />
          </button>
        );
      })}
      {/* 끝까지 밀었을 때 마지막 장이 우하단 플로팅 버튼(채팅 열기)에 가리지 않게 여유 폭 */}
      <div className="w-16 shrink-0" aria-hidden />
    </div>
  );
}
