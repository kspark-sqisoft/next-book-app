"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { stepPageIndex } from "@/components/books/BookViewOnlyShield";
import { setPageIndex } from "@/features/book/editor-ui-store";

/**
 * 캔버스 스테이지 위에 떠 있는 작은 표시 둘.
 *
 * `BookDetailPage` 와 `BookEditorPage` 에 **글자 단위로 같은 복사본**으로 있었다
 * (변수 이름만 `activePage`/`currentPage` 로 달랐다). 위젯 삽입과 같은 종류의 중복이라
 * 같은 방식으로 한 곳에 모은다.
 *
 * 페이지 이동은 기본으로 `setPageIndex` 스토어 액션을 부른다 — 편집 화면 둘은 그렇게
 * 쓴다. 게스트 뷰는 페이지 인덱스가 로컬 state 라 `onChangeIndex` 로 넘긴다.
 */

/** 모바일 보기 전용 방패(`BookViewOnlyShield`, z-50)보다 위 — 아니면 좌우 버튼이 눌리지 않는다 */
const badgeBaseClass =
  "absolute top-2 z-[60] rounded-md bg-black/60 text-[11px] text-white shadow-sm backdrop-blur-sm";

const navButtonClass =
  "flex size-5 shrink-0 items-center justify-center rounded hover:bg-white/20 disabled:opacity-30";

/** 캔버스 상단 가운데 — 현재 페이지 이름 + 좌우 이동(페이지 1개면 이동 숨김) */
export function BookCanvasPageNavBadge({
  pageCount,
  activePageIndex,
  pageName,
  onChangeIndex = setPageIndex,
}: {
  pageCount: number;
  activePageIndex: number;
  /** 비어 있으면 `슬라이드 N` 로 대체한다 */
  pageName?: string;
  /** 기본은 편집 UI 스토어의 `setPageIndex` */
  onChangeIndex?: (update: (i: number) => number) => void;
}) {
  const hasSiblings = pageCount > 1;
  return (
    <div
      className={`${badgeBaseClass} left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 px-1.5 py-1`}
    >
      {hasSiblings ? (
        <button
          type="button"
          className={navButtonClass}
          title="이전 페이지"
          aria-label="이전 페이지"
          disabled={activePageIndex <= 0}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChangeIndex(stepPageIndex("prev", pageCount))}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </button>
      ) : null}
      <span className="min-w-0 truncate font-medium" title="현재 페이지">
        {pageName?.trim() || `슬라이드 ${activePageIndex + 1}`}
      </span>
      {hasSiblings ? (
        <>
          <span className="shrink-0 tabular-nums text-white/50">
            {activePageIndex + 1}/{pageCount}
          </span>
          <button
            type="button"
            className={navButtonClass}
            title="다음 페이지"
            aria-label="다음 페이지"
            disabled={activePageIndex >= pageCount - 1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChangeIndex(stepPageIndex("next", pageCount))}
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}

/** 캔버스 우상단 — 이 페이지의 슬라이드쇼 재생 시간. 기준 레이어가 없으면 표시하지 않는다 */
export function BookCanvasPlaybackBadge({
  playbackSec,
}: {
  playbackSec: number | null | undefined;
}) {
  if (playbackSec == null) return null;
  return (
    <div
      className={`${badgeBaseClass} pointer-events-none right-2 px-2 py-1 font-mono tabular-nums`}
      title="기준 레이어 기준 이 페이지의 슬라이드쇼 재생 시간"
    >
      재생 {playbackSec}초
    </div>
  );
}
