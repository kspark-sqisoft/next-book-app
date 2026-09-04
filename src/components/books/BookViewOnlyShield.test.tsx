// 보기 전용 방패 — 가로 스와이프로 페이지 이동, 짧거나 세로 위주 제스처는 무시
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BookViewOnlyShield,
  stepPageIndex,
} from "@/components/books/BookViewOnlyShield";

afterEach(() => cleanup());

function swipe(el: Element, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(el, {
    pointerId: 1,
    clientX: from[0],
    clientY: from[1],
  });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

describe("BookViewOnlyShield 스와이프", () => {
  it("왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<BookViewOnlyShield onSwipe={onSwipe} />);
    const shield = getByTestId("book-view-only-shield");
    swipe(shield, [200, 100], [100, 110]);
    expect(onSwipe).toHaveBeenLastCalledWith("next");
    swipe(shield, [100, 100], [220, 90]);
    expect(onSwipe).toHaveBeenLastCalledWith("prev");
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it("짧은 이동·세로 위주 이동·취소된 포인터는 무시한다", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<BookViewOnlyShield onSwipe={onSwipe} />);
    const shield = getByTestId("book-view-only-shield");
    swipe(shield, [200, 100], [170, 100]);
    swipe(shield, [200, 100], [120, 300]);
    fireEvent.pointerDown(shield, { pointerId: 2, clientX: 200, clientY: 0 });
    fireEvent.pointerCancel(shield, { pointerId: 2 });
    fireEvent.pointerUp(shield, { pointerId: 2, clientX: 0, clientY: 0 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("onSwipe 없이도 방패로만 동작한다(휠·핀치는 부모로 버블링)", () => {
    const { getByTestId } = render(<BookViewOnlyShield />);
    const shield = getByTestId("book-view-only-shield");
    expect(() => swipe(shield, [200, 100], [0, 100])).not.toThrow();
    expect(shield.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("stepPageIndex", () => {
  it("양 끝에서 멈춘다", () => {
    expect(stepPageIndex("next", 3)(0)).toBe(1);
    expect(stepPageIndex("next", 3)(2)).toBe(2);
    expect(stepPageIndex("prev", 3)(2)).toBe(1);
    expect(stepPageIndex("prev", 3)(0)).toBe(0);
  });
});
