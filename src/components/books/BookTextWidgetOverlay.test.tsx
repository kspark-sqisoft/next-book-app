// 텍스트 위젯 오버레이 — 애니메이션은 보기 모드에서만, 마키·세로 스크롤은 클리핑 컨테이너 경로
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BookTextWidgetOverlay } from "@/components/books/BookTextWidgetOverlay";
import type { BookCanvasElement } from "@/features/book/book-canvas";

const textEl = (
  over: Partial<Extract<BookCanvasElement, { type: "text" }>> = {},
): Extract<BookCanvasElement, { type: "text" }> => ({
  id: "t1",
  type: "text",
  x: 10,
  y: 10,
  text: "안녕 hello",
  richHtml: "<p>안녕 <strong>hello</strong></p>",
  fontSize: 24,
  fill: "#111827",
  width: 400,
  height: 120,
  ...over,
});

afterEach(() => cleanup());

describe("BookTextWidgetOverlay 애니메이션", () => {
  it("효과가 없으면 정적 본문만 렌더한다", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl()}
        scale={1}
        mode="view"
        isSelected={false}
      />,
    );
    expect(container.querySelector(".book-ta")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("hello");
  });

  it("편집 모드에서도 효과가 재생된다(캔버스에서 바로 확인)", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "typewriter" })}
        scale={1}
        mode="edit"
        isSelected={false}
      />,
    );
    expect(container.querySelector(".book-ta--typewriter")).not.toBeNull();
    expect(container.querySelectorAll(".bta-u").length).toBeGreaterThan(0);
  });

  it("편집 모드 + 마키: 트랙이 박스보다 커도 높이 자동 확장을 보고하지 않는다", () => {
    const reported: number[] = [];
    render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "marquee" })}
        scale={1}
        mode="edit"
        isSelected={false}
        onReportLogicalHeight={(n) => reported.push(n)}
      />,
    );
    expect(reported).toHaveLength(0);
  });

  it("편집 모드에서 위젯을 다시 선택하면 처음부터 다시 재생한다(remount)", () => {
    const { container, rerender } = render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "fadeIn" })}
        scale={1}
        mode="edit"
        isSelected={false}
      />,
    );
    const before = container.querySelector(".book-ta");
    rerender(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "fadeIn" })}
        scale={1}
        mode="edit"
        isSelected
      />,
    );
    const after = container.querySelector(".book-ta");
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  it("보기 모드 + 글자 효과: 텍스트 노드가 글자 span으로 분할되고 서식은 유지된다", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl({
          textAnimation: "typewriter",
          textAnimationDurationSec: 2,
        })}
        scale={1}
        mode="view"
        isSelected={false}
      />,
    );
    const root = container.querySelector(".book-ta") as HTMLElement;
    expect(root.classList.contains("book-ta--typewriter")).toBe(true);
    expect(root.style.getPropertyValue("--bta-dur")).toBe("2s");
    expect(root.querySelectorAll(".bta-u")).toHaveLength(7);
    expect(root.querySelector("strong .bta-u")?.textContent).toBe("h");
  });

  it("보기 모드 + 블록 효과: 클래스와 시간 변수만 붙는다", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "fadeIn" })}
        scale={1}
        mode="view"
        isSelected={false}
      />,
    );
    const root = container.querySelector(".book-ta--fadeIn") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue("--bta-dur")).toBe("0.8s");
    expect(root.querySelector(".bta-u")).toBeNull();
  });

  it("애니메이션 중 본문 박스는 스크롤바가 생기지 않게 overflow-hidden", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "charPop" })}
        scale={1}
        mode="view"
        isSelected={false}
      />,
    );
    const root = container.querySelector(".book-ta--charPop") as HTMLElement;
    expect(root.classList.contains("overflow-hidden")).toBe(true);
    expect(root.classList.contains("overflow-y-auto")).toBe(false);
  });

  it("보기 모드 + 세로 스크롤: 내용 2벌 트랙과 박스 높이 간격", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "scrollUp", height: 200 })}
        scale={0.5}
        mode="view"
        isSelected={false}
      />,
    );
    const root = container.querySelector(".book-ta--scrollUp") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.querySelectorAll(".bta-copy")).toHaveLength(2);
    // 간격 = 박스 높이 × 스케일
    expect(root.style.getPropertyValue("--bta-gap")).toBe("100px");
    expect(root.style.getPropertyValue("--bta-dur")).toBe("12s");
  });

  it("보기 모드 + 마키: 세로 정렬(middle)이 클리핑 컨테이너에 반영된다", () => {
    const { container } = render(
      <BookTextWidgetOverlay
        el={textEl({ textAnimation: "marquee", verticalAlign: "middle" })}
        scale={1}
        mode="view"
        isSelected={false}
      />,
    );
    const root = container.querySelector(".book-ta--marquee") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.parentElement?.classList.contains("justify-center")).toBe(true);
  });
});
