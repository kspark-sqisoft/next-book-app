import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  type BookCanvasElement,
} from "@/lib/book-canvas";
import { getTextWidgetDisplayHtml, textWidgetHitHeight } from "@/lib/book-text-widget";

/** 드래그·트랜스폼 중 Konva와 동일(논리 좌표: 회전 전 박스 왼쪽 위·크기·도) */
export type BookTextOverlayLiveFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type Props = {
  el: Extract<BookCanvasElement, { type: "text" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  /** Konva `dragLive` / `transformLive`와 맞춤. 없으면 `el`만 사용. */
  liveFrame?: BookTextOverlayLiveFrame | null;
  /** 논리 높이(px) — 콘텐츠에 맞춤(편집 모드). */
  onReportLogicalHeight?: (logicalPx: number) => void;
};

function textWidgetCellVerticalAlign(
  el: Extract<BookCanvasElement, { type: "text" }>,
): "top" | "middle" | "bottom" {
  const v = el.verticalAlign;
  if (v === "middle" || v === "bottom") return v;
  return "top";
}

export function BookTextWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
  onReportLogicalHeight,
}: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const html = getTextWidgetDisplayHtml(el);
  const w = el.width ?? 720;
  const h = textWidgetHitHeight(el);
  const o = resolveBookElementOpacity(el.opacity);
  const rot = resolveBookElementRotation(el.rotation);
  const pivot = bookElementPivotKonva({ x: el.x, y: el.y, width: w, height: h, rotation: el.rotation });
  const layoutOrigin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? layoutOrigin.x;
  const fy = liveFrame?.y ?? layoutOrigin.y;
  const fw = liveFrame?.width ?? w;
  const fh = liveFrame?.height ?? h;
  const fRot = liveFrame != null ? liveFrame.rotation : rot;
  const cellVerticalAlign = textWidgetCellVerticalAlign(el);

  const tBr = resolveBookElementBorderRadius(el);
  const tOw = resolveBookElementOutlineWidth(el);
  const tOc = resolveBookElementOutlineColor(el);
  const outlineShadow =
    mode === "edit" && tOw > 0
      ? `0 0 0 ${Math.max(0.5, tOw * scale)}px ${tOc}`
      : undefined;

  useLayoutEffect(() => {
    if (mode !== "edit" || !onReportLogicalHeight) return;
    const node = measureRef.current;
    if (!node) return;

    const measure = () => {
      const sh = node.scrollHeight;
      if (sh <= 0) return;
      const logical = sh / scale;
      onReportLogicalHeight(logical);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(node);
    return () => ro.disconnect();
  }, [html, scale, mode, onReportLogicalHeight, w, fh, liveFrame, el.verticalAlign]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: fx * scale,
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        fontSize: el.fontSize * scale,
        color: el.fill?.startsWith("#") ? el.fill : "#111827",
        lineHeight: 1.35,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: Math.max(0, tBr * scale),
        boxShadow: outlineShadow,
      }}
    >
      <div
        style={{
          display: "table",
          width: "100%",
          height: "100%",
          tableLayout: "fixed",
        }}
      >
        <div
          style={{
            display: "table-cell",
            verticalAlign: cellVerticalAlign,
            height: "100%",
            width: "100%",
          }}
        >
          <div
            ref={measureRef}
            className={cn(
              "book-text-widget-content max-h-full min-h-0 select-none overflow-x-hidden overflow-y-auto [&_blockquote]:border-s-2 [&_blockquote]:border-border/80 [&_blockquote]:ps-2 [&_blockquote]:italic",
              "[&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
              "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/80 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.85em]",
              "[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:ps-4",
              "[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:ps-4",
              "[&_h2]:mt-1 [&_h2]:mb-0.5 [&_h2]:text-[1.15em] [&_h2]:font-semibold",
              "[&_h3]:mt-1 [&_h3]:mb-0.5 [&_h3]:text-[1.05em] [&_h3]:font-semibold",
              "[&_p]:my-0.5 [&_p]:min-h-[1em]",
              "[&_a]:text-primary [&_a]:underline",
              "[&_hr]:my-2 [&_hr]:border-border",
            )}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
