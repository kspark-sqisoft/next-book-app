import { useEffect, useRef, useState } from "react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  bookWidgetBackdropChromeStyle,
  parseBookClockBackground,
  parseBookWidgetTextColor,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveBookTickerSpeedPxPerSec,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "ticker" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

export function BookTickerWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const text = el.tickerText?.trim() || "티커 문구를 속성 창에서 입력하세요.";
  const speedLogical = resolveBookTickerSpeedPxPerSec(el);
  const direction = el.tickerDirection === "right" ? "right" : "left";

  const w = el.width;
  const h = el.height;
  const o = resolveBookElementOpacity(el.opacity);
  const rot = resolveBookElementRotation(el.rotation);
  const pivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const layoutOrigin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? layoutOrigin.x;
  const fy = liveFrame?.y ?? layoutOrigin.y;
  const fw = liveFrame?.width ?? w;
  const fh = liveFrame?.height ?? h;
  const fRot = liveFrame != null ? liveFrame.rotation : rot;

  const fontLogical =
    typeof el.tickerFontSize === "number" &&
    Number.isFinite(el.tickerFontSize) &&
    el.tickerFontSize >= 10
      ? Math.min(200, el.tickerFontSize)
      : Math.max(12, fh * 0.55);
  const fontPx = Math.max(8, fontLogical * scale);
  /** 반복 사이 간격 — 글자 크기에 비례 */
  const gapPx = Math.max(24, fontPx * 2);

  /** 한 사이클(문구 1개 + 간격) 실측 폭 → 속도에 맞는 애니메이션 시간.
      ResizeObserver는 observe 직후 초기 알림을 주므로 문구·글자 크기 변경도 자동 반영 */
  const cycleRef = useRef<HTMLSpanElement>(null);
  const [cycleWidthPx, setCycleWidthPx] = useState(0);
  useEffect(() => {
    const node = cycleRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      const w = node.offsetWidth;
      setCycleWidthPx((prev) => (prev === w ? prev : w));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const speedPx = Math.max(1, speedLogical * scale);
  const durationSec = cycleWidthPx > 0 ? cycleWidthPx / speedPx : 0;

  const customBg = parseBookClockBackground(el.tickerBackground);
  const customText = parseBookWidgetTextColor(el.tickerTextColor);
  const backdropChrome = customBg
    ? bookWidgetBackdropChromeStyle(customBg)
    : null;
  const brPx = Math.max(0, resolveBookElementBorderRadius(el) * scale);
  const ow = resolveBookElementOutlineWidth(el);
  const oc = resolveBookElementOutlineColor(el);
  const outlineRing =
    mode === "edit" && ow > 0
      ? `0 0 0 ${Math.max(0.5, ow * scale)}px ${oc}`
      : "";
  const bgShadow = !customBg ? "0 8px 24px -10px rgba(0,0,0,0.45)" : "";
  const mergedShadow = [bgShadow, outlineRing].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        !customBg && "bg-linear-to-r from-slate-950 via-slate-900 to-slate-950",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: fx * scale,
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: brPx,
        ...(customBg
          ? {
              background: customBg,
              border: backdropChrome?.border,
            }
          : {}),
        boxShadow: mergedShadow || undefined,
      }}
    >
      <div className="flex h-full items-center overflow-hidden">
        <div
          className="flex w-max items-center whitespace-nowrap will-change-transform"
          style={{
            animation:
              durationSec > 0
                ? `book-ticker-marquee ${durationSec}s linear infinite`
                : undefined,
            animationDirection: direction === "right" ? "reverse" : undefined,
          }}
        >
          {/* 같은 문구 2벌 — -50% 이동이 정확히 한 사이클이 되도록 */}
          <span
            ref={cycleRef}
            className={cn("font-medium", !customText && "text-white")}
            style={{
              fontSize: fontPx,
              lineHeight: 1.1,
              paddingRight: gapPx,
              ...(customText ? { color: customText } : {}),
            }}
          >
            {text}
          </span>
          <span
            aria-hidden
            className={cn("font-medium", !customText && "text-white")}
            style={{
              fontSize: fontPx,
              lineHeight: 1.1,
              paddingRight: gapPx,
              ...(customText ? { color: customText } : {}),
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}
