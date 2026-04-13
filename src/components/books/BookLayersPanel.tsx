// 레이어 목록: z-order·잠금·발표 타이밍 요소 선택
import {
  closestCenter,
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
import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Clock,
  CloudSun,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Lock,
  Newspaper,
  Pencil,
  Shapes,
  Trash2,
  Type,
  Unlock,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { BookNumericIntField } from "@/components/books/BookNumericIntField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type BookCanvasElement,
  type ElementZOrderOp,
  isBookElementLocked,
  isBookElementVisible,
} from "@/lib/book-canvas";
import { displayLayerPresentationSec } from "@/lib/book-presentation";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

function bookElementLayerLabel(el: BookCanvasElement): string {
  switch (el.type) {
    case "text": {
      const t = el.text?.trim() ?? "";
      if (t) return t.length > 32 ? `${t.slice(0, 32)}…` : t;
      return "텍스트";
    }
    case "image":
      return "이미지";
    case "video":
      return "동영상";
    case "weather":
      return "날씨";
    case "digitalClock":
      return "디지털 시계";
    case "news":
      return "뉴스";
    case "mediaPlaylist":
      return "미디어";
    case "drawing":
      return "그리기";
    case "shape":
      return "도형";
    default:
      return "요소";
  }
}

function LayerHoldSecInput({
  elementId,
  storedSec,
  resolvedSec,
  onCommit,
}: {
  elementId: string;
  storedSec: number | undefined;
  resolvedSec: number;
  onCommit: (sec: number | undefined) => void;
}) {
  return (
    <div
      className="shrink-0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <BookNumericIntField
        fieldKey={`${elementId}:layer-hold`}
        htmlId={`layer-hold-${elementId}`}
        hideLabel
        optional
        commitPolicy="reject"
        showSpinners={false}
        value={storedSec}
        min={1}
        max={3600}
        maxDigits={4}
        placeholder={String(resolvedSec)}
        className="space-y-0"
        inputClassName="h-7 w-11 shrink-0 px-1 text-center font-mono text-[10px] tabular-nums"
        onCommit={onCommit}
        aria-label="슬라이드쇼 표시 초"
        title="미리보기 표시 시간(초). 비우면 기본값"
      />
    </div>
  );
}

function LayerTypeIcon({ el }: { el: BookCanvasElement }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground";
  switch (el.type) {
    case "text":
      return <Type className={cls} aria-hidden />;
    case "image":
      return <ImageIcon className={cls} aria-hidden />;
    case "video":
      return <Video className={cls} aria-hidden />;
    case "weather":
      return <CloudSun className={cls} aria-hidden />;
    case "news":
      return <Newspaper className={cls} aria-hidden />;
    case "digitalClock":
      return <Clock className={cls} aria-hidden />;
    case "mediaPlaylist":
      return <ListVideo className={cls} aria-hidden />;
    case "drawing":
      return <Pencil className={cls} aria-hidden />;
    case "shape":
      return <Shapes className={cls} aria-hidden />;
    default:
      return <Layers className={cls} aria-hidden />;
  }
}

function layerRowShellClass(
  selected: boolean,
  showing: boolean,
  locked: boolean,
  isDragging?: boolean,
) {
  return cn(
    "flex min-w-0 w-full items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 transition-colors",
    selected ? "border-primary/35 bg-primary/10" : "hover:bg-muted/60",
    !showing && "opacity-[0.72]",
    locked && "ring-1 ring-amber-500/25",
    isDragging && "opacity-[0.45]",
  );
}

type LayerRowActionsProps = {
  el: BookCanvasElement;
  displayIndex: number;
  revLength: number;
  showing: boolean;
  locked: boolean;
  readOnly: boolean;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onVisibilityChange?: (elementId: string, visible: boolean) => void;
  onLockChange?: (elementId: string, locked: boolean) => void;
  onRequestDelete?: (elementId: string) => void;
  onReorderZ?: (elementId: string, op: ElementZOrderOp) => void;
  canReorder: boolean;
  /** 이 슬라이드의 미리보기 시간 기준 레이어 id */
  presentationTimingElementId?: string | null;
  onPresentationTimingElementIdChange?: (id: string | null) => void;
  onPresentationHoldSecChange?: (
    elementId: string,
    sec: number | undefined,
  ) => void;
  videoDurationSecByElementId?: Record<string, number>;
};

