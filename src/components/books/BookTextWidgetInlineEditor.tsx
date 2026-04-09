import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
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
import {
  bookRichHtmlFromContentEditable,
  mergeTextWidgetHeightAfterMeasure,
  richHtmlToPlainText,
  textWidgetHitHeight,
} from "@/lib/book-text-widget";
import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";

export type BookTextWidgetInlineEditorHandle = {
  commit: () => void;
};

/** #RRGGBB / #RGB 기준 상대 밝기(0=어두움). 비헥스는 어두운 글자로 간주 */
function hexFillLuminance(fill: string | undefined): number {
  const raw = fill?.trim() ?? "";
  if (!raw.startsWith("#")) return 0.12;
  let h = raw.slice(1);
  if (h.length === 3) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (h.length !== 6 || !/^[0-9a-f]+$/i.test(h)) return 0.12;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 슬라이드 글자색과 겹치지 않게 편집 패드만 밝은/어두운 면으로 분리 */
function inlineEditPadColors(fill: string | undefined): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const lum = hexFillLuminance(fill);
  const hex = fill?.startsWith("#") ? fill : "#111827";
  if (lum < 0.5) {
    return {
      backgroundColor: "#ffffff",
      color: hex,
      borderColor: "rgba(59, 130, 246, 0.95)",
    };
  }
  return {
    backgroundColor: "#1e293b",
    color: hex,
    borderColor: "rgba(147, 197, 253, 0.95)",
  };
}

type Props = {
  el: Extract<BookCanvasElement, { type: "text" }>;
  scale: number;
  liveFrame?: BookTextOverlayLiveFrame | null;
  /** 열릴 때의 표시 HTML — Escape 시 복원 */
  initialDisplayHtml: string;
  onCommit: (patch: { richHtml: string; text: string; height: number }) => void;
  onCancel: () => void;
  onReportLogicalHeight?: (logicalPx: number) => void;
};

/**
 * 더블클릭으로 캔버스 위에서 바로 텍스트(리치 HTML) 편집.
 * Blur 시 저장, Escape 시 취소.
 */
export const BookTextWidgetInlineEditor = forwardRef<BookTextWidgetInlineEditorHandle, Props>(
  function BookTextWidgetInlineEditor(
    {
      el,
      scale,
      liveFrame,
      initialDisplayHtml,
      onCommit,
      onCancel,
      onReportLogicalHeight,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const snapshotHtmlRef = useRef(initialDisplayHtml);
    const didCommitRef = useRef(false);
    const escapeCancelRef = useRef(false);

    const doCommit = useCallback(() => {
      if (didCommitRef.current) return;
      const node = editorRef.current;
      if (!node) return;
      didCommitRef.current = true;
      const raw = node.innerHTML;
      const sanitized = bookRichHtmlFromContentEditable(raw);
      const richHtml = sanitized.trim() ? sanitized : "<p></p>";
      const text = richHtmlToPlainText(richHtml);
      const height = mergeTextWidgetHeightAfterMeasure(
        node.scrollHeight / scale,
        el.height,
        el.fontSize,
      );
      onCommit({ richHtml, text, height });
    }, [onCommit, scale, el.height, el.fontSize]);

    useImperativeHandle(ref, () => ({ commit: doCommit }), [doCommit]);

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

    const tBr = resolveBookElementBorderRadius(el);
    const tOw = resolveBookElementOutlineWidth(el);
    const tOc = resolveBookElementOutlineColor(el);
    const outlineShadow =
      tOw > 0 ? `0 0 0 ${Math.max(0.5, tOw * scale)}px ${tOc}` : undefined;
    const pad = inlineEditPadColors(el.fill);

    useLayoutEffect(() => {
      const node = editorRef.current;
      if (!node) return;
      node.innerHTML = snapshotHtmlRef.current;
      node.focus();
      try {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        /* ignore */
      }
    }, []);

    useLayoutEffect(() => {
      if (!onReportLogicalHeight) return;
      const node = editorRef.current;
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
    }, [scale, onReportLogicalHeight, fw, fh, liveFrame, el.verticalAlign]);

    const cellVerticalAlign: "top" | "middle" | "bottom" =
      el.verticalAlign === "middle" || el.verticalAlign === "bottom" ? el.verticalAlign : "top";

    return (
      <div
        className="pointer-events-auto absolute z-[25] overflow-visible"
        style={{
          left: fx * scale,
          top: fy * scale,
          width: fw * scale,
          minHeight: fh * scale,
          opacity: o,
          transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
          transformOrigin: "center center",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "table",
            width: "100%",
            minHeight: fh * scale,
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
              ref={editorRef}
              role="textbox"
              tabIndex={-1}
              aria-multiline
              aria-label="슬라이드 텍스트 편집"
              contentEditable
              suppressContentEditableWarning
              className={cn(
                "book-text-widget-content max-h-[min(70vh,4000px)] min-h-[1.5em] w-full max-w-full cursor-text overflow-auto rounded-sm border-2 px-1.5 py-1 shadow-xl outline-none ring-2 ring-primary/35",
                "[&_blockquote]:border-s-2 [&_blockquote]:border-border/80 [&_blockquote]:ps-2 [&_blockquote]:italic",
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
              style={{
                fontSize: el.fontSize * scale,
                backgroundColor: pad.backgroundColor,
                color: pad.color,
                borderColor: pad.borderColor,
                lineHeight: 1.35,
                borderRadius: Math.max(0, tBr * scale),
                boxShadow: outlineShadow
                  ? `${outlineShadow}, 0 10px 40px rgba(0,0,0,0.18)`
                  : "0 10px 40px rgba(0,0,0,0.18)",
                caretColor: pad.color,
              }}
              onBlur={() => {
                if (escapeCancelRef.current) {
                  escapeCancelRef.current = false;
                  return;
                }
                doCommit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  escapeCancelRef.current = true;
                  const node = editorRef.current;
                  if (node) node.innerHTML = snapshotHtmlRef.current;
                  didCommitRef.current = true;
                  onCancel();
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  },
);
