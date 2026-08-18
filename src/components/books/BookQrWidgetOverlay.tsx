import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  parseBookQrValue,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type Props = {
  el: Extract<BookCanvasElement, { type: "qr" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

export function BookQrWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
}: Props) {
  const value = parseBookQrValue(el.qrValue);

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

  const hintPx = Math.max(10 * scale, fh * scale * 0.05);
  const hintIconPx = Math.max(16 * scale, fh * scale * 0.14);

  // QR은 정사각형 유지 — 프레임이 정사각형이 아니어도 짧은 변에 맞춰 여백을 둠
  const pad = Math.max(6, Math.min(fw, fh) * 0.08);
  const qrLogical = Math.max(1, Math.min(fw, fh) - pad * 2);
  const qrPx = qrLogical * scale;

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
      {value ? (
        <div className="flex size-full items-center justify-center bg-white">
          <QRCodeSVG
            value={value}
            size={qrPx}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
      ) : (
        <div
          className="flex size-full flex-col items-center justify-center bg-slate-100 px-3 text-center text-slate-500"
          style={{ gap: Math.max(8, scale * 6), fontSize: hintPx }}
        >
          <QrCode
            aria-hidden
            style={{ width: hintIconPx, height: hintIconPx }}
            className="opacity-70"
          />
          <p>속성 창에서 QR 값을 입력하세요.</p>
        </div>
      )}
    </div>
  );
}