type LayerPanelRowProps = LayerRowActionsProps & { selected: boolean };

function LayerRowActions({
  el,
  displayIndex,
  revLength,
  showing,
  locked,
  readOnly,
  onSelect,
  onVisibilityChange,
  onLockChange,
  onRequestDelete,
  onReorderZ,
  canReorder,
  presentationTimingElementId,
  onPresentationTimingElementIdChange,
  onPresentationHoldSecChange,
  videoDurationSecByElementId,
}: LayerRowActionsProps) {
  const isFront = displayIndex === 0;
  const isBack = displayIndex === revLength - 1;
  const label = bookElementLayerLabel(el);
  const isTimingLayer =
    presentationTimingElementId != null &&
    presentationTimingElementId !== "" &&
    presentationTimingElementId === el.id;
  const displaySec = displayLayerPresentationSec(el, {
    videoDurationSecById: videoDurationSecByElementId,
  });

  return (
    <>
      {readOnly ? (
        <span
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
          title={showing ? "보이는 레이어" : "숨긴 레이어"}
          aria-hidden
        >
          {showing ? (
            <Eye className="size-3.5" />
          ) : (
            <EyeOff className="size-3.5" />
          )}
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          title={showing ? "슬라이드에서 숨기기" : "다시 보이기"}
          aria-label={
            showing ? `${label} 슬라이드에서 숨기기` : `${label} 다시 보이기`
          }
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityChange?.(el.id, !showing);
          }}
        >
          {showing ? (
            <Eye className="size-3.5" aria-hidden />
          ) : (
            <EyeOff className="size-3.5 opacity-80" aria-hidden />
          )}
        </Button>
      )}
      {readOnly ? (
        <span
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
          title={locked ? "잠긴 레이어" : "잠금 없음"}
          aria-hidden
        >
          {locked ? (
            <Lock className="size-3.5" />
          ) : (
            <Unlock className="size-3.5 opacity-40" />
          )}
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          title={locked ? "잠금 해제" : "잠그기"}
          aria-label={locked ? `${label} 잠금 해제` : `${label} 잠그기`}
          onClick={(e) => {
            e.stopPropagation();
            onLockChange?.(el.id, !locked);
          }}
        >
          {locked ? (
            <Lock
              className="size-3.5 text-amber-700 dark:text-amber-400"
              aria-hidden
            />
          ) : (
            <Unlock className="size-3.5 opacity-70" aria-hidden />
          )}
        </Button>
      )}
      {(onPresentationTimingElementIdChange != null ||
        presentationTimingElementId !== undefined) && (
        <div
          className="flex w-[2.125rem] shrink-0 flex-col items-center justify-center gap-0.5"
          title="이 슬라이드 미리보기 시간 기준 레이어(한 개만)"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isTimingLayer}
            disabled={readOnly || !onPresentationTimingElementIdChange}
            onCheckedChange={(c) => {
              if (!onPresentationTimingElementIdChange) return;
              if (c === true) onPresentationTimingElementIdChange(el.id);
            }}
            className="size-4"
            aria-label={`${label}: 페이지 시간 기준`}
          />
          <span className="text-[8px] leading-none text-muted-foreground">
            기준
          </span>
        </div>
      )}
      {el.type === "mediaPlaylist" ? (
        <span
          className="flex w-11 shrink-0 flex-col items-center justify-center leading-none"
          title="미디어 목록 항목 시간 합"
        >
          <span className="text-[9px] text-muted-foreground">합</span>
          <span className="text-[10px] font-mono tabular-nums text-foreground/90">
            {displaySec}s
          </span>
        </span>
      ) : readOnly || !onPresentationHoldSecChange ? (
        <span
          className="w-11 shrink-0 text-center text-[10px] font-mono tabular-nums text-muted-foreground"
          title="미리보기 표시 시간(초)"
        >
          {displaySec}s
        </span>
      ) : (
        <LayerHoldSecInput
          elementId={el.id}
          storedSec={el.presentationHoldSec}
          resolvedSec={displaySec}
          onCommit={(sec) => onPresentationHoldSecChange(el.id, sec)}
        />
      )}
      {readOnly ? (
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 px-1 py-1 text-xs">
          <LayerTypeIcon el={el} />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {label}
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 basis-0 items-center gap-2 rounded px-1 py-1 text-left text-xs"
          onClick={(e) => onSelect(el.id, e.shiftKey)}
        >
          <LayerTypeIcon el={el} />
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium text-foreground",
              !showing && "line-through decoration-muted-foreground/70",
              locked && "text-amber-900/90 dark:text-amber-100/90",
              isTimingLayer && "text-primary",
            )}
          >
            {label}
          </span>
        </button>
      )}
      {!readOnly && onRequestDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="이 슬라이드에서 삭제"
          aria-label={`${label} 삭제`}
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(el.id);
          }}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      ) : null}
      {canReorder && onReorderZ ? (
        <div className="flex shrink-0 items-center gap-px pr-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            title="한 단계 앞으로"
            aria-label={`${label} 한 단계 앞으로`}
            disabled={isFront || locked}
            onClick={(e) => {
              e.stopPropagation();
              onReorderZ(el.id, "forward");
            }}
          >
            <ChevronUp className="size-3" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            title="한 단계 뒤로"
            aria-label={`${label} 한 단계 뒤로`}
            disabled={isBack || locked}
            onClick={(e) => {
              e.stopPropagation();
              onReorderZ(el.id, "backward");
            }}
          >
            <ChevronDown className="size-3" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            title="맨 앞으로"
            aria-label={`${label} 맨 앞으로`}
            disabled={isFront || locked}
            onClick={(e) => {
              e.stopPropagation();
              onReorderZ(el.id, "front");
            }}
          >
            <ChevronsUp className="size-3" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            title="맨 뒤로"
            aria-label={`${label} 맨 뒤로`}
            disabled={isBack || locked}
            onClick={(e) => {
              e.stopPropagation();
              onReorderZ(el.id, "back");
            }}
          >
            <ChevronsDown className="size-3" aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  );
}

