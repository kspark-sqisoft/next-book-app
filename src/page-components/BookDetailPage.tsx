"use client";

// 북 상세·편집: 서버 페이지 → 로컬 히스토리, 소유자는 BookDetailOwnerView / 비로그인·타인은 읽기 전용 게스트 뷰
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Save,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { BookAiAssistantPanel } from "@/components/books/BookAiAssistantPanel";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookEditorToolRail } from "@/components/books/BookEditorToolRail";

/** Filerobot 편집기는 브라우저 전용 — SSR 제외하고 열 때만 로드 */
const BookImageEditorDialog = dynamic(
  () =>
    import("@/components/books/BookImageEditorDialog").then(
      (m) => m.BookImageEditorDialog,
    ),
  { ssr: false },
);

/** Twick 비디오 편집기(WebCodecs 렌더)도 브라우저 전용 */
const BookVideoEditorDialog = dynamic(
  () =>
    import("@/components/books/BookVideoEditorDialog").then(
      (m) => m.BookVideoEditorDialog,
    ),
  { ssr: false },
);
import { BookElementsPanel } from "@/components/books/BookElementsPanel";
import { BookHeaderSlideDimensions } from "@/components/books/BookHeaderSlideDimensions";
import { BookInspectorPanel } from "@/components/books/BookInspectorPanel";
import { BookLayersPanel } from "@/components/books/BookLayersPanel";
import { BookMediaLibraryPanel } from "@/components/books/BookMediaLibraryPanel";
import { BookMediaLibraryPickDialog } from "@/components/books/BookMediaLibraryPickDialog";
import type {
  BookMediaPlaylistPlaybackUiSnapshot,
  BookMediaPlaylistRemoteCommand,
} from "@/components/books/BookMediaPlaylistWidgetOverlay";
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import {
  type BookCanvasSelectDetail,
  type BookDropWidgetKind,
  type BookLibraryDragPayload,
  type BookReplaceMediaFromFileRequest,
  BookSlideCanvas,
  DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
} from "@/components/books/BookSlideCanvas";
import { BookSlideDrawingPanel } from "@/components/books/BookSlideDrawingPanel";
import { BookSlideTemplatesPanel } from "@/components/books/BookSlideTemplatesPanel";
import { BookWidgetPalette } from "@/components/books/BookWidgetPalette";
import { BookWorkspaceShell } from "@/components/books/BookWorkspaceShell";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import {
  AlertDialog,
  AlertDialogAction,
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
  type BookCanvasElement,
  type BookDetail,
  type BookPageDto,
  deleteBook,
  fetchBook,
  updateBook,
  uploadBookMedia,
} from "@/lib/api";
import { canEditAsOwnerOrAdmin } from "@/lib/authz";
import {
  applyAutoSlideNamesByIndex,
  BOOK_CANVAS_DRAG_GRID_PX,
  type BookEditorPageState,
  type BookShapeKind,
  createBookShapeElement,
  createEmptyEditorPage,
  DEFAULT_BOOK_CALENDAR_HEIGHT,
  DEFAULT_BOOK_CALENDAR_WIDTH,
  DEFAULT_BOOK_CHART_DATA,
  DEFAULT_BOOK_CHART_HEIGHT,
  DEFAULT_BOOK_CHART_TYPE,
  DEFAULT_BOOK_CHART_WIDTH,
  DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
  DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
  DEFAULT_BOOK_MAP_BBOX,
  DEFAULT_BOOK_MAP_HEIGHT,
  DEFAULT_BOOK_MAP_LAT,
  DEFAULT_BOOK_MAP_LON,
  DEFAULT_BOOK_MAP_QUERY,
  DEFAULT_BOOK_MAP_WIDTH,
  DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
  DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
  DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
  DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
  DEFAULT_BOOK_QR_HEIGHT,
  DEFAULT_BOOK_QR_VALUE,
  DEFAULT_BOOK_QR_WIDTH,
  DEFAULT_BOOK_TICKER_HEIGHT,
  DEFAULT_BOOK_TICKER_WIDTH,
  DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
  DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
  DEFAULT_BOOK_WEBVIEW_HEIGHT,
  DEFAULT_BOOK_WEBVIEW_WIDTH,
  DEFAULT_BOOK_YOUTUBE_HEIGHT,
  DEFAULT_BOOK_YOUTUBE_WIDTH,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  duplicateBookEditorPage,
  type ElementZOrderOp,
  MEDIA_PLAYLIST_MAX_ITEMS,
  pageIndexAfterRemove,
  pageIndexAfterReorder,
  placeBookShapeElementAtPointer,
  reorderBookElementsByDisplayIndex,
  reorderElementsZ,
  reorderPagesArray,
  resolveEffectivePresentationTimingElementId,
  toBookPagePayloads,
} from "@/lib/book-canvas";
import { isBookEditorTypingTarget } from "@/lib/book-editor-keyboard";
import type { BookEditorLeftTab } from "@/lib/book-editor-panel-events";
import {
  readFloatingMediaLibraryVisible,
  readFloatingWidgetPaletteVisible,
  writeFloatingMediaLibraryVisible,
  writeFloatingWidgetPaletteVisible,
} from "@/lib/book-floating-ui-prefs";
import { warmBookCanvasImagesForNeighborPages } from "@/lib/book-image-cache";
import { appendBookMediaLibraryItem } from "@/lib/book-media-library";
import { renderPdfFileToPageImages } from "@/lib/book-pdf-import";
import { computeSlidePresentationDurationSec } from "@/lib/book-presentation";
import {
  type BookPresentationTransitionId,
  clampBookPresentationTransitionMs,
  normalizeBookPresentationTransition,
} from "@/lib/book-presentation-transition";
import {
  type BookSlideTemplateId,
  instantiateBookSlideTemplate,
} from "@/lib/book-slide-templates";
import { defaultTextWidgetBoxHeight } from "@/lib/book-text-widget";
import {
  bookCanvasStageMatClass,
  bookCanvasToolbarRowClass,
  bookLeftDockContentColumnClass,
  bookRightDockInspectorShellClass,
} from "@/lib/book-workspace-ui";
import { bookKeys } from "@/lib/query-keys";
import {
  BOOK_CANVAS_STAGE_DISPLAY_OPTS,
  useBookCanvasDisplayScale,
} from "@/lib/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/lib/use-book-document-history";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { useBookWidgetClipboard } from "@/lib/use-book-widget-clipboard";
import { useAuth } from "@/stores/auth-store";

// API 페이지 DTO 를 편집기 로컬 페이지 배열로 정렬·정규화
function mapServerPagesToLocal(pages: BookPageDto[]): BookEditorPageState[] {
  const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
  return applyAutoSlideNamesByIndex(
    sorted.map((p, i) => ({
      clientKey: `srv-${p.id}`,
      sortOrder: i,
      name: typeof p.name === "string" ? p.name : "",
      backgroundColor:
        typeof p.backgroundColor === "string" && p.backgroundColor.trim()
          ? p.backgroundColor.trim()
          : DEFAULT_PAGE_BACKGROUND,
      elements: p.elements,
      presentationTimingElementId: resolveEffectivePresentationTimingElementId(
        p.elements,
        typeof p.presentationTimingElementId === "string"
          ? p.presentationTimingElementId
          : null,
      ),
      presentationTransition: normalizeBookPresentationTransition(
        p.presentationTransition,
      ),
      presentationTransitionMs: clampBookPresentationTransitionMs(
        p.presentationTransitionMs,
      ),
    })),
  );
}

// 헤더 액션: /preview 새 탭
function BookSlidePreviewOpenButton({ bookId }: { bookId: number }) {
  return (
    <Button
      type="button"
      size="sm"
      asChild
      className="relative h-7 overflow-hidden border-0 bg-linear-to-br from-violet-600 via-fuchsia-600 to-rose-500 px-2.5 text-xs font-semibold leading-none text-white shadow-[0_2px_14px_-2px_rgba(124,58,237,0.55)] ring-1 ring-white/25 transition [text-shadow:0_1px_1px_rgba(0,0,0,0.2)] hover:brightness-110 hover:shadow-[0_4px_20px_-2px_rgba(168,85,247,0.55)] focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:from-violet-500 dark:via-fuchsia-600 dark:to-rose-600 dark:shadow-[0_2px_18px_-4px_rgba(167,139,250,0.45)]"
    >
      <Link href={`/books/${bookId}/preview`} target="_blank" rel="noreferrer">
        <MonitorPlay
          className="mr-1.5 size-3.5 shrink-0 drop-shadow-sm"
          aria-hidden
        />
        미리보기
      </Link>
    </Button>
  );
}

