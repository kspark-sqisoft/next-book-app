import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, FileStack, Plus, Trash2 } from "lucide-react";
import {
  Fragment,
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  ContextMenuFloatingItem,
  ContextMenuFloatingPanel,
} from "@/components/ui/context-menu";
import {
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  slideDisplayLabel,
} from "@/lib/book-canvas";
import {
  bookDockedPanelFooterClass,
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

type BookPageSidebarProps = {
  pageCount: number;
  /** 정렬·애니메이션용 안정 id; 편집+재정렬 시 pageCount와 길이가 같아야 함 */
  pageKeys?: string[];
  /** `pageKeys[i]`와 동일한 키로 조회하는 슬라이드 미리보기(data URL) */
  thumbnailsByKey?: Record<string, string | undefined>;
  activeIndex: number;
  onSelectPage: (index: number) => void;
  mode: "view" | "edit";
  /** 길이는 pageCount와 같아야 함. 없으면 "슬라이드 n" */
  pageLabels?: string[];
  /** 편집 모드에서만; 슬라이드를 `from`에서 `to` 위치로 이동 */
  onReorderPages?: (fromIndex: number, toIndex: number) => void;
  onAddPage?: () => void;
  /** 편집 모드: 슬라이드 사이(구분선) 우클릭 시 `insertIndex` 위치에 빈 페이지 삽입 */
  onAddPageAtInsertIndex?: (insertIndex: number) => void;
  /** 편집 모드: 인덱스별 삭제(하단 버튼·우클릭 메뉴) */
  onRemovePageAtIndex?: (index: number) => void;
  canRemovePage?: boolean;
  /** 편집 모드: 우클릭 — 복사본을 해당 페이지 바로 아래에 삽입 */
  onDuplicatePageAtIndex?: (index: number) => void;
  /** 왼쪽 툴레일 옆 열에 넣을 때 true — 전체 너비에 맞추고 옆 테두리 제거 */
  fluid?: boolean;
  /** 슬라이드 해상도(썸네일 세로 비율). 미지정 시 기본 슬라이드 크기 */
  slideWidth?: number;
  slideHeight?: number;
};

function useDismissFloatingMenu(
  open: boolean,
  menuRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onPointerDownCapture = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };

    let raf = 0;
    raf = window.requestAnimationFrame(() => {
      window.addEventListener("pointerdown", onPointerDownCapture, true);
    });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuRef, onClose]);
}

/** 슬라이드 행 사이 우클릭 → 해당 위치에 페이지 삽입 */
function PageInsertGap({
  insertIndex,
  pageCount,
  fluid,
  onAddPageAtInsertIndex,
}: {
  insertIndex: number;
  pageCount: number;
  fluid?: boolean;
  onAddPageAtInsertIndex?: (insertIndex: number) => void;
}) {
  const [ctxPoint, setCtxPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setCtxPoint(null), []);
  useDismissFloatingMenu(
    ctxPoint != null && onAddPageAtInsertIndex != null,
    menuRef,
    closeMenu,
  );

  if (!onAddPageAtInsertIndex) return null;

  const ariaLabel =
    insertIndex === 0
      ? "첫 슬라이드 앞에 새 페이지 삽입, 우클릭"
      : insertIndex >= pageCount
        ? "목록 끝에 새 페이지 삽입, 우클릭"
        : `슬라이드 ${insertIndex}과 ${insertIndex + 1} 사이에 새 페이지 삽입, 우클릭`;

  const menuPortal =
    ctxPoint != null
      ? createPortal(
          <ContextMenuFloatingPanel
            ref={menuRef}
            className="animate-in fade-in-0 zoom-in-95 flex min-w-[11rem] flex-col gap-0.5"
            style={{
              position: "fixed",
              left: Math.min(
                ctxPoint.x,
                typeof window !== "undefined"
                  ? Math.max(8, window.innerWidth - 200)
                  : ctxPoint.x,
              ),
              top: Math.min(
                ctxPoint.y,
                typeof window !== "undefined"
                  ? Math.max(8, window.innerHeight - 120)
                  : ctxPoint.y,
              ),
            }}
          >
            <div
              className="flex flex-col gap-0.5"
              role="group"
              aria-label="삽입"
            >
              <ContextMenuFloatingItem
                onClick={() => {
                  onAddPageAtInsertIndex(insertIndex);
                  setCtxPoint(null);
                }}
              >
                <Plus className="size-4" aria-hidden />
                페이지 추가
              </ContextMenuFloatingItem>
            </div>
          </ContextMenuFloatingPanel>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className={cn(
          "group/gap shrink-0 cursor-context-menu rounded-sm border border-dashed border-transparent",
          /* 목록은 gap-0이라 이 띠만 슬라이드 사이 간격을 담당 — 얇게 유지 */
          fluid ? "mx-2.5 h-2" : "mx-1.5 h-1.5",
          "hover:border-primary/25 hover:bg-primary/5",
        )}
        title="슬라이드 사이: 우클릭하면 여기에 새 페이지를 넣습니다"
        aria-label={ariaLabel}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCtxPoint({ x: e.clientX, y: e.clientY });
        }}
      />
      {menuPortal}
    </>
  );
}

