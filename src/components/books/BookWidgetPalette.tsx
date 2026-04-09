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
  Blocks,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudSun,
  GripVertical,
  ImagePlus,
  ListVideo,
  Newspaper,
  PictureInPicture2,
  Type,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { BOOK_WIDGET_DRAG_TYPE, type BookDropWidgetKind } from "@/components/books/BookSlideCanvas";
import { Button } from "@/components/ui/button";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

/** 텍스트·이미지·동영상은 항상 맨 앞 순서, 그 외 위젯은 뒤에 둡니다. */
const ITEMS: { kind: BookDropWidgetKind; label: string; icon: LucideIcon }[] = [
  { kind: "text", label: "텍스트", icon: Type },
  { kind: "image", label: "이미지", icon: ImagePlus },
  { kind: "video", label: "동영상", icon: Video },
  { kind: "weather", label: "날씨", icon: CloudSun },
  { kind: "news", label: "뉴스", icon: Newspaper },
  { kind: "mediaPlaylist", label: "미디어", icon: ListVideo },
  { kind: "digitalClock", label: "디지털 시계", icon: Clock },
];

const STORAGE_KEY = "book-widget-palette";
const PANEL_MAX_W = 352; // ~22rem
const PANEL_COLLAPSED_ESTIMATE_W = 140;
const VIEW_MARGIN = 8;

type PaletteStored = { left: number; top: number; collapsed: boolean };

