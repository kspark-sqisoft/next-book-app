"use client";

import { BookInspectorPanel } from "@/components/books/BookInspectorPanel";
import { BookLayersPanel } from "@/components/books/BookLayersPanel";
import type { BookMediaPlaylistPlaybackUiSnapshot } from "@/components/books/BookMediaPlaylistWidgetOverlay";
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import type {
  BookCanvasElement,
  BookEditorPageState,
  ElementZOrderOp,
} from "@/features/book/book-canvas";
import { DEFAULT_PAGE_BACKGROUND } from "@/features/book/book-canvas";
import {
  type BookPresentationTransitionId,
  clampBookPresentationTransitionMs,
  normalizeBookPresentationTransition,
} from "@/features/book/book-presentation-transition";
import { bookRightDockInspectorShellClass } from "@/features/book/book-workspace-ui";
import {
  toggleSelectedId,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/** 요소 자체를 고치는 조작들 */
export type BookRightDockElementActions = {
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onReorderZ: (elementId: string, op: ElementZOrderOp) => void;
  onDragReorder: (fromDisplay: number, toDisplay: number) => void;
  onVisibilityChange: (elementId: string, visible: boolean) => void;
  onLockChange: (elementId: string, locked: boolean) => void;
  onRequestDelete: (elementId: string) => void;
  /** 하나 선택했을 때 인스펙터의 삭제 */
  onDeleteSelected: () => void;
  /** 여럿 선택했을 때 */
  onDeleteSelectedBulk: () => void;
};

/** 슬라이드 한 장의 속성을 고치는 조작들 */
export type BookRightDockPageActions = {
  onChangeName: (name: string) => void;
  onChangeBackground: (color: string) => void;
  onChangeTimingElementId: (id: string | null) => void;
  onChangeTransition: (v: BookPresentationTransitionId) => void;
  onChangeTransitionMs: (ms: number) => void;
};

/**
 * 편집 화면 오른쪽 도크 — 위는 레이어 목록, 아래는 선택 상태에 따라 바뀌는 패널.
 *
 * 아래 칸은 세 가지 중 하나다: 여럿 선택(공통 속성만) / 하나 선택(요소 인스펙터) /
 * 선택 없음(슬라이드 속성). 이 규칙이 `BookDetailPage` 와 `BookEditorPage` 에 거의
 * 같은 100줄로 있었다.
 *
 * 선택 목록과 동영상 길이는 스토어에서 직접 읽는다 — 두 화면 모두 그렇게 했다.
 */
export function BookEditorRightDock({
  page,
  pageIndex,
  pageCount,
  pageNames,
  selectedIds,
  selectedElement,
  slideWidth,
  slideHeight,
  elements,
  pageActions,
  presentationLoop,
  onChangePresentationLoop,
  playlist,
  mediaHint,
  media,
}: {
  page: BookEditorPageState;
  pageIndex: number;
  pageCount: number;
  /** 인스펙터에서 다른 슬라이드를 가리킬 때 쓴다 — 그 기능이 있는 화면만 준다 */
  pageNames?: string[];
  selectedIds: readonly string[];
  selectedElement: BookCanvasElement | null;
  slideWidth: number;
  slideHeight: number;
  elements: BookRightDockElementActions;
  pageActions: BookRightDockPageActions;
  presentationLoop: boolean;
  onChangePresentationLoop: (loop: boolean) => void;
  playlist: {
    playbackByElementId: Record<string, number>;
    playbackUiByElementId: Record<string, BookMediaPlaylistPlaybackUiSnapshot>;
    onRemoteControl: (
      elementId: string,
      kind: "prev" | "next" | "togglePause" | "jumpTo",
      index?: number,
    ) => void;
  };
  /** 업로드 실패 안내 등 — 인스펙터 미디어 칸에 표시 */
  mediaHint?: string | null;
  /** 파일·라이브러리로 미디어를 채울 수 있는 화면만 */
  media?: {
    onReplaceFromFile: () => void;
    onPickFromLibrary: () => void;
    onAppendPlaylistFromFile: (elementId: string) => void;
    onAppendPlaylistFromLibrary: (elementId: string) => void;
  };
}) {
  const videoDurationByElementId = useBookEditorUiStore(
    (s) => s.videoDurationByElementId,
  );
  const background = page.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND;

  return (
    <aside className="flex h-full min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-card/50">
      <BookLayersPanel
        elements={page.elements}
        selectedIds={selectedIds}
        onSelect={toggleSelectedId}
        onReorderZ={elements.onReorderZ}
        onLayerDragReorder={elements.onDragReorder}
        onVisibilityChange={elements.onVisibilityChange}
        onLockChange={elements.onLockChange}
        onRequestDelete={elements.onRequestDelete}
        presentationTimingElementId={page.presentationTimingElementId}
        onPresentationTimingElementIdChange={
          pageActions.onChangeTimingElementId
        }
        onPresentationHoldSecChange={(eid, sec) =>
          elements.onChange(eid, { presentationHoldSec: sec })
        }
        videoDurationSecByElementId={videoDurationByElementId}
      />
      <div className={bookRightDockInspectorShellClass()}>
        {selectedIds.length >= 2 ? (
          <BookInspectorPanel
            embedded
            selected={null}
            multiSelectionCount={selectedIds.length}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            onChange={elements.onChange}
            onDelete={elements.onDeleteSelectedBulk}
            mediaHint={mediaHint}
          />
        ) : selectedIds.length === 1 ? (
          <BookInspectorPanel
            embedded
            selected={selectedElement}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            onChange={elements.onChange}
            onDelete={elements.onDeleteSelected}
            mediaHint={mediaHint}
            onReplaceMediaFromFile={media?.onReplaceFromFile}
            onPickMediaFromLibrary={media?.onPickFromLibrary}
            onRequestAppendPlaylistMediaFromFile={
              media?.onAppendPlaylistFromFile
            }
            onRequestAppendPlaylistMediaFromLibrary={
              media?.onAppendPlaylistFromLibrary
            }
            mediaLibraryReplaceEnabled={media != null}
            mediaPlaylistPlaybackByElementId={playlist.playbackByElementId}
            mediaPlaylistPlaybackUiByElementId={playlist.playbackUiByElementId}
            onMediaPlaylistRemoteControl={playlist.onRemoteControl}
            videoDurationSecByElementId={videoDurationByElementId}
            pagePresentationTimingElementId={page.presentationTimingElementId}
            pageNames={pageNames}
            activePageIndex={pageNames ? pageIndex : undefined}
          />
        ) : (
          <BookPagePropertiesPanel
            embedded
            pageIndex={pageIndex}
            totalPages={pageCount}
            name={page.name}
            onChangeName={pageActions.onChangeName}
            backgroundColor={background}
            onChangeBackgroundColor={pageActions.onChangeBackground}
            elements={page.elements}
            presentationTimingElementId={page.presentationTimingElementId}
            onChangePresentationTimingElementId={
              pageActions.onChangeTimingElementId
            }
            presentationLoop={presentationLoop}
            onChangePresentationLoop={onChangePresentationLoop}
            presentationTransition={normalizeBookPresentationTransition(
              page.presentationTransition,
            )}
            onChangePresentationTransition={pageActions.onChangeTransition}
            presentationTransitionMs={clampBookPresentationTransitionMs(
              page.presentationTransitionMs,
            )}
            onChangePresentationTransitionMs={pageActions.onChangeTransitionMs}
          />
        )}
      </div>
    </aside>
  );
}
