import { type CSSProperties, type Ref, useMemo } from "react";

import {
  BOOK_TEXT_ANIMATION_META,
  type BookTextAnimationId,
  buildAnimatedTextHtml,
  textAnimationCssVars,
} from "@/lib/book-text-animation";
import { cn } from "@/lib/utils";

type Props = {
  /** 살균된 리치 HTML(`getTextWidgetDisplayHtml`) */
  html: string;
  /** `none`은 호출부에서 걸러 주세요(정적 렌더는 기존 경로 사용). */
  animation: Exclude<BookTextAnimationId, "none">;
  durationSec: number;
  /** 본문 타이포그래피 클래스(오버레이·미리보기 공통) */
  contentClassName?: string;
  /** 세로 스크롤 반복 사이 빈 간격(px) — 보통 박스 높이 */
  scrollGapPx?: number;
  style?: CSSProperties;
  /** 루트 div 참조(편집 캔버스 높이 측정용) */
  ref?: Ref<HTMLDivElement>;
  /** 테스트·E2E 식별자(`data-testid`) */
  testId?: string;
};

/**
 * 텍스트 위젯 애니메이션 렌더 — 블록 효과는 클래스만, 글자·단어 효과는 텍스트 노드를 span으로 분할,
 * 마키·세로 스크롤은 내용 2벌 트랙. 마운트 시 재생되므로 다시 재생하려면 `key`를 바꾸세요.
 */
export function BookTextAnimatedContent({
  html,
  animation,
  durationSec,
  contentClassName,
  scrollGapPx,
  style,
  ref,
  testId,
}: Props) {
  const meta = BOOK_TEXT_ANIMATION_META[animation];
  const splitUnit =
    meta.unit === "char" || meta.unit === "word" ? meta.unit : null;

  const split = useMemo(
    () => (splitUnit ? buildAnimatedTextHtml(html, splitUnit) : null),
    [html, splitUnit],
  );

  // 글자·단어가 너무 많아 분할을 포기한 경우 → 블록 페이드로 폴백
  const effective: Exclude<BookTextAnimationId, "none"> =
    split && split.count === 0 ? "fadeIn" : animation;
  const effectiveHtml = split && split.count > 0 ? split.html : html;
  const vars = textAnimationCssVars(
    effective,
    durationSec,
    split?.count ?? 0,
  ) as CSSProperties;

  if (effective === "marquee" || effective === "scrollUp") {
    return (
      <div
        ref={ref}
        data-testid={testId}
        className={cn("book-ta", `book-ta--${effective}`)}
        style={{
          ...vars,
          ...(scrollGapPx != null
            ? ({
                "--bta-gap": `${Math.max(0, scrollGapPx)}px`,
              } as CSSProperties)
            : {}),
          ...style,
        }}
      >
        <div className="bta-track">
          <div
            className={cn("bta-copy", contentClassName)}
            dangerouslySetInnerHTML={{ __html: effectiveHtml }}
          />
          <div
            aria-hidden
            className={cn("bta-copy", contentClassName)}
            dangerouslySetInnerHTML={{ __html: effectiveHtml }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-testid={testId}
      className={cn("book-ta", `book-ta--${effective}`, contentClassName)}
      style={{ ...vars, ...style }}
      dangerouslySetInnerHTML={{ __html: effectiveHtml }}
    />
  );
}