// 소유자·관리자 전용 편집 워크스페이스; 부모 key 는 book.id 만(리마운트로 상태 유실 방지)
function BookDetailOwnerView({
  bookId,
  serverBook,
}: {
  bookId: number;
  serverBook: BookDetail;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [bookTitle, setBookTitle] = useState(serverBook.title);
  const [pageIndex, setPageIndex] = useState(0);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // 마운트 시 1회만 쓰이는 초기값 — 매 렌더 전체 페이지 재계산(정렬·정규화)을 막는다
  const initialPagesRef = useRef<BookEditorPageState[] | null>(null);
  if (initialPagesRef.current === null) {
    initialPagesRef.current = mapServerPagesToLocal(serverBook.pages);
  }
  const {
    pages: localPages,
    updatePages,
    updatePagesSilent,
    commitPages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBookDocumentHistory(initialPagesRef.current);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const playlistMediaInputRef = useRef<HTMLInputElement>(null);
  const playlistAppendElementIdRef = useRef<string | null>(null);
  const pendingMediaKindRef = useRef<"image" | "video" | null>(null);
  const pendingPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const replaceMediaElementIdRef = useRef<string | null>(null);
  const [libraryPick, setLibraryPick] = useState<
    | { mode: "replace"; elementId: string; kind: "image" | "video" }
    | { mode: "playlistAppend"; elementId: string }
    | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [widgetDeleteOpen, setWidgetDeleteOpen] = useState(false);
  const [widgetDeleteIds, setWidgetDeleteIds] = useState<string[]>([]);
  const [pageDeleteOpen, setPageDeleteOpen] = useState(false);
  const [pageDeleteIndex, setPageDeleteIndex] = useState<number | null>(null);
  const [slideWidth, setSlideWidth] = useState(
    () => serverBook.slideWidth ?? DEFAULT_SLIDE_WIDTH,
  );
  const [slideHeight, setSlideHeight] = useState(
    () => serverBook.slideHeight ?? DEFAULT_SLIDE_HEIGHT,
  );
  const [centerGuideThresholdPx, setCenterGuideThresholdPx] = useState(
    DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
  );
  const [dragGridPx, setDragGridPx] = useState(BOOK_CANVAS_DRAG_GRID_PX);
  const [presentationLoop, setPresentationLoop] = useState(
    () => serverBook.presentationLoop !== false,
  );
  const [leftDockTab, setLeftDockTab] = useState<BookEditorLeftTab>("page");
  const [drawingStrokeColor, setDrawingStrokeColor] = useState("#0f172a");
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(4);
  const [floatingWidgetPaletteOpen, setFloatingWidgetPaletteOpen] = useState(
    readFloatingWidgetPaletteVisible,
  );
  const [floatingMediaLibraryOpen, setFloatingMediaLibraryOpen] = useState(
    readFloatingMediaLibraryVisible,
  );
  const persistWidgetFloatingOpen = useCallback((open: boolean) => {
    writeFloatingWidgetPaletteVisible(open);
    setFloatingWidgetPaletteOpen(open);
  }, []);
  const persistMediaFloatingOpen = useCallback((open: boolean) => {
    writeFloatingMediaLibraryVisible(open);
    setFloatingMediaLibraryOpen(open);
  }, []);
  const [floatingPanelZ, setFloatingPanelZ] = useState(() => ({
    widget: 290,
    media: 289,
    ai: 288,
  }));
  /** 캔버스 플레이리스트별 재생 중 항목 인덱스 → 속성 목록 하이라이트 */
  const [
    mediaPlaylistPlaybackByElementId,
    setMediaPlaylistPlaybackByElementId,
  ] = useState<Record<string, number>>({});
  const [videoDurationByElementId, setVideoDurationByElementId] = useState<
    Record<string, number>
  >({});
  const [
    mediaPlaylistPlaybackUiByElementId,
    setMediaPlaylistPlaybackUiByElementId,
  ] = useState<Record<string, BookMediaPlaylistPlaybackUiSnapshot>>({});
  const playlistRemoteSeqRef = useRef(0);
  const [playlistRemoteCmd, setPlaylistRemoteCmd] =
    useState<BookMediaPlaylistRemoteCommand | null>(null);
  /** 이미지·비디오 편집기(레일 메뉴) — 전체 화면 편집 창 */
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [videoEditorOpen, setVideoEditorOpen] = useState(false);
  /** 전체 화면 편집기가 떠 있는 동안 북 에디터 단축키(Delete·Ctrl+S 등)가 가로채지 않게 */
  const editorOverlayOpen = imageEditorOpen || videoEditorOpen;
  /** PDF 가져오기(팔레트) — 변환·업로드 진행 중 여부와 숨김 파일 입력 */
  const [pdfImportBusy, setPdfImportBusy] = useState(false);
  const pdfImportInputRef = useRef<HTMLInputElement>(null);
  /** 드래그 드롭으로 시작한 경우 위젯을 놓을 지점(더블 클릭·버튼은 null → 중앙) */
  const pdfImportPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const raiseFloatingWidgetStack = useCallback(() => {
    setFloatingPanelZ((prev) => {
      const top = Math.max(prev.widget, prev.media, prev.ai) + 1;
      return { ...prev, widget: top };
    });
  }, []);
  const raiseFloatingMediaStack = useCallback(() => {
    setFloatingPanelZ((prev) => {
      const top = Math.max(prev.widget, prev.media, prev.ai) + 1;
      return { ...prev, media: top };
    });
  }, []);
  const raiseFloatingAiStack = useCallback(() => {
    setFloatingPanelZ((prev) => {
      const top = Math.max(prev.widget, prev.media, prev.ai) + 1;
      return { ...prev, ai: top };
    });
  }, []);

  const maxPageIdx = Math.max(0, localPages.length - 1);
  const activePageIndex = Math.min(pageIndex, maxPageIdx);
  const activePage = localPages[activePageIndex];

  const activePageElementIdsKey = useMemo(
    () => activePage?.elements.map((e) => e.id).join("\0") ?? "",
    [activePage?.elements],
  );

  useEffect(() => {
    // 파생 상태 자동 교정은 히스토리에 남기지 않는다(Silent) —
    // 남기면 템플릿 적용·요소 삭제 뒤 Ctrl+Z가 유령 엔트리에 한 번 헛돈다.
    const pg = localPages[activePageIndex];
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
    activePageElementIdsKey,
    activePage?.presentationTimingElementId,
    localPages,
    updatePagesSilent,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      setMediaPlaylistPlaybackByElementId({});
      setMediaPlaylistPlaybackUiByElementId({});
    });
  }, [activePageIndex]);

  const handleMediaPlaylistPlaybackIndex = useCallback(
    (elementId: string, index: number) => {
      setMediaPlaylistPlaybackByElementId((prev) => {
        if (prev[elementId] === index) return prev;
        return { ...prev, [elementId]: index };
      });
    },
    [],
  );

  const handleVideoDurationKnown = useCallback(
    (elementId: string, durationSec: number) => {
      setVideoDurationByElementId((prev) => {
        if (prev[elementId] === durationSec) return prev;
        return { ...prev, [elementId]: durationSec };
      });
    },
    [],
  );

  const handleMediaPlaylistPlaybackUiReport = useCallback(
    (elementId: string, payload: BookMediaPlaylistPlaybackUiSnapshot) => {
      setMediaPlaylistPlaybackUiByElementId((prev) => ({
        ...prev,
        [elementId]: payload,
      }));
    },
    [],
  );

  const clearPlaylistRemoteCmd = useCallback(
    () => setPlaylistRemoteCmd(null),
    [],
  );

  const handleMediaPlaylistRemoteControl = useCallback(
    (
      elementId: string,
      kind: "prev" | "next" | "togglePause" | "jumpTo",
      index?: number,
    ) => {
      playlistRemoteSeqRef.current += 1;
      setPlaylistRemoteCmd({
        targetId: elementId,
        kind,
        seq: playlistRemoteSeqRef.current,
        ...(index !== undefined ? { index } : {}),
      });
    },
    [],
  );

  const canvasSelectedIds = useMemo(() => {
    if (!activePage) return [];
    const onPage = new Set(activePage.elements.map((e) => e.id));
    return selectedIds.filter((id) => onPage.has(id));
  }, [selectedIds, activePage]);

  const playlistInspectorSelectionKey = useMemo(
    () => (canvasSelectedIds.length === 1 ? (canvasSelectedIds[0] ?? "") : ""),
    [canvasSelectedIds],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setPlaylistRemoteCmd(null);
    });
  }, [playlistInspectorSelectionKey]);

  const handleCanvasSelect = useCallback((d: BookCanvasSelectDetail) => {
    if (d.id === null) {
      setSelectedIds([]);
      return;
    }
    const nextId = d.id;
    setSelectedIds((prev) => {
      if (d.shiftKey) {
        const nex = new Set(prev);
        if (nex.has(nextId)) nex.delete(nextId);
        else nex.add(nextId);
        return Array.from(nex);
      }
      return [nextId];
    });
  }, []);

  const handleLayerSelect = useCallback((id: string, shiftKey?: boolean) => {
    setSelectedIds((prev) => {
      if (shiftKey) {
        const nex = new Set(prev);
        if (nex.has(id)) nex.delete(id);
        else nex.add(id);
        return Array.from(nex);
      }
      return [id];
    });
  }, []);

  const libraryPickAcceptKind =
    libraryPick == null
      ? null
      : libraryPick.mode === "replace"
        ? libraryPick.kind
        : ("both" as const);

  useEffect(() => {
    if (!libraryPick || !activePage) return;
    const el = activePage.elements.find((e) => e.id === libraryPick.elementId);
    if (!el) {
      setLibraryPick(null);
      return;
    }
    if (libraryPick.mode === "replace" && el.type !== libraryPick.kind) {
      setLibraryPick(null);
      return;
    }
    if (libraryPick.mode === "playlistAppend" && el.type !== "mediaPlaylist") {
      setLibraryPick(null);
    }
  }, [libraryPick, activePage]);

  useEffect(() => {
    if (!activePage) return;
    const onPage = new Set(activePage.elements.map((e) => e.id));
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
  }, [activePage]);

  const { displayScale, zoomPercent, zoomIn, zoomOut, zoomReset, handleWheel } =
    useBookCanvasDisplayScale(canvasWrapRef, {
      slideWidth,
      slideHeight,
      ...BOOK_CANVAS_STAGE_DISPLAY_OPTS,
    });

  useEffect(() => {
    warmBookCanvasImagesForNeighborPages(localPages, activePageIndex);
  }, [localPages, activePageIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBookEditorTypingTarget(e.target)) return;
      // 비디오·이미지 편집기 안에서 Delete가 슬라이드 삭제로 오인되지 않게
      if (editorOverlayOpen) return;
      if (widgetDeleteOpen || deleteConfirmOpen || pageDeleteOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (!activePage) return;
        setSelectedIds(activePage.elements.map((el) => el.id));
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
        localPages.length > 1
      ) {
        e.preventDefault();
        setPageDeleteIndex(activePageIndex);
        setPageDeleteOpen(true);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        canvasSelectedIds.length > 0
      ) {
        e.preventDefault();
        setWidgetDeleteIds([...canvasSelectedIds]);
        setWidgetDeleteOpen(true);
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
    activePage,
    widgetDeleteOpen,
    deleteConfirmOpen,
    pageDeleteOpen,
    editorOverlayOpen,
    localPages.length,
    activePageIndex,
  ]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateBook(bookId, {
        title: bookTitle.trim() || "제목 없음",
        slideWidth,
        slideHeight,
        presentationLoop,
        pages: toBookPagePayloads(localPages),
      }),
    onSuccess: (res) => {
      void queryClient.setQueryData(bookKeys.detail(bookId), res);
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      toast.success("저장했습니다.");
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
      if (editorOverlayOpen) return;
      if (widgetDeleteOpen || deleteConfirmOpen || pageDeleteOpen) return;
      e.preventDefault();
      if (saveMutationRef.current.isPending) return;
      saveMutationRef.current.mutate();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [widgetDeleteOpen, deleteConfirmOpen, pageDeleteOpen, editorOverlayOpen]);

  // 미저장 편집이 있으면 탭 닫기·새로고침 전에 경고
  useEffect(() => {
    if (!canUndo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [canUndo]);

  const deleteMutation = useMutation({
    mutationFn: (bid: number) => deleteBook(bid),
    onSuccess: (_data, deletedId) => {
      setDeleteConfirmOpen(false);
      void queryClient.removeQueries({ queryKey: bookKeys.detail(deletedId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      toast.success("북을 삭제했습니다.");
      router.replace("/books");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBookDialog = (
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>북을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            “{bookTitle.trim() || "제목 없음"}” 북과 포함된 모든 페이지가
            삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={deleteMutation.isPending}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(bookId)}
          >
            {deleteMutation.isPending ? (
              <Spinner className="mr-2 size-4" />
            ) : null}
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const onElementChange = useCallback(
    (elId: string, patch: Partial<BookCanvasElement>) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        const el = p.elements.find((x) => x.id === elId);
        if (!el) return;
        Object.assign(el, patch);
      });
    },
    [activePageIndex, updatePages],
  );

  // 그룹 드래그·다중 nudge — 한 번의 조작 = 한 개의 undo 엔트리
  const onElementsChange = useCallback(
    (patches: { id: string; patch: Partial<BookCanvasElement> }[]) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        for (const { id, patch } of patches) {
          const el = p.elements.find((x) => x.id === id);
          if (el) Object.assign(el, patch);
        }
      });
    },
    [activePageIndex, updatePages],
  );

  const onReorderZ = useCallback(
    (elementId: string, op: ElementZOrderOp) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = reorderElementsZ(p.elements, elementId, op);
      });
    },
    [activePageIndex, updatePages],
  );

  const onLayerDragReorder = useCallback(
    (fromDisplay: number, toDisplay: number) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = reorderBookElementsByDisplayIndex(
          p.elements,
          fromDisplay,
          toDisplay,
        );
      });
    },
    [activePageIndex, updatePages],
  );

  const onLayerVisibilityChange = useCallback(
    (elementId: string, visible: boolean) => {
      onElementChange(
        elementId,
        visible
          ? ({ visible: undefined } as Partial<BookCanvasElement>)
          : { visible: false },
      );
      if (!visible) {
        setSelectedIds((prev) => prev.filter((id) => id !== elementId));
      }
    },
    [onElementChange],
  );

  const onLayerLockChange = useCallback(
    (elementId: string, locked: boolean) => {
      onElementChange(
        elementId,
        locked
          ? { locked: true }
          : ({ locked: undefined } as Partial<BookCanvasElement>),
      );
    },
    [onElementChange],
  );

  const applySlideTemplate = useCallback(
    (templateId: BookSlideTemplateId) => {
      if (!activePage) {
        toast.error("먼저 페이지를 추가하세요.");
        return;
      }
      const nextElements = instantiateBookSlideTemplate(
        templateId,
        slideWidth,
        slideHeight,
      );
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = nextElements;
        // 요소를 통째로 교체하면 기존 타이밍 요소 id가 무효 — 즉시 재계산(뒤늦은 effect 교정에 의존하지 않음)
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(p.elements, null);
      });
      setSelectedIds([]);
      toast.success("슬라이드 내용을 비우고 템플릿을 적용했습니다.");
    },
    [
      activePage,
      activePageIndex,
      slideHeight,
      slideWidth,
      setSelectedIds,
      updatePages,
    ],
  );

  const onAppendDrawingElement = useCallback(
    (el: BookCanvasElement) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements.push(el);
      });
      setSelectedIds([el.id]);
    },
    [activePageIndex, updatePages],
  );

  const onAddShapeFromElementsPanel = useCallback(
    (kind: BookShapeKind) => {
      const el = createBookShapeElement(kind, slideWidth, slideHeight);
      onAppendDrawingElement(el);
    },
    [onAppendDrawingElement, slideHeight, slideWidth],
  );

  const addShapeAt = useCallback(
    (x: number, y: number, kind: BookShapeKind) => {
      const base = createBookShapeElement(kind, slideWidth, slideHeight);
      const placed = placeBookShapeElementAtPointer(
        base,
        x,
        y,
        slideWidth,
        slideHeight,
      );
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(placed);
      });
      setSelectedIds([placed.id]);
    },
    [activePageIndex, slideHeight, slideWidth, updatePages],
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

  const updatePresentationTimingElementId = useCallback(
    (id: string | null) => {
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
          resolveEffectivePresentationTimingElementId(
            p.elements,
            p.presentationTimingElementId,
          );
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
      if (localPages.length === 0) return;
      const idx = Math.round(n) - 1;
      const clamped = Math.min(localPages.length - 1, Math.max(0, idx));
      updatePageNameAt(clamped, name);
    },
    [activePageIndex, localPages.length, updatePageNameAt],
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

  const addTextAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "text",
        x,
        y,
        text: "텍스트를 입력하세요",
        richHtml: "<p>텍스트를 입력하세요</p>",
        fontSize: 28,
        fill: "#111827",
        width: 480,
        height: defaultTextWidgetBoxHeight(28),
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addWeatherAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "weather",
        x,
        y,
        width: DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
        height: DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addNewsAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "news",
        x,
        y,
        width: DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
        height: DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addMediaPlaylistAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "mediaPlaylist",
        x,
        y,
        width: DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
        height: DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
        mediaPlaylistItems: [],
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addWebviewAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "webview",
        x,
        y,
        width: DEFAULT_BOOK_WEBVIEW_WIDTH,
        height: DEFAULT_BOOK_WEBVIEW_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addMapAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "map",
        x,
        y,
        width: DEFAULT_BOOK_MAP_WIDTH,
        height: DEFAULT_BOOK_MAP_HEIGHT,
        mapQuery: DEFAULT_BOOK_MAP_QUERY,
        mapLat: DEFAULT_BOOK_MAP_LAT,
        mapLon: DEFAULT_BOOK_MAP_LON,
        mapBbox: DEFAULT_BOOK_MAP_BBOX,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addCalendarAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "calendar",
        x,
        y,
        width: DEFAULT_BOOK_CALENDAR_WIDTH,
        height: DEFAULT_BOOK_CALENDAR_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addQrAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "qr",
        x,
        y,
        width: DEFAULT_BOOK_QR_WIDTH,
        height: DEFAULT_BOOK_QR_HEIGHT,
        qrValue: DEFAULT_BOOK_QR_VALUE,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addChartAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "chart",
        x,
        y,
        width: DEFAULT_BOOK_CHART_WIDTH,
        height: DEFAULT_BOOK_CHART_HEIGHT,
        chartType: DEFAULT_BOOK_CHART_TYPE,
        chartData: [...DEFAULT_BOOK_CHART_DATA],
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addTickerAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "ticker",
        x,
        y,
        width: DEFAULT_BOOK_TICKER_WIDTH,
        height: DEFAULT_BOOK_TICKER_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addYoutubeAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "youtube",
        x,
        y,
        width: DEFAULT_BOOK_YOUTUBE_WIDTH,
        height: DEFAULT_BOOK_YOUTUBE_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addDigitalClockAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "digitalClock",
        x,
        y,
        width: DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
        height: DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const handleMediaFile = async (file: File, kind: "image" | "video") => {
    setUploadError(null);
    const replaceElementId = replaceMediaElementIdRef.current;
    replaceMediaElementIdRef.current = null;
    const pos = pendingPlacementRef.current ?? { x: 100, y: 100 };
    const idx = activePageIndex;
    pendingPlacementRef.current = null;
    pendingMediaKindRef.current = null;
    try {
      const res = await uploadBookMedia(bookId, file, null);
      if (kind === "image" && res.kind !== "image") {
        throw new Error("이미지 파일이 아닙니다.");
      }
      if (kind === "video" && res.kind !== "video") {
        throw new Error("동영상 파일이 아닙니다.");
      }
      if (replaceElementId) {
        updatePages((draft) => {
          const p = draft[idx];
          if (!p) return;
          const el = p.elements.find((e) => e.id === replaceElementId);
          if (!el) return;
          if (el.type === "image" && res.kind === "image") {
            Object.assign(el, { src: res.url });
          } else if (el.type === "video" && res.kind === "video") {
            Object.assign(el, {
              src: res.url,
              posterSrc: res.posterUrl ?? null,
            });
          }
        });
        appendBookMediaLibraryItem(bookId, {
          kind: res.kind,
          src: res.url,
          posterUrl: res.posterUrl,
        });
        toast.success("미디어를 바꿨습니다.");
        return;
      }
      const id = crypto.randomUUID();
      const w = kind === "image" ? 400 : 480;
      const h = kind === "image" ? 260 : 270;
      const el: BookCanvasElement =
        res.kind === "image"
          ? {
              id,
              type: "image",
              x: pos.x,
              y: pos.y,
              width: w,
              height: h,
              src: res.url,
            }
          : {
              id,
              type: "video",
              x: pos.x,
              y: pos.y,
              width: w,
              height: h,
              src: res.url,
              posterSrc: res.posterUrl,
            };
      updatePages((draft) => {
        const p = draft[idx];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
      appendBookMediaLibraryItem(bookId, {
        kind: res.kind,
        src: res.url,
        posterUrl: res.posterUrl,
      });
      toast.success(
        kind === "image" ? "이미지를 넣었습니다." : "동영상을 넣었습니다.",
      );
    } catch (e) {
      setUploadError((e as Error).message);
    }
  };

  const onRequestReplaceMediaFromFile = useCallback(
    (req: BookReplaceMediaFromFileRequest) => {
      replaceMediaElementIdRef.current = req.elementId;
      pendingMediaKindRef.current = req.kind;
      if (req.kind === "image") {
        imageInputRef.current?.click();
      } else {
        videoInputRef.current?.click();
      }
    },
    [],
  );

  const onRequestPickLibraryMediaForReplace = useCallback(
    (req: { elementId: string }) => {
      const el = activePage?.elements.find((e) => e.id === req.elementId);
      if (!el || (el.type !== "image" && el.type !== "video")) return;
      setLibraryPick({
        mode: "replace",
        elementId: req.elementId,
        kind: el.type,
      });
      raiseFloatingMediaStack();
    },
    [activePage, raiseFloatingMediaStack],
  );

  const handlePlaylistMediaFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      const elementId = playlistAppendElementIdRef.current;
      playlistAppendElementIdRef.current = null;
      if (!elementId) return;
      const idx = activePageIndex;
      try {
        const res = await uploadBookMedia(bookId, file, null);
        let blockedFull = false;
        let applied = false;
        updatePages((draft) => {
          const p = draft[idx];
          if (!p) return;
          const el = p.elements.find((e) => e.id === elementId);
          if (!el || el.type !== "mediaPlaylist") return;
          const cur = el.mediaPlaylistItems ?? [];
          if (cur.length >= MEDIA_PLAYLIST_MAX_ITEMS) {
            blockedFull = true;
            return;
          }
          if (res.kind === "image") {
            el.mediaPlaylistItems = [
              ...cur,
              { id: crypto.randomUUID(), kind: "image", src: res.url },
            ];
          } else {
            el.mediaPlaylistItems = [
              ...cur,
              {
                id: crypto.randomUUID(),
                kind: "video",
                src: res.url,
                posterSrc: res.posterUrl ?? null,
              },
            ];
          }
          applied = true;
        });
        if (blockedFull) {
          toast.error(
            `미디어 목록은 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개입니다.`,
          );
          return;
        }
        if (!applied) return;
        appendBookMediaLibraryItem(bookId, {
          kind: res.kind,
          src: res.url,
          posterUrl: res.posterUrl,
        });
        toast.success("목록 끝에 미디어를 추가했습니다.");
      } catch (e) {
        setUploadError((e as Error).message);
      }
    },
    [activePageIndex, bookId, updatePages],
  );

  /** PDF 가져오기 — 각 페이지를 PNG로 변환·업로드해 미디어 재생목록 위젯으로 추가 */
  const handleImportPdfFile = useCallback(
    async (file: File) => {
      const idx = activePageIndex;
      setPdfImportBusy(true);
      const toastId = toast.loading("PDF 페이지 변환 중…");
      try {
        const { pages, totalPageCount } = await renderPdfFileToPageImages(
          file,
          {
            maxPages: MEDIA_PLAYLIST_MAX_ITEMS,
            onProgress: (done, total) =>
              toast.loading(`PDF 페이지 변환 중… (${done}/${total})`, {
                id: toastId,
              }),
          },
        );
        if (pages.length === 0) {
          throw new Error("PDF에서 페이지를 찾지 못했습니다.");
        }
        const baseName = file.name.replace(/\.pdf$/i, "").trim() || "pdf";
        const items: { id: string; kind: "image"; src: string }[] = [];
        for (let i = 0; i < pages.length; i++) {
          toast.loading(`페이지 업로드 중… (${i + 1}/${pages.length})`, {
            id: toastId,
          });
          const pageFile = new File(
            [pages[i]!.blob],
            `${baseName}-p${i + 1}.png`,
            { type: "image/png" },
          );
          const res = await uploadBookMedia(bookId, pageFile, null);
          items.push({ id: crypto.randomUUID(), kind: "image", src: res.url });
        }
        // 위젯 프레임: 첫 페이지 비율로 슬라이드의 ~70%, 중앙 배치
        const first = pages[0]!;
        const aspect = first.height / Math.max(1, first.width);
        let w = Math.max(80, Math.min(slideWidth * 0.7, slideWidth - 40));
        let h = w * aspect;
        const maxH = Math.max(80, slideHeight - 40);
        if (h > maxH) {
          h = maxH;
          w = h / Math.max(0.01, aspect);
        }
        w = Math.round(w);
        h = Math.round(h);
        const at = pdfImportPlacementRef.current;
        pdfImportPlacementRef.current = null;
        const px = at
          ? Math.round(Math.min(Math.max(0, at.x), Math.max(0, slideWidth - w)))
          : Math.round((slideWidth - w) / 2);
        const py = at
          ? Math.round(
              Math.min(Math.max(0, at.y), Math.max(0, slideHeight - h)),
            )
          : Math.round((slideHeight - h) / 2);
        const el: BookCanvasElement = {
          id: crypto.randomUUID(),
          type: "mediaPlaylist",
          x: px,
          y: py,
          width: w,
          height: h,
          mediaPlaylistItems: items,
        };
        updatePages((draft) => {
          const p = draft[idx];
          if (!p) return;
          p.elements.push(el);
        });
        setSelectedIds([el.id]);
        toast.success(
          `PDF ${pages.length}페이지를 미디어 위젯으로 추가했습니다. 페이지별 표시 시간은 속성 패널에서 바꿀 수 있어요.`,
          { id: toastId },
        );
        if (totalPageCount > pages.length) {
          toast.warning(
            `PDF가 ${totalPageCount}페이지라 앞 ${pages.length}페이지만 가져왔습니다(위젯 항목 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개).`,
          );
        }
      } catch (e) {
        toast.error(`PDF 가져오기 실패: ${(e as Error).message}`, {
          id: toastId,
        });
      } finally {
        setPdfImportBusy(false);
      }
    },
    [activePageIndex, bookId, slideHeight, slideWidth, updatePages],
  );

  const onRequestImportPdf = useCallback(() => {
    pdfImportInputRef.current?.click();
  }, []);

  const onRequestPlaylistAppendFromFile = useCallback(
    (elementId: string) => {
      const el = activePage?.elements.find((e) => e.id === elementId);
      if (!el || el.type !== "mediaPlaylist") return;
      if ((el.mediaPlaylistItems ?? []).length >= MEDIA_PLAYLIST_MAX_ITEMS) {
        toast.error(`미디어 목록은 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개입니다.`);
        return;
      }
      playlistAppendElementIdRef.current = elementId;
      playlistMediaInputRef.current?.click();
    },
    [activePage],
  );

  const onRequestPlaylistAppendFromLibrary = useCallback(
    (elementId: string) => {
      setLibraryPick({ mode: "playlistAppend", elementId });
      raiseFloatingMediaStack();
    },
    [raiseFloatingMediaStack],
  );

  useEffect(() => {
    const onImgVidCancel = () => {
      replaceMediaElementIdRef.current = null;
      pendingMediaKindRef.current = null;
    };
    const onPlaylistCancel = () => {
      playlistAppendElementIdRef.current = null;
    };
    const img = imageInputRef.current;
    const vid = videoInputRef.current;
    const pl = playlistMediaInputRef.current;
    img?.addEventListener("cancel", onImgVidCancel);
    vid?.addEventListener("cancel", onImgVidCancel);
    pl?.addEventListener("cancel", onPlaylistCancel);
    return () => {
      img?.removeEventListener("cancel", onImgVidCancel);
      vid?.removeEventListener("cancel", onImgVidCancel);
      pl?.removeEventListener("cancel", onPlaylistCancel);
    };
  }, []);

  const onDropWidget = useCallback(
    (point: { x: number; y: number }, kind: BookDropWidgetKind) => {
      if (kind === "text") {
        addTextAt(point.x, point.y);
        return;
      }
      if (kind === "weather") {
        addWeatherAt(point.x, point.y);
        return;
      }
      if (kind === "news") {
        addNewsAt(point.x, point.y);
        return;
      }
      if (kind === "mediaPlaylist") {
        addMediaPlaylistAt(point.x, point.y);
        return;
      }
      if (kind === "digitalClock") {
        addDigitalClockAt(point.x, point.y);
        return;
      }
      if (kind === "webview") {
        addWebviewAt(point.x, point.y);
        return;
      }
      if (kind === "map") {
        addMapAt(point.x, point.y);
        return;
      }
      if (kind === "calendar") {
        addCalendarAt(point.x, point.y);
        return;
      }
      if (kind === "qr") {
        addQrAt(point.x, point.y);
        return;
      }
      if (kind === "chart") {
        addChartAt(point.x, point.y);
        return;
      }
      if (kind === "ticker") {
        addTickerAt(point.x, point.y);
        return;
      }
      if (kind === "youtube") {
        addYoutubeAt(point.x, point.y);
        return;
      }
      if (kind === "pdfImport") {
        if (!pdfImportBusy) {
          pdfImportPlacementRef.current = point;
          pdfImportInputRef.current?.click();
        }
        return;
      }
      // 명시된 종류만 파일 선택으로 — 새 위젯 kind가 조용히 동영상 선택창으로 흘러가지 않게
      if (kind === "image" || kind === "video") {
        pendingPlacementRef.current = point;
        pendingMediaKindRef.current = kind;
        if (kind === "image") {
          imageInputRef.current?.click();
        } else {
          videoInputRef.current?.click();
        }
        return;
      }
      toast.error("지원하지 않는 위젯 종류입니다.");
    },
    [
      addCalendarAt,
      addChartAt,
      addDigitalClockAt,
      addMapAt,
      addMediaPlaylistAt,
      addNewsAt,
      addQrAt,
      addTextAt,
      addTickerAt,
      addWeatherAt,
      addWebviewAt,
      addYoutubeAt,
      pdfImportBusy,
    ],
  );

  /** 이미지 편집기 내보내기 — 업로드 후 미디어 라이브러리에 등록 */
  const handleImageEditorExport = useCallback(
    async (file: File) => {
      try {
        const res = await uploadBookMedia(bookId, file, null);
        appendBookMediaLibraryItem(bookId, {
          kind: res.kind,
          src: res.url,
          posterUrl: res.posterUrl,
        });
        toast.success("편집한 이미지를 미디어 라이브러리에 저장했습니다.");
      } catch (e) {
        toast.error(`이미지 저장 실패: ${(e as Error).message}`);
        throw e;
      }
    },
    [bookId],
  );

  /** 비디오 편집기 서버 렌더 완료 — 결과 URL을 미디어 라이브러리에 등록(성공/실패 토스트는 다이얼로그가 담당) */
  const handleVideoRendered = useCallback(
    (media: {
      kind: "image" | "video";
      url: string;
      posterUrl: string | null;
    }) => {
      appendBookMediaLibraryItem(bookId, {
        kind: media.kind,
        src: media.url,
        posterUrl: media.posterUrl,
      });
    },
    [bookId],
  );

  /** 팔레트 더블 클릭 — 위젯을 슬라이드 가운데에 바로 추가 */
  const handlePaletteQuickAdd = useCallback(
    (kind: BookDropWidgetKind) => {
      const center = (w: number, h: number) => ({
        x: Math.max(0, Math.round((slideWidth - w) / 2)),
        y: Math.max(0, Math.round((slideHeight - h) / 2)),
      });
      if (kind === "text") {
        const p = center(480, defaultTextWidgetBoxHeight(28));
        addTextAt(p.x, p.y);
        return;
      }
      if (kind === "weather") {
        const p = center(
          DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
          DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
        );
        addWeatherAt(p.x, p.y);
        return;
      }
      if (kind === "news") {
        const p = center(
          DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
          DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
        );
        addNewsAt(p.x, p.y);
        return;
      }
      if (kind === "mediaPlaylist") {
        const p = center(
          DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
          DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
        );
        addMediaPlaylistAt(p.x, p.y);
        return;
      }
      if (kind === "digitalClock") {
        const p = center(
          DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
          DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
        );
        addDigitalClockAt(p.x, p.y);
        return;
      }
      if (kind === "webview") {
        const p = center(
          DEFAULT_BOOK_WEBVIEW_WIDTH,
          DEFAULT_BOOK_WEBVIEW_HEIGHT,
        );
        addWebviewAt(p.x, p.y);
        return;
      }
      if (kind === "map") {
        const p = center(DEFAULT_BOOK_MAP_WIDTH, DEFAULT_BOOK_MAP_HEIGHT);
        addMapAt(p.x, p.y);
        return;
      }
      if (kind === "calendar") {
        const p = center(
          DEFAULT_BOOK_CALENDAR_WIDTH,
          DEFAULT_BOOK_CALENDAR_HEIGHT,
        );
        addCalendarAt(p.x, p.y);
        return;
      }
      if (kind === "qr") {
        const p = center(DEFAULT_BOOK_QR_WIDTH, DEFAULT_BOOK_QR_HEIGHT);
        addQrAt(p.x, p.y);
        return;
      }
      if (kind === "chart") {
        const p = center(DEFAULT_BOOK_CHART_WIDTH, DEFAULT_BOOK_CHART_HEIGHT);
        addChartAt(p.x, p.y);
        return;
      }
      if (kind === "ticker") {
        const p = center(DEFAULT_BOOK_TICKER_WIDTH, DEFAULT_BOOK_TICKER_HEIGHT);
        addTickerAt(p.x, p.y);
        return;
      }
      if (kind === "youtube") {
        const p = center(
          DEFAULT_BOOK_YOUTUBE_WIDTH,
          DEFAULT_BOOK_YOUTUBE_HEIGHT,
        );
        addYoutubeAt(p.x, p.y);
        return;
      }
      if (kind === "pdfImport") {
        if (!pdfImportBusy) {
          pdfImportPlacementRef.current = null;
          pdfImportInputRef.current?.click();
        }
        return;
      }
      // 이미지·동영상: 파일 선택 후 중앙 근처 배치
      pendingPlacementRef.current = center(480, 320);
      pendingMediaKindRef.current = kind;
      if (kind === "image") {
        imageInputRef.current?.click();
      } else {
        videoInputRef.current?.click();
      }
    },
    [
      addCalendarAt,
      addChartAt,
      addDigitalClockAt,
      addMapAt,
      addMediaPlaylistAt,
      addNewsAt,
      addQrAt,
      addTextAt,
      addTickerAt,
      addWeatherAt,
      addWebviewAt,
      addYoutubeAt,
      pdfImportBusy,
      slideHeight,
      slideWidth,
    ],
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
      const prevLen = localPages.length;
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
    [commitPages, localPages.length],
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

  const onDropLibraryMedia = useCallback(
    (point: { x: number; y: number }, payload: BookLibraryDragPayload) => {
      const id = crypto.randomUUID();
      const w = payload.kind === "image" ? 400 : 480;
      const h = payload.kind === "image" ? 260 : 270;
      const el: BookCanvasElement =
        payload.kind === "image"
          ? {
              id,
              type: "image",
              x: point.x,
              y: point.y,
              width: w,
              height: h,
              src: payload.src,
            }
          : {
              id,
              type: "video",
              x: point.x,
              y: point.y,
              width: w,
              height: h,
              src: payload.src,
              posterSrc: payload.posterSrc,
            };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
      toast.success(
        payload.kind === "image"
          ? "이미지를 배치했습니다."
          : "동영상을 배치했습니다.",
      );
    },
    [activePageIndex, updatePages],
  );

  const addPage = useCallback(() => {
    commitPages((prev) =>
      applyAutoSlideNamesByIndex([...prev, createEmptyEditorPage(prev.length)]),
    );
    setPageIndex(localPages.length);
    setSelectedIds([]);
  }, [commitPages, localPages.length]);

  const addPageAtInsertIndex = useCallback(
    (insertIndex: number) => {
      commitPages((prev) => {
        const idx = Math.max(0, Math.min(insertIndex, prev.length));
        const newPage = createEmptyEditorPage(0);
        const next = [...prev.slice(0, idx), newPage, ...prev.slice(idx)];
        return applyAutoSlideNamesByIndex(
          next.map((p, i) => ({ ...p, sortOrder: i })),
        );
      });
      setPageIndex(insertIndex);
      setSelectedIds([]);
    },
    [commitPages],
  );

  const removePageAt = useCallback(
    (index: number) => {
      let nextIdx = activePageIndex;
      commitPages((prev) => {
        if (prev.length <= 1 || index < 0 || index >= prev.length) return prev;
        const next = prev.filter((_, i) => i !== index);
        nextIdx = pageIndexAfterRemove(activePageIndex, index, prev.length);
        return applyAutoSlideNamesByIndex(next);
      });
      setPageIndex(nextIdx);
      setSelectedIds([]);
    },
    [activePageIndex, commitPages],
  );

  const requestRemovePageAt = useCallback((index: number) => {
    setPageDeleteIndex(index);
    setPageDeleteOpen(true);
  }, []);

  const requestRemoveCurrentPageForAi = useCallback(() => {
    requestRemovePageAt(activePageIndex);
  }, [activePageIndex, requestRemovePageAt]);

  const confirmRemovePageAt = useCallback(() => {
    if (pageDeleteIndex != null) removePageAt(pageDeleteIndex);
    setPageDeleteOpen(false);
    setPageDeleteIndex(null);
  }, [pageDeleteIndex, removePageAt]);

  const duplicatePageAt = useCallback(
    (index: number) => {
      commitPages((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const dup = duplicateBookEditorPage(prev[index]);
        const next = [
          ...prev.slice(0, index + 1),
          dup,
          ...prev.slice(index + 1),
        ];
        return applyAutoSlideNamesByIndex(
          next.map((p, i) => ({ ...p, sortOrder: i })),
        );
      });
      setPageIndex(index + 1);
      setSelectedIds([]);
    },
    [commitPages],
  );

  const removeElementsByIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = p.elements.filter((e) => !idSet.has(e.id));
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(
            p.elements,
            p.presentationTimingElementId,
          );
      });
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    },
    [activePageIndex, updatePages],
  );

  const appendElementsToActivePage = useCallback(
    (els: BookCanvasElement[]) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements.push(...els);
      });
    },
    [activePageIndex, updatePages],
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
    getActivePageElements: () => activePage?.elements ?? [],
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
      if (editorOverlayOpen) return;
      if (widgetDeleteOpen || deleteConfirmOpen || pageDeleteOpen) return;
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
    deleteConfirmOpen,
    pageDeleteOpen,
    editorOverlayOpen,
    widgetClipboardHasContent,
    copySelectedWidgets,
    cutSelectedWidgets,
    pasteWidgetClipboard,
  ]);

  /** 캔버스 우상단 오버레이 — 슬라이드쇼와 같은 규칙의 페이지 재생 시간(초) */
  const activePagePlaybackSec = useMemo(() => {
    if (!activePage) return null;
    return computeSlidePresentationDurationSec(
      {
        elements: activePage.elements,
        presentationTimingElementId:
          activePage.presentationTimingElementId ?? null,
      },
      { videoDurationSecById: videoDurationByElementId },
    );
  }, [activePage, videoDurationByElementId]);

  const requestRemoveWidget = useCallback((elementId: string) => {
    setWidgetDeleteIds([elementId]);
    setWidgetDeleteOpen(true);
  }, []);

  const confirmRemoveWidget = useCallback(() => {
    if (widgetDeleteIds.length > 0) removeElementsByIds(widgetDeleteIds);
    setWidgetDeleteOpen(false);
    setWidgetDeleteIds([]);
  }, [widgetDeleteIds, removeElementsByIds]);

  const removeSelected = useCallback(() => {
    if (canvasSelectedIds.length !== 1) return;
    requestRemoveWidget(canvasSelectedIds[0]!);
  }, [canvasSelectedIds, requestRemoveWidget]);

  const removeSelectedBulk = useCallback(() => {
    if (canvasSelectedIds.length === 0) return;
    setWidgetDeleteIds([...canvasSelectedIds]);
    setWidgetDeleteOpen(true);
  }, [canvasSelectedIds]);

  const reorderPages = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const maxIdx = Math.max(0, localPages.length - 1);
      commitPages((prev) => reorderPagesArray(prev, from, to));
      setPageIndex((cur) => {
        const c = Math.min(cur, maxIdx);
        const next = pageIndexAfterReorder(c, from, to);
        return Math.min(next, maxIdx);
      });
    },
    [commitPages, localPages.length],
  );

  const selectedEl = useMemo(() => {
    if (canvasSelectedIds.length !== 1 || !activePage) return null;
    const id = canvasSelectedIds[0];
    return activePage.elements.find((e) => e.id === id) ?? null;
  }, [canvasSelectedIds, activePage]);

  const layoutAiMediaSelection = useMemo(() => {
    if (!selectedEl) return null;
    if (selectedEl.type !== "image" && selectedEl.type !== "video") return null;
    return { elementId: selectedEl.id, kind: selectedEl.type };
  }, [selectedEl]);

  const onInspectorReplaceMediaFromFile = useCallback(() => {
    if (
      !selectedEl ||
      (selectedEl.type !== "image" && selectedEl.type !== "video")
    )
      return;
    onRequestReplaceMediaFromFile({
      elementId: selectedEl.id,
      kind: selectedEl.type,
    });
  }, [selectedEl, onRequestReplaceMediaFromFile]);

  const onInspectorPickMediaFromLibrary = useCallback(() => {
    if (
      !selectedEl ||
      (selectedEl.type !== "image" && selectedEl.type !== "video")
    )
      return;
    onRequestPickLibraryMediaForReplace({ elementId: selectedEl.id });
  }, [selectedEl, onRequestPickLibraryMediaForReplace]);

  const widgetDeleteKindLabel = useMemo(() => {
    if (widgetDeleteIds.length === 0 || !activePage) return "위젯";
    if (widgetDeleteIds.length > 1) return `${widgetDeleteIds.length}개 위젯`;
    const el = activePage.elements.find((e) => e.id === widgetDeleteIds[0]);
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
    if (el.type === "drawing") return "그리기";
    return "위젯";
  }, [widgetDeleteIds, activePage]);

  const mediaHint = useMemo(() => uploadError, [uploadError]);

  const widgetDeleteDialog = (
    <AlertDialog
      open={widgetDeleteOpen}
      onOpenChange={(open) => {
        setWidgetDeleteOpen(open);
        if (!open) setWidgetDeleteIds([]);
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
  );

  const pageDeleteTargetLabel =
    pageDeleteIndex != null && localPages[pageDeleteIndex]
      ? localPages[pageDeleteIndex].name.trim() ||
        `슬라이드 ${pageDeleteIndex + 1}`
      : "이 슬라이드";

  const pageDeleteDialog = (
    <AlertDialog
      open={pageDeleteOpen}
      onOpenChange={(open) => {
        setPageDeleteOpen(open);
        if (!open) setPageDeleteIndex(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>슬라이드를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            「{pageDeleteTargetLabel}」와 이 페이지에 있는 모든 위젯이
            제거됩니다. 되돌리기(Ctrl+Z)로 복구할 수 있습니다.
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
  );

  const pageLabels = useMemo(() => localPages.map((p) => p.name), [localPages]);
  const pageKeys = useMemo(
    () => localPages.map((p) => p.clientKey),
    [localPages],
  );

  const slideThumbnailSources = useMemo(
    () =>
      localPages.map((p) => ({
        clientKey: p.clientKey,
        backgroundColor: p.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND,
        elements: p.elements,
      })),
    [localPages],
  );
  const slideThumbnails = useBookPageThumbnails(
    slideThumbnailSources,
    slideWidth,
    slideHeight,
  );

  if (localPages.length === 0) {
    return (
      <>
        <BookWorkspaceShell
          titleArea={
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
              <Input
                className="h-8 min-w-[10rem] max-w-md flex-1 rounded-md border-transparent bg-transparent pl-2.5 pr-2 text-sm font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/25 focus-visible:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-base"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
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
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <BookSlidePreviewOpenButton bookId={bookId} />
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
                <Button
                  type="button"
                  size="sm"
                  className="h-7 border-transparent bg-red-600 px-2.5 text-xs text-white hover:bg-red-700 focus-visible:ring-red-500/40"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  삭제
                </Button>
              </div>
            </>
          }
          left={
            <div className="flex h-full min-h-0 w-fit max-w-full flex-row">
              <BookEditorToolRail
                activeTab={leftDockTab}
                onActiveTabChange={setLeftDockTab}
                mediaLibraryEnabled
                onOpenImageEditor={() => setImageEditorOpen(true)}
                onOpenVideoEditor={() => setVideoEditorOpen(true)}
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
                  <BookPageSidebar
                    fluid
                    pageCount={0}
                    activeIndex={0}
                    onSelectPage={() => undefined}
                    mode="edit"
                    onAddPage={addPage}
                    canRemovePage={false}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                  />
                ) : null}
                {leftDockTab === "widgets" ? (
                  <BookWidgetPalette
                    variant="docked"
                    className="min-h-0 flex-1"
                    onRequestFloat={() => persistWidgetFloatingOpen(true)}
                    onRequestImportPdf={onRequestImportPdf}
                    pdfImportBusy={pdfImportBusy}
                    onQuickAdd={handlePaletteQuickAdd}
                  />
                ) : null}
                {leftDockTab === "media" ? (
                  <BookMediaLibraryPanel
                    variant="docked"
                    bookId={bookId}
                    className="min-h-0 flex-1"
                    onRequestFloat={() => persistMediaFloatingOpen(true)}
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
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  페이지가 없습니다. 왼쪽에서 페이지를 추가하세요.
                </p>
                <Button type="button" onClick={addPage}>
                  첫 페이지 추가
                </Button>
              </div>
              {floatingWidgetPaletteOpen ? (
                <BookWidgetPalette
                  variant="floating"
                  floatingStackZIndex={floatingPanelZ.widget}
                  onRaiseFloatingStack={raiseFloatingWidgetStack}
                  onClose={() => persistWidgetFloatingOpen(false)}
                  onRequestImportPdf={onRequestImportPdf}
                  pdfImportBusy={pdfImportBusy}
                  onQuickAdd={handlePaletteQuickAdd}
                />
              ) : null}
              {floatingMediaLibraryOpen ? (
                <BookMediaLibraryPanel
                  bookId={bookId}
                  variant="floating"
                  floatingStackZIndex={floatingPanelZ.media}
                  onRaiseFloatingStack={raiseFloatingMediaStack}
                  onClose={() => persistMediaFloatingOpen(false)}
                />
              ) : null}
            </>
          }
          right={
            <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card/50 p-3">
              <p className="text-sm text-muted-foreground">
                페이지를 추가한 뒤 여기서 슬라이드 이름을 바꿀 수 있습니다.
                크기는 헤더 캔버스 W·H를 사용하세요.
              </p>
            </aside>
          }
        />
        {deleteBookDialog}
        {widgetDeleteDialog}
        {pageDeleteDialog}
      </>
    );
  }

  return (
    <>
      <BookWorkspaceShell
        titleArea={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
            <Input
              className="h-8 min-w-[10rem] max-w-md flex-1 rounded-md border-transparent bg-transparent pl-2.5 pr-2 text-sm font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/25 focus-visible:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-base"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
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
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <BookSlidePreviewOpenButton bookId={bookId} />
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
              <Button
                type="button"
                size="sm"
                className="h-7 border-transparent bg-red-600 px-2.5 text-xs text-white hover:bg-red-700 focus-visible:ring-red-500/40"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                삭제
              </Button>
            </div>
          </>
        }
        left={
          <div className="flex h-full min-h-0 w-fit max-w-full flex-row">
            <BookEditorToolRail
              activeTab={leftDockTab}
              onActiveTabChange={setLeftDockTab}
              mediaLibraryEnabled
              onOpenImageEditor={() => setImageEditorOpen(true)}
              onOpenVideoEditor={() => setVideoEditorOpen(true)}
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
                    pageCount={localPages.length}
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
                    canRemovePage={localPages.length > 1}
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
                  onRequestImportPdf={onRequestImportPdf}
                  pdfImportBusy={pdfImportBusy}
                  onQuickAdd={handlePaletteQuickAdd}
                />
              ) : null}
              {leftDockTab === "media" ? (
                <BookMediaLibraryPanel
                  variant="docked"
                  bookId={bookId}
                  className="min-h-0 flex-1"
                  onRequestFloat={() => persistMediaFloatingOpen(true)}
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
                {/* 캔버스 상단 가운데 — 현재 페이지 이름 + 좌우 이동(페이지 1개면 이동 숨김) */}
                <div className="absolute left-1/2 top-2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-md bg-black/60 px-1.5 py-1 text-[11px] text-white shadow-sm backdrop-blur-sm">
                  {localPages.length > 1 ? (
                    <button
                      type="button"
                      className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-white/20 disabled:opacity-30"
                      title="이전 페이지"
                      aria-label="이전 페이지"
                      disabled={activePageIndex <= 0}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                  <span
                    className="min-w-0 truncate font-medium"
                    title="현재 페이지"
                  >
                    {activePage?.name?.trim() ||
                      `슬라이드 ${activePageIndex + 1}`}
                  </span>
                  {localPages.length > 1 ? (
                    <>
                      <span className="shrink-0 tabular-nums text-white/50">
                        {activePageIndex + 1}/{localPages.length}
                      </span>
                      <button
                        type="button"
                        className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-white/20 disabled:opacity-30"
                        title="다음 페이지"
                        aria-label="다음 페이지"
                        disabled={activePageIndex >= localPages.length - 1}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() =>
                          setPageIndex((i) =>
                            Math.min(localPages.length - 1, i + 1),
                          )
                        }
                      >
                        <ChevronRight className="size-3.5" aria-hidden />
                      </button>
                    </>
                  ) : null}
                </div>
                {/* 캔버스 우상단 — 페이지 재생 시간(별도) */}
                {activePagePlaybackSec != null ? (
                  <div
                    className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] tabular-nums text-white shadow-sm backdrop-blur-sm"
                    title="기준 레이어 기준 이 페이지의 슬라이드쇼 재생 시간"
                  >
                    재생 {activePagePlaybackSec}초
                  </div>
                ) : null}
                <BookSlideCanvas
                  pageWidth={slideWidth}
                  pageHeight={slideHeight}
                  pageBackgroundColor={
                    activePage.backgroundColor?.trim() ||
                    DEFAULT_PAGE_BACKGROUND
                  }
                  scale={displayScale}
                  elements={activePage.elements}
                  mode="edit"
                  selectedIds={canvasSelectedIds}
                  onSelect={handleCanvasSelect}
                  onElementChange={onElementChange}
                  onElementsChange={onElementsChange}
                  keyboardShortcutsDisabled={editorOverlayOpen}
                  onDropWidget={onDropWidget}
                  onDropShape={onDropShape}
                  onDropLibraryMedia={onDropLibraryMedia}
                  onReorderZ={onReorderZ}
                  onDeleteElement={requestRemoveWidget}
                  centerGuideThresholdPx={centerGuideThresholdPx}
                  dragGridPx={dragGridPx}
                  editInteractionTool={
                    leftDockTab === "drawing" ? "draw" : "default"
                  }
                  drawingStrokeColor={drawingStrokeColor}
                  drawingStrokeWidth={drawingStrokeWidth}
                  onAppendElement={onAppendDrawingElement}
                  onRequestReplaceMediaFromFile={onRequestReplaceMediaFromFile}
                  onRequestPickLibraryMediaForReplace={
                    onRequestPickLibraryMediaForReplace
                  }
                  onRequestPlaylistAppendFromFile={
                    onRequestPlaylistAppendFromFile
                  }
                  onRequestPlaylistAppendFromLibrary={
                    onRequestPlaylistAppendFromLibrary
                  }
                  mediaLibraryReplaceEnabled
                  onMediaPlaylistPlaybackIndexChange={
                    handleMediaPlaylistPlaybackIndex
                  }
                  onMediaPlaylistPlaybackUiReport={
                    handleMediaPlaylistPlaybackUiReport
                  }
                  mediaPlaylistRemoteCommand={playlistRemoteCmd}
                  onMediaPlaylistRemoteCommandConsumed={clearPlaylistRemoteCmd}
                  onVideoDurationKnown={handleVideoDurationKnown}
                  onCopyElement={copyElementOrSelection}
                  onCutElement={cutElementOrSelection}
                  onPasteFromClipboard={pasteWidgetClipboard}
                  widgetClipboardHasContent={widgetClipboardHasContent}
                />
              </div>
            </div>
            {floatingWidgetPaletteOpen ? (
              <BookWidgetPalette
                variant="floating"
                floatingStackZIndex={floatingPanelZ.widget}
                onRaiseFloatingStack={raiseFloatingWidgetStack}
                onClose={() => persistWidgetFloatingOpen(false)}
                onRequestImportPdf={onRequestImportPdf}
                pdfImportBusy={pdfImportBusy}
                onQuickAdd={handlePaletteQuickAdd}
              />
            ) : null}
            {floatingMediaLibraryOpen ? (
              <BookMediaLibraryPanel
                bookId={bookId}
                variant="floating"
                floatingStackZIndex={floatingPanelZ.media}
                onRaiseFloatingStack={raiseFloatingMediaStack}
                onClose={() => persistMediaFloatingOpen(false)}
              />
            ) : null}
            <BookAiAssistantPanel
              bookId={bookId}
              slideWidth={slideWidth}
              slideHeight={slideHeight}
              pageCount={localPages.length}
              activePageIndex={activePageIndex}
              onApplyElements={applyAiElements}
              onApplyPageBackground={updateCurrentPageBackground}
              onApplyPageTitle={applyPageTitleFromAi}
              onApplyBookTitle={setBookTitle}
              onAddPages={addPagesFromAi}
              onUndo={undo}
              onRedo={redo}
              onRequestRemoveCurrentPage={requestRemoveCurrentPageForAi}
              floatingStackZIndex={floatingPanelZ.ai}
              onRaiseFloatingStack={raiseFloatingAiStack}
              onApplySlideDimensions={applySlideDimensionsFromAi}
              layoutAiMediaSelection={layoutAiMediaSelection}
              onPatchBookElement={onElementChange}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (pendingMediaKindRef.current !== "image") return;
                if (!f) {
                  replaceMediaElementIdRef.current = null;
                  pendingMediaKindRef.current = null;
                  return;
                }
                void handleMediaFile(f, "image");
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (pendingMediaKindRef.current !== "video") return;
                if (!f) {
                  replaceMediaElementIdRef.current = null;
                  pendingMediaKindRef.current = null;
                  return;
                }
                void handleMediaFile(f, "video");
              }}
            />
            <input
              ref={playlistMediaInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) {
                  playlistAppendElementIdRef.current = null;
                  return;
                }
                void handlePlaylistMediaFile(f);
              }}
            />
            <input
              ref={pdfImportInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void handleImportPdfFile(f);
              }}
            />
            {imageEditorOpen ? (
              <BookImageEditorDialog
                onClose={() => setImageEditorOpen(false)}
                onExport={handleImageEditorExport}
              />
            ) : null}
            {videoEditorOpen ? (
              <BookVideoEditorDialog
                onClose={() => setVideoEditorOpen(false)}
                bookId={bookId}
                onRendered={handleVideoRendered}
              />
            ) : null}
          </>
        }
        right={
          <aside className="flex h-full min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-card/50">
            <BookLayersPanel
              elements={activePage.elements}
              selectedIds={canvasSelectedIds}
              onSelect={handleLayerSelect}
              onReorderZ={onReorderZ}
              onLayerDragReorder={onLayerDragReorder}
              onVisibilityChange={onLayerVisibilityChange}
              onLockChange={onLayerLockChange}
              onRequestDelete={requestRemoveWidget}
              presentationTimingElementId={
                activePage.presentationTimingElementId
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
                  onReplaceMediaFromFile={onInspectorReplaceMediaFromFile}
                  onPickMediaFromLibrary={onInspectorPickMediaFromLibrary}
                  onRequestAppendPlaylistMediaFromFile={
                    onRequestPlaylistAppendFromFile
                  }
                  onRequestAppendPlaylistMediaFromLibrary={
                    onRequestPlaylistAppendFromLibrary
                  }
                  mediaLibraryReplaceEnabled
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
                    activePage.presentationTimingElementId
                  }
                />
              ) : (
                <BookPagePropertiesPanel
                  embedded
                  pageIndex={activePageIndex}
                  totalPages={localPages.length}
                  name={activePage.name}
                  onChangeName={updateCurrentPageName}
                  backgroundColor={
                    activePage.backgroundColor?.trim() ||
                    DEFAULT_PAGE_BACKGROUND
                  }
                  onChangeBackgroundColor={updateCurrentPageBackground}
                  elements={activePage.elements}
                  presentationTimingElementId={
                    activePage.presentationTimingElementId
                  }
                  onChangePresentationTimingElementId={
                    updatePresentationTimingElementId
                  }
                  presentationLoop={presentationLoop}
                  onChangePresentationLoop={setPresentationLoop}
                  presentationTransition={normalizeBookPresentationTransition(
                    activePage.presentationTransition,
                  )}
                  onChangePresentationTransition={updatePresentationTransition}
                  presentationTransitionMs={clampBookPresentationTransitionMs(
                    activePage.presentationTransitionMs,
                  )}
                  onChangePresentationTransitionMs={
                    updatePresentationTransitionMs
                  }
                />
              )}
            </div>
          </aside>
        }
      />
      {deleteBookDialog}
      {widgetDeleteDialog}
      {pageDeleteDialog}
      {libraryPickAcceptKind ? (
        <BookMediaLibraryPickDialog
          open={libraryPick != null}
          onOpenChange={(o) => {
            if (!o) setLibraryPick(null);
          }}
          bookId={bookId}
          acceptKind={libraryPickAcceptKind}
          title={
            libraryPick?.mode === "playlistAppend"
              ? "라이브러리에서 미디어 선택"
              : undefined
          }
          onPick={(item) => {
            if (!libraryPick) return;
            if (libraryPick.mode === "replace") {
              if (item.kind === "image") {
                onElementChange(libraryPick.elementId, { src: item.src });
              } else {
                onElementChange(libraryPick.elementId, {
                  src: item.src,
                  posterSrc: item.posterSrc,
                });
              }
              toast.success("미디어를 바꿨습니다.");
            } else {
              const pageEl = activePage?.elements.find(
                (e) => e.id === libraryPick.elementId,
              );
              if (!pageEl || pageEl.type !== "mediaPlaylist") {
                setLibraryPick(null);
                return;
              }
              const cur = pageEl.mediaPlaylistItems ?? [];
              if (cur.length >= MEDIA_PLAYLIST_MAX_ITEMS) {
                setLibraryPick(null);
                toast.error(
                  `미디어 목록은 최대 ${MEDIA_PLAYLIST_MAX_ITEMS}개입니다.`,
                );
                return;
              }
              if (item.kind === "image") {
                onElementChange(libraryPick.elementId, {
                  mediaPlaylistItems: [
                    ...cur,
                    {
                      id: crypto.randomUUID(),
                      kind: "image",
                      src: item.src,
                    },
                  ],
                });
              } else {
                onElementChange(libraryPick.elementId, {
                  mediaPlaylistItems: [
                    ...cur,
                    {
                      id: crypto.randomUUID(),
                      kind: "video",
                      src: item.src,
                      posterSrc: item.posterSrc ?? null,
                    },
                  ],
                });
              }
              toast.success("목록에 미디어를 추가했습니다.");
            }
            setLibraryPick(null);
          }}
        />
      ) : null}
    </>
  );
}