function slideRowClass(active: boolean, fluid?: boolean) {
  return cn(
    "block w-full min-w-full flex-1 shrink-0 text-left transition-colors",
    fluid ? "rounded-xl border-2 p-2.5" : "rounded-lg border p-1.5",
    active
      ? "border-primary bg-primary/10 font-medium text-foreground shadow-sm ring-1 ring-primary/15"
      : "border-border/50 bg-muted/25 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
  );
}

/** 가로는 목록 행(카드) 안을 꽉 채우고, 세로만 슬라이드 비율 반영 */
function SlideCardPreview({
  thumbUrl,
  index,
  label,
  fluid,
  slideWidth,
  slideHeight,
}: {
  thumbUrl?: string;
  index: number;
  label: string;
  fluid?: boolean;
  slideWidth: number;
  slideHeight: number;
}) {
  const aw = Math.max(1, slideWidth);
  const ah = Math.max(1, slideHeight);
  return (
    <div
      className={cn(
        "relative box-border h-auto w-full max-w-full shrink-0 overflow-hidden bg-white dark:bg-black",
        fluid
          ? "rounded-lg shadow-md ring-2 ring-border/70 dark:ring-border"
          : "rounded-md shadow-sm ring-1 ring-border/80 dark:ring-border",
      )}
      style={{
        aspectRatio: `${aw} / ${ah}`,
      }}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10",
          fluid ? "px-2 pb-8 pt-1.5" : "px-1.5 pb-6 pt-1",
        )}
      >
        <span
          className={cn(
            "line-clamp-2 max-w-full text-left font-semibold leading-tight",
            fluid ? "text-xs" : "text-[10px]",
            thumbUrl
              ? "inline-block rounded bg-black/55 px-1.5 py-0.5 text-white"
              : "text-foreground",
          )}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          "absolute z-10 rounded bg-black/65 font-semibold tabular-nums text-white shadow-sm",
          fluid
            ? "bottom-1.5 left-1.5 px-1.5 py-0.5 text-xs"
            : "bottom-1 left-1 px-1 py-0.5 text-[10px]",
        )}
      >
        {index + 1}
      </span>
    </div>
  );
}