function SortableLayerRow(props: LayerPanelRowProps) {
  const { selected, ...actionsProps } = props;
  const { el, locked, readOnly, showing } = actionsProps;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: el.id,
    disabled: locked || readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("min-w-0", isDragging && "relative z-[1]")}
    >
      <div
        className={layerRowShellClass(selected, showing, locked, isDragging)}
      >
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 shrink-0 touch-none",
              locked
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab active:cursor-grabbing",
            )}
            disabled={locked}
            aria-label={`${bookElementLayerLabel(el)} 순서 이동`}
            title={
              locked
                ? "잠긴 레이어는 순서를 바꿀 수 없습니다"
                : "드래그해 위·아래로 순서 변경"
            }
            {...attributes}
            {...listeners}
          >
            <GripVertical
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
          </Button>
        ) : null}
        <LayerRowActions {...actionsProps} />
      </div>
    </li>
  );
}

function StaticLayerRow(props: LayerPanelRowProps) {
  const { selected, ...actionsProps } = props;
  const { showing, locked } = actionsProps;
  return (
    <li className="min-w-0">
      <div className={layerRowShellClass(selected, showing, locked, false)}>
        <LayerRowActions {...actionsProps} />
      </div>
    </li>
  );
}

function LayerDragOverlay({ el }: { el: BookCanvasElement }) {
  const label = bookElementLayerLabel(el);
  return (
    <div
      className={cn(
        "flex min-w-[200px] max-w-[min(100vw-2rem,18rem)] items-center gap-2 rounded-md border border-primary/40 bg-card px-2 py-1.5 shadow-lg",
      )}
    >
      <GripVertical
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <LayerTypeIcon el={el} />
      <span className="min-w-0 truncate text-xs font-medium text-foreground">
        {label}
      </span>
    </div>
  );
}

export type BookLayersPanelProps = {
  elements: BookCanvasElement[];
  selectedIds: readonly string[];
  onSelect: (id: string, shiftKey?: boolean) => void;
  onReorderZ?: (elementId: string, op: ElementZOrderOp) => void;
  /** 편집: 패널 표시 순서(위=앞) 기준으로 드래그 이동 */
  onLayerDragReorder?: (
    fromDisplayIndex: number,
    toDisplayIndex: number,
  ) => void;
  onVisibilityChange?: (elementId: string, visible: boolean) => void;
  onLockChange?: (elementId: string, locked: boolean) => void;
  onRequestDelete?: (elementId: string) => void;
  readOnly?: boolean;
  expandVertical?: boolean;
  className?: string;
  presentationTimingElementId?: string | null;
  onPresentationTimingElementIdChange?: (id: string | null) => void;
  onPresentationHoldSecChange?: (
    elementId: string,
    sec: number | undefined,
  ) => void;
  videoDurationSecByElementId?: Record<string, number>;
};

