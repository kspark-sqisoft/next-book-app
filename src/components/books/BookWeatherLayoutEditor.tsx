// 날씨 위젯 블록 배치 편집기: 드래그 또는 화살표 버튼으로 슬롯·순서 변경
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import type { BookWeatherBlockKey } from "@/features/book/book-canvas";
import { cn } from "@/lib/utils";

type CommitPayload = {
  order: BookWeatherBlockKey[];
  rightBlocks: BookWeatherBlockKey[];
};

type Props = {
  layout: "columns" | "single" | "row";
  /** 전체 블록 순서(항상 5개 순열) */
  order: BookWeatherBlockKey[];
  /** 좌우 2열에서 오른쪽 열에 둘 블록 */
  rightBlocks: BookWeatherBlockKey[];
  /** 표시 항목이 모두 꺼져 지금은 카드에 보이지 않는 블록 */
  hiddenKeys: ReadonlySet<BookWeatherBlockKey>;
  onCommit: (next: CommitPayload) => void;
};

const BLOCK_SHORT_LABELS: Record<BookWeatherBlockKey, string> = {
  main: "날씨",
  time: "시계·날짜",
  location: "위치",
  air: "대기질",
  secondary: "부가 정보",
};

type ChipAction = {
  key: string;
  title: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
};