function SortableSlideRow({
  id,
  index,
  activeIndex,
  label,
  thumbUrl,
  fluid,
  slideWidth,
  slideHeight,
  onSelect,
  onRemovePageAtIndex,
  canRemovePage,
  onDuplicatePageAtIndex,
}: {
  id: string;
  index: number;
  activeIndex: number;
  label: string;
  thumbUrl?: string;
  fluid?: boolean;
  slideWidth: number;
  slideHeight: number;
  onSelect: (i: number) => void;
  onRemovePageAtIndex?: (i: number) => void;
  canRemovePage?: boolean;
  onDuplicatePageAtIndex?: (i: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const [ctxPoint, setCtxPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const closeCtxMenu = useCallback(() => setCtxPoint(null), []);
  useDismissFloatingMenu(ctxPoint != null, menuRef, closeCtxMenu);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rowClass = cn(
    "flex w-full min-w-0 items-stretch rounded-md border border-transparent",
    fluid ? "gap-1 p-1" : "gap-0.5 p-0.5",
    "cursor-grab touch-none active:cursor-grabbing",
    isDragging && "relative z-[1] opacity-[0.35]",
  );

  const ctxEnabled =
    onRemovePageAtIndex != null || onDuplicatePageAtIndex != null;

  const onRowContextMenu = ctxEnabled
    ? (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxPoint({ x: e.clientX, y: e.clientY });
      }
    : undefined;

  const menuPortal =
    ctxPoint && ctxEnabled
      ? createPortal(
          <ContextMenuFloatingPanel
            ref={menuRef}
            className="animate-in fade-in-0 zoom-in-95 flex min-w-[11rem] flex-col gap-0.5"
            style={{
              position: "fixed",
              left: Math.min(
                ctxPoint.x,
                typeof window !== "undefined"
                  ? Math.max(8, window.innerWidth - 200)
                  : ctxPoint.x,
              ),
              top: Math.min(
                ctxPoint.y,
                typeof window !== "undefined"
                  ? Math.max(8, window.innerHeight - 120)
                  : ctxPoint.y,
              ),
            }}
          >
            {onDuplicatePageAtIndex ? (
              <div
                className="flex flex-col gap-0.5"
                role="group"
                aria-label="복사"
              >
                <ContextMenuFloatingItem
                  onClick={() => {
                    onDuplicatePageAtIndex(index);
                    setCtxPoint(null);
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  페이지 복사
                </ContextMenuFloatingItem>
              </div>
            ) : null}
            {onDuplicatePageAtIndex && onRemovePageAtIndex ? (
              <div
                className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                role="separator"
                aria-hidden="true"
              />
            ) : null}
            {onRemovePageAtIndex ? (
              <div
                className="flex flex-col gap-0.5"
                role="group"
                aria-label="삭제"
              >
                <ContextMenuFloatingItem
                  variant="destructive"
                  disabled={!canRemovePage}
                  onClick={() => {
                    if (!canRemovePage) return;
                    onRemovePageAtIndex(index);
                    setCtxPoint(null);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />이 페이지 삭제
                </ContextMenuFloatingItem>
              </div>
            ) : null}
          </ContextMenuFloatingPanel>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={rowClass}
        onContextMenu={onRowContextMenu}
        {...attributes}
        {...listeners}
      >
        <button
          type="button"
          onClick={() => onSelect(index)}
          className={slideRowClass(index === activeIndex, fluid)}
        >
          <SlideCardPreview
            fluid={fluid}
            thumbUrl={thumbUrl}
            index={index}
            label={label}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
          />
        </button>
      </div>
      {menuPortal}
    </>
  );
}

function StaticSlideRow({
  index,
  activeIndex,
  label,
  thumbUrl,
  fluid,
  slideWidth,
  slideHeight,
  onSelect,
}: {
  index: number;
  activeIndex: number;
  label: string;
  thumbUrl?: string;
  fluid?: boolean;
  slideWidth: number;
  slideHeight: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch rounded-md border border-transparent",
        fluid ? "gap-1 p-1" : "gap-0.5 p-0.5",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(index)}
        className={slideRowClass(index === activeIndex, fluid)}
      >
        <SlideCardPreview
          fluid={fluid}
          thumbUrl={thumbUrl}
          index={index}
          label={label}
          slideWidth={slideWidth}
          slideHeight={slideHeight}
        />
      </button>
    </div>
  );
}

function DragOverlayRow({
  index,
  label,
  active,
  thumbUrl,
  fluid,
  slideWidth,
  slideHeight,
}: {
  index: number;
  label: string;
  active: boolean;
  thumbUrl?: string;
  fluid?: boolean;
  slideWidth: number;
  slideHeight: number;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 cursor-grabbing items-stretch rounded-md border border-primary/40 bg-card shadow-lg",
        fluid ? "gap-1 p-1" : "gap-0.5 p-0.5",
      )}
    >
      <div
        className={cn(
          slideRowClass(active, fluid),
          "pointer-events-none w-full flex-1",
        )}
      >
        <SlideCardPreview
          fluid={fluid}
          thumbUrl={thumbUrl}
          index={index}
          label={label}
          slideWidth={slideWidth}
          slideHeight={slideHeight}
        />
      </div>
    </div>
  );
}

export function BookPageSidebar({
  pageCount,
  pageKeys,
  thumbnailsByKey,
  activeIndex,
  onSelectPage,
  mode,
  pageLabels,
  onReorderPages,
  onAddPage,
  onAddPageAtInsertIndex,
  onRemovePageAtIndex,
  canRemovePage,
  onDuplicatePageAtIndex,
  fluid = false,
  slideWidth: slideWidthProp,
  slideHeight: slideHeightProp,
}: BookPageSidebarProps) {
  const slideWidth = slideWidthProp ?? DEFAULT_SLIDE_WIDTH;
  const slideHeight = slideHeightProp ?? DEFAULT_SLIDE_HEIGHT;
  const edit = mode === "edit";
  const reorder = Boolean(edit && onReorderPages);

  const sortableIds = useMemo(() => {
    if (pageCount === 0) return [];
    return Array.from(
      { length: pageCount },
      (_, i) => pageKeys?.[i] ?? `sidebar-fallback-${i}`,
    );
  }, [pageCount, pageKeys]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || !onReorderPages) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const oldIndex = sortableIds.indexOf(activeId);
    const newIndex = sortableIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderPages(oldIndex, newIndex);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const activeOverlayIndex = activeDragId
    ? sortableIds.indexOf(activeDragId)
    : -1;
  const overlayLabel =
    activeOverlayIndex >= 0
      ? slideDisplayLabel(pageLabels?.[activeOverlayIndex], activeOverlayIndex)
      : "";
  const thumbFor = (i: number) => {
    const k = pageKeys?.[i] ?? sortableIds[i];
    if (!k || !thumbnailsByKey) return undefined;
    return thumbnailsByKey[k];
  };

  /** 보기 전용 목록만 카드 사이 gap 사용. 드래그+삽입 슬롯 목록은 gap-0으로 이중 여백 방지 */
  const listGapStatic = fluid ? "gap-3 p-3" : "gap-2 p-2";
  const listGapReorder = fluid ? "gap-0 p-3" : "gap-0 p-2";

  const listBody =
    reorder && sortableIds.length > 0 ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <div className={cn("flex w-full min-w-0 flex-col", listGapReorder)}>
            {sortableIds.map((id, i) => (
              <Fragment key={id}>
                <PageInsertGap
                  insertIndex={i}
                  pageCount={pageCount}
                  fluid={fluid}
                  onAddPageAtInsertIndex={
                    edit ? onAddPageAtInsertIndex : undefined
                  }
                />
                <SortableSlideRow
                  id={id}
                  fluid={fluid}
                  index={i}
                  activeIndex={activeIndex}
                  label={slideDisplayLabel(pageLabels?.[i], i)}
                  thumbUrl={thumbFor(i)}
                  slideWidth={slideWidth}
                  slideHeight={slideHeight}
                  onSelect={onSelectPage}
                  onRemovePageAtIndex={edit ? onRemovePageAtIndex : undefined}
                  canRemovePage={canRemovePage}
                  onDuplicatePageAtIndex={
                    edit ? onDuplicatePageAtIndex : undefined
                  }
                />
              </Fragment>
            ))}
            <PageInsertGap
              insertIndex={pageCount}
              pageCount={pageCount}
              fluid={fluid}
              onAddPageAtInsertIndex={edit ? onAddPageAtInsertIndex : undefined}
            />
          </div>
        </SortableContext>
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          {activeDragId != null && activeOverlayIndex >= 0 ? (
            <DragOverlayRow
              fluid={fluid}
              index={activeOverlayIndex}
              label={overlayLabel}
              active={activeOverlayIndex === activeIndex}
              thumbUrl={thumbFor(activeOverlayIndex)}
              slideWidth={slideWidth}
              slideHeight={slideHeight}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    ) : (
      <div className={cn("flex w-full min-w-0 flex-col", listGapStatic)}>
        {Array.from({ length: pageCount }, (_, i) => (
          <StaticSlideRow
            key={pageKeys?.[i] ?? `page-${i}`}
            fluid={fluid}
            index={i}
            activeIndex={activeIndex}
            label={slideDisplayLabel(pageLabels?.[i], i)}
            thumbUrl={
              pageKeys?.[i] && thumbnailsByKey
                ? thumbnailsByKey[pageKeys[i]!]
                : undefined
            }
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            onSelect={onSelectPage}
          />
        ))}
      </div>
    );

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 max-h-full flex-col overflow-hidden bg-card/50",
        fluid
          ? "w-full min-w-0 shrink-0 border-0"
          : "w-[20rem] shrink-0 border-r border-border sm:w-[24rem]",
      )}
    >
      <div
        className={bookDockedPanelHeaderRowClass()}
        title={
          reorder
            ? "슬라이드 줄 전체를 드래그해 순서를 바꿀 수 있습니다."
            : undefined
        }
      >
        <FileStack className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>페이지</span>
      </div>
      {/* basis-0: flex 자식이 콘텐츠 높이만큼 밀고 늘어나지 않게 — 목록만 스크롤, 하단 버튼 고정 */}
      <div className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        {listBody}
      </div>
      {edit ? (
        <div className={bookDockedPanelFooterClass()}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full font-medium"
            onClick={onAddPage}
          >
            <Plus
              className={cn("mr-1", fluid ? "size-4" : "size-3.5")}
              aria-hidden
            />
            페이지 추가
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canRemovePage || !onRemovePageAtIndex}
            onClick={() => onRemovePageAtIndex?.(activeIndex)}
          >
            <Trash2
              className={cn("mr-1", fluid ? "size-4" : "size-3.5")}
              aria-hidden
            />
            현재 삭제
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
