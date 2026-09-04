"use client";

import { useRef } from "react";

/** 이 거리보다 짧게 밀면 탭·흔들림으로 보고 무시한다 */
const SWIPE_MIN_PX = 50;

export type BookPageSwipeDirection = "prev" | "next";

/** 좌우 이동을 페이지 수 안으로 클램프하는 갱신 함수 — 배지 버튼과 스와이프가 같은 규칙을 쓴다 */
export function stepPageIndex(
  dir: BookPageSwipeDirection,
  pageCount: number,
): (i: number) => number {
  return (i) =>
    dir === "next" ? Math.min(pageCount - 1, i + 1) : Math.max(0, i - 1);
}

/**
 * 모바일 보기 전용 방패 — 캔버스 위젯(동영상 컨트롤 등)까지 눌리지 않게 투명하게 덮는다.
 *
 * 소유자 뷰(`BookEditorCanvasStage`)와 게스트 뷰(`BookDetailGuestBookView`)에 글자 그대로
 * 같은 `div` 가 있었다. 한 곳에 모으면서 가로 스와이프로 페이지를 넘기는 동작을 얹는다.
 *
 * - 휠·핀치 줌은 여기서 막지 않고 부모(canvasWrap) 핸들러로 그대로 버블링된다.
 * - `touch-action: pan-y pinch-zoom` — 세로 스크롤·핀치는 브라우저에 맡기고 가로 이동만
 *   포인터 이벤트로 받는다(전부 막으면 페이지 스크롤이, 전부 허용하면 가로 제스처가
 *   `pointercancel` 로 끊긴다).
 * - 페이지 이동 배지는 이 방패보다 위(`z-[60]`)에 있어야 눌린다.
 */
export function BookViewOnlyShield({
  onSwipe,
}: {
  onSwipe?: (dir: BookPageSwipeDirection) => void;
}) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="absolute inset-0 z-50"
      style={{ touchAction: "pan-y pinch-zoom" }}
      aria-hidden
      data-testid="book-view-only-shield"
      onPointerDown={(e) => {
        if (!onSwipe) return;
        start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        // 손가락이 방패 밖으로 나가도 pointerup 을 여기서 받는다(jsdom 은 미구현)
        const el = e.currentTarget;
        if (typeof el.setPointerCapture === "function") {
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* 이미 떼어진 포인터 등 — 캡처 실패는 무시 */
          }
        }
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s || !onSwipe || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
        onSwipe(dx < 0 ? "next" : "prev");
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}
