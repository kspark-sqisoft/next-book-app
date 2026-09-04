"use client";

import { type ReactNode, useRef } from "react";

import {
  BookCanvasPageNavBadge,
  BookCanvasPlaybackBadge,
} from "@/components/books/BookCanvasStageOverlays";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import {
  BookSlideCanvas,
  type BookSlideCanvasProps,
} from "@/components/books/BookSlideCanvas";
import {
  BookViewOnlyShield,
  stepPageIndex,
} from "@/components/books/BookViewOnlyShield";
import {
  type BookCanvasElement,
  type BookEditorPageState,
  DEFAULT_PAGE_BACKGROUND,
} from "@/features/book/book-canvas";
import {
  bookCanvasStageMatClass,
  bookCanvasToolbarRowClass,
} from "@/features/book/book-workspace-ui";
import {
  setCenterGuideThresholdPx,
  setDragGridPx,
  setPageIndex,
  setSelectedIds,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";
import {
  BOOK_CANVAS_STAGE_DISPLAY_OPTS,
  useBookCanvasDisplayScale,
} from "@/features/book/use-book-canvas-display-scale";

/** 스테이지가 스스로 채우는 것을 뺀 나머지 캔버스 props — 페이지·배율·모드는 여기서 정한다 */
export type BookEditorCanvasStageCanvasProps = Omit<
  BookSlideCanvasProps,
  | "pageWidth"
  | "pageHeight"
  | "pageBackgroundColor"
  | "scale"
  | "elements"
  | "mode"
  | "centerGuideThresholdPx"
  | "dragGridPx"
>;

/**
 * 편집 화면 한가운데 — 줌·되돌리기 툴바, 슬라이드가 놓이는 매트, 그 위의 캔버스.
 *
 * 매트의 크기에 맞춰 배율을 정하는 훅과 그 ref 는 이 안에서만 쓰이므로 여기가 갖는다.
 * 두 화면이 각자 같은 113줄을 갖고 있었고, 그중 배율 계산 배선이 절반이었다.
 *
 * 매트를 클릭하면 선택을 비운다 — 단, 슬라이드 자체를 누른 것은 캔버스가 처리하므로
 * 넘긴다(`data-book-slide-root` 안이면 손대지 않는다).
 */
export function BookEditorCanvasStage({
  slideWidth,
  slideHeight,
  page,
  pageCount,
  activePageIndex,
  playbackSec,
  readOnly = false,
  history,
  canvas,
  ghosts,
  footer,
}: {
  slideWidth: number;
  slideHeight: number;
  /** 없으면 툴바·매트만 그리고 캔버스는 비운다(페이지 0장은 정상 경로에서 나오지 않는다) */
  page: BookEditorPageState | undefined;
  pageCount: number;
  activePageIndex: number;
  playbackSec: number | null | undefined;
  /** 보기 전용이면 되돌리기·격자 설정을 숨기고 캔버스를 투명 방패로 덮는다 */
  readOnly?: boolean;
  history: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
  };
  canvas: BookEditorCanvasStageCanvasProps;
  /** 다른 페이지의 공통 위젯을 반투명으로 겹쳐 보인다 — 위치 참고용, 클릭 불가 */
  ghosts?: BookCanvasElement[];
  /** 캔버스 매트 아래 — 모바일 보기 전용의 썸네일 스트립 등 */
  footer?: ReactNode;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const centerGuideThresholdPx = useBookEditorUiStore(
    (s) => s.centerGuideThresholdPx,
  );
  const dragGridPx = useBookEditorUiStore((s) => s.dragGridPx);
  const { displayScale, zoomPercent, zoomIn, zoomOut, zoomReset, handleWheel } =
    useBookCanvasDisplayScale(canvasWrapRef, {
      slideWidth,
      slideHeight,
      ...BOOK_CANVAS_STAGE_DISPLAY_OPTS,
    });
  const background = page?.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={bookCanvasToolbarRowClass()}>
        <BookCanvasToolbar
          zoomPercent={zoomPercent}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          {...(readOnly
            ? {}
            : {
                showUndoRedo: true,
                canUndo: history.canUndo,
                canRedo: history.canRedo,
                onUndo: history.undo,
                onRedo: history.redo,
                centerGuideThresholdPx,
                onCenterGuideThresholdPxChange: setCenterGuideThresholdPx,
                dragGridPx,
                onDragGridPxChange: setDragGridPx,
              })}
        />
      </div>
      <div
        ref={canvasWrapRef}
        className={bookCanvasStageMatClass(
          "relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-2",
        )}
        onWheel={handleWheel}
        onPointerDown={(e) => {
          const slide = (e.currentTarget as HTMLElement).querySelector(
            "[data-book-slide-root]",
          );
          if (slide?.contains(e.target as Node)) return;
          setSelectedIds([]);
        }}
      >
        <BookCanvasPageNavBadge
          pageCount={pageCount}
          activePageIndex={activePageIndex}
          pageName={page?.name}
        />
        <BookCanvasPlaybackBadge playbackSec={playbackSec} />
        {page ? (
          <BookSlideCanvas
            {...canvas}
            pageWidth={slideWidth}
            pageHeight={slideHeight}
            pageBackgroundColor={background}
            scale={displayScale}
            elements={page.elements}
            mode={readOnly ? "view" : "edit"}
            centerGuideThresholdPx={centerGuideThresholdPx}
            dragGridPx={dragGridPx}
          />
        ) : null}
        {page && ghosts && ghosts.length > 0 ? (
          <div
            className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center opacity-60"
            aria-hidden
          >
            <BookSlideCanvas
              pageWidth={slideWidth}
              pageHeight={slideHeight}
              pageBackgroundColor="transparent"
              readabilityBackgroundColor={background}
              scale={displayScale}
              elements={ghosts}
              mode="view"
              selectedIds={[]}
              onSelect={() => undefined}
              onElementChange={() => undefined}
            />
          </div>
        ) : null}
        {readOnly ? (
          <BookViewOnlyShield
            onSwipe={(dir) => setPageIndex(stepPageIndex(dir, pageCount))}
          />
        ) : null}
      </div>
      {footer}
    </div>
  );
}
