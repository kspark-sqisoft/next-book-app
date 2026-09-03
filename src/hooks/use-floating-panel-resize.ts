// 떠 있는 패널(위젯·미디어 창) 공용 리사이즈 훅 — 오른쪽 아래 모서리 드래그.
// 기본(자연) 크기가 최소이고, 최대는 가로 기본폭×1.5 · 세로 자연 높이×2.
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useRef,
} from "react";

/** 저장하는 패널 크기 — minH는 처음 리사이즈한 시점의 자연(최소) 높이 */
export type FloatingPanelSize = { w: number; h: number; minH: number };

/** localStorage 복원값 검증 */
export function normalizeFloatingPanelSize(
  v: unknown,
): FloatingPanelSize | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (
    typeof o.w !== "number" ||
    typeof o.h !== "number" ||
    typeof o.minH !== "number" ||
    !Number.isFinite(o.w) ||
    !Number.isFinite(o.h) ||
    !Number.isFinite(o.minH) ||
    o.w <= 0 ||
    o.h <= 0 ||
    o.minH <= 0
  ) {
    return null;
  }
  return { w: o.w, h: o.h, minH: o.minH };
}

export function useFloatingPanelResize({
  rootRef,
  baseWidth,
  size,
  onSizeChange,
  viewMargin = 8,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  /** 기본(최소) 가로 px — 최대는 1.5배 */
  baseWidth: number;
  size: FloatingPanelSize | null;
  onSizeChange: (size: FloatingPanelSize) => void;
  viewMargin?: number;
}) {
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originW: number;
    originH: number;
    minH: number;
  } | null>(null);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const el = rootRef.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originW: el.offsetWidth,
        originH: el.offsetHeight,
        // 크기 지정 전이면 지금 자연 높이가 곧 최소 높이
        minH: size?.minH ?? el.offsetHeight,
      };
    },
    [rootRef, size],
  );

  const onResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const r = resizeRef.current;
      if (!r || e.pointerId !== r.pointerId) return;
      const maxW = Math.min(
        Math.round(baseWidth * 1.5),
        window.innerWidth - 2 * viewMargin,
      );
      const maxH = Math.min(r.minH * 2, window.innerHeight - 2 * viewMargin);
      const w = Math.min(
        maxW,
        Math.max(baseWidth, r.originW + (e.clientX - r.startX)),
      );
      const h = Math.min(
        maxH,
        Math.max(r.minH, r.originH + (e.clientY - r.startY)),
      );
      onSizeChange({ w, h, minH: r.minH });
    },
    [baseWidth, onSizeChange, viewMargin],
  );

  const onResizePointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const r = resizeRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resizeRef.current = null;
  }, []);

  return { onResizePointerDown, onResizePointerMove, onResizePointerUp };
}
