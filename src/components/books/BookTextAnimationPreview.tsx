import { Play } from "lucide-react";
import { useState } from "react";

import { BookTextAnimatedContent } from "@/components/books/BookTextAnimatedContent";
import { BOOK_TEXT_WIDGET_CONTENT_CLASS } from "@/components/books/BookTextWidgetOverlay";
import { Button } from "@/components/ui/button";
import type { BookTextAnimationId } from "@/features/book/book-text-animation";
import { cn } from "@/lib/utils";

const PREVIEW_HEIGHT_PX = 96;

type Props = {
  /** 살균된 리치 HTML */
  html: string;
  animation: Exclude<BookTextAnimationId, "none">;
  durationSec: number;
  /** 기본 글자색(hex) */
  fill: string;
  verticalAlign?: "top" | "middle" | "bottom";
};

/**
 * 인스펙터용 소형 애니메이션 미리보기 — 캔버스에서도 재생되지만 여기서는 언제든 처음부터 다시 볼 수 있습니다.
 * 효과·시간이 바뀌면 자동으로 다시 재생, 버튼으로 수동 재생.
 * (본문 입력 중에는 재생을 반복하지 않도록 html은 재생 키에서 제외)
 */
export function BookTextAnimationPreview({
  html,
  animation,
  durationSec,
  fill,
  verticalAlign = "top",
}: Props) {
  const [replay, setReplay] = useState(0);
  const playKey = `${animation}|${durationSec}|${replay}`;
  const isScrolling = animation === "marquee" || animation === "scrollUp";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">미리보기</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setReplay((n) => n + 1)}
        >
          <Play className="size-3" aria-hidden />
          다시 재생
        </Button>
      </div>
      <div
        className="relative overflow-hidden rounded-md border border-border bg-white px-2 py-1"
        style={{
          height: PREVIEW_HEIGHT_PX,
          fontSize: 14,
          lineHeight: 1.35,
          color: fill?.startsWith("#") ? fill : "#111827",
        }}
      >
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden",
            verticalAlign === "middle"
              ? "justify-center"
              : verticalAlign === "bottom"
                ? "justify-end"
                : "justify-start",
          )}
        >
          <BookTextAnimatedContent
            key={playKey}
            testId="book-text-animation-preview"
            html={html}
            animation={animation}
            durationSec={durationSec}
            contentClassName={cn(
              "min-h-0 select-none",
              !isScrolling && "max-h-full overflow-hidden",
              BOOK_TEXT_WIDGET_CONTENT_CLASS,
            )}
            scrollGapPx={PREVIEW_HEIGHT_PX}
          />
        </div>
      </div>
    </div>
  );
}
