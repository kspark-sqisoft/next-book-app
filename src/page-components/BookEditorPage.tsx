"use client";

// 새 북 작성: 빈 문서로 워크스페이스 열고 createBook 저장, 상세와 동일 패널·캔버스 구성
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { BookAiAssistantPanel } from "@/components/books/BookAiAssistantPanel";
import {} from "@/components/books/BookCanvasStageOverlays";
import { BookEditorCanvasStage } from "@/components/books/BookEditorCanvasStage";
import {
  BookPageDeleteDialog,
  BookWidgetDeleteDialog,
} from "@/components/books/BookEditorDeleteDialogs";
import { BookEditorLeftDock } from "@/components/books/BookEditorLeftDock";
import { BookEditorRightDock } from "@/components/books/BookEditorRightDock";
import { BookHeaderSlideDimensions } from "@/components/books/BookHeaderSlideDimensions";
import { type BookDropWidgetKind } from "@/components/books/BookSlideCanvas";
import { BookWidgetPalette } from "@/components/books/BookWidgetPalette";
import { BookWorkspaceShell } from "@/components/books/BookWorkspaceShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  applyAutoSlideNamesByIndex,
  type BookShapeKind,
  createEmptyEditorPage,
  DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
  DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  resolveEffectivePresentationTimingElementId,
  toBookPagePayloads,
} from "@/features/book/book-canvas";
import { isBookEditorTypingTarget } from "@/features/book/book-editor-keyboard";
import { pageDeleteTargetLabel } from "@/features/book/book-element-labels";
import {} from "@/features/book/book-floating-ui-prefs";
import { warmBookCanvasImagesForNeighborPages } from "@/features/book/book-image-cache";
import { computeSlidePresentationDurationSec } from "@/features/book/book-presentation";
import {} from "@/features/book/book-presentation-transition";
import {
  type BookSlideTemplateId,
  instantiateBookSlideTemplate,
} from "@/features/book/book-slide-templates";
import {} from "@/features/book/book-workspace-ui";
import {
  openPageDelete,
  openWidgetDelete,
  resetEditorUi,
  setFloatingWidgetPaletteOpen as persistWidgetFloatingOpen,
  setPageIndex,
  setSelectedIds,
  setVideoDuration as handleVideoDurationKnown,
  useBookEditorUiValues,
} from "@/features/book/editor-ui-store";
import { useAiDocumentEdits } from "@/features/book/use-ai-document-edits";
import {} from "@/features/book/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/features/book/use-book-document-history";
import { useBookPageThumbnails } from "@/features/book/use-book-page-thumbnails";
import { useBookWidgetClipboard } from "@/features/book/use-book-widget-clipboard";
import { useCanvasSelection } from "@/features/book/use-canvas-selection";
import { useElementMutations } from "@/features/book/use-element-mutations";
import { useMediaPlaylistPlayback } from "@/features/book/use-media-playlist-playback";
import { usePageOperations } from "@/features/book/use-page-operations";
import { usePageProperties } from "@/features/book/use-page-properties";
import { useWidgetDeleteFlow } from "@/features/book/use-widget-delete-flow";
import { useWidgetInserters } from "@/features/book/use-widget-inserters";
import { createBook } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";

