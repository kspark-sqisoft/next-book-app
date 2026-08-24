import { useLayoutEffect, useRef, useState } from "react";

import { BookTextAnimatedContent } from "@/components/books/BookTextAnimatedContent";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
} from "@/lib/book-canvas";
import { resolveBookTextAnimation } from "@/lib/book-text-animation";
import {
  getTextWidgetDisplayHtml,
  textWidgetHitHeight,
} from "@/lib/book-text-widget";
import { cn } from "@/lib/utils";

/** 드래그·트랜스폼 중 Konva와 동일(논리 좌표: 회전 전 박스 왼쪽 위·크기·도) */
export type BookTextOverlayLiveFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

/** 텍스트 위젯 본문 타이포그래피 — 오버레이·인스펙터 애니메이션 미리보기 공통 */
export const BOOK_TEXT_WIDGET_CONTENT_CLASS = cn(
  "book-text-widget-content [&_blockquote]:border-s-2 [&_blockquote]:border-border/80 [&_blockquote]:ps-2 [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/80 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.85em]",
  "[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:ps-4",
  "[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:ps-4",
  "[&_h2]:mt-1 [&_h2]:mb-0.5 [&_h2]:text-[1.15em] [&_h2]:font-semibold",
  "[&_h3]:mt-1 [&_h3]:mb-0.5 [&_h3]:text-[1.05em] [&_h3]:font-semibold",
  "[&_p]:my-0.5 [&_p]:min-h-[1em]",
  "[&_a]:text-primary [&_a]:underline",
  "[&_hr]:my-2 [&_hr]:border-border",
);

/** E2E·테스트에서 캔버스 오버레이의 애니메이션 루트를 찾는 식별자 */
export const BOOK_TEXT_WIDGET_ANIMATION_TEST_ID = "book-text-widget-animation";

