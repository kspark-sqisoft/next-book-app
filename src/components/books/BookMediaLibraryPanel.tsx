import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Film,
  GripVertical,
  ImagePlus,
  PictureInPicture2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { publicAssetUrl, uploadBookMedia } from "@/lib/api";
import {
  appendBookMediaLibraryItem,
  BOOK_MEDIA_LIBRARY_CHANGED,
  loadBookMediaLibrary,
  removeBookMediaLibraryItem,
  type BookMediaLibraryItem,
} from "@/lib/book-media-library";
import { BOOK_LIBRARY_DRAG_TYPE } from "@/components/books/BookSlideCanvas";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "book-media-library-panel";
const PANEL_MAX_W = 320;
const VIEW_MARGIN = 8;
const PANEL_COLLAPSED_ESTIMATE_W = 168;

type PanelStored = { left: number; top: number; collapsed: boolean };

function loadStored(): PanelStored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PanelStored>;
    if (
      typeof p.left === "number" &&
      typeof p.top === "number" &&
      typeof p.collapsed === "boolean"
    ) {
      return { left: p.left, top: p.top, collapsed: p.collapsed };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function defaultCoords(): { left: number; top: number } {
  return {
    left: VIEW_MARGIN,
    top: Math.max(VIEW_MARGIN, 96),
  };
}

function clampCoords(
  left: number,
  top: number,
  panelW: number,
  panelH: number,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(panelW, vw - 2 * VIEW_MARGIN);
  const maxL = Math.max(VIEW_MARGIN, vw - w - VIEW_MARGIN);
  const maxT = Math.max(VIEW_MARGIN, vh - panelH - VIEW_MARGIN);
  return {
    left: Math.min(maxL, Math.max(VIEW_MARGIN, left)),
    top: Math.min(maxT, Math.max(VIEW_MARGIN, top)),
  };
}

function useBookMediaLibraryCore(bookId: number) {
  const [items, setItems] = useState<BookMediaLibraryItem[]>(() =>
    loadBookMediaLibrary(bookId),
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(loadBookMediaLibrary(bookId));
  }, [bookId]);

  useEffect(() => {
    const fn = (ev: Event) => {
      const d = (ev as CustomEvent<{ bookId?: number }>).detail;
      if (d?.bookId === bookId) setItems(loadBookMediaLibrary(bookId));
    };
    window.addEventListener(BOOK_MEDIA_LIBRARY_CHANGED, fn);
    return () => window.removeEventListener(BOOK_MEDIA_LIBRARY_CHANGED, fn);
  }, [bookId]);

  const onDragStartItem = useCallback((e: DragEvent, item: BookMediaLibraryItem) => {
    e.dataTransfer.setData(
      BOOK_LIBRARY_DRAG_TYPE,
      JSON.stringify({
        kind: item.kind,
        src: item.src,
        posterSrc: item.posterSrc,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setUploading(true);
      try {
        const res = await uploadBookMedia(bookId, f, null);
        appendBookMediaLibraryItem(bookId, {
          kind: res.kind,
          src: res.url,
          posterUrl: res.posterUrl,
        });
        toast.success(
          res.kind === "image"
            ? "라이브러리에 이미지를 추가했습니다."
            : "라이브러리에 동영상을 추가했습니다.",
        );
      } catch (err) {
        toast.error((err as Error).message || "업로드에 실패했습니다.");
      } finally {
        setUploading(false);
      }
    },
    [bookId],
  );

  return { items, fileRef, uploading, onPickFile, onDragStartItem };
}

function MediaGrid({
  bookId,
  items,
  onDragStartItem,
  gridClassName,
}: {
  bookId: number;
  items: BookMediaLibraryItem[];
  onDragStartItem: (e: DragEvent, item: BookMediaLibraryItem) => void;
  gridClassName?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        아직 없습니다. 업로드하면 여기에 쌓입니다.
      </p>
    );
  }
  return (
    <ul className={cn("grid gap-2", gridClassName)}>
      {items.map((item) => {
        const thumb =
          item.kind === "image" ? publicAssetUrl(item.src) : publicAssetUrl(item.posterSrc);
        return (
          <li key={item.id} className="relative">
            <div
              draggable
              onDragStart={(e) => onDragStartItem(e, item)}
              onPointerDown={(e) => e.stopPropagation()}
              className="group relative aspect-square cursor-grab select-none overflow-hidden rounded-lg border border-border/80 bg-muted/40 active:cursor-grabbing hover:border-violet-400/50"
            >
              {thumb ? (
                <img src={thumb} alt="" className="size-full object-cover" draggable={false} />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Film className="size-8" aria-hidden />
                </div>
              )}
              <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-background/85 px-1 text-[9px] font-medium text-foreground/90">
                {item.kind === "image" ? "IMG" : "MOV"}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute -right-1 -top-1 size-6 rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm hover:bg-destructive/15 hover:text-destructive"
              aria-label="라이브러리에서 제거"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => removeBookMediaLibraryItem(bookId, item.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function BookMediaLibraryDocked({
  bookId,
  className,
  onRequestFloat,
}: {
  bookId: number;
  className?: string;
  onRequestFloat?: () => void;
}) {
  const { items, fileRef, uploading, onPickFile, onDragStartItem } = useBookMediaLibraryCore(bookId);

  return (
    <div
      className={cn(bookDockedPanelRootClass(), className)}
      role="region"
      aria-label="미디어 라이브러리"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={onPickFile}
      />
      <div className={bookDockedPanelHeaderRowClass()}>
        <ImagePlus className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={cn(bookDockedPanelHeadingClass(), "min-w-0 flex-1")}>미디어 라이브러리</span>
        {onRequestFloat ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onRequestFloat}
          >
            <PictureInPicture2 className="size-3.5" aria-hidden />
            떠 있는 창
          </Button>
        ) : null}
      </div>
      <p className="shrink-0 border-b border-border/40 bg-muted/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        업로드한 뒤 썸네일을 슬라이드로 끌어 놓을 수 있어요.
      </p>
      <div className="shrink-0 px-3 pb-2 pt-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full gap-2"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
          업로드
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]">
        <MediaGrid
          bookId={bookId}
          items={items}
          onDragStartItem={onDragStartItem}
          gridClassName="grid-cols-2 sm:grid-cols-3"
        />
      </div>
    </div>
  );
}

function BookMediaLibraryFloating({
  bookId,
  className,
  onCollapsedChange,
  onClose,
  stackZIndex,
  onRaiseStack,
}: {
  bookId: number;
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  stackZIndex?: number;
  onRaiseStack?: () => void;
}) {
  const { items, fileRef, uploading, onPickFile, onDragStartItem } = useBookMediaLibraryCore(bookId);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  const [collapsed, setCollapsed] = useState(() => loadStored()?.collapsed ?? false);
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  useEffect(() => {
    onCollapsedChangeRef.current = onCollapsedChange;
  });
  const [coords, setCoords] = useState<{ left: number; top: number }>(() => {
    if (typeof window === "undefined") return { left: 16, top: 96 };
    const s = loadStored();
    if (s) {
      const w = Math.min(window.innerWidth - 2 * VIEW_MARGIN, PANEL_MAX_W);
      return clampCoords(s.left, s.top, w, s.collapsed ? 48 : 280);
    }
    return defaultCoords();
  });

  const estimateHeight = collapsed ? 48 : 320;
  const estimateWidth = collapsed
    ? PANEL_COLLAPSED_ESTIMATE_W
    : Math.min(
        typeof window !== "undefined" ? window.innerWidth - 2 * VIEW_MARGIN : PANEL_MAX_W,
        PANEL_MAX_W,
      );

  const persist = useCallback((next: { left: number; top: number; collapsed: boolean }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    persist({ ...coords, collapsed });
  }, [coords, collapsed, persist]);

  useEffect(() => {
    onCollapsedChangeRef.current?.(collapsed);
  }, [collapsed]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setCoords((c) => clampCoords(c.left, c.top, el.offsetWidth, el.offsetHeight));
  }, [collapsed]);

  useEffect(() => {
    const onResize = () => {
      setCoords((c) => {
        const el = rootRef.current;
        const w = el?.offsetWidth ?? estimateWidth;
        const h = el?.offsetHeight ?? estimateHeight;
        return clampCoords(c.left, c.top, w, h);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed, estimateHeight, estimateWidth]);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (
      (e.target as HTMLElement).closest(
        "[data-library-toggle],[data-library-upload],[data-library-close]",
      )
    ) {
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: coords.left,
      originTop: coords.top,
    };
  };

  const onHeaderPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const el = rootRef.current;
    const w = el?.offsetWidth ?? Math.min(window.innerWidth - 2 * VIEW_MARGIN, PANEL_MAX_W);
    const h = el?.offsetHeight ?? estimateHeight;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setCoords(clampCoords(d.originLeft + dx, d.originTop + dy, w, h));
  };

  const onHeaderPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag();
  };

  return (
    <div
      ref={rootRef}
      style={{
        left: coords.left,
        top: coords.top,
        ...(stackZIndex != null ? { zIndex: stackZIndex } : {}),
      }}
      onPointerDownCapture={(e) => {
        if (e.button !== 0) return;
        onRaiseStack?.();
      }}
      className={cn(
        "pointer-events-auto fixed flex flex-col rounded-xl border shadow-lg backdrop-blur-md",
        stackZIndex == null && "z-[219]",
        collapsed
          ? "w-max max-w-[calc(100vw-2rem)] gap-0 border-violet-200/90 bg-violet-50/98 px-2 py-1.5 ring-1 ring-violet-200/45 dark:border-violet-500/35 dark:bg-violet-950/50 dark:ring-violet-400/25"
          : "w-[min(100vw-2rem,20rem)] max-w-[calc(100vw-2rem)] gap-2 border-border bg-card/95 p-2.5 ring-1 ring-border/40",
        className,
      )}
      role="region"
      aria-label="미디어 라이브러리"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={onPickFile}
      />
      <header
        className={cn(
          "touch-none flex cursor-grab select-none gap-2 border-b border-border/60 pb-2",
          collapsed ? "items-center border-0 pb-0" : "items-start",
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-200">
          <ImagePlus className="size-4" aria-hidden />
        </div>
        <div className={cn("min-w-0 flex-1 pt-0.5", collapsed && "shrink-0")}>
          <div className="flex items-center gap-1">
            {!collapsed ? (
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
            ) : null}
            <h2 className="font-heading text-sm font-semibold leading-none tracking-tight text-foreground">
              미디어
            </h2>
          </div>
          {!collapsed ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              업로드 후 썸네일을 슬라이드로 끌어 놓으세요
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            data-library-toggle
            aria-expanded={!collapsed}
            aria-label={collapsed ? "미디어 라이브러리 펼치기" : "미디어 라이브러리 접기"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              data-library-close
              aria-label="미디어 창 닫기"
              title="닫기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onClose()}
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </header>
      {!collapsed ? (
        <>
          <div className="flex justify-center px-0.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full gap-2"
              disabled={uploading}
              data-library-upload
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
              업로드
            </Button>
          </div>
          <div className="max-h-[220px] overflow-y-auto overflow-x-hidden px-0.5">
            <MediaGrid
              bookId={bookId}
              items={items}
              onDragStartItem={onDragStartItem}
              gridClassName="grid-cols-3"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * 북별 업로드 미디어 목록. 슬라이드로 드래그해 같은 URL을 여러 번 배치할 수 있습니다.
 * - `docked`: 왼쪽 열(페이지 속성과 같은 헤더 스타일)
 * - `floating`: 화면 위 떠 있는 패널
 */
export function BookMediaLibraryPanel({
  bookId,
  variant = "floating",
  className,
  onCollapsedChange,
  onClose,
  onRequestFloat,
  floatingStackZIndex,
  onRaiseFloatingStack,
}: {
  bookId: number;
  variant?: "floating" | "docked";
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  onRequestFloat?: () => void;
  floatingStackZIndex?: number;
  onRaiseFloatingStack?: () => void;
}) {
  if (variant === "docked") {
    return (
      <BookMediaLibraryDocked
        bookId={bookId}
        className={className}
        onRequestFloat={onRequestFloat}
      />
    );
  }
  return (
    <BookMediaLibraryFloating
      bookId={bookId}
      className={className}
      onCollapsedChange={onCollapsedChange}
      onClose={onClose}
      stackZIndex={floatingStackZIndex}
      onRaiseStack={onRaiseFloatingStack}
    />
  );
}
