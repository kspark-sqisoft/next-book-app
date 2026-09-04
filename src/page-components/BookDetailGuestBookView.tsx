"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { BookCanvasPageNavBadge } from "@/components/books/BookCanvasStageOverlays";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookLayersPanel } from "@/components/books/BookLayersPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import { BookPageThumbnailStrip } from "@/components/books/BookPageThumbnailStrip";
import { BookSlideCanvas } from "@/components/books/BookSlideCanvas";
import { BookSlidePreviewOpenButton } from "@/components/books/BookSlidePreviewOpenButton";
import {
  BookViewOnlyShield,
  stepPageIndex,
} from "@/components/books/BookViewOnlyShield";
import { BookWorkspaceShell } from "@/components/books/BookWorkspaceShell";
import {
  collectBookOverlayElements,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  resolveEffectivePresentationTimingElementId,
} from "@/features/book/book-canvas";
import { warmBookCanvasImagesForNeighborPages } from "@/features/book/book-image-cache";
import {
  bookCanvasStageMatClass,
  bookCanvasToolbarRowClass,
} from "@/features/book/book-workspace-ui";
import {
  BOOK_CANVAS_STAGE_DISPLAY_OPTS,
  useBookCanvasDisplayScale,
} from "@/features/book/use-book-canvas-display-scale";
import { useBookPageThumbnails } from "@/features/book/use-book-page-thumbnails";
import type { BookDetail } from "@/lib/api";

/**
 * 편집 권한이 없을 때 보는 화면 — 캔버스·사이드바·레이어 패널이 모두 읽기 전용이다.
 *
 * 소유자 화면과 달리 편집 스토어를 쓰지 않는다. 페이지 위치를 부모가 들고 있어서
 * `pageIndex`/`setPageIndex` 를 받는다.
 */