// 편집 권한 없을 때: 캔버스·사이드바·레이어 패널은 읽기 전용
function BookDetailGuestBookView({
  data,
  sortedPagesView,
  pageIndex,
  setPageIndex,
}: {
  data: BookDetail;
  sortedPagesView: NonNullable<BookDetail["pages"]>;
  pageIndex: number;
  setPageIndex: Dispatch<SetStateAction<number>>;
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
          <BookSlidePreviewOpenButton bookId={data.id} />
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
              elements={viewPage.elements}
              mode="view"
              selectedIds={[]}
              onSelect={() => undefined}
              onElementChange={() => undefined}
            />
          </div>
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
export function BookDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { user } = useAuth();
  const [pageIndex, setPageIndex] = useState(0);

  const { data, error, isPending } = useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
    enabled: Number.isFinite(id) && id > 0,
    // 편집 화면은 key 리마운트로만 문서를 초기화 — 포커스 복귀 refetch가 편집 흐름을 흔들지 않게
    refetchOnWindowFocus: false,
  });

  /** 작성자 또는 관리자만 편집 UI */
  const canEdit = Boolean(
    user && data && canEditAsOwnerOrAdmin(user, data.author.id),
  );

  const sortedPagesView = useMemo(() => {
    if (!data?.pages) return [];
    return [...data.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <BookWorkspaceShell
        titleArea={
          <span className="text-sm text-muted-foreground">잘못된 주소</span>
        }
        left={
          <div className="w-52 shrink-0 border-r border-border bg-card/50" />
        }
        center={
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
            <p className="text-sm text-muted-foreground">
              목록에서 북을 다시 선택해 주세요.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/books">목록</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (isPending) {
    return (
      <BookWorkspaceShell
        titleArea={
          <span className="truncate text-sm text-muted-foreground">
            불러오는 중…
          </span>
        }
        left={
          <div className="w-52 shrink-0 border-r border-border bg-card/50" />
        }
        center={
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-10 text-muted-foreground" />
          </div>
        }
      />
    );
  }

  if (error || !data) {
    return (
      <BookWorkspaceShell
        titleArea={<span className="text-destructive">오류</span>}
        left={<div className="w-52 shrink-0 border-r border-border" />}
        center={
          <div className="flex flex-1 items-center justify-center p-4">
            <FormErrorAlert
              message={(error as Error)?.message ?? "불러오지 못했습니다."}
            />
          </div>
        }
      />
    );
  }

  if (canEdit) {
    return <BookDetailOwnerView key={data.id} bookId={id} serverBook={data} />;
  }

  if (!sortedPagesView.length) {
    return (
      <BookWorkspaceShell
        titleArea={
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {data.title}
          </h1>
        }
        left={
          <div className="w-52 shrink-0 border-r border-border bg-card/50" />
        }
        center={
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              이 북에는 페이지가 없습니다.
            </p>
          </div>
        }
      />
    );
  }

  return (
    <BookDetailGuestBookView
      data={data}
      sortedPagesView={sortedPagesView}
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
    />
  );
}