function SortableBlockChip({
  id,
  dimmed,
  actions,
}: {
  id: BookWeatherBlockKey;
  dimmed: boolean;
  actions: ChipAction[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const label = BLOCK_SHORT_LABELS[id];
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1",
        dimmed && "opacity-50",
        isDragging && "relative z-[1] opacity-80 shadow-md",
      )}
      title={
        dimmed ? "표시 항목에서 꺼져 있어 카드에는 보이지 않습니다" : undefined
      }
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`${label} 드래그로 이동`}
        title="드래그해 원하는 자리로 이동"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
      {actions.map(({ key, title, icon: Icon, disabled, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          disabled={disabled}
          title={title}
          aria-label={`${label} ${title}`}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  empty,
  children,
}: {
  id: string;
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-dashed border-border/80 bg-background/40 p-1.5",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <p className="text-[10px] font-medium text-muted-foreground">{title}</p>
      {children}
      {empty ? (
        <p className="rounded border border-dashed border-border/60 px-1.5 py-2 text-center text-[10px] text-muted-foreground/70">
          여기로 드래그
        </p>
      ) : null}
    </div>
  );
}

/** 한 열 안 이동(위/아래·앞/뒤) 화살표 액션 */
function reorderActions(
  list: BookWeatherBlockKey[],
  index: number,
  horizontal: boolean,
  apply: (next: BookWeatherBlockKey[]) => void,
): ChipAction[] {
  return [
    {
      key: "back",
      title: horizontal ? "앞으로" : "위로",
      icon: horizontal ? ChevronLeft : ChevronUp,
      disabled: index <= 0,
      onClick: () => apply(arrayMove(list, index, index - 1)),
    },
    {
      key: "fwd",
      title: horizontal ? "뒤로" : "아래로",
      icon: horizontal ? ChevronRight : ChevronDown,
      disabled: index >= list.length - 1,
      onClick: () => apply(arrayMove(list, index, index + 1)),
    },
  ];
}

export function BookWeatherLayoutEditor({
  layout,
  order,
  rightBlocks,
  hiddenKeys,
  onCommit,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const baseLeft = order.filter((k) => !rightBlocks.includes(k));
  const baseRight = order.filter((k) => rightBlocks.includes(k));
  /** 드래그 중 임시 배치(놓기 전 미리보기). null이면 저장값 그대로 */
  const [dragCols, setDragCols] = useState<{
    left: BookWeatherBlockKey[];
    right: BookWeatherBlockKey[];
  } | null>(null);

  if (layout !== "columns") {
    const horizontal = layout === "row";
    const commitOrder = (next: BookWeatherBlockKey[]) =>
      onCommit({ order: next, rightBlocks });
    const handleDragEnd = (e: DragEndEvent) => {
      const from = order.indexOf(e.active.id as BookWeatherBlockKey);
      const to = e.over ? order.indexOf(e.over.id as BookWeatherBlockKey) : -1;
      if (from >= 0 && to >= 0 && from !== to) {
        commitOrder(arrayMove(order, from, to));
      }
    };
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order}
          strategy={
            horizontal ? rectSortingStrategy : verticalListSortingStrategy
          }
        >
          <div
            className={cn(
              "gap-1 rounded-md border border-dashed border-border/80 bg-background/40 p-1.5",
              horizontal ? "flex flex-wrap" : "flex flex-col",
            )}
          >
            {order.map((k, i) => (
              <SortableBlockChip
                key={k}
                id={k}
                dimmed={hiddenKeys.has(k)}
                actions={reorderActions(order, i, horizontal, commitOrder)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  const left = dragCols?.left ?? baseLeft;
  const right = dragCols?.right ?? baseRight;
  const commitCols = (l: BookWeatherBlockKey[], r: BookWeatherBlockKey[]) =>
    onCommit({ order: [...l, ...r], rightBlocks: r });

  const handleDragOver = (e: DragOverEvent) => {
    const activeId = e.active.id as BookWeatherBlockKey;
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    setDragCols((cur) => {
      const cols = cur ?? { left: baseLeft, right: baseRight };
      const from = cols.left.includes(activeId) ? "left" : "right";
      const to =
        overId === "weather-col-left"
          ? "left"
          : overId === "weather-col-right"
            ? "right"
            : cols.left.includes(overId as BookWeatherBlockKey)
              ? "left"
              : "right";
      if (to === from) return cols;
      const fromList = cols[from].filter((k) => k !== activeId);
      const toList = [...cols[to]];
      const overIndex = toList.indexOf(overId as BookWeatherBlockKey);
      toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, activeId);
      return from === "left"
        ? { left: fromList, right: toList }
        : { left: toList, right: fromList };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = e.active.id as BookWeatherBlockKey;
    const overId = e.over ? (String(e.over.id) as BookWeatherBlockKey) : null;
    const cols = dragCols ?? { left: baseLeft, right: baseRight };
    let { left: l, right: r } = cols;
    if (overId && overId !== activeId) {
      // 같은 열 안에서의 최종 놓은 위치 반영(열 간 이동은 dragOver에서 이미 처리됨)
      const inLeft = l.includes(activeId);
      const list = inLeft ? l : r;
      const from = list.indexOf(activeId);
      const to = list.indexOf(overId);
      if (from >= 0 && to >= 0 && from !== to) {
        const moved = arrayMove(list, from, to);
        if (inLeft) l = moved;
        else r = moved;
      }
    }
    setDragCols(null);
    commitCols(l, r);
  };

  const renderColumn = (side: "left" | "right") => {
    const list = side === "left" ? left : right;
    const other = side === "left" ? right : left;
    return (
      <DroppableColumn
        id={side === "left" ? "weather-col-left" : "weather-col-right"}
        title={side === "left" ? "왼쪽 열" : "오른쪽 열"}
        empty={list.length === 0}
      >
        <SortableContext items={list} strategy={verticalListSortingStrategy}>
          {list.map((k, i) => (
            <SortableBlockChip
              key={k}
              id={k}
              dimmed={hiddenKeys.has(k)}
              actions={[
                ...reorderActions(list, i, false, (next) =>
                  side === "left"
                    ? commitCols(next, other)
                    : commitCols(other, next),
                ),
                {
                  key: "side",
                  title:
                    side === "left" ? "오른쪽 열로 이동" : "왼쪽 열로 이동",
                  icon: side === "left" ? ChevronRight : ChevronLeft,
                  onClick: () => {
                    const rest = list.filter((v) => v !== k);
                    const moved = [...other, k];
                    if (side === "left") commitCols(rest, moved);
                    else commitCols(moved, rest);
                  },
                },
              ]}
            />
          ))}
        </SortableContext>
      </DroppableColumn>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragCols(null)}
    >
      <div className="flex min-w-0 items-stretch gap-1.5">
        {renderColumn("left")}
        {renderColumn("right")}
      </div>
    </DndContext>
  );
}