export function BookDetailGuestBookView({
  data,
  sortedPagesView,
  pageIndex,
  setPageIndex,
  viewLocked,
}: {
  data: BookDetail;
  sortedPagesView: NonNullable<BookDetail["pages"]>;
  pageIndex: number;
  setPageIndex: Dispatch<SetStateAction<number>>;
  /** 모바일 보기 전용 — 좌·우 패널 잠금 + 캔버스 위 요소 클릭 차단 */
  viewLocked?: boolean;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const guestSlideW = data.slideWidth ?? DEFAULT_SLIDE_WIDTH;
  const guestSlideH = data.slideHeight ?? DEFAULT_SLIDE_HEIGHT;
  const guestPageLabels = useMemo(
    () => sortedPagesView.map((p) => p.name ?? ""),
    [sortedPagesView],
  );

  const guestThumbSources = useMemo(
    () =>
      sortedPagesView.map((p) => ({
        clientKey: `v-${p.id}`,
        backgroundColor:
          typeof p.backgroundColor === "string" && p.backgroundColor.trim()
            ? p.backgroundColor.trim()
            : DEFAULT_PAGE_BACKGROUND,
        elements: p.elements,
      })),
    [sortedPagesView],
  );
  const guestThumbnails = useBookPageThumbnails(
    guestThumbSources,
    guestSlideW,
    guestSlideH,
  );

  const guestCanvasScale = useBookCanvasDisplayScale(canvasWrapRef, {
    slideWidth: guestSlideW,
    slideHeight: guestSlideH,
    ...BOOK_CANVAS_STAGE_DISPLAY_OPTS,
  });

  const safeIndex = Math.min(
    pageIndex,
    Math.max(0, sortedPagesView.length - 1),
  );
  const viewPage = sortedPagesView[safeIndex];

  /** 다른 페이지의 공통(오버라이드) 위젯을 현재 페이지에 겹쳐 렌더 — 요소 key(id)가 유지되어 상태도 이어진다 */
  const viewElements = useMemo(() => {
    if (!viewPage) return [];
    const overlays = collectBookOverlayElements(
      sortedPagesView.map((p) => ({
        sortOrder: p.sortOrder,
        elements: p.elements,
      })),
      viewPage.sortOrder,
    );
    return overlays.length > 0
      ? [...viewPage.elements, ...overlays]
      : viewPage.elements;
  }, [sortedPagesView, viewPage]);

  const guestPresentationTimingId = useMemo(
    () =>
      viewPage
        ? resolveEffectivePresentationTimingElementId(
            viewPage.elements,
            typeof viewPage.presentationTimingElementId === "string"
              ? viewPage.presentationTimingElementId
              : null,
          )
        : null,
    [viewPage],
  );

  useEffect(() => {
    warmBookCanvasImagesForNeighborPages(guestThumbSources, safeIndex);
  }, [guestThumbSources, safeIndex]);

  return (
    <BookWorkspaceShell
      panelsLocked={viewLocked}
      titleArea={
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
            {data.title}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {data.author.name} · {sortedPagesView.length}페이지 ·{" "}
            {safeIndex + 1}번째 보는 중
          </p>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <BookSlidePreviewOpenButton
            bookId={data.id}
            currentIndex={safeIndex}
          />
        </div>
      }
      left={
        <BookPageSidebar
          pageCount={sortedPagesView.length}
          pageKeys={sortedPagesView.map((p) => `v-${p.id}`)}
          thumbnailsByKey={guestThumbnails}
          activeIndex={safeIndex}
          pageLabels={guestPageLabels}
          onSelectPage={setPageIndex}
          mode="view"
          pageVisibles={sortedPagesView.map(
            (p) => p.presentationVisible !== false,
          )}
          slideWidth={guestSlideW}
          slideHeight={guestSlideH}
        />
      }
      center={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={bookCanvasToolbarRowClass()}>
            <BookCanvasToolbar
              zoomPercent={guestCanvasScale.zoomPercent}
              onZoomIn={guestCanvasScale.zoomIn}
              onZoomOut={guestCanvasScale.zoomOut}
              onZoomReset={guestCanvasScale.zoomReset}
            />
          </div>
          <div
            ref={canvasWrapRef}
            className={bookCanvasStageMatClass(
              "relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-2",
            )}
            onWheel={guestCanvasScale.handleWheel}
          >
            <BookCanvasPageNavBadge
              pageCount={sortedPagesView.length}
              activePageIndex={safeIndex}
              pageName={viewPage.name}
              onChangeIndex={setPageIndex}
            />
            <BookSlideCanvas
              pageWidth={guestSlideW}
              pageHeight={guestSlideH}
              pageBackgroundColor={
                typeof viewPage.backgroundColor === "string" &&
                viewPage.backgroundColor.trim()
                  ? viewPage.backgroundColor.trim()
                  : DEFAULT_PAGE_BACKGROUND
              }
              scale={guestCanvasScale.displayScale}
              elements={viewElements}
              mode="view"
              selectedIds={[]}
              onSelect={() => undefined}
              onElementChange={() => undefined}
            />
            {viewLocked ? (
              <BookViewOnlyShield
                onSwipe={(dir) =>
                  setPageIndex(stepPageIndex(dir, sortedPagesView.length))
                }
              />
            ) : null}
          </div>
          {viewLocked ? (
            <BookPageThumbnailStrip
              pageCount={sortedPagesView.length}
              pageKeys={sortedPagesView.map((p) => `v-${p.id}`)}
              thumbnailsByKey={guestThumbnails}
              activeIndex={safeIndex}
              pageLabels={guestPageLabels}
              onSelectPage={setPageIndex}
              slideWidth={guestSlideW}
              slideHeight={guestSlideH}
            />
          ) : null}
        </div>
      }
      right={
        <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card/50">
          <BookLayersPanel
            expandVertical
            elements={viewPage.elements}
            selectedIds={[]}
            onSelect={() => undefined}
            readOnly
            presentationTimingElementId={guestPresentationTimingId}
          />
        </aside>
      }
    />
  );
}

// 데이터 로드 후 canEdit 에 따라 소유자 편집 UI 또는 게스트 뷰
