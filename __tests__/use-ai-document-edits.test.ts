import { act, renderHook } from "@testing-library/react";
import { produce } from "immer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  createEmptyEditorPage,
} from "@/features/book/book-canvas";
import {
  resetEditorUi,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";
import { useAiDocumentEdits } from "@/features/book/use-ai-document-edits";

/**
 * AI 가 문서를 고치는 경로. 사람이 하는 조작과 두 가지가 다르다 — 슬라이드를 1부터 세고,
 * 고친 슬라이드로 화면을 옮겨 줘야 한다. 두 화면에 같은 복사본으로 있던 것을 모았다.
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

const pageIndex = () => useBookEditorUiStore.getState().pageIndex;
const selectedIds = () => useBookEditorUiStore.getState().selectedIds;

function harness(initial: BookEditorPageState[], activePageIndex = 0) {
  let pages = initial;
  const setSlideWidth = vi.fn();
  const setSlideHeight = vi.fn();
  const updatePages = (recipe: (d: BookEditorPageState[]) => void) => {
    pages = produce(pages, recipe as never) as BookEditorPageState[];
  };
  const commitPages = (
    recipe: (prev: BookEditorPageState[]) => BookEditorPageState[],
  ) => {
    pages = recipe(pages);
  };
  const view = renderHook(() =>
    useAiDocumentEdits({
      activePageIndex,
      pageCount: initial.length,
      updatePages: updatePages as never,
      commitPages,
      setSlideWidth,
      setSlideHeight,
    }),
  );
  return {
    view,
    setSlideWidth,
    setSlideHeight,
    get pages() {
      return pages;
    },
  };
}

beforeEach(() => resetEditorUi());

describe("useAiDocumentEdits", () => {
  describe("요소 넣기", () => {
    it("번호를 주지 않으면 현재 슬라이드에 넣고 화면은 그대로 둔다", () => {
      const h = harness([pageAt(0), pageAt(1)], 1);
      act(() => h.view.result.current.applyAiElements([el("x")]));

      expect(h.pages[1].elements.map((e) => e.id)).toEqual(["x"]);
      expect(h.pages[0].elements).toHaveLength(0);
      expect(pageIndex()).toBe(0); // 이동 없음
    });

    /**
     * 번호는 1부터 — 0 기반으로 읽으면 옆 슬라이드에 들어간다.
     *
     * **마지막 슬라이드로 시험하면 안 된다.** 상한 클램프가 오차를 삼켜서 0 기반으로
     * 잘못 읽어도 통과한다(처음에 그렇게 썼다가 일부러 깨뜨렸을 때 안 잡혀 알았다).
     * 가운데 슬라이드를 골라야 어긋남이 드러난다.
     */
    it("번호를 주면 1부터 세어 그 슬라이드에 넣는다", () => {
      const h = harness([pageAt(0), pageAt(1), pageAt(2)]);
      act(() =>
        h.view.result.current.applyAiElements([el("x")], {
          targetSlideNumber: 2,
        }),
      );
      expect(h.pages[1].elements.map((e) => e.id)).toEqual(["x"]);
      expect(h.pages[2].elements).toHaveLength(0);
    });

    /** 다른 슬라이드를 고쳤으면 그리로 옮겨야 한다 — 안 그러면 아무 일도 없어 보인다 */
    it("번호로 넣으면 그 슬라이드로 옮긴다", () => {
      const h = harness([pageAt(0), pageAt(1), pageAt(2)]);
      act(() =>
        h.view.result.current.applyAiElements([el("x")], {
          targetSlideNumber: 3,
        }),
      );
      expect(pageIndex()).toBe(2);
    });

    it("범위를 벗어난 번호는 양 끝으로 잘린다", () => {
      const h = harness([pageAt(0), pageAt(1)]);
      act(() =>
        h.view.result.current.applyAiElements([el("a")], {
          targetSlideNumber: 99,
        }),
      );
      act(() =>
        h.view.result.current.applyAiElements([el("b")], {
          targetSlideNumber: -3,
        }),
      );
      expect(h.pages[1].elements.map((e) => e.id)).toEqual(["a"]);
      expect(h.pages[0].elements.map((e) => e.id)).toEqual(["b"]);
    });

    it("넣은 것 중 마지막을 선택해 준다", () => {
      const h = harness([pageAt(0)]);
      act(() => h.view.result.current.applyAiElements([el("a"), el("b")]));
      expect(selectedIds()).toEqual(["b"]);
    });

    it("빈 목록이면 아무것도 하지 않는다", () => {
      const h = harness([pageAt(0)]);
      const before = h.pages;
      act(() => h.view.result.current.applyAiElements([]));
      expect(h.pages).toBe(before);
      expect(selectedIds()).toEqual([]);
    });
  });

  describe("페이지 추가", () => {
    it("요청한 만큼 붙이고 마지막 페이지로 옮긴다", () => {
      const h = harness([pageAt(0), pageAt(1)]);
      act(() => h.view.result.current.addPagesFromAi(3));

      expect(h.pages).toHaveLength(5);
      expect(pageIndex()).toBe(4);
      expect(selectedIds()).toEqual([]);
    });

    /** AI 가 큰 수를 말해도 문서가 통째로 불어나면 안 된다 */
    it("한 번에 20장을 넘지 않는다", () => {
      const h = harness([pageAt(0)]);
      act(() => h.view.result.current.addPagesFromAi(500));
      expect(h.pages).toHaveLength(21);
    });

    it("0이나 음수를 줘도 최소 한 장은 붙인다", () => {
      const h = harness([pageAt(0)]);
      act(() => h.view.result.current.addPagesFromAi(0));
      expect(h.pages).toHaveLength(2);
    });

    it("붙인 뒤 sortOrder 가 위치와 맞는다", () => {
      const h = harness([pageAt(0)]);
      act(() => h.view.result.current.addPagesFromAi(2));
      expect(h.pages.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
    });
  });

  describe("슬라이드 크기", () => {
    it("준 값만 바꾼다", () => {
      const h = harness([pageAt(0)]);
      act(() =>
        h.view.result.current.applySlideDimensionsFromAi({
          slideWidth: 1280,
        }),
      );

      expect(h.setSlideWidth).toHaveBeenCalledWith(1280);
      expect(h.setSlideHeight).not.toHaveBeenCalled();
    });
  });
});