type Props = {
  el: Extract<BookCanvasElement, { type: "text" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  /** Konva `dragLive` / `transformLive`와 맞춤. 없으면 `el`만 사용. */
  liveFrame?: BookTextOverlayLiveFrame | null;
  /** 논리 높이(px) — 콘텐츠에 맞춤(편집 모드). */
  onReportLogicalHeight?: (logicalPx: number) => void;
};

function textWidgetCellVerticalAlign(
  el: Extract<BookCanvasElement, { type: "text" }>,
): "top" | "middle" | "bottom" {
  const v = el.verticalAlign;
  if (v === "middle" || v === "bottom") return v;
  return "top";
}

const CONTENT_BOX_CLASS =
  "max-h-full min-h-0 select-none overflow-x-hidden overflow-y-auto";
/** 애니메이션 중 본문 — 글자 팝(scale 오버슈트)·웨이브 등 transform이 스크롤 영역을 넓혀 스크롤바가 깜빡이지 않도록 hidden */
const ANIMATED_CONTENT_BOX_CLASS =
  "max-h-full min-h-0 select-none overflow-hidden";

/**
 * 편집 캔버스에서 1회 효과를 다시 재생할 계기 — 위젯을 (다시) 선택할 때마다 증가.
 * 효과·시간 변경은 key에 직접 포함되어 별도 처리 없이 재생됩니다.
 */
function useReplayOnSelect(isSelected: boolean): number {
  const [epoch, setEpoch] = useState(0);
  const [prevSelected, setPrevSelected] = useState(isSelected);
  // 렌더 중 prop 변화에 맞춰 상태 조정(React 권장 패턴) — effect 안 setState로 인한 연쇄 렌더 방지
  if (isSelected !== prevSelected) {
    setPrevSelected(isSelected);
    if (isSelected) setEpoch(epoch + 1);
  }
  return epoch;
}

export function BookTextWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
  onReportLogicalHeight,
}: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const html = getTextWidgetDisplayHtml(el);
  const w = el.width ?? 720;
  const h = textWidgetHitHeight(el);
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
  const cellVerticalAlign = textWidgetCellVerticalAlign(el);

  /* 애니메이션은 편집 캔버스·보기 모두 재생. 편집에서는 효과·시간 변경이나 위젯 재선택 시 처음부터 다시 재생 */
  const textAnim = resolveBookTextAnimation(el);
  const animation = textAnim.id !== "none" ? textAnim.id : null;
  const isScrollingAnimation =
    animation === "marquee" || animation === "scrollUp";
  const replayEpoch = useReplayOnSelect(mode === "edit" && isSelected);
  const animationKey = `${textAnim.id}|${textAnim.durationSec}|${replayEpoch}`;

  const tBr = resolveBookElementBorderRadius(el);
  const tOw = resolveBookElementOutlineWidth(el);
  const tOc = resolveBookElementOutlineColor(el);
  const outlineShadow =
    mode === "edit" && tOw > 0
      ? `0 0 0 ${Math.max(0.5, tOw * scale)}px ${tOc}`
      : undefined;

  /* 마키·세로 스크롤은 트랙이 박스보다 커지는 게 정상이므로 높이 자동 확장 측정을 하지 않음 */
  const measureEnabled = mode === "edit" && !isScrollingAnimation;

  useLayoutEffect(() => {
    if (!measureEnabled || !onReportLogicalHeight) return;
    const node = measureRef.current;
    if (!node) return;

    const measure = () => {
      const sh = node.scrollHeight;
      if (sh <= 0) return;
      const logical = sh / scale;
      onReportLogicalHeight(logical);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(node);
    return () => ro.disconnect();
  }, [
    html,
    scale,
    measureEnabled,
    animationKey,
    onReportLogicalHeight,
    w,
    fh,
    liveFrame,
    el.verticalAlign,
  ]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: fx * scale,
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        fontSize: el.fontSize * scale,
        color: el.fill?.startsWith("#") ? el.fill : "#111827",
        lineHeight: 1.35,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: Math.max(0, tBr * scale),
        boxShadow: outlineShadow,
      }}
    >
      {animation && isScrollingAnimation ? (
        /* 마키·세로 스크롤: 트랙이 박스보다 커지므로 테이블 대신 박스를 꽉 채우는 클리핑 컨테이너 */
        <div
          className={cn(
            "absolute inset-0 flex flex-col overflow-hidden",
            animation === "marquee" && cellVerticalAlign === "middle"
              ? "justify-center"
              : animation === "marquee" && cellVerticalAlign === "bottom"
                ? "justify-end"
                : "justify-start",
          )}
        >
          <BookTextAnimatedContent
            key={animationKey}
            testId={BOOK_TEXT_WIDGET_ANIMATION_TEST_ID}
            html={html}
            animation={animation}
            durationSec={textAnim.durationSec}
            contentClassName={cn("select-none", BOOK_TEXT_WIDGET_CONTENT_CLASS)}
            scrollGapPx={fh * scale}
          />
        </div>
      ) : (
        <div
          style={{
            display: "table",
            width: "100%",
            height: "100%",
            tableLayout: "fixed",
          }}
        >
          <div
            style={{
              display: "table-cell",
              verticalAlign: cellVerticalAlign,
              height: "100%",
              width: "100%",
            }}
          >
            {animation ? (
              <BookTextAnimatedContent
                key={animationKey}
                ref={measureRef}
                testId={BOOK_TEXT_WIDGET_ANIMATION_TEST_ID}
                html={html}
                animation={animation}
                durationSec={textAnim.durationSec}
                contentClassName={cn(
                  ANIMATED_CONTENT_BOX_CLASS,
                  BOOK_TEXT_WIDGET_CONTENT_CLASS,
                )}
              />
            ) : (
              <div
                ref={measureRef}
                className={cn(
                  CONTENT_BOX_CLASS,
                  BOOK_TEXT_WIDGET_CONTENT_CLASS,
                )}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