/** `/books/new` — 저장 후 `/books/:id`로 이동해 동일 편집 UI를 씁니다. */
export function BookEditorPage() {
  // ── 에디터 UI·도구 상태 ─────────────────────────────────────────
  // 같은 13개가 BookDetailPage 소유자 뷰에도 복사돼 있었다. 정의를 스토어 한 곳에 모아
  // 두 화면이 조용히 벌어지지 않게 한다(features/book/editor-ui-store.ts).
  const {
    pageIndex,
    leftDockTab,
    drawingStrokeColor,
    drawingStrokeWidth,
    floatingWidgetPaletteOpen,
    widgetDeleteOpen,
    pageDeleteOpen,
    pageDeleteIndex,
    videoDurationByElementId,
  } = useBookEditorUiValues();

  // 새 북 편집을 시작할 때 이전 북에서 남은 슬라이드 위치·선택을 지운다
  useEffect(() => resetEditorUi(), []);

  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const {
    pages,
    updatePages,
    updatePagesSilent,
    commitPages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBookDocumentHistory(
    applyAutoSlideNamesByIndex([createEmptyEditorPage(0)]),
  );
  const [slideWidth, setSlideWidth] = useState(DEFAULT_SLIDE_WIDTH);
  const [slideHeight, setSlideHeight] = useState(DEFAULT_SLIDE_HEIGHT);
  const [presentationLoop, setPresentationLoop] = useState(true);

  const maxPageIdx = Math.max(0, pages.length - 1);
  const activePageIndex = Math.min(pageIndex, maxPageIdx);

  // 위젯 삽입 — 종류별 핸들러 13개가 두 화면에 복사돼 있던 것을 공용 훅 하나로 모았다
  const {
    appendElement: onAppendDrawingElement,
    addByKind,
    addByKindCentered,
    addShapeAt,
    addFromElementsPanel: onAddShapeFromElementsPanel,
    addMediaPlaylistAt,
    addEmptyMediaAt,
  } = useWidgetInserters({
    activePageIndex,
    updatePages,
    slideWidth,
    slideHeight,
    emptyMediaHint: () =>
      "자리를 놓았습니다 — 북을 저장한 뒤 파일을 채울 수 있습니다.",
  });

  const currentPage = pages[activePageIndex] ?? pages[0];
  const {
    canvasSelectedIds,
    inspectorSelectionKey: playlistInspectorSelectionKey,
    onCanvasSelect: handleCanvasSelect,
  } = useCanvasSelection(currentPage);

  const currentPageElementIdsKey = useMemo(
    () => currentPage?.elements.map((e) => e.id).join("\0") ?? "",
    [currentPage?.elements],
  );

  useEffect(() => {
    const pg = pages[activePageIndex];
    if (!pg) return;
    if (pg.elements.length === 0) {
      if (pg.presentationTimingElementId != null) {
        updatePagesSilent((d) => {
          const p = d[activePageIndex];
          if (p && p.elements.length === 0)
            p.presentationTimingElementId = null;
        });
      }
      return;
    }
    const want = resolveEffectivePresentationTimingElementId(
      pg.elements,
      pg.presentationTimingElementId,
    );
    if (want !== pg.presentationTimingElementId) {
      // 파생 상태 자동 교정 — 히스토리에 남기지 않아 유령 undo 엔트리를 만들지 않는다
      updatePagesSilent((d) => {
        const p = d[activePageIndex];
        if (!p || p.elements.length === 0) return;
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(
            p.elements,
            p.presentationTimingElementId,
          );
      });
    }
  }, [
    activePageIndex,
    currentPageElementIdsKey,
    currentPage?.presentationTimingElementId,
    pages,
    updatePagesSilent,
  ]);

  useEffect(() => {
    if (!currentPage) return;
    const onPage = new Set(currentPage.elements.map((e) => e.id));
    queueMicrotask(() => {
      setSelectedIds((prev) => {
        const next = prev.filter((id) => onPage.has(id));
        if (
          next.length === prev.length &&
          next.every((id, i) => id === prev[i])
        )
          return prev;
        return next;
      });
    });
  }, [currentPage]);

  useEffect(() => {
    warmBookCanvasImagesForNeighborPages(pages, activePageIndex);
  }, [pages, activePageIndex]);

  const {
    playbackIndexByElementId: mediaPlaylistPlaybackByElementId,
    playbackUiByElementId: mediaPlaylistPlaybackUiByElementId,
    remoteCommand: playlistRemoteCmd,
    handlePlaybackIndex: handleMediaPlaylistPlaybackIndex,
    handlePlaybackUiReport: handleMediaPlaylistPlaybackUiReport,
    clearRemoteCommand: clearPlaylistRemoteCmd,
    sendRemoteControl: handleMediaPlaylistRemoteControl,
  } = useMediaPlaylistPlayback({
    activePageIndex,
    inspectorSelectionKey: playlistInspectorSelectionKey,
  });

  // 상세 페이지와 동일 — 동영상 실제 길이를 반영해야 재생 시간 배지·타이밍 계산이 맞음

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBookEditorTypingTarget(e.target)) return;
      if (widgetDeleteOpen || pageDeleteOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (!currentPage) return;
        setSelectedIds(currentPage.elements.map((el) => el.id));
        return;
      }
      if (e.key === "Escape" && canvasSelectedIds.length > 0) {
        e.preventDefault();
        setSelectedIds([]);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) redo();
      } else if (
        e.key === "Delete" &&
        canvasSelectedIds.length === 0 &&
        pages.length > 1
      ) {
        e.preventDefault();
        openPageDelete(activePageIndex);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        canvasSelectedIds.length > 0
      ) {
        e.preventDefault();
        openWidgetDelete([...canvasSelectedIds]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    canvasSelectedIds,
    currentPage,
    widgetDeleteOpen,
    pageDeleteOpen,
    pages.length,
    activePageIndex,
  ]);

  /** 생성 성공 여부 — 성공 후에는 편집 내역이 저장된 것이므로 이탈 경고를 끈다 */
  const createdRef = useRef(false);
  const saveMutation = useMutation({
    mutationFn: () =>
      createBook({
        title: title.trim() || "제목 없음",
        slideWidth,
        slideHeight,
        presentationLoop,
        pages: toBookPagePayloads(pages),
      }),
    onSuccess: (res) => {
      // 생성 완료 후에는 상세로 이동하는 동안 이탈 경고를 띄우지 않는다
      createdRef.current = true;
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      void queryClient.setQueryData(bookKeys.detail(res.id), res);
      toast.success("북을 만들었습니다.");
      router.replace(`/books/${res.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // useMutation 반환 객체는 매 렌더 새 참조 — ref로 참조해 리스너 재등록 반복을 막는다
  const saveMutationRef = useRef(saveMutation);
  useLayoutEffect(() => {
    saveMutationRef.current = saveMutation;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) return;
      if (isBookEditorTypingTarget(e.target)) return;
      if (widgetDeleteOpen || pageDeleteOpen) return;
      e.preventDefault();
      if (saveMutationRef.current.isPending) return;
      saveMutationRef.current.mutate();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [widgetDeleteOpen, pageDeleteOpen]);

  // 미저장 편집이 있으면 탭 닫기·새로고침 전에 경고 — 생성 성공 후에는 경고 없음
  useEffect(() => {
    if (!canUndo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (createdRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [canUndo]);

  const {
    mutateActivePage,
    onElementChange,
    onElementsChange,
    onReorderZ,
    onLayerDragReorder,
    onLayerVisibilityChange,
    onLayerLockChange,
    removeElementsByIds,
    appendElementsToActivePage,
  } = useElementMutations({ activePageIndex, updatePages });

  const applySlideTemplate = useCallback(
    (templateId: BookSlideTemplateId) => {
      if (!currentPage) return;
      const nextElements = instantiateBookSlideTemplate(
        templateId,
        slideWidth,
        slideHeight,
      );
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = nextElements;
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(p.elements, null);
      });
      setSelectedIds([]);
      toast.success("슬라이드 내용을 비우고 템플릿을 적용했습니다.");
    },
    [activePageIndex, currentPage, slideHeight, slideWidth, updatePages],
  );

  const onDropShape = useCallback(
    (point: { x: number; y: number }, kind: BookShapeKind) => {
      addShapeAt(point.x, point.y, kind);
    },
    [addShapeAt],
  );

  const {
    updateCurrentPageName,
    applyPageTitleFromAi,
    updateCurrentPageBackground,
    updatePresentationTransition,
    updatePresentationTransitionMs,
    updatePresentationTimingElementId,
  } = usePageProperties({
    activePageIndex,
    pageCount: pages.length,
    updatePages,
    mutateActivePage,
  });

  const onDropWidget = useCallback(
    (point: { x: number; y: number }, kind: BookDropWidgetKind) => {
      if (addByKind(kind, point.x, point.y)) return;
      if (kind === "mediaPlaylist") {
        addMediaPlaylistAt(point.x, point.y);
        return;
      }
      if (kind === "image" || kind === "video") {
        // 미디어 위젯과 같은 흐름 — 빈 자리를 먼저 놓는다.
        // 파일 채우기는 업로드에 북 id가 필요해 저장 후에 가능하다.
        addEmptyMediaAt(point.x, point.y, kind);
        return;
      }
      toast.error("지원하지 않는 위젯 종류입니다.");
    },
    [addByKind, addEmptyMediaAt, addMediaPlaylistAt],
  );

  /** 팔레트 더블 클릭 — 위젯을 슬라이드 가운데에 바로 추가 */
  const handlePaletteQuickAdd = useCallback(
    (kind: BookDropWidgetKind) => {
      if (addByKindCentered(kind)) return;

      // 표에 없는 종류 — 미디어 플레이리스트만 이 화면에서 다룬다
      if (kind === "mediaPlaylist") {
        addMediaPlaylistAt(
          Math.max(
            0,
            Math.round((slideWidth - DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH) / 2),
          ),
          Math.max(
            0,
            Math.round((slideHeight - DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT) / 2),
          ),
        );
        return;
      }

      toast.error(
        "저장한 뒤 열린 북 화면에서 이미지·동영상·PDF 위젯을 넣을 수 있습니다.",
      );
    },
    [addByKindCentered, addMediaPlaylistAt, slideHeight, slideWidth],
  );

  const { applyAiElements, addPagesFromAi, applySlideDimensionsFromAi } =
    useAiDocumentEdits({
      activePageIndex,
      pageCount: pages.length,
      updatePages,
      commitPages,
      setSlideWidth,
      setSlideHeight,
    });

  const {
    hasClipboard: widgetClipboardHasContent,
    copySelection: copySelectedWidgets,
    cutSelection: cutSelectedWidgets,
    copyElementOrSelection,
    cutElementOrSelection,
    paste: pasteWidgetClipboard,
  } = useBookWidgetClipboard({
    selectedIds: canvasSelectedIds,
    activePageIndex,
    slideWidth,
    slideHeight,
    getActivePageElements: () => currentPage?.elements ?? [],
    appendElements: appendElementsToActivePage,
    removeElementsByIds,
    setSelectedIds,
  });

  /** 위젯 복사/잘라내기/붙여넣기 단축키 — 입력창·다이얼로그에서는 브라우저 기본 동작 유지 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "c" && k !== "x" && k !== "v") return;
      if (isBookEditorTypingTarget(e.target)) return;
      if (widgetDeleteOpen || pageDeleteOpen) return;
      if (k === "v") {
        if (!widgetClipboardHasContent) return;
        e.preventDefault();
        pasteWidgetClipboard();
        return;
      }
      if (canvasSelectedIds.length === 0) return;
      e.preventDefault();
      if (k === "c") copySelectedWidgets();
      else cutSelectedWidgets();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    canvasSelectedIds,
    widgetDeleteOpen,
    pageDeleteOpen,
    widgetClipboardHasContent,
    copySelectedWidgets,
    cutSelectedWidgets,
    pasteWidgetClipboard,
  ]);

  /** 캔버스 우상단 오버레이 — 슬라이드쇼와 같은 규칙의 페이지 재생 시간(초) */
  const currentPagePlaybackSec = useMemo(() => {
    if (!currentPage) return null;
    return computeSlidePresentationDurationSec(
      {
        elements: currentPage.elements,
        presentationTimingElementId:
          currentPage.presentationTimingElementId ?? null,
      },
      { videoDurationSecById: videoDurationByElementId },
    );
  }, [currentPage, videoDurationByElementId]);

  const {
    widgetDeleteIds,
    widgetDeleteKindLabel,
    requestRemoveWidget,
    confirmRemoveWidget,
    removeSelected,
    removeSelectedBulk,
  } = useWidgetDeleteFlow({
    activePage: currentPage,
    canvasSelectedIds,
    removeElementsByIds,
  });

  const addPage = () => {
    commitPages((prev) =>
      applyAutoSlideNamesByIndex([...prev, createEmptyEditorPage(prev.length)]),
    );
    setPageIndex(pages.length);
    setSelectedIds([]);
  };

  const {
    addPageAtInsertIndex,
    requestRemovePageAt,
    requestRemoveCurrentPageForAi,
    confirmRemovePageAt,
    duplicatePageAt,
    reorderPages,
  } = usePageOperations({
    activePageIndex,
    pageCount: pages.length,
    commitPages,
  });

  const selectedEl = useMemo(() => {
    if (canvasSelectedIds.length !== 1 || !currentPage) return null;
    const id = canvasSelectedIds[0];
    return currentPage.elements.find((e) => e.id === id) ?? null;
  }, [canvasSelectedIds, currentPage]);

  const layoutAiMediaSelection = useMemo(() => {
    if (!selectedEl) return null;
    if (selectedEl.type !== "image" && selectedEl.type !== "video") return null;
    return { elementId: selectedEl.id, kind: selectedEl.type };
  }, [selectedEl]);

  const mediaHint = useMemo(
    () =>
      "저장하면 북이 만들어지고, 그 화면에서 이미지·동영상 위젯을 쓸 수 있습니다.",
    [],
  );

  const pageLabels = useMemo(() => pages.map((p) => p.name), [pages]);
  const pageKeys = useMemo(() => pages.map((p) => p.clientKey), [pages]);

  const slideThumbnailSources = useMemo(
    () =>
      pages.map((p) => ({
        clientKey: p.clientKey,
        backgroundColor: p.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND,
        elements: p.elements,
      })),
    [pages],
  );
  const slideThumbnails = useBookPageThumbnails(
    slideThumbnailSources,
    slideWidth,
    slideHeight,
  );

  return (
    <>
      <BookWorkspaceShell
        titleArea={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
            <Input
              className="h-8 min-w-[10rem] max-w-md flex-1 rounded-md border-transparent bg-transparent pl-2.5 pr-2 text-sm font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/25 focus-visible:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="북 제목"
              maxLength={200}
              aria-label="북 제목"
            />
            <BookHeaderSlideDimensions
              slideWidth={slideWidth}
              slideHeight={slideHeight}
              onChangeSlideWidth={setSlideWidth}
              onChangeSlideHeight={setSlideHeight}
            />
          </div>
        }
        actions={
          <Button
            type="button"
            size="sm"
            className="h-7 border-transparent bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-700 focus-visible:ring-blue-500/40 disabled:opacity-100"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Spinner className="mr-1.5 size-3.5 text-white" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            저장
          </Button>
        }
        left={
          <BookEditorLeftDock
            pages={{
              count: pages.length,
              keys: pageKeys,
              labels: pageLabels,
              thumbnailsByKey: slideThumbnails,
              activeIndex: activePageIndex,
              onReorder: reorderPages,
              onAdd: addPage,
              onAddAt: addPageAtInsertIndex,
              onRemoveAt: requestRemovePageAt,
              onDuplicateAt: duplicatePageAt,
            }}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            onApplyTemplate={applySlideTemplate}
            onAddShape={onAddShapeFromElementsPanel}
            widgets={{
              onFloat: () => persistWidgetFloatingOpen(true),
              onQuickAdd: handlePaletteQuickAdd,
            }}
          />
        }
        center={
          <>
            <BookEditorCanvasStage
              slideWidth={slideWidth}
              slideHeight={slideHeight}
              page={currentPage}
              pageCount={pages.length}
              activePageIndex={activePageIndex}
              playbackSec={currentPagePlaybackSec}
              history={{ canUndo, canRedo, undo, redo }}
              canvas={{
                selectedIds: canvasSelectedIds,
                onSelect: handleCanvasSelect,
                onElementChange,
                onElementsChange,
                onReorderZ,
                onDeleteElement: requestRemoveWidget,
                drop: { onDropWidget, onDropShape },
                drawing: {
                  tool: leftDockTab === "drawing" ? "draw" : "default",
                  strokeColor: drawingStrokeColor,
                  strokeWidth: drawingStrokeWidth,
                  onAppendElement: onAppendDrawingElement,
                },
                media: {
                  onPlaylistPlaybackIndexChange:
                    handleMediaPlaylistPlaybackIndex,
                  onPlaylistPlaybackUiReport:
                    handleMediaPlaylistPlaybackUiReport,
                  playlistRemoteCommand: playlistRemoteCmd,
                  onPlaylistRemoteCommandConsumed: clearPlaylistRemoteCmd,
                  onVideoDurationKnown: handleVideoDurationKnown,
                },
                clipboard: {
                  onCopyElement: copyElementOrSelection,
                  onCutElement: cutElementOrSelection,
                  onPaste: pasteWidgetClipboard,
                  hasContent: widgetClipboardHasContent,
                },
              }}
            />
            {floatingWidgetPaletteOpen ? (
              <BookWidgetPalette
                variant="floating"
                onClose={() => persistWidgetFloatingOpen(false)}
                onQuickAdd={handlePaletteQuickAdd}
              />
            ) : null}
            {currentPage ? (
              <BookAiAssistantPanel
                slideWidth={slideWidth}
                slideHeight={slideHeight}
                pageCount={pages.length}
                activePageIndex={activePageIndex}
                onApplyElements={applyAiElements}
                onApplyPageBackground={updateCurrentPageBackground}
                onApplyPageTitle={applyPageTitleFromAi}
                onApplyBookTitle={setTitle}
                onAddPages={addPagesFromAi}
                onUndo={undo}
                onRedo={redo}
                onRequestRemoveCurrentPage={requestRemoveCurrentPageForAi}
                onApplySlideDimensions={applySlideDimensionsFromAi}
                layoutAiMediaSelection={layoutAiMediaSelection}
                onPatchBookElement={onElementChange}
              />
            ) : null}
          </>
        }
        right={
          currentPage ? (
            <BookEditorRightDock
              page={currentPage}
              pageIndex={activePageIndex}
              pageCount={pages.length}
              selectedIds={canvasSelectedIds}
              selectedElement={selectedEl}
              slideWidth={slideWidth}
              slideHeight={slideHeight}
              elements={{
                onChange: onElementChange,
                onReorderZ,
                onDragReorder: onLayerDragReorder,
                onVisibilityChange: onLayerVisibilityChange,
                onLockChange: onLayerLockChange,
                onRequestDelete: requestRemoveWidget,
                onDeleteSelected: removeSelected,
                onDeleteSelectedBulk: removeSelectedBulk,
              }}
              pageActions={{
                onChangeName: updateCurrentPageName,
                onChangeBackground: updateCurrentPageBackground,
                onChangeTimingElementId: updatePresentationTimingElementId,
                onChangeTransition: updatePresentationTransition,
                onChangeTransitionMs: updatePresentationTransitionMs,
              }}
              presentationLoop={presentationLoop}
              onChangePresentationLoop={setPresentationLoop}
              playlist={{
                playbackByElementId: mediaPlaylistPlaybackByElementId,
                playbackUiByElementId: mediaPlaylistPlaybackUiByElementId,
                onRemoteControl: handleMediaPlaylistRemoteControl,
              }}
              mediaHint={mediaHint}
            />
          ) : null
        }
      />
      <BookWidgetDeleteDialog
        kindLabel={widgetDeleteKindLabel}
        count={widgetDeleteIds.length}
        onConfirm={confirmRemoveWidget}
      />
      <BookPageDeleteDialog
        targetLabel={pageDeleteTargetLabel(pageDeleteIndex, pages)}
        onConfirm={confirmRemovePageAt}
      />
    </>
  );
}
