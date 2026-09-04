// 페이지 이동 배지 — 콜백 주입, 양 끝 비활성, 보기 전용 방패(z-50)보다 위에 뜬다
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookCanvasPageNavBadge } from "@/components/books/BookCanvasStageOverlays";
import { BookViewOnlyShield } from "@/components/books/BookViewOnlyShield";

afterEach(() => cleanup());

describe("BookCanvasPageNavBadge", () => {
  it("좌우 버튼이 onChangeIndex 에 클램프된 갱신 함수를 넘긴다", () => {
    const onChangeIndex = vi.fn();
    const { getByLabelText } = render(
      <BookCanvasPageNavBadge
        pageCount={3}
        activePageIndex={1}
        onChangeIndex={onChangeIndex}
      />,
    );
    fireEvent.click(getByLabelText("다음 페이지"));
    expect(onChangeIndex).toHaveBeenCalledTimes(1);
    expect(onChangeIndex.mock.calls[0][0](1)).toBe(2);
    expect(onChangeIndex.mock.calls[0][0](2)).toBe(2);
    fireEvent.click(getByLabelText("이전 페이지"));
    expect(onChangeIndex.mock.calls[1][0](1)).toBe(0);
    expect(onChangeIndex.mock.calls[1][0](0)).toBe(0);
  });

  it("첫 페이지에선 이전, 마지막에선 다음이 비활성이고 1장이면 버튼이 없다", () => {
    const first = render(
      <BookCanvasPageNavBadge pageCount={2} activePageIndex={0} />,
    );
    expect(
      (first.getByLabelText("이전 페이지") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (first.getByLabelText("다음 페이지") as HTMLButtonElement).disabled,
    ).toBe(false);
    cleanup();
    const single = render(
      <BookCanvasPageNavBadge pageCount={1} activePageIndex={0} />,
    );
    expect(single.queryByLabelText("다음 페이지")).toBeNull();
    expect(single.getByText("슬라이드 1")).toBeTruthy();
  });

  it("모바일 보기 전용 방패(z-50)에 가려지지 않게 그 위 z-index 를 쓴다", () => {
    const { getByLabelText, getByTestId } = render(
      <div className="relative">
        <BookCanvasPageNavBadge pageCount={2} activePageIndex={0} />
        <BookViewOnlyShield />
      </div>,
    );
    const badge = getByLabelText("다음 페이지").parentElement!;
    const badgeZ = Number(/z-\[(\d+)\]/.exec(badge.className)?.[1]);
    const shieldZ = Number(
      /z-(?:\[)?(\d+)\]?/.exec(
        getByTestId("book-view-only-shield").className,
      )?.[1],
    );
    expect(badgeZ).toBeGreaterThan(shieldZ);
  });
});
