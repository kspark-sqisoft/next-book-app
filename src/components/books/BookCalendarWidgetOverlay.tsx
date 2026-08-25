import { useEffect, useMemo, useState } from "react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  bookReadabilityContainerStyle,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementReadability,
  resolveBookElementRotation,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "calendar" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 자정에 한 번 갱신 — 날이 바뀌면 오늘 강조도 이동 */
function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1,
    );
    const t = setTimeout(
      () => setToday(new Date()),
      Math.max(1000, nextMidnight.getTime() - now.getTime()),
    );
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

export function BookCalendarWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const today = useToday();

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

  const brPx = Math.max(0, resolveBookElementBorderRadius(el) * scale);
  const ow = resolveBookElementOutlineWidth(el);
  const oc = resolveBookElementOutlineColor(el);
  const outlineRing =
    mode === "edit" && ow > 0
      ? `0 0 0 ${Math.max(0.5, ow * scale)}px ${oc}`
      : "";

  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [year, month]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden bg-white",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      data-book-readability={resolveBookElementReadability(el) ?? undefined}
      style={{
        left: fx * scale,
        ...bookReadabilityContainerStyle(resolveBookElementReadability(el)),
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: brPx,
        boxShadow: outlineRing || undefined,
      }}
    >
      {/* 논리 픽셀 크기로 렌더 후 확대/축소 — 줌과 무관하게 같은 레이아웃 유지 */}
      <div
        className="absolute left-0 top-0 flex flex-col bg-white text-slate-800"
        style={{
          width: fw,
          height: fh,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          padding: Math.max(8, fh * 0.05),
        }}
      >
        <div
          className="text-center font-bold tracking-tight text-slate-900"
          style={{ fontSize: Math.max(14, fh * 0.08), lineHeight: 1.1 }}
        >
          {`${year}년 ${month + 1}월`}
        </div>
        <div
          className="mt-1 grid grid-cols-7 text-center font-medium"
          style={{ fontSize: Math.max(9, fh * 0.045) }}
        >
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                i === 0 && "text-rose-400",
                i === 6 && "text-sky-400",
                i !== 0 && i !== 6 && "text-slate-400",
              )}
            >
              {d}
            </div>
          ))}
        </div>
        <div
          className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-[2px] text-center"
          style={{ fontSize: Math.max(9, fh * 0.045) }}
        >
          {cells.map((d, i) => {
            const isToday = d === todayDate;
            const dow = i % 7;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center rounded-full",
                  d == null && "opacity-0",
                  isToday && "bg-[#2563eb] font-bold text-white",
                  !isToday && dow === 0 && "text-rose-500",
                  !isToday && dow === 6 && "text-sky-600",
                )}
                style={{
                  aspectRatio: "1 / 1",
                  margin: "0 auto",
                  width: "min(100%, 2em)",
                }}
              >
                {d ?? ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
