"use client";

// 북 상세·편집: 서버 페이지 → 로컬 히스토리, 소유자는 BookDetailOwnerView / 비로그인·타인은 읽기 전용 게스트 뷰
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorPlay, Save, Share2, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type Dispatch,
  type ReactNode,
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
import {
  BookCanvasPageNavBadge,
  BookCanvasPlaybackBadge,
} from "@/components/books/BookCanvasStageOverlays";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookEditorToolRail } from "@/components/books/BookEditorToolRail";
import { BookMediaFileInputs } from "@/components/books/BookMediaFileInputs";

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
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import { BookSharePopover } from "@/components/books/BookShareDialog";
import {
  type BookCanvasSelectDetail,
  type BookDropWidgetKind,
  type BookLibraryDragPayload,
  BookSlideCanvas,
} from "@/components/books/BookSlideCanvas";
import { BookSlideDrawingPanel } from "@/components/books/BookSlideDrawingPanel";
import { BookSlideTemplatesPanel } from "@/components/books/BookSlideTemplatesPanel";
import { BookStatusControls } from "@/components/books/BookStatusControls";
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
  applyAutoSlideNamesByIndex,
  type BookEditorPageState,
  type BookShapeKind,
  collectBookOverlayElements,
  createEmptyEditorPage,
  DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
  DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  MEDIA_PLAYLIST_MAX_ITEMS,
  pageIndexAfterReorder,
  reorderPagesArray,
  resolveEffectivePresentationTimingElementId,
  toBookPagePayloads,
} from "@/features/book/book-canvas";
import { isBookEditorTypingTarget } from "@/features/book/book-editor-keyboard";
import {
  readFloatingMediaLibraryVisible,
  writeFloatingMediaLibraryVisible,
} from "@/features/book/book-floating-ui-prefs";
import { warmBookCanvasImagesForNeighborPages } from "@/features/book/book-image-cache";
import { computeSlidePresentationDurationSec } from "@/features/book/book-presentation";
import {
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
  useBookEditorUiValues,
} from "@/features/book/editor-ui-store";
import { useAiDocumentEdits } from "@/features/book/use-ai-document-edits";
import {
  BOOK_CANVAS_STAGE_DISPLAY_OPTS,
  useBookCanvasDisplayScale,
} from "@/features/book/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/features/book/use-book-document-history";
import { useBookMediaUploads } from "@/features/book/use-book-media-uploads";
import { useBookPageThumbnails } from "@/features/book/use-book-page-thumbnails";
import { useBookWidgetClipboard } from "@/features/book/use-book-widget-clipboard";
import { useElementMutations } from "@/features/book/use-element-mutations";
import { useMediaPlaylistPlayback } from "@/features/book/use-media-playlist-playback";
import { usePageOperations } from "@/features/book/use-page-operations";
import { usePageProperties } from "@/features/book/use-page-properties";
import { useWidgetInserters } from "@/features/book/use-widget-inserters";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  addBookMediaLibraryItem,
  type BookCanvasElement,
  type BookDetail,
  type BookPageDto,
  deleteBook,
  fetchBook,
  updateBook,
  uploadBookMedia,
} from "@/lib/api";
import {
  canEditAsOwnerOrAdmin,
  canEditBookAsOwnerAdminOrShared,
} from "@/lib/authz";
import { bookKeys } from "@/lib/query-keys";
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
      presentationVisible: p.presentationVisible !== false,
    })),
  );
}

