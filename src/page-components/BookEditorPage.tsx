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
import {
  BookCanvasPageNavBadge,
  BookCanvasPlaybackBadge,
} from "@/components/books/BookCanvasStageOverlays";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookEditorToolRail } from "@/components/books/BookEditorToolRail";
import { BookElementsPanel } from "@/components/books/BookElementsPanel";
import { BookHeaderSlideDimensions } from "@/components/books/BookHeaderSlideDimensions";
import { BookInspectorPanel } from "@/components/books/BookInspectorPanel";
import { BookLayersPanel } from "@/components/books/BookLayersPanel";
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import {
  type BookCanvasSelectDetail,
  type BookDropWidgetKind,
  BookSlideCanvas,
} from "@/components/books/BookSlideCanvas";
import { BookSlideDrawingPanel } from "@/components/books/BookSlideDrawingPanel";
import { BookSlideTemplatesPanel } from "@/components/books/BookSlideTemplatesPanel";
import { BookWidgetPalette } from "@/components/books/BookWidgetPalette";
import { BookWorkspaceShell } from "@/components/books/BookWorkspaceShell";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  pageIndexAfterReorder,
  reorderPagesArray,
  resolveEffectivePresentationTimingElementId,
  toBookPagePayloads,
} from "@/features/book/book-canvas";
import { isBookEditorTypingTarget } from "@/features/book/book-editor-keyboard";
import {} from "@/features/book/book-floating-ui-prefs";
import { warmBookCanvasImagesForNeighborPages } from "@/features/book/book-image-cache";
import { computeSlidePresentationDurationSec } from "@/features/book/book-presentation";
import {
  type BookPresentationTransitionId,
  clampBookPresentationTransitionMs,
  normalizeBookPresentationTransition,
} from "@/features/book/book-presentation-transition";
import {
  type BookSlideTemplateId,
  instantiateBookSlideTemplate,
} from "@/features/book/book-slide-templates";
import {
  bookCanvasStageMatClass,
  bookCanvasToolbarRowClass,
  bookLeftDockContentColumnClass,
  bookRightDockInspectorShellClass,
} from "@/features/book/book-workspace-ui";
import {
  closePageDelete,
  closeWidgetDelete,
  openPageDelete,
  openWidgetDelete,
  resetEditorUi,
  setCenterGuideThresholdPx,
  setDragGridPx,
  setDrawingStrokeColor,
  setDrawingStrokeWidth,
  setFloatingWidgetPaletteOpen as persistWidgetFloatingOpen,
  setLeftDockTab,
  setPageIndex,
  setSelectedIds,
  setVideoDuration as handleVideoDurationKnown,
  toggleSelectedId,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";
import {
  BOOK_CANVAS_STAGE_DISPLAY_OPTS,
  useBookCanvasDisplayScale,
} from "@/features/book/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/features/book/use-book-document-history";
import { useBookPageThumbnails } from "@/features/book/use-book-page-thumbnails";
import { useBookWidgetClipboard } from "@/features/book/use-book-widget-clipboard";
import { useElementMutations } from "@/features/book/use-element-mutations";
import { useMediaPlaylistPlayback } from "@/features/book/use-media-playlist-playback";
import { usePageOperations } from "@/features/book/use-page-operations";
import { useWidgetInserters } from "@/features/book/use-widget-inserters";
import { type BookCanvasElement, createBook } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";

/** `/books/new` — 저장 후 `/books/:id`로 이동해 동일 편집 UI를 씁니다. */
export function BookEditorPage() {
  // ── 에디터 UI·도구 상태 ─────────────────────────────────────────
  // 같은 13개가 BookDetailPage 소유자 뷰에도 복사돼 있었다. 정의를 스토어 한 곳에 모아
  // 두 화면이 조용히 벌어지지 않게 한다(features/book/editor-ui-store.ts).
  const pageIndex = useBookEditorUiStore((s) => s.pageIndex);
  const selectedIds = useBookEditorUiStore((s) => s.selectedIds);
  const leftDockTab = useBookEditorUiStore((s) => s.leftDockTab);
  const drawingStrokeColor = useBookEditorUiStore((s) => s.drawingStrokeColor);
  const drawingStrokeWidth = useBookEditorUiStore((s) => s.drawingStrokeWidth);
  const centerGuideThresholdPx = useBookEditorUiStore(
    (s) => s.centerGuideThresholdPx,
  );
  const dragGridPx = useBookEditorUiStore((s) => s.dragGridPx);
  const floatingWidgetPaletteOpen = useBookEditorUiStore(
    (s) => s.floatingWidgetPaletteOpen,
  );
  const widgetDeleteOpen = useBookEditorUiStore((s) => s.widgetDeleteOpen);
  const widgetDeleteIds = useBookEditorUiStore((s) => s.widgetDeleteIds);
  const pageDeleteOpen = useBookEditorUiStore((s) => s.pageDeleteOpen);
  const pageDeleteIndex = useBookEditorUiStore((s) => s.pageDeleteIndex);
  const videoDurationByElementId = useBookEditorUiStore(
    (s) => s.videoDurationByElementId,
  );

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
  const canvasWrapRef = useRef<HTMLDivElement>(null);
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
  const canvasSelectedIds = useMemo(() => {
    if (!currentPage) return [];
    const onPage = new Set(currentPage.elements.map((e) => e.id));
    return selectedIds.filter((id) => onPage.has(id));
  }, [selectedIds, currentPage]);

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

  const handleCanvasSelect = useCallback((d: BookCanvasSelectDetail) => {
    if (d.id === null) setSelectedIds([]);
    else toggleSelectedId(d.id, d.shiftKey);
  }, []);

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

  const playlistInspectorSelectionKey = useMemo(
    () => (canvasSelectedIds.length === 1 ? (canvasSelectedIds[0] ?? "") : ""),
    [canvasSelectedIds],
  );

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

  const { displayScale, zoomPercent, zoomIn, zoomOut, zoomReset, handleWheel } =
    useBookCanvasDisplayScale(canvasWrapRef, {
      slideWidth,
      slideHeight,
      ...BOOK_CANVAS_STAGE_DISPLAY_OPTS,
    });

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

  const updateCurrentPageName = useCallback(
    (name: string) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.name = name;
      });
    },
    [activePageIndex, updatePages],
  );

  const updatePageNameAt = useCallback(
    (index: number, name: string) => {
      updatePages((draft) => {
        const p = draft[index];
        if (p) p.name = name;
      });
    },
    [updatePages],
  );

  const applyPageTitleFromAi = useCallback(
    (name: string, opts?: { slideNumber?: number }) => {
      const n = opts?.slideNumber;
      if (n == null || !Number.isFinite(n)) {
        updatePageNameAt(activePageIndex, name);
        return;
      }
      if (pages.length === 0) return;
      const idx = Math.round(n) - 1;
      const clamped = Math.min(pages.length - 1, Math.max(0, idx));
      updatePageNameAt(clamped, name);
    },
    [activePageIndex, pages.length, updatePageNameAt],
  );

  const updateCurrentPageBackground = useCallback(
    (backgroundColor: string) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.backgroundColor = backgroundColor;
      });
    },
    [activePageIndex, updatePages],
  );

  const updatePresentationTimingElementId = useCallback(
    (id: string | null) => {
      // 상세 페이지와 동일한 검증 — 삭제된 요소 id가 그대로 저장되지 않게
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        if (p.elements.length === 0) {
          p.presentationTimingElementId = null;
          return;
        }
        const trimmed = typeof id === "string" ? id.trim() : "";
        if (trimmed && p.elements.some((e) => e.id === trimmed)) {
          p.presentationTimingElementId = trimmed;
          return;
        }
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(p.elements, null);
      });
    },
    [activePageIndex, updatePages],
  );

  const updatePresentationTransition = useCallback(
    (transition: BookPresentationTransitionId) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.presentationTransition = transition;
      });
    },
    [activePageIndex, updatePages],
  );

  const updatePresentationTransitionMs = useCallback(
    (ms: number) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.presentationTransitionMs = ms;
      });
    },
    [activePageIndex, updatePages],
  );

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

  const applyAiElements = useCallback(
    (elements: BookCanvasElement[], opts?: { targetSlideNumber?: number }) => {
      if (elements.length === 0) return;
      let navigatedIdx: number | null = null;
      updatePages((draft) => {
        const maxIdx = Math.max(0, draft.length - 1);
        const idx =
          typeof opts?.targetSlideNumber === "number" &&
          Number.isFinite(opts.targetSlideNumber)
            ? Math.min(
                maxIdx,
                Math.max(0, Math.round(opts.targetSlideNumber) - 1),
              )
            : Math.min(Math.max(0, activePageIndex), maxIdx);
        const p = draft[idx];
        if (!p) return;
        for (const el of elements) p.elements.push(el);
        if (
          typeof opts?.targetSlideNumber === "number" &&
          Number.isFinite(opts.targetSlideNumber)
        ) {
          navigatedIdx = idx;
        }
      });
      if (navigatedIdx != null) {
        setPageIndex(navigatedIdx);
      }
      setSelectedIds([elements[elements.length - 1]!.id]);
    },
    [activePageIndex, updatePages],
  );

  const addPagesFromAi = useCallback(
    (count: number) => {
      const n = Math.min(20, Math.max(1, Math.round(count)));
      const prevLen = pages.length;
      commitPages((prev) => {
        const next = [...prev];
        for (let i = 0; i < n; i++) {
          next.push(createEmptyEditorPage(next.length));
        }
        return applyAutoSlideNamesByIndex(next);
      });
      setPageIndex(prevLen + n - 1);
      setSelectedIds([]);
    },
    [commitPages, pages.length],
  );

  const applySlideDimensionsFromAi = useCallback(
    (partial: { slideWidth?: number; slideHeight?: number }) => {
      if (typeof partial.slideWidth === "number")
        setSlideWidth(partial.slideWidth);
      if (typeof partial.slideHeight === "number")
        setSlideHeight(partial.slideHeight);
    },
    [],
  );

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

  const requestRemoveWidget = useCallback((elementId: string) => {
    openWidgetDelete([elementId]);
  }, []);

  const confirmRemoveWidget = useCallback(() => {
    if (widgetDeleteIds.length > 0) removeElementsByIds(widgetDeleteIds);
    closeWidgetDelete();
  }, [widgetDeleteIds, removeElementsByIds]);

  const removeSelected = useCallback(() => {
    if (canvasSelectedIds.length !== 1) return;
    requestRemoveWidget(canvasSelectedIds[0]!);
  }, [canvasSelectedIds, requestRemoveWidget]);

  const removeSelectedBulk = useCallback(() => {
    if (canvasSelectedIds.length === 0) return;
    openWidgetDelete([...canvasSelectedIds]);
  }, [canvasSelectedIds]);

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
  } = usePageOperations({ activePageIndex, commitPages });

  const reorderPages = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const maxIdx = Math.max(0, pages.length - 1);
      commitPages((prev) => reorderPagesArray(prev, from, to));
      setPageIndex((cur) => {
        const c = Math.min(cur, maxIdx);
        const next = pageIndexAfterReorder(c, from, to);
        return Math.min(next, maxIdx);
      });
    },
    [commitPages, pages.length],
  );

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

  const widgetDeleteKindLabel = useMemo(() => {
    if (widgetDeleteIds.length === 0 || !currentPage) return "위젯";
    if (widgetDeleteIds.length > 1) return `${widgetDeleteIds.length}개 위젯`;
    const el = currentPage.elements.find((e) => e.id === widgetDeleteIds[0]);
    if (!el) return "위젯";
    if (el.type === "text") return "텍스트 위젯";
    if (el.type === "image") return "이미지 위젯";
    if (el.type === "video") return "동영상 위젯";
    if (el.type === "weather") return "날씨 위젯";
    if (el.type === "news") return "뉴스 위젯";
    if (el.type === "mediaPlaylist") return "미디어 위젯";
    if (el.type === "digitalClock") return "디지털 시계 위젯";
    if (el.type === "webview") return "웹뷰 위젯";
    if (el.type === "map") return "지도 위젯";
    if (el.type === "calendar") return "캘린더 위젯";
    if (el.type === "qr") return "QR코드 위젯";
    if (el.type === "chart") return "차트 위젯";
    if (el.type === "ticker") return "티커 위젯";
    if (el.type === "youtube") return "유튜브 위젯";
    if (el.type === "adSlot") return "광고 위젯";
    if (el.type === "drawing") return "그리기";
    return "위젯";
  }, [widgetDeleteIds, currentPage]);

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
          <div className="flex h-full min-h-0 w-fit max-w-full flex-row">
            <BookEditorToolRail
              activeTab={leftDockTab}
              onActiveTabChange={setLeftDockTab}
              mediaLibraryEnabled={false}
            />
            <div
              className={bookLeftDockContentColumnClass(
                "border-s border-border/40",
                {
                  slideWidth,
                  slideHeight,
                },
              )}
            >
              {leftDockTab === "page" ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <BookPageSidebar
                    fluid
                    pageCount={pages.length}
                    pageKeys={pageKeys}
                    thumbnailsByKey={slideThumbnails}
                    activeIndex={activePageIndex}
                    pageLabels={pageLabels}
                    onSelectPage={(i) => {
                      setPageIndex(i);
                      setSelectedIds([]);
                    }}
                    mode="edit"
                    onReorderPages={reorderPages}
                    onAddPage={addPage}
                    onAddPageAtInsertIndex={addPageAtInsertIndex}
                    onRemovePageAtIndex={requestRemovePageAt}
                    onDuplicatePageAtIndex={duplicatePageAt}
                    canRemovePage={pages.length > 1}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                  />
                </div>
              ) : null}
              {leftDockTab === "widgets" ? (
                <BookWidgetPalette
                  variant="docked"
                  className="min-h-0 flex-1"
                  onRequestFloat={() => persistWidgetFloatingOpen(true)}
                  onQuickAdd={handlePaletteQuickAdd}
                />
              ) : null}
              {leftDockTab === "templates" ? (
                <BookSlideTemplatesPanel
                  className="min-h-0 flex-1"
                  onApplyTemplate={applySlideTemplate}
                />
              ) : null}
              {leftDockTab === "elements" ? (
                <BookElementsPanel
                  className="min-h-0 flex-1"
                  onAddShape={onAddShapeFromElementsPanel}
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
        }
        center={
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className={bookCanvasToolbarRowClass()}>
                <BookCanvasToolbar
                  zoomPercent={zoomPercent}
                  onZoomIn={zoomIn}
                  onZoomOut={zoomOut}
                  onZoomReset={zoomReset}
                  showUndoRedo
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  centerGuideThresholdPx={centerGuideThresholdPx}
                  onCenterGuideThresholdPxChange={setCenterGuideThresholdPx}
                  dragGridPx={dragGridPx}
                  onDragGridPxChange={setDragGridPx}
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
                  pageCount={pages.length}
                  activePageIndex={activePageIndex}
                  pageName={currentPage?.name}
                />
                <BookCanvasPlaybackBadge playbackSec={currentPagePlaybackSec} />
                {currentPage ? (
                  <BookSlideCanvas
                    pageWidth={slideWidth}
                    pageHeight={slideHeight}
                    pageBackgroundColor={
                      currentPage.backgroundColor?.trim() ||
                      DEFAULT_PAGE_BACKGROUND
                    }
                    scale={displayScale}
                    elements={currentPage.elements}
                    mode="edit"
                    selectedIds={canvasSelectedIds}
                    onSelect={handleCanvasSelect}
                    onElementChange={onElementChange}
                    onElementsChange={onElementsChange}
                    onReorderZ={onReorderZ}
                    onDeleteElement={requestRemoveWidget}
                    centerGuideThresholdPx={centerGuideThresholdPx}
                    dragGridPx={dragGridPx}
                    drop={{ onDropWidget, onDropShape }}
                    drawing={{
                      tool: leftDockTab === "drawing" ? "draw" : "default",
                      strokeColor: drawingStrokeColor,
                      strokeWidth: drawingStrokeWidth,
                      onAppendElement: onAppendDrawingElement,
                    }}
                    media={{
                      onPlaylistPlaybackIndexChange:
                        handleMediaPlaylistPlaybackIndex,
                      onPlaylistPlaybackUiReport:
                        handleMediaPlaylistPlaybackUiReport,
                      playlistRemoteCommand: playlistRemoteCmd,
                      onPlaylistRemoteCommandConsumed: clearPlaylistRemoteCmd,
                      onVideoDurationKnown: handleVideoDurationKnown,
                    }}
                    clipboard={{
                      onCopyElement: copyElementOrSelection,
                      onCutElement: cutElementOrSelection,
                      onPaste: pasteWidgetClipboard,
                      hasContent: widgetClipboardHasContent,
                    }}
                  />
                ) : null}
              </div>
            </div>
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
            <aside className="flex h-full min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-card/50">
              <BookLayersPanel
                elements={currentPage.elements}
                selectedIds={canvasSelectedIds}
                onSelect={toggleSelectedId}
                onReorderZ={onReorderZ}
                onLayerDragReorder={onLayerDragReorder}
                onVisibilityChange={onLayerVisibilityChange}
                onLockChange={onLayerLockChange}
                onRequestDelete={requestRemoveWidget}
                presentationTimingElementId={
                  currentPage.presentationTimingElementId
                }
                onPresentationTimingElementIdChange={
                  updatePresentationTimingElementId
                }
                onPresentationHoldSecChange={(eid, sec) =>
                  onElementChange(eid, { presentationHoldSec: sec })
                }
                videoDurationSecByElementId={videoDurationByElementId}
              />
              <div className={bookRightDockInspectorShellClass()}>
                {canvasSelectedIds.length >= 2 ? (
                  <BookInspectorPanel
                    embedded
                    selected={null}
                    multiSelectionCount={canvasSelectedIds.length}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                    onChange={onElementChange}
                    onDelete={removeSelectedBulk}
                    mediaHint={mediaHint}
                  />
                ) : canvasSelectedIds.length === 1 ? (
                  <BookInspectorPanel
                    embedded
                    selected={selectedEl}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                    onChange={onElementChange}
                    onDelete={removeSelected}
                    mediaHint={mediaHint}
                    mediaPlaylistPlaybackByElementId={
                      mediaPlaylistPlaybackByElementId
                    }
                    mediaPlaylistPlaybackUiByElementId={
                      mediaPlaylistPlaybackUiByElementId
                    }
                    onMediaPlaylistRemoteControl={
                      handleMediaPlaylistRemoteControl
                    }
                    videoDurationSecByElementId={videoDurationByElementId}
                    pagePresentationTimingElementId={
                      currentPage.presentationTimingElementId
                    }
                  />
                ) : (
                  <BookPagePropertiesPanel
                    embedded
                    pageIndex={activePageIndex}
                    totalPages={pages.length}
                    name={currentPage.name}
                    onChangeName={updateCurrentPageName}
                    backgroundColor={
                      currentPage.backgroundColor?.trim() ||
                      DEFAULT_PAGE_BACKGROUND
                    }
                    onChangeBackgroundColor={updateCurrentPageBackground}
                    elements={currentPage.elements}
                    presentationTimingElementId={
                      currentPage.presentationTimingElementId
                    }
                    onChangePresentationTimingElementId={
                      updatePresentationTimingElementId
                    }
                    presentationLoop={presentationLoop}
                    onChangePresentationLoop={setPresentationLoop}
                    presentationTransition={normalizeBookPresentationTransition(
                      currentPage.presentationTransition,
                    )}
                    onChangePresentationTransition={
                      updatePresentationTransition
                    }
                    presentationTransitionMs={clampBookPresentationTransitionMs(
                      currentPage.presentationTransitionMs,
                    )}
                    onChangePresentationTransitionMs={
                      updatePresentationTransitionMs
                    }
                  />
                )}
              </div>
            </aside>
          ) : null
        }
      />
      <AlertDialog
        open={widgetDeleteOpen}
        onOpenChange={(open) => {
          if (!open) closeWidgetDelete();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>위젯을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 슬라이드에서 「{widgetDeleteKindLabel}」을(를) 제거합니다.
              {widgetDeleteIds.length > 1
                ? " 선택한 위젯이 모두 삭제됩니다."
                : ""}{" "}
              실행 후에는 되돌리기(Ctrl+Z)로 복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirmRemoveWidget()}
            >
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pageDeleteOpen}
        onOpenChange={(open) => {
          if (!open) closePageDelete();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>슬라이드를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              「
              {pageDeleteIndex != null && pages[pageDeleteIndex]
                ? pages[pageDeleteIndex].name.trim() ||
                  `슬라이드 ${pageDeleteIndex + 1}`
                : "이 슬라이드"}
              」와 이 페이지에 있는 모든 위젯이 제거됩니다. 되돌리기(Ctrl+Z)로
              복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirmRemovePageAt()}
            >
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
