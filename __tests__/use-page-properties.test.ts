import { act, renderHook } from "@testing-library/react";
import { produce } from "immer";
import { describe, expect, it } from "vitest";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  createEmptyEditorPage,
} from "@/features/book/book-canvas";
import { usePageProperties } from "@/features/book/use-page-properties";

/**
 * `BookDetailPage` 와 `BookEditorPage` 에 같은 복사본으로 있던 슬라이드 속성 편집을
 * 모은 훅이다. 두 화면이 이제 같은 코드를 쓰므로 여기서 깨지면 양쪽이 함께 깨진다.
 */

const el = (id: string) =>
  ({
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  }) as BookCanvasElement;

const pageAt = (i: number, over: Partial<BookEditorPageState> = {}) => ({
  ...createEmptyEditorPage(i),
  ...over,
});

function harness(initial: BookEditorPageState[], activePageIndex = 0) {
  let pages = initial;
  const updatePages = (recipe: (draft: BookEditorPageState[]) => void) => {
    pages = produce(pages, recipe as never) as BookEditorPageState[];
  };
  const mutateActivePage = (recipe: (p: BookEditorPageState) => void) => {
    updatePages((draft) => {
      const p = draft[activePageIndex];
      if (p) recipe(p);
    });
  };
  const view = renderHook(() =>
    usePageProperties({
      activePageIndex,
      pageCount: initial.length,
      updatePages: updatePages as never,
      mutateActivePage: mutateActivePage as never,
    }),
  );
  return {
    view,
    get pages() {
      return pages;
    },
  };
}

describe("usePageProperties", () => {
  it("현재 페이지의 이름·배경·전환만 고친다", () => {
    const h = harness([pageAt(0), pageAt(1)]);
    act(() => h.view.result.current.updateCurrentPageName("표지"));
    act(() => h.view.result.current.updateCurrentPageBackground("#000000"));
    act(() => h.view.result.current.updatePresentationTransition("fade"));
    act(() => h.view.result.current.updatePresentationTransitionMs(700));

    expect(h.pages[0]).toMatchObject({
      name: "표지",
      backgroundColor: "#000000",
      presentationTransition: "fade",
      presentationTransitionMs: 700,
    });
    expect(h.pages[1].name).not.toBe("표지");
  });

  describe("AI 의 슬라이드 제목", () => {
    /** AI 는 1부터 센다 — 0 기반으로 잘못 읽으면 옆 슬라이드 이름이 바뀐다 */
    it("슬라이드 번호는 1부터 센다", () => {
      const h = harness([pageAt(0), pageAt(1), pageAt(2)]);
      act(() =>
        h.view.result.current.applyPageTitleFromAi("둘째", { slideNumber: 2 }),
      );
      expect(h.pages.map((p) => p.name)).toEqual(["", "둘째", ""]);
    });

    it("번호를 주지 않으면 현재 페이지", () => {
      const h = harness([pageAt(0), pageAt(1)], 1);
      act(() => h.view.result.current.applyPageTitleFromAi("현재"));
      expect(h.pages.map((p) => p.name)).toEqual(["", "현재"]);
    });

    it("범위를 벗어난 번호는 양 끝으로 잘린다", () => {
      const h = harness([pageAt(0), pageAt(1)]);
      act(() =>
        h.view.result.current.applyPageTitleFromAi("앞", { slideNumber: -5 }),
      );
      act(() =>
        h.view.result.current.applyPageTitleFromAi("뒤", { slideNumber: 99 }),
      );
      expect(h.pages.map((p) => p.name)).toEqual(["앞", "뒤"]);
    });

    it("숫자가 아닌 번호는 현재 페이지로 본다", () => {
      const h = harness([pageAt(0), pageAt(1)], 0);
      act(() =>
        h.view.result.current.applyPageTitleFromAi("현재", {
          slideNumber: Number.NaN,
        }),
      );
      expect(h.pages.map((p) => p.name)).toEqual(["현재", ""]);
    });
  });

  describe("재생 시간 기준 요소", () => {
    it("이 페이지에 있는 요소면 그대로 쓴다", () => {
      const h = harness([pageAt(0, { elements: [el("a"), el("b")] })]);
      act(() => h.view.result.current.updatePresentationTimingElementId("b"));
      expect(h.pages[0].presentationTimingElementId).toBe("b");
    });

    it("요소가 없는 페이지면 기준도 없다", () => {
      const h = harness([
        pageAt(0, { elements: [], presentationTimingElementId: "a" }),
      ]);
      act(() => h.view.result.current.updatePresentationTimingElementId("a"));
      expect(h.pages[0].presentationTimingElementId).toBeNull();
    });

    /**
     * 지금 UI 는 목록에서 고른 유효한 id 만 넘기므로 이 분기는 도달하지 않는다.
     * 두 화면의 구현이 서로 달랐는데도 아무도 몰랐던 이유다 — 한쪽은 기존 선택을
     * 유지하고 다른 쪽은 첫 요소로 되돌렸다. 유지하는 쪽으로 맞췄고, 여기서 고정한다.
     */
    it("없는 id 가 오면 이미 고른 유효한 기준을 지킨다", () => {
      const h = harness([
        pageAt(0, {
          elements: [el("a"), el("b")],
          presentationTimingElementId: "b",
        }),
      ]);
      act(() =>
        h.view.result.current.updatePresentationTimingElementId("사라진id"),
      );
      expect(h.pages[0].presentationTimingElementId).toBe("b");
    });

    it("기존 기준마저 사라졌으면 첫 요소로 물러난다", () => {
      const h = harness([
        pageAt(0, {
          elements: [el("a"), el("b")],
          presentationTimingElementId: "지워진요소",
        }),
      ]);
      act(() => h.view.result.current.updatePresentationTimingElementId(null));
      expect(h.pages[0].presentationTimingElementId).toBe("a");
    });

    it("공백만 있는 id 는 값이 없는 것으로 본다", () => {
      const h = harness([
        pageAt(0, { elements: [el("a")], presentationTimingElementId: null }),
      ]);
      act(() => h.view.result.current.updatePresentationTimingElementId("   "));
      expect(h.pages[0].presentationTimingElementId).toBe("a");
    });
  });
});
