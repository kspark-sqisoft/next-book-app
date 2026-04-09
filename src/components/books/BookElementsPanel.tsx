import {
  type DragEvent,
  useCallback,
  useRef,
} from "react";
import {
  AppWindow,
  ArrowRight,
  ChevronRight,
  Circle,
  Diamond,
  Disc,
  Donut,
  FoldHorizontal,
  Funnel,
  GripVertical,
  Hexagon,
  Minus,
  Octagon,
  Pentagon,
  Plus,
  Shapes,
  Sparkles,
  Square,
  Triangle,
  TriangleRight,
  X,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { setShapeDragData } from "@/components/books/BookSlideCanvas";
import type { BookShapeKind } from "@/lib/book-canvas";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

const ITEMS: {
  kind: BookShapeKind;
  label: string;
  Icon: typeof Square;
}[] = [
  { kind: "rect", label: "사각형", Icon: Square },
  { kind: "roundRect", label: "둥근 사각형", Icon: AppWindow },
  { kind: "ellipse", label: "타원", Icon: Circle },
  { kind: "line", label: "직선", Icon: Minus },
  { kind: "arrow", label: "화살표", Icon: ArrowRight },
  { kind: "chevron", label: "쉐브론", Icon: ChevronRight },
  { kind: "triangle", label: "삼각형", Icon: Triangle },
  { kind: "rightTriangle", label: "직각삼각형", Icon: TriangleRight },
  { kind: "diamond", label: "마름모", Icon: Diamond },
  { kind: "trapezoid", label: "사다리꼴", Icon: Funnel },
  { kind: "parallelogram", label: "평행사변형", Icon: FoldHorizontal },
  { kind: "pentagon", label: "오각형", Icon: Pentagon },
  { kind: "hexagon", label: "육각형", Icon: Hexagon },
  { kind: "octagon", label: "팔각형", Icon: Octagon },
  { kind: "star", label: "별", Icon: Sparkles },
  { kind: "ring", label: "도넛", Icon: Donut },
  { kind: "blockArc", label: "호(블록)", Icon: Disc },
  { kind: "plus", label: "플러스", Icon: Plus },
  { kind: "cross", label: "X / 곱하기", Icon: X },
];

const tileClass = cn(
  "relative flex min-w-0 cursor-grab select-none flex-col items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-2 py-2.5 transition-colors",
  "hover:border-primary/35 hover:bg-muted/40 active:cursor-grabbing",
);

export function BookElementsPanel({
  className,
  onAddShape,
}: {
  className?: string;
  onAddShape: (kind: BookShapeKind) => void;
}) {
  const dragRef = useRef(false);

  const onDragStart = useCallback((e: DragEvent<HTMLDivElement>, kind: BookShapeKind) => {
    dragRef.current = true;
    setShapeDragData(e, kind);
  }, []);

  const onDragEnd = useCallback(() => {
    window.setTimeout(() => {
      dragRef.current = false;
    }, 0);
  }, []);

  const onRowClick = useCallback(
    (kind: BookShapeKind) => {
      if (dragRef.current) return;
      onAddShape(kind);
    },
    [onAddShape],
  );

  return (
    <div
      className={cn(bookDockedPanelRootClass(), className)}
      role="region"
      aria-label="도형 요소"
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <Shapes className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>Elements</span>
      </div>
      <p className="shrink-0 px-3 pt-2 text-[11px] leading-snug text-muted-foreground">
        도형을 슬라이드로 끌어다 놓거나, 칸을 클릭하면 가운데에 추가됩니다.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [-webkit-overflow-scrolling:touch]">
        <Label className="sr-only">도형 목록</Label>
        <div className="grid grid-cols-2 gap-2">
          {ITEMS.map(({ kind, label, Icon }) => (
            <div
              key={kind}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => onDragStart(e, kind)}
              onDragEnd={onDragEnd}
              onClick={() => onRowClick(kind)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onAddShape(kind);
                }
              }}
              className={tileClass}
            >
              <GripVertical
                className="absolute left-1 top-1 size-3 shrink-0 text-muted-foreground opacity-60"
                aria-hidden
              />
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary"
                aria-hidden
              >
                <Icon className="size-7" strokeWidth={1.75} />
              </span>
              <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-snug text-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