/**
 * Polotno 스타일: 위가 앞쪽(위에 그려지는) 레이어, 아래가 뒤.
 * 배열은 [뒤 → 앞] 순서이므로 목록은 역순으로 표시합니다.
 */
export function BookLayersPanel({
  elements,
  selectedIds,
  onSelect,
  onReorderZ,
  onLayerDragReorder,
  onVisibilityChange,
  onLockChange,
  onRequestDelete,
  readOnly = false,
  expandVertical = false,
  className,
  presentationTimingElementId,
  onPresentationTimingElementIdChange,
  onPresentationHoldSecChange,
  videoDurationSecByElementId,
}: BookLayersPanelProps) {
  const rev = useMemo(() => [...elements].reverse(), [elements]);
  const canReorder = Boolean(onReorderZ) && !readOnly;
  const dragSortEnabled = canReorder && Boolean(onLayerDragReorder);

  const sortableIds = useMemo(() => rev.map((e) => e.id), [rev]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !onLayerDragReorder) return;
    if (active.id === over.id) return;
    const from = sortableIds.indexOf(String(active.id));
    const to = sortableIds.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onLayerDragReorder(from, to);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const activeOverlayEl = activeDragId
    ? rev.find((e) => e.id === activeDragId)
    : null;

  const rowPropsBase = {
    revLength: rev.length,
    onSelect,
    onVisibilityChange,
    onLockChange,
    onRequestDelete,
    onReorderZ,
    canReorder,
    readOnly: Boolean(readOnly),
    presentationTimingElementId,
    onPresentationTimingElementIdChange,
    onPresentationHoldSecChange,
    videoDurationSecByElementId,
  };

  const listUl = (
    <ul className="flex min-w-0 flex-col gap-px p-1.5" role="list">
      {rev.map((el, displayIndex) => {
        const selected = selectedIds.includes(el.id);
        const showing = isBookElementVisible(el);
        const locked = isBookElementLocked(el);
        const rowProps = {
          ...rowPropsBase,
          el,
          displayIndex,
          selected,
          showing,
          locked,
        };
        return dragSortEnabled ? (
          <SortableLayerRow key={el.id} {...rowProps} />
        ) : (
          <StaticLayerRow key={el.id} {...rowProps} />
        );
      })}
    </ul>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        expandVertical
          ? "flex-1 border-b-0 bg-muted/[0.08] dark:bg-muted/[0.1]"
          : "shrink-0 border-b-2 border-border/80 bg-muted/[0.14] dark:bg-muted/[0.18]",
        className,
      )}
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <Layers className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>레이어</span>
        <span className="ml-auto rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {elements.length}
        </span>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
          expandVertical ? "" : "max-h-[min(38vh,260px)]",
        )}
      >
        {rev.length === 0 ? (
          <p className="px-3 py-5 text-center text-xs leading-relaxed text-muted-foreground">
            이 슬라이드에 위젯이 없습니다. 왼쪽에서 위젯을 끌어 오거나 템플릿을
            적용해 보세요.
          </p>
        ) : dragSortEnabled ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              {listUl}
            </SortableContext>
            <DragOverlay
              dropAnimation={{
                duration: 200,
                easing: "cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            >
              {activeOverlayEl ? (
                <LayerDragOverlay el={activeOverlayEl} />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          listUl
        )}
      </div>
      <p className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[10px] leading-snug text-muted-foreground">
        {readOnly
          ? "위쪽이 화면 앞 순서입니다. 기준 체크는 저장된 미리보기 시간 기준 레이어입니다. 숫자는 표시 초(미디어 위젯은 합)."
          : dragSortEnabled
            ? "위쪽이 앞 순서입니다. 기준=페이지 미리보기 시간을 정하는 레이어, 초=표시 시간. 미디어 위젯은 합만 표시. 드래그로 순서 변경."
            : "기준 체크=이 슬라이드 미리보기의 시간 기준 레이어(하나). 초 칸=표시 시간(기본 10초, 미디어 위젯 제외). 눈·자물쇠·삭제는 기존과 동일."}
      </p>
    </div>
  );
}
