import { MapPin } from "lucide-react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  buildBookOsmEmbedUrl,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/features/book/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "map" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

export function BookMapWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const url = buildBookOsmEmbedUrl(el);

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

  const hintPx = Math.max(10 * scale, fh * scale * 0.032);
  const hintIconPx = Math.max(14 * scale, fh * scale * 0.055);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden bg-white",
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
        boxShadow: outlineRing || undefined,
      }}
    >
      {url ? (
        <iframe
          /* 좌표가 바뀌면 강제 재로드 */
          key={`${el.id}:${url}`}
          title="지도 위젯"
          src={url}
          /* 논리 픽셀 크기로 렌더 후 확대/축소 — 줌과 무관하게 같은 레이아웃 유지 */
          className={cn(
            "absolute left-0 top-0 border-0 bg-white",
            mode === "view" ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            width: fw,
            height: fh,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          sandbox="allow-scripts allow-popups"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <div
          className="flex size-full flex-col items-center justify-center bg-slate-900 px-3 text-center text-slate-400"
          style={{ gap: Math.max(8, scale * 6), fontSize: hintPx }}
        >
          <MapPin
            aria-hidden
            style={{ width: hintIconPx, height: hintIconPx }}
            className="opacity-80"
          />
          <p>속성 창에서 지도에 표시할 주소·지역을 입력하세요.</p>
        </div>
      )}
    </div>
  );
}