function loadStored(): PaletteStored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PaletteStored>;
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
  const w = window.innerWidth;
  const h = window.innerHeight;
  const panelW = Math.min(w - 2 * VIEW_MARGIN, PANEL_MAX_W);
  return {
    left: Math.max(VIEW_MARGIN, (w - panelW) / 2),
    top: Math.max(VIEW_MARGIN, h - 168),
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

function setWidgetDragData(e: DragEvent, kind: BookDropWidgetKind) {
  e.dataTransfer.setData(BOOK_WIDGET_DRAG_TYPE, kind);
  e.dataTransfer.setData("text/plain", kind);
  e.dataTransfer.effectAllowed = "copy";
}

/** 왼쪽 열 도킹 — `BookPagePropertiesPanel`과 같은 헤더·스크롤 구조 */
function BookWidgetPaletteDocked({
  className,
  onRequestFloat,
}: {
  className?: string;
  onRequestFloat?: () => void;
}) {
  return (
    <div
      className={cn(bookDockedPanelRootClass(), className)}
      role="region"
      aria-label="위젯"
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <Blocks className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={cn(bookDockedPanelHeadingClass(), "min-w-0 flex-1")}>위젯</span>
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
      <p className="shrink-0 px-3 pt-2 text-[11px] leading-snug text-muted-foreground">
        아래를 슬라이드로 끌어다 놓으세요.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col gap-2">
          {ITEMS.map(({ kind, label, icon: Icon }) => (
            <div
              key={kind}
              draggable
              onDragStart={(e) => setWidgetDragData(e, kind)}
              className="flex cursor-grab select-none items-center gap-3 rounded-lg border border-border/80 bg-background/90 px-3 py-2.5 transition-colors active:cursor-grabbing hover:border-primary/35 hover:bg-muted/40"
            >
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <Icon className="size-5 shrink-0 text-foreground" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookWidgetPaletteFloating({
  className,
  onCollapsedChange,
  onClose,
  stackZIndex,
  onRaiseStack,
}: {
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  /** 다른 플로팅 패널 위에 올릴 때 부모가 넘기는 z-index */
  stackZIndex?: number;
  /** 포인터 다운(캡처) 시 맨 앞으로 — 미디어 창 등과 겹침 처리 */
  onRaiseStack?: () => void;
}) {
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
    if (typeof window === "undefined") return { left: 16, top: 400 };
    const s = loadStored();
    if (s) {
      const w = Math.min(window.innerWidth - 2 * VIEW_MARGIN, PANEL_MAX_W);
      return clampCoords(s.left, s.top, w, s.collapsed ? 48 : 200);
    }
    return defaultCoords();
  });

  const estimateHeight = collapsed ? 48 : 200;
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
    if ((e.target as HTMLElement).closest("[data-palette-toggle],[data-palette-close]")) {
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
        stackZIndex == null && "z-[220]",
        collapsed
          ? "w-max max-w-[calc(100vw-2rem)] gap-0 border-sky-200/90 bg-sky-50/98 px-2 py-1.5 ring-1 ring-sky-200/45 dark:border-sky-500/40 dark:bg-sky-950/55 dark:ring-sky-400/30"
          : "w-[min(100vw-2rem,22rem)] max-w-[calc(100vw-2rem)] gap-2 border-border bg-card/95 p-2.5 ring-1 ring-border/40",
        className,
      )}
      role="region"
      aria-label="위젯 팔레트"
    >
      <header
        className={cn(
          "touch-none flex cursor-grab select-none gap-2 border-b border-border/60 pb-2 active:cursor-grabbing",
          collapsed ? "items-center border-0 pb-0" : "items-start",
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Blocks className="size-4" aria-hidden />
        </div>
        <div className={cn("pt-0.5", collapsed ? "shrink-0" : "min-w-0 flex-1")}>
          <div className="flex items-center gap-1">
            {!collapsed ? (
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
            ) : null}
            <h2 className="font-heading text-sm font-semibold leading-none tracking-tight text-foreground">
              위젯
            </h2>
          </div>
          {!collapsed ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              아래를 슬라이드로 끌어다 놓으세요
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            data-palette-toggle
            aria-expanded={!collapsed}
            aria-label={collapsed ? "위젯 팔레트 펼치기" : "위젯 팔레트 접기"}
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
              data-palette-close
              aria-label="위젯 창 닫기"
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
        <div className="flex items-stretch justify-center gap-2 px-0.5">
          {ITEMS.map(({ kind, label, icon: Icon }) => (
            <div
              key={kind}
              draggable
              onDragStart={(e) => setWidgetDragData(e, kind)}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex min-w-0 flex-1 cursor-grab select-none flex-col items-center gap-1 rounded-lg border border-border/80 bg-background/90 px-2 py-2 transition-colors active:cursor-grabbing hover:border-primary/35 hover:bg-muted/40 sm:px-3"
            >
              <GripVertical className="size-3 text-muted-foreground" aria-hidden />
              <Icon className="size-5 text-foreground" aria-hidden />
              <span className="text-center text-[10px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 위젯을 슬라이드로 드래그해 넣습니다.
 * - `docked`: 왼쪽 열에 고정(페이지 속성 패널과 같은 헤더 스타일)
 * - `floating`: 화면 위 떠 있는 팔레트(이동·접기 가능)
 */
export function BookWidgetPalette({
  variant = "floating",
  className,
  onCollapsedChange,
  onClose,
  onRequestFloat,
  floatingStackZIndex,
  onRaiseFloatingStack,
}: {
  variant?: "floating" | "docked";
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** floating: 헤더에서 창을 완전히 숨김 */
  onClose?: () => void;
  /** docked: 떠 있는 위젯 창 다시 표시 */
  onRequestFloat?: () => void;
  /** floating: 다른 떠 있는 패널과 겹칠 때 쌓임 순서(부모 state) */
  floatingStackZIndex?: number;
  onRaiseFloatingStack?: () => void;
}) {
  if (variant === "docked") {
    return (
      <BookWidgetPaletteDocked className={className} onRequestFloat={onRequestFloat} />
    );
  }
  return (
    <BookWidgetPaletteFloating
      className={className}
      onCollapsedChange={onCollapsedChange}
      onClose={onClose}
      stackZIndex={floatingStackZIndex}
      onRaiseStack={onRaiseFloatingStack}
    />
  );
}
