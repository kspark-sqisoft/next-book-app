import { useEffect, useMemo, useState } from "react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  bookWidgetBackdropChromeStyle,
  parseBookClockBackground,
  parseBookWidgetTextColor,
  resolveBookDigitalClockDisplay,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "digitalClock" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

function useClockNow(showSeconds: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const ms = showSeconds ? 1000 : 60_000;
    const tick = () => setNow(new Date());
    const t = setInterval(tick, ms);
    return () => clearInterval(t);
  }, [showSeconds]);
  return now;
}

export function BookDigitalClockWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const disp = resolveBookDigitalClockDisplay(el.clockDisplay);
  const now = useClockNow(disp.seconds);

  const timeStr = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      ...(disp.seconds ? { second: "2-digit" } : {}),
      hour12: disp.hour12,
    };
    return now.toLocaleTimeString("ko-KR", opts);
  }, [now, disp.seconds, disp.hour12]);

  const dateStr = useMemo(
    () =>
      now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    [now],
  );

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

  const timeSize = Math.max(14 * scale, fh * 0.42 * scale);
  const dateSize = Math.max(9 * scale, fh * 0.14 * scale);

  const customBg = parseBookClockBackground(el.clockBackground);
  const customText = parseBookWidgetTextColor(el.clockTextColor);
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
  const bgShadow = !customBg
    ? "0 12px 40px -8px rgba(0,0,0,0.45)"
    : customBg && backdropChrome && backdropChrome.boxShadow !== "none"
      ? backdropChrome.boxShadow
      : "";
  const mergedShadow = [bgShadow, outlineRing].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        !customBg &&
          mode === "edit" &&
          "border border-white/10 bg-linear-to-br from-slate-900 via-slate-800 to-slate-950",
        !customBg &&
          mode === "view" &&
          "bg-linear-to-br from-slate-900 via-slate-800 to-slate-950",
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
              backgroundImage: "none",
              border: backdropChrome?.border,
            }
          : {}),
        boxShadow: mergedShadow || undefined,
      }}
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col items-center justify-center text-center",
          !customText && "text-white",
        )}
        style={{
          gap: Math.max(2 * scale, 4),
          paddingLeft: Math.max(6 * scale, 8),
          paddingRight: Math.max(6 * scale, 8),
          paddingTop: Math.max(3 * scale, 4),
          paddingBottom: Math.max(3 * scale, 4),
          ...(customText ? { color: customText } : {}),
        }}
      >
        <div
          className={cn(
            "font-mono font-semibold tabular-nums tracking-tight drop-shadow-sm",
            !customText && "text-white",
          )}
          style={{ fontSize: timeSize, lineHeight: 1.05 }}
        >
          {timeStr}
        </div>
        {disp.date ? (
          <div
            className={cn("tabular-nums", !customText && "text-white/80")}
            style={{
              fontSize: dateSize,
              lineHeight: 1.2,
              ...(customText ? { opacity: 0.88 } : {}),
            }}
          >
            {dateStr}
          </div>
        ) : null}
      </div>
    </div>
  );
}