// 헤더 액션: /preview 새 탭 — 처음부터 + (현재 인덱스가 있으면) 현재 페이지부터
function BookSlidePreviewOpenButton({
  bookId,
  currentIndex,
}: {
  bookId: number;
  currentIndex?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        asChild
        className="relative h-7 overflow-hidden border-0 bg-linear-to-br from-violet-600 via-fuchsia-600 to-rose-500 px-2.5 text-xs font-semibold leading-none text-white shadow-[0_2px_14px_-2px_rgba(124,58,237,0.55)] ring-1 ring-white/25 transition [text-shadow:0_1px_1px_rgba(0,0,0,0.2)] hover:brightness-110 hover:shadow-[0_4px_20px_-2px_rgba(168,85,247,0.55)] focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:from-violet-500 dark:via-fuchsia-600 dark:to-rose-600 dark:shadow-[0_2px_18px_-4px_rgba(167,139,250,0.45)]"
      >
        <Link
          href={`/books/${bookId}/preview`}
          target="_blank"
          rel="noreferrer"
        >
          <MonitorPlay
            className="mr-1.5 size-3.5 shrink-0 drop-shadow-sm"
            aria-hidden
          />
          미리보기
        </Link>
      </Button>
      {currentIndex != null ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          asChild
          className="h-7 px-2 text-xs"
          title="현재 페이지부터 미리보기 (파워포인트의 '현재 슬라이드부터')"
        >
          <Link
            href={`/books/${bookId}/preview?start=${currentIndex}`}
            target="_blank"
            rel="noreferrer"
          >
            <MonitorPlay className="mr-1.5 size-3.5 shrink-0" aria-hidden />
            현재부터
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

// 소유자·관리자 전용 편집 워크스페이스; 부모 key 는 book.id 만(리마운트로 상태 유실 방지)
function BookDetailOwnerView({
  bookId,
  serverBook,
  readOnly = false,
}: {
  bookId: number;
  serverBook: BookDetail;
  /**
   * 모바일 폭에서의 보기 전용 잠금. 이 컴포넌트를 **언마운트하지 않고** 잠그는 것이 핵심 —
   * 편집 상태(페이지·되돌리기 스택·선택)가 전부 로컬이라, 창 폭이 768px를 오갈 때
   * 컴포넌트를 갈아끼우면 미저장 작업이 경고 없이 사라진다.
   */
  readOnly?: boolean;
}) {
  // ── 에디터 UI·도구 상태 ─────────────────────────────────────────
  // BookEditorPage 와 **같은 스토어**를 쓴다. 이전에는 13개가 양쪽에 복사돼 있어
  // 한쪽만 고치면 두 화면이 조용히 달라졌다(features/book/editor-ui-store.ts).
  const {
    pageIndex,
    selectedIds,
    leftDockTab,
    drawingStrokeColor,
    drawingStrokeWidth,
    centerGuideThresholdPx,
    dragGridPx,
    floatingWidgetPaletteOpen,
    widgetDeleteOpen,
    widgetDeleteIds,
    pageDeleteOpen,
    pageDeleteIndex,
    videoDurationByElementId,
  } = useBookEditorUiValues();

  // 스토어는 모듈 수명이라 화면을 옮겨도 값이 남는다. 부모가 `key={book.id}` 로 이 컴포넌트를
  // 리마운트해 왔으므로 useState 시절에는 자동으로 비워졌지만, 이제는 명시적으로 지운다 —
  // 안 하면 앞 북의 슬라이드 위치·선택이 다음 북에 그대로 이어진다.
  useEffect(() => resetEditorUi(), [bookId]);

  const router = useRouter();
  const queryClient = useQueryClient();
  /** 업로드 결과를 서버 미디어 라이브러리에 기록(실패해도 편집 흐름은 계속) */
  const appendToMediaLibrary = useCallback(
    (meta: {
      kind: "image" | "video";
      src: string;
      posterUrl: string | null;
    }) => {
      void addBookMediaLibraryItem(bookId, {
        kind: meta.kind,
        src: meta.src,
        posterSrc: meta.posterUrl,
      })
        .then((lib) =>
          queryClient.setQueryData(bookKeys.mediaLibrary(bookId), lib),
        )
        .catch(() => undefined);
    },
    [bookId, queryClient],
  );
  const [bookTitle, setBookTitle] = useState(serverBook.title);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  /**
   * 마운트 시 1회만 쓰이는 초기값 — 매 렌더 전체 페이지 재계산(정렬·정규화)을 막는다.
   *
   * 예전에는 `useRef` + "비어 있으면 채운다" 였는데, 그건 렌더 중에 ref 를 읽는 것이라
   * 컴파일러가 값의 안정성을 보장하지 못한다(`react-hooks/refs`). 게으른 `useState`
   * 초기화가 같은 일을 하면서 렌더에서 읽어도 되는 값이다.
   */
  const [initialPages] = useState(() =>
    mapServerPagesToLocal(serverBook.pages),
  );
  const {
    pages: localPages,
    updatePages,
    updatePagesSilent,
    commitPages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBookDocumentHistory(initialPages);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  /** 공유 다이얼로그 — 작성자·관리자만 열 수 있음(공유받은 편집자는 버튼 없음) */
  const [shareOpen, setShareOpen] = useState(false);
  const { user: authUser } = useAuth();
  const canManageShare = canEditAsOwnerOrAdmin(authUser, serverBook.author.id);
  const [slideWidth, setSlideWidth] = useState(
    () => serverBook.slideWidth ?? DEFAULT_SLIDE_WIDTH,
  );
  const [slideHeight, setSlideHeight] = useState(
    () => serverBook.slideHeight ?? DEFAULT_SLIDE_HEIGHT,
  );
  const [presentationLoop, setPresentationLoop] = useState(
    () => serverBook.presentationLoop !== false,
  );
  const [floatingMediaLibraryOpen, setFloatingMediaLibraryOpen] = useState(
    readFloatingMediaLibraryVisible,
  );
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
  /** 이미지·비디오 편집기(레일 메뉴) — 전체 화면 편집 창 */
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [videoEditorOpen, setVideoEditorOpen] = useState(false);
  /** 전체 화면 편집기가 떠 있는 동안 북 에디터 단축키(Delete·Ctrl+S 등)가 가로채지 않게 */
  const editorOverlayOpen = imageEditorOpen || videoEditorOpen;
  /** PDF 가져오기(팔레트) — 변환·업로드 진행 중 여부와 숨김 파일 입력 */
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

  // 위젯 삽입 — 종류별 핸들러 13개가 BookEditorPage 와 글자 단위로 같은 복사본이었다
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
    emptyMediaHint: (kind) =>
      kind === "image"
        ? "이미지 자리를 놓았습니다 — 우클릭해서 파일이나 라이브러리에서 채우세요."
        : "동영상 자리를 놓았습니다 — 우클릭해서 파일이나 라이브러리에서 채우세요.",
  });
  const activePage = localPages[activePageIndex];

  const {
    uploadError,
    pdfImportBusy,
    libraryPick,
    setLibraryPick,
    libraryPickAcceptKind,
    onRequestReplaceMediaFromFile,
    onRequestPickLibraryMediaForReplace,
    onRequestPlaylistAppendFromFile,
    onRequestPlaylistAppendFromLibrary,
    requestImportPdf,
    fileInputs: mediaFileInputs,
  } = useBookMediaUploads({
    bookId,
    activePageIndex,
    activePage,
    slideWidth,
    slideHeight,
    updatePages,
    appendToMediaLibrary,
    raiseFloatingMediaStack,
  });

  /** 다른 페이지의 공통(오버라이드) 위젯 중 현재 페이지에 겹쳐 보일 것 — 편집 캔버스 고스트 */
  const editorOverlayGhosts = useMemo(
    () =>
      collectBookOverlayElements(
        localPages.map((p, i) => ({ sortOrder: i, elements: p.elements })),
        activePageIndex,
      ),
    [localPages, activePageIndex],
  );

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

  const canvasSelectedIds = useMemo(() => {
    if (!activePage) return [];
    const onPage = new Set(activePage.elements.map((e) => e.id));
    return selectedIds.filter((id) => onPage.has(id));
  }, [selectedIds, activePage]);

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

  const handleCanvasSelect = useCallback((d: BookCanvasSelectDetail) => {
    if (d.id === null) setSelectedIds([]);
    else toggleSelectedId(d.id, d.shiftKey);
  }, []);

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
    activePage,
    widgetDeleteOpen,
    deleteConfirmOpen,
    pageDeleteOpen,
    editorOverlayOpen,
    localPages.length,
    activePageIndex,
  ]);

  /**
   * 마지막 저장 시점 스냅샷(참조 비교) — beforeunload "미저장" 판정 기준.
   * undo 스택(canUndo)은 저장 후에도 남아 있어 기준으로 쓰면 항상 경고가 뜬다.
   */
  const [initialSavedSnapshot] = useState(() => ({
    pages: initialPages,
    title: serverBook.title,
    slideWidth: serverBook.slideWidth ?? DEFAULT_SLIDE_WIDTH,
    slideHeight: serverBook.slideHeight ?? DEFAULT_SLIDE_HEIGHT,
    presentationLoop: serverBook.presentationLoop !== false,
  }));
  const lastSavedRef = useRef(initialSavedSnapshot);
  /**
   * 저장 요청에 실린 값 — 저장 중 추가 편집이 있으면 성공해도 그 편집은 미저장으로 남는다.
   * 처음에는 `lastSavedRef` 와 **같은 객체**를 가리킨다(참조 비교가 기준이라 중요하다).
   */
  const pendingSaveRef = useRef(initialSavedSnapshot);

  const saveMutation = useMutation({
    mutationFn: () => {
      pendingSaveRef.current = {
        pages: localPages,
        title: bookTitle,
        slideWidth,
        slideHeight,
        presentationLoop,
      };
      return updateBook(bookId, {
        title: bookTitle.trim() || "제목 없음",
        slideWidth,
        slideHeight,
        presentationLoop,
        pages: toBookPagePayloads(localPages),
      });
    },
    onSuccess: (res) => {
      lastSavedRef.current = pendingSaveRef.current;
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

  // 미저장 편집이 있으면 탭 닫기·새로고침 전에 경고 — 마지막 저장 스냅샷과 비교(저장하면 경고 없음)
  const unsavedCheckRef = useRef<() => boolean>(() => false);
  useLayoutEffect(() => {
    unsavedCheckRef.current = () => {
      const saved = lastSavedRef.current;
      return (
        localPages !== saved.pages ||
        bookTitle !== saved.title ||
        slideWidth !== saved.slideWidth ||
        slideHeight !== saved.slideHeight ||
        presentationLoop !== saved.presentationLoop
      );
    };
  });
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsavedCheckRef.current()) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

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

  /** 승인 워크플로 배지·버튼 — 상태가 바뀌면 상세 캐시의 status만 갱신 */
  const bookStatusControls = (
    <BookStatusControls
      book={serverBook}
      onChanged={(b) =>
        queryClient.setQueryData<BookDetail>(bookKeys.detail(bookId), (old) =>
          old ? { ...old, status: b.status } : old,
        )
      }
    />
  );

  // 공유 팝오버 — 공유 버튼 바로 옆에 붙는다. 공유 목록이 바뀌면 상세 캐시의 sharedUserIds만 갱신
  const renderShareButton = (button: ReactNode) =>
    canManageShare ? (
      <BookSharePopover
        open={shareOpen}
        onOpenChange={setShareOpen}
        bookId={bookId}
        bookTitle={bookTitle.trim() || serverBook.title}
        authorId={serverBook.author.id}
        sharedUserIds={serverBook.sharedUserIds ?? []}
        sharedToAll={serverBook.sharedToAll === true}
        onChanged={(book) =>
          queryClient.setQueryData<BookDetail>(
            bookKeys.detail(bookId),
            (old) =>
              old
                ? {
                    ...old,
                    sharedUserIds: book.sharedUserIds ?? [],
                    sharedToAll: book.sharedToAll === true,
                  }
                : old,
          )
        }
      >
        {button}
      </BookSharePopover>
    ) : null;

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
    [activePage, activePageIndex, slideHeight, slideWidth, updatePages],
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
    pageCount: localPages.length,
    updatePages,
    mutateActivePage,
  });

  /** 눈 토글 — 미리보기 재생 목록 포함/제외(숨긴 페이지는 사이드바에 흐리게) */
  const togglePageVisibleAt = useCallback(
    (idx: number) => {
      updatePages((draft) => {
        const p = draft[idx];
        if (p) p.presentationVisible = p.presentationVisible === false;
      });
    },
    [updatePages],
  );

  const pageVisibles = useMemo(
    () => localPages.map((p) => p.presentationVisible !== false),
    [localPages],
  );

  const onDropWidget = useCallback(
    (point: { x: number; y: number }, kind: BookDropWidgetKind) => {
      if (addByKind(kind, point.x, point.y)) return;
      if (kind === "mediaPlaylist") {
        addMediaPlaylistAt(point.x, point.y);
        return;
      }
      if (kind === "pdfImport") {
        requestImportPdf(point);
        return;
      }
      // 미디어 위젯과 같은 흐름 — 빈 자리를 먼저 놓는다
      if (kind === "image" || kind === "video") {
        addEmptyMediaAt(point.x, point.y, kind);
        return;
      }
      toast.error("지원하지 않는 위젯 종류입니다.");
    },
    [addByKind, addEmptyMediaAt, addMediaPlaylistAt, requestImportPdf],
  );

  /** 이미지 편집기 내보내기 — 업로드 후 미디어 라이브러리에 등록 */
  const handleImageEditorExport = useCallback(
    async (file: File) => {
      try {
        const res = await uploadBookMedia(bookId, file, null);
        appendToMediaLibrary({
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
    [appendToMediaLibrary, bookId],
  );

  /** 비디오 편집기 서버 렌더 완료 — 결과 URL을 미디어 라이브러리에 등록(성공/실패 토스트는 다이얼로그가 담당) */
  const handleVideoRendered = useCallback(
    (media: {
      kind: "image" | "video";
      url: string;
      posterUrl: string | null;
    }) => {
      appendToMediaLibrary({
        kind: media.kind,
        src: media.url,
        posterUrl: media.posterUrl,
      });
    },
    [appendToMediaLibrary],
  );

  /** 팔레트 더블 클릭 — 위젯을 슬라이드 가운데에 바로 추가 */
  const handlePaletteQuickAdd = useCallback(
    (kind: BookDropWidgetKind) => {
      if (addByKindCentered(kind)) return;

      const center = (w: number, h: number) => ({
        x: Math.max(0, Math.round((slideWidth - w) / 2)),
        y: Math.max(0, Math.round((slideHeight - h) / 2)),
      });
      if (kind === "mediaPlaylist") {
        const p = center(
          DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
          DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
        );
        addMediaPlaylistAt(p.x, p.y);
        return;
      }
      if (kind === "pdfImport") {
        requestImportPdf(null);
        return;
      }
      // 이미지·동영상: 가운데에 빈 자리를 놓고 나중에 채운다
      const at = center(
        kind === "image" ? 400 : 480,
        kind === "image" ? 260 : 270,
      );
      addEmptyMediaAt(at.x, at.y, kind === "image" ? "image" : "video");
    },
    [
      addByKindCentered,
      addEmptyMediaAt,
      addMediaPlaylistAt,
      requestImportPdf,
      slideHeight,
      slideWidth,
    ],
  );

  const { applyAiElements, addPagesFromAi, applySlideDimensionsFromAi } =
    useAiDocumentEdits({
      activePageIndex,
      pageCount: localPages.length,
      updatePages,
      commitPages,
      setSlideWidth,
      setSlideHeight,
    });

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

  const {
    addPageAtInsertIndex,
    requestRemovePageAt,
    requestRemoveCurrentPageForAi,
    confirmRemovePageAt,
    duplicatePageAt,
  } = usePageOperations({ activePageIndex, commitPages });

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
    if (el.type === "adSlot") return "광고 위젯";
    if (el.type === "drawing") return "그리기";
    return "위젯";
  }, [widgetDeleteIds, activePage]);

  const mediaHint = useMemo(() => uploadError, [uploadError]);

  const widgetDeleteDialog = (
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
        if (!open) closePageDelete();
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

  /** 헤더 작성자 표시 — 내가 공유받은 북(개별/전체 공유)이면 배지로 구분 */
  const isNotAuthor = Boolean(
    authUser && Number(authUser.sub) !== Number(serverBook.author.id),
  );
  const isSharedToMe = Boolean(
    isNotAuthor &&
    authUser &&
    (serverBook.sharedUserIds ?? []).some(
      (uid) => Number(uid) === Number(authUser.sub),
    ),
  );
  const isSharedToAllForMe = Boolean(
    isNotAuthor && !isSharedToMe && serverBook.sharedToAll === true,
  );
  const authorTitleInfo = (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="truncate">
        작성자{" "}
        <span className="font-medium text-foreground">
          {serverBook.author.name}
        </span>
      </span>
      {isSharedToMe || isSharedToAllForMe ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          <Share2 className="size-3" aria-hidden />
          {isSharedToMe ? "공유받은 북" : "전체 공유 북"}
        </span>
      ) : null}
    </span>
  );

  if (localPages.length === 0) {
    return (
      <>
        <BookWorkspaceShell
          panelsLocked={readOnly}
          titleArea={
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
              <Input
                className="h-8 min-w-[10rem] max-w-md flex-1 rounded-md border-transparent bg-transparent pl-2.5 pr-2 text-sm font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/25 focus-visible:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-base"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="북 제목"
                maxLength={200}
                aria-label="북 제목"
                readOnly={readOnly}
              />
              {readOnly ? null : (
                <BookHeaderSlideDimensions
                  slideWidth={slideWidth}
                  slideHeight={slideHeight}
                  onChangeSlideWidth={setSlideWidth}
                  onChangeSlideHeight={setSlideHeight}
                />
              )}
              {authorTitleInfo}
              {readOnly ? null : bookStatusControls}
            </div>
          }
          actions={
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <BookSlidePreviewOpenButton
                  bookId={bookId}
                  currentIndex={activePageIndex}
                />
                {renderShareButton(
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                  >
                    <Share2 className="mr-1.5 size-3.5" />
                    공유
                    {serverBook.sharedUserIds?.length ? (
                      <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                        {serverBook.sharedUserIds.length}
                      </span>
                    ) : null}
                  </Button>,
                )}
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
                    onRequestImportPdf={() => requestImportPdf(null)}
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
              {!readOnly && floatingWidgetPaletteOpen ? (
                <BookWidgetPalette
                  variant="floating"
                  floatingStackZIndex={floatingPanelZ.widget}
                  onRaiseFloatingStack={raiseFloatingWidgetStack}
                  onClose={() => persistWidgetFloatingOpen(false)}
                  onRequestImportPdf={() => requestImportPdf(null)}
                  pdfImportBusy={pdfImportBusy}
                  onQuickAdd={handlePaletteQuickAdd}
                />
              ) : null}
              {!readOnly && floatingMediaLibraryOpen ? (
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
        panelsLocked={readOnly}
        titleArea={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
            <Input
              className="h-8 min-w-[10rem] max-w-md flex-1 rounded-md border-transparent bg-transparent pl-2.5 pr-2 text-sm font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/25 focus-visible:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-base"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="북 제목"
              maxLength={200}
              aria-label="북 제목"
              readOnly={readOnly}
            />
            {readOnly ? null : (
              <BookHeaderSlideDimensions
                slideWidth={slideWidth}
                slideHeight={slideHeight}
                onChangeSlideWidth={setSlideWidth}
                onChangeSlideHeight={setSlideHeight}
              />
            )}
            {authorTitleInfo}
            {readOnly ? null : bookStatusControls}
          </div>
        }
        actions={
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <BookSlidePreviewOpenButton
                bookId={bookId}
                currentIndex={activePageIndex}
              />
              {readOnly
                ? null
                : renderShareButton(
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                    >
                      <Share2 className="mr-1.5 size-3.5" />
                      공유
                      {serverBook.sharedUserIds?.length ? (
                        <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                          {serverBook.sharedUserIds.length}
                        </span>
                      ) : null}
                    </Button>,
                  )}
              {readOnly ? null : (
                <>
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
                </>
              )}
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
                    pageVisibles={pageVisibles}
                    onTogglePageVisibleAtIndex={togglePageVisibleAt}
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
                  onRequestImportPdf={() => requestImportPdf(null)}
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
                  {...(readOnly
                    ? {}
                    : {
                        showUndoRedo: true,
                        canUndo,
                        canRedo,
                        onUndo: undo,
                        onRedo: redo,
                        centerGuideThresholdPx,
                        onCenterGuideThresholdPxChange:
                          setCenterGuideThresholdPx,
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
                  pageCount={localPages.length}
                  activePageIndex={activePageIndex}
                  pageName={activePage?.name}
                />
                <BookCanvasPlaybackBadge playbackSec={activePagePlaybackSec} />
                <BookSlideCanvas
                  pageWidth={slideWidth}
                  pageHeight={slideHeight}
                  pageBackgroundColor={
                    activePage.backgroundColor?.trim() ||
                    DEFAULT_PAGE_BACKGROUND
                  }
                  scale={displayScale}
                  elements={activePage.elements}
                  mode={readOnly ? "view" : "edit"}
                  selectedIds={canvasSelectedIds}
                  onSelect={handleCanvasSelect}
                  onElementChange={onElementChange}
                  onElementsChange={onElementsChange}
                  keyboardShortcutsDisabled={editorOverlayOpen || readOnly}
                  onReorderZ={onReorderZ}
                  onDeleteElement={requestRemoveWidget}
                  centerGuideThresholdPx={centerGuideThresholdPx}
                  dragGridPx={dragGridPx}
                  drop={{ onDropWidget, onDropShape, onDropLibraryMedia }}
                  drawing={{
                    tool: leftDockTab === "drawing" ? "draw" : "default",
                    strokeColor: drawingStrokeColor,
                    strokeWidth: drawingStrokeWidth,
                    onAppendElement: onAppendDrawingElement,
                  }}
                  media={{
                    onRequestReplaceMediaFromFile,
                    onRequestPickLibraryMediaForReplace,
                    onRequestPlaylistAppendFromFile,
                    onRequestPlaylistAppendFromLibrary,
                    libraryReplaceEnabled: true,
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
                {/* 다른 페이지의 공통 위젯 고스트 — 위치 참고용(반투명·클릭 불가) */}
                {editorOverlayGhosts.length > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center opacity-60"
                    aria-hidden
                  >
                    <BookSlideCanvas
                      pageWidth={slideWidth}
                      pageHeight={slideHeight}
                      pageBackgroundColor="transparent"
                      readabilityBackgroundColor={
                        activePage.backgroundColor?.trim() ||
                        DEFAULT_PAGE_BACKGROUND
                      }
                      scale={displayScale}
                      elements={editorOverlayGhosts}
                      mode="view"
                      selectedIds={[]}
                      onSelect={() => undefined}
                      onElementChange={() => undefined}
                    />
                  </div>
                ) : null}
                {readOnly ? (
                  /* 게스트 뷰와 같은 규칙 — 위젯(동영상 컨트롤 등)까지 눌리지 않게 투명 방패로 덮는다.
                     휠·핀치 줌은 부모(canvasWrap) 핸들러로 버블링되어 그대로 동작 */
                  <div className="absolute inset-0 z-50" aria-hidden />
                ) : null}
              </div>
            </div>
            {!readOnly && floatingWidgetPaletteOpen ? (
              <BookWidgetPalette
                variant="floating"
                floatingStackZIndex={floatingPanelZ.widget}
                onRaiseFloatingStack={raiseFloatingWidgetStack}
                onClose={() => persistWidgetFloatingOpen(false)}
                onRequestImportPdf={() => requestImportPdf(null)}
                pdfImportBusy={pdfImportBusy}
                onQuickAdd={handlePaletteQuickAdd}
              />
            ) : null}
            {!readOnly && floatingMediaLibraryOpen ? (
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
            <BookMediaFileInputs inputs={mediaFileInputs} />
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
              onSelect={toggleSelectedId}
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
                  pageNames={localPages.map((p) => p.name)}
                  activePageIndex={activePageIndex}
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
              /* 모바일 보기 전용 — 위젯(동영상 컨트롤 등)까지 눌리지 않게 투명 방패로 덮는다.
                 휠·핀치 줌은 부모(canvasWrap) 핸들러로 버블링되어 그대로 동작 */
              <div className="absolute inset-0 z-50" aria-hidden />
            ) : null}
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
  /** 모바일은 편집 권한과 무관하게 보기 전용 — 패널 잠금·선택 차단 */
  const isMobile = useIsMobile();

  const { data, error, isPending } = useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
    enabled: Number.isFinite(id) && id > 0,
    // 편집 화면은 key 리마운트로만 문서를 초기화 — 포커스 복귀 refetch가 편집 흐름을 흔들지 않게
    refetchOnWindowFocus: false,
  });

  /** 작성자·관리자 또는 공유받은 사용자(모든 사용자 공유 포함)만 편집 UI */
  const canEdit = Boolean(
    user &&
    data &&
    canEditBookAsOwnerAdminOrShared(
      user,
      data.author.id,
      data.sharedUserIds,
      data.sharedToAll,
    ),
  );

  const sortedPagesView = useMemo(() => {
    if (!data?.pages) return [];
    return [...data.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  // 모바일로 북을 열면 권한과 무관하게 안내 — 실제 폰은 별도 세션이라 로그인·권한이
  // 제각각인데, 권한자에게만 띄우면 "안내가 안 뜬다"로 보인다. 로드 성공 여부로만 판단
  const bookLoaded = data != null;
  useEffect(() => {
    if (isMobile && bookLoaded) {
      toast.info(
        "모바일에서는 북을 보기 전용으로 엽니다. 편집은 PC 등 넓은 화면에서 이용해 주세요.",
        { id: "book-mobile-view-only", duration: 5000 },
      );
    }
  }, [isMobile, bookLoaded]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <BookWorkspaceShell
        panelsLocked={isMobile}
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
        panelsLocked={isMobile}
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
        panelsLocked={isMobile}
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
    // 모바일에서도 **같은 컴포넌트를 유지한 채** 잠근다 — 폭 변화로 갈아끼우면
    // 편집 상태가 컴포넌트 로컬이라 미저장 작업과 되돌리기 스택이 통째로 사라진다.
    return (
      <BookDetailOwnerView
        key={data.id}
        bookId={id}
        serverBook={data}
        readOnly={isMobile}
      />
    );
  }

  if (!sortedPagesView.length) {
    return (
      <BookWorkspaceShell
        panelsLocked={isMobile}
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
      viewLocked={isMobile}
    />
  );
}
