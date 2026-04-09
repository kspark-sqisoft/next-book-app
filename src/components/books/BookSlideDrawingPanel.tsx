import { Pencil } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#0f172a",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
];

export function BookSlideDrawingPanel({
  strokeColor,
  strokeWidth,
  onStrokeColorChange,
  onStrokeWidthChange,
  className,
}: {
  strokeColor: string;
  strokeWidth: number;
  onStrokeColorChange: (c: string) => void;
  onStrokeWidthChange: (w: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(bookDockedPanelRootClass(), className)}
      role="region"
      aria-label="자유 그리기"
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <Pencil className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>드로잉</span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
        <p className="rounded-md border border-border/50 bg-muted/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          이 탭이 선택된 상태에서 슬라이드 위를 드래그하면 선이 그어집니다. 다른
          탭으로 바꾸면 선택·이동 모드로 돌아갑니다.
        </p>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">색</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                className={cn(
                  "size-8 rounded-md border-2 shadow-sm transition-transform hover:scale-105",
                  strokeColor === c
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border",
                )}
                style={{ backgroundColor: c }}
                onClick={() => onStrokeColorChange(c)}
              />
            ))}
          </div>
          <input
            type="color"
            value={
              strokeColor.startsWith("#") && strokeColor.length >= 7
                ? strokeColor.slice(0, 7)
                : "#000000"
            }
            onChange={(e) => onStrokeColorChange(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
            aria-label="선 색 직접 선택"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draw-width" className="text-xs text-muted-foreground">
            굵기 ({strokeWidth}px)
          </Label>
          <input
            id="draw-width"
            type="range"
            min={2}
            max={24}
            step={1}
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
