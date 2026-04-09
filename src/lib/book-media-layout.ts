import type { BookMediaObjectFit } from "@/lib/book-canvas";
import { resolveBookMediaObjectFit } from "@/lib/book-canvas";

export type KonvaFittedImageLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  crop?: { x: number; y: number; width: number; height: number };
};

/**
 * 위젯 박스(el.width × el.height) 안에서 미디어를 그리기 위한 Konva.Image 속성.
 */
export function computeKonvaFittedImageLayout(
  fitRaw: BookMediaObjectFit | undefined,
  boxW: number,
  boxH: number,
  natW: number,
  natH: number,
): KonvaFittedImageLayout {
  const fit = resolveBookMediaObjectFit(fitRaw);
  const bw = Math.max(1, boxW);
  const bh = Math.max(1, boxH);
  if (!natW || !natH) {
    return { x: 0, y: 0, width: bw, height: bh };
  }

  if (fit === "fill") {
    return { x: 0, y: 0, width: bw, height: bh };
  }

  if (fit === "none") {
    const dw = Math.min(natW, bw);
    const dh = Math.min(natH, bh);
    return {
      x: 0,
      y: 0,
      width: dw,
      height: dh,
      crop: { x: 0, y: 0, width: dw, height: dh },
    };
  }

  if (fit === "cover") {
    const scale = Math.max(bw / natW, bh / natH);
    const sliceW = bw / scale;
    const sliceH = bh / scale;
    const cx = Math.max(0, (natW - sliceW) / 2);
    const cy = Math.max(0, (natH - sliceH) / 2);
    return {
      x: 0,
      y: 0,
      width: bw,
      height: bh,
      crop: { x: cx, y: cy, width: sliceW, height: sliceH },
    };
  }

  let scale = Math.min(bw / natW, bh / natH);
  if (fit === "scale-down") scale = Math.min(1, scale);
  const w = natW * scale;
  const h = natH * scale;
  const x = (bw - w) / 2;
  const y = (bh - h) / 2;
  return {
    x,
    y,
    width: w,
    height: h,
  };
}

/** `<video>` / Tailwind `object-*` */
export function mediaObjectFitToCssClass(fitRaw: BookMediaObjectFit | undefined): string {
  const fit = resolveBookMediaObjectFit(fitRaw);
  switch (fit) {
    case "contain":
      return "object-contain";
    case "fill":
      return "object-fill";
    case "none":
      return "object-none";
    case "scale-down":
      return "object-scale-down";
    default:
      return "object-cover";
  }
}
