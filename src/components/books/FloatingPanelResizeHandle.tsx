"use client";

// 떠 있는 패널 공용 크기 조절 핸들 — 오른쪽 아래 모서리 대각선 그립
import type { PointerEvent as ReactPointerEvent } from "react";

type Props = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
};

export function FloatingPanelResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  return (
    <div
      data-panel-resize
      aria-label="창 크기 조절"
      title="드래그해서 창 크기 조절"
      className="absolute bottom-0 right-0 flex size-5 cursor-nwse-resize touch-none items-end justify-end p-1 text-muted-foreground/70 hover:text-foreground"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="size-3"
        aria-hidden
      >
        <path d="M10.5 4.5 4.5 10.5M10.5 8.5l-2 2" />
      </svg>
    </div>
  );
}
