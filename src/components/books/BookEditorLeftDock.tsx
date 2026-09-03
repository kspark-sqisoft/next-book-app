"use client";

import { BookEditorToolRail } from "@/components/books/BookEditorToolRail";
import { BookElementsPanel } from "@/components/books/BookElementsPanel";
import { BookMediaLibraryPanel } from "@/components/books/BookMediaLibraryPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import { BookSlideDrawingPanel } from "@/components/books/BookSlideDrawingPanel";
import { BookSlideTemplatesPanel } from "@/components/books/BookSlideTemplatesPanel";
import { BookWidgetPalette } from "@/components/books/BookWidgetPalette";
import type { BookShapeKind } from "@/features/book/book-canvas";
import type { BookDropWidgetKind } from "@/features/book/book-canvas";
import type { BookSlideTemplateId } from "@/features/book/book-slide-templates";
import { bookLeftDockContentColumnClass } from "@/features/book/book-workspace-ui";
import {
  setDrawingStrokeColor,
  setDrawingStrokeWidth,
  setLeftDockTab,
  setPageIndex,
  setSelectedIds,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/** 슬라이드 목록에 필요한 값들 */
export type BookLeftDockPages = {
  count: number;
  keys: string[];
  labels: string[];
  thumbnailsByKey: Record<string, string | undefined>;
  activeIndex: number;
  /** 눈 토글이 있는 화면만 준다 — 없으면 아이콘이 나오지 않는다 */
  visibles?: boolean[];
  onReorder: (from: number, to: number) => void;
  onAdd: () => void;
  onAddAt: (insertIndex: number) => void;
  onRemoveAt: (index: number) => void;
  onDuplicateAt: (index: number) => void;
  onToggleVisibleAt?: (index: number) => void;
};

/**
 * 편집 화면 왼쪽 도크 — 도구 레일과 그때그때 열리는 패널 하나.
 *
 * `BookDetailPage` 와 `BookEditorPage` 에 거의 같은 87줄로 있었다. 다른 부분은 전부
 * **화면마다 있고 없는 기능**이라, 그 단위를 선택 prop 으로 만들었다. 새 북 화면은 저장
 * 전이라 미디어 라이브러리·PDF 가져오기·이미지 편집기가 없고 페이지 숨김도 쓰지 않는다.
 *
 * 지금 열린 탭과 그리기 색·굵기는 스토어에서 직접 읽는다 — 두 화면 모두 그렇게 했으므로
 * 굳이 prop 으로 받아 넘길 이유가 없다.
 */
export function BookEditorLeftDock({
  pages,
  slideWidth,
  slideHeight,
  onApplyTemplate,
  onAddShape,
  widgets,
  media,
  editors,
}: {
  pages: BookLeftDockPages;
  slideWidth: number;
  slideHeight: number;
  onApplyTemplate: (templateId: BookSlideTemplateId) => void;
  onAddShape: (kind: BookShapeKind) => void;
  widgets: {
    onFloat: () => void;
    onQuickAdd: (kind: BookDropWidgetKind) => void;
    /** 업로드가 가능한 화면만 — 없으면 팔레트에 PDF 항목이 나오지 않는다 */
    onImportPdf?: () => void;
    pdfImportBusy?: boolean;
  };
  /** 저장된 북에서만 — 새 북은 올릴 곳이 없다 */
  media?: { bookId: number; onFloat: () => void };
  /** 전체 화면 이미지·영상 편집기를 여는 레일 메뉴 */
  editors?: { onOpenImageEditor: () => void; onOpenVideoEditor: () => void };
}) {
  const leftDockTab = useBookEditorUiStore((s) => s.leftDockTab);
  const drawingStrokeColor = useBookEditorUiStore((s) => s.drawingStrokeColor);
  const drawingStrokeWidth = useBookEditorUiStore((s) => s.drawingStrokeWidth);

  return (
    <div className="flex h-full min-h-0 w-fit max-w-full flex-row">
      <BookEditorToolRail
        activeTab={leftDockTab}
        onActiveTabChange={setLeftDockTab}
        mediaLibraryEnabled={media != null}
        onOpenImageEditor={editors?.onOpenImageEditor}
        onOpenVideoEditor={editors?.onOpenVideoEditor}
      />
      <div
        className={bookLeftDockContentColumnClass("border-s border-border/40", {
          slideWidth,
          slideHeight,
        })}
      >
        {leftDockTab === "page" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <BookPageSidebar
              fluid
              pageCount={pages.count}
              pageKeys={pages.keys}
              thumbnailsByKey={pages.thumbnailsByKey}
              activeIndex={pages.activeIndex}
              pageLabels={pages.labels}
              onSelectPage={(i) => {
                setPageIndex(i);
                setSelectedIds([]);
              }}
              mode="edit"
              onReorderPages={pages.onReorder}
              onAddPage={pages.onAdd}
              onAddPageAtInsertIndex={pages.onAddAt}
              onRemovePageAtIndex={pages.onRemoveAt}
              onDuplicatePageAtIndex={pages.onDuplicateAt}
              canRemovePage={pages.count > 1}
              pageVisibles={pages.visibles}
              onTogglePageVisibleAtIndex={pages.onToggleVisibleAt}
              slideWidth={slideWidth}
              slideHeight={slideHeight}
            />
          </div>
        ) : null}
        {leftDockTab === "widgets" ? (
          <BookWidgetPalette
            variant="docked"
            className="min-h-0 flex-1"
            onRequestFloat={widgets.onFloat}
            onRequestImportPdf={widgets.onImportPdf}
            pdfImportBusy={widgets.pdfImportBusy}
            onQuickAdd={widgets.onQuickAdd}
          />
        ) : null}
        {leftDockTab === "media" && media ? (
          <BookMediaLibraryPanel
            variant="docked"
            bookId={media.bookId}
            className="min-h-0 flex-1"
            onRequestFloat={media.onFloat}
          />
        ) : null}
        {leftDockTab === "templates" ? (
          <BookSlideTemplatesPanel
            className="min-h-0 flex-1"
            onApplyTemplate={onApplyTemplate}
          />
        ) : null}
        {leftDockTab === "elements" ? (
          <BookElementsPanel
            className="min-h-0 flex-1"
            onAddShape={onAddShape}
          />
        ) : null}
        {leftDockTab === "drawing" ? (
          <BookSlideDrawingPanel
            className="min-h-0 flex-1"
            strokeColor={drawingStrokeColor}
            strokeWidth={drawingStrokeWidth}
            onStrokeColorChange={setDrawingStrokeColor}
            onStrokeWidthChange={setDrawingStrokeWidth}
          />
        ) : null}
      </div>
    </div>
  );
}
