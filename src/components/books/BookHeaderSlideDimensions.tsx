import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BookHeaderSlideDimensionsProps = {
  slideWidth: number;
  slideHeight: number;
  onChangeSlideWidth: (w: number) => void;
  onChangeSlideHeight: (h: number) => void;
};

const DIM_MIN = 100;
const DIM_MAX = 4000;

function clampDim(n: number): number {
  return Math.min(DIM_MAX, Math.max(DIM_MIN, n));
}

/**
 * 북 워크스페이스 헤더(제목 옆)에 두는 공통 슬라이드 캔버스 크기(px).
 */
export function BookHeaderSlideDimensions({
  slideWidth,
  slideHeight,
  onChangeSlideWidth,
  onChangeSlideHeight,
}: BookHeaderSlideDimensionsProps) {
  const [wEdit, setWEdit] = useState<string | null>(null);
  const [hEdit, setHEdit] = useState<string | null>(null);

  const wShown = wEdit !== null ? wEdit : String(slideWidth);
  const hShown = hEdit !== null ? hEdit : String(slideHeight);

  const commitWidth = () => {
    const raw = (wEdit ?? String(slideWidth)).trim();
    setWEdit(null);
    if (raw === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChangeSlideWidth(clampDim(n));
  };

  const commitHeight = () => {
    const raw = (hEdit ?? String(slideHeight)).trim();
    setHEdit(null);
    if (raw === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChangeSlideHeight(clampDim(n));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-l border-border/70 pl-2 sm:gap-x-3 sm:pl-3"
      title={`슬라이드 캔버스 크기(px). ${DIM_MIN}~${DIM_MAX}. 입력 후 Enter 또는 포커스 이동.`}
    >
      <span className="text-[11px] font-semibold tracking-tight text-foreground/80 sm:text-xs">
        캔버스
      </span>
      <div className="flex items-center gap-1.5">
        <Label htmlFor="book-hdr-slide-w" className="sr-only">
          너비 픽셀
        </Label>
        <span
          className="text-muted-foreground tabular-nums text-xs"
          aria-hidden
        >
          W
        </span>
        <Input
          id="book-hdr-slide-w"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="h-7 w-16 px-1.5 text-[11px] tabular-nums sm:w-[4.25rem] sm:text-xs"
          value={wShown}
          onFocus={() => setWEdit(String(slideWidth))}
          onChange={(e) => setWEdit(e.target.value.replace(/\D/g, ""))}
          onBlur={commitWidth}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label htmlFor="book-hdr-slide-h" className="sr-only">
          높이 픽셀
        </Label>
        <span
          className="text-muted-foreground tabular-nums text-xs"
          aria-hidden
        >
          H
        </span>
        <Input
          id="book-hdr-slide-h"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="h-7 w-16 px-1.5 text-[11px] tabular-nums sm:w-[4.25rem] sm:text-xs"
          value={hShown}
          onFocus={() => setHEdit(String(slideHeight))}
          onChange={(e) => setHEdit(e.target.value.replace(/\D/g, ""))}
          onBlur={commitHeight}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}
