import { act, renderHook } from "@testing-library/react";
import { produce } from "immer";
import { beforeEach, describe, expect, it } from "vitest";

import type {
  BookCanvasElement,
  BookEditorPageState,
} from "@/features/book/book-canvas";
import {
  resetEditorUi,
  setSelectedIds,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";
import { useElementMutations } from "@/features/book/use-element-mutations";

/**
 * 이 훅은 `BookDetailPage` 와 `BookEditorPage` 에 같은 복사본으로 있던 80줄을 모은 것이다.
 * 두 화면이 이제 같은 코드를 쓰므로, 여기서 깨지면 양쪽이 함께 깨진다.
 */

const el = (id: string, over: Partial<BookCanvasElement> = {}) =>
  ({
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...over,
  }) as BookCanvasElement;

let pageSeq = 0;
const page = (
  elements: BookCanvasElement[],
  over: Partial<BookEditorPageState> = {},
): BookEditorPageState => ({
  clientKey: `p${++pageSeq}`,
  sortOrder: pageSeq,
  name: "",
  backgroundColor: "#ffffff",
  elements,
  ...over,
});

const selectedIds = () => useBookEditorUiStore.getState().selectedIds;

/** 화면이 하는 것과 같은 방식으로 immer 로 페이지 배열을 굴리는 최소 하네스 */
function harness(initial: BookEditorPageState[], activePageIndex = 0) {
  let pages = initial;
  const updatePages = (recipe: Parameters<typeof produce>[1]) => {
    pages = produce(pages, recipe as never) as BookEditorPageState[];
  };
  const view = renderHook(() =>
    useElementMutations({
      activePageIndex,
      updatePages: updatePages as never,
    }),
  );
  return {
    view,
    get pages() {
      return pages;
    },
  };
}

beforeEach(() => resetEditorUi());

describe("useElementMutations", () => {
  it("현재 페이지의 요소만 고친다", () => {
    const h = harness([page([el("a"), el("b")]), page([el("a")])]);
    act(() => h.view.result.current.onElementChange("a", { x: 42 }));

    expect(h.pages[0].elements[0]).toMatchObject({ id: "a", x: 42 });
    expect(h.pages[0].elements[1]).toMatchObject({ id: "b", x: 0 });
    // 같은 id 가 다른 페이지에도 있지만 건드리지 않는다
    expect(h.pages[1].elements[0]).toMatchObject({ id: "a", x: 0 });
  });

  /** 활성 인덱스가 범위를 벗어나는 순간(페이지 삭제 직후 등)에도 던지지 않아야 한다 */
  it("현재 페이지가 없으면 아무것도 하지 않는다", () => {
    const h = harness([page([el("a")])], 5);
    const before = h.pages;
    act(() => h.view.result.current.onElementChange("a", { x: 42 }));
    expect(h.pages).toBe(before);
  });

  it("없는 요소를 가리키면 아무것도 하지 않는다", () => {
    const h = harness([page([el("a")])]);
    act(() => h.view.result.current.onElementChange("없음", { x: 42 }));
    expect(h.pages[0].elements[0]).toMatchObject({ id: "a", x: 0 });
  });

  /** 그룹 드래그·다중 nudge — 한 번의 조작이 undo 한 칸이어야 하므로 한 번에 적용된다 */
  it("여러 요소를 한 번에 고친다", () => {
    const h = harness([page([el("a"), el("b"), el("c")])]);
    act(() =>
      h.view.result.current.onElementsChange([
        { id: "a", patch: { x: 1 } },
        { id: "없음", patch: { x: 9 } },
        { id: "c", patch: { x: 3 } },
      ]),
    );
    expect(h.pages[0].elements.map((e) => e.x)).toEqual([1, 0, 3]);
  });

  /**
   * 끌 때 `false` 가 아니라 `undefined` 를 넣는 것이 이 코드의 의도다 — 기본값이
   * "보임/잠금 없음"이라 키를 지워야 저장 문서에 군더더기가 남지 않는다.
   */
  it("보임·잠금을 되돌리면 값을 false 로 두지 않고 키를 지운다", () => {
    const h = harness([page([el("a", { visible: false, locked: true })])]);

    act(() => h.view.result.current.onLayerVisibilityChange("a", true));
    act(() => h.view.result.current.onLayerLockChange("a", false));

    const target = h.pages[0].elements[0];
    expect(target.visible).toBeUndefined();
    expect(target.locked).toBeUndefined();
    expect("visible" in target && target.visible === false).toBe(false);
  });

  /**
   * 숨긴 요소가 선택에 남으면 인스펙터가 화면에 없는 것을 편집하게 된다.
   * 숨김만 선택을 건드리고, 잠금은 건드리지 않는다.
   */
  it("요소를 숨기면 선택에서 뺀다", () => {
    const h = harness([page([el("a"), el("b")])]);
    act(() => setSelectedIds(["a", "b"]));

    act(() => h.view.result.current.onLayerVisibilityChange("a", false));
    expect(selectedIds()).toEqual(["b"]);

    act(() => h.view.result.current.onLayerLockChange("b", true));
    expect(selectedIds()).toEqual(["b"]);
  });

  it("다시 보이게 해도 선택을 되돌리지는 않는다", () => {
    const h = harness([page([el("a")])]);
    act(() => setSelectedIds([]));
    act(() => h.view.result.current.onLayerVisibilityChange("a", true));
    expect(selectedIds()).toEqual([]);
  });

  describe("요소 삭제", () => {
    it("지운 요소를 선택에서도 뺀다", () => {
      const h = harness([page([el("a"), el("b"), el("c")])]);
      act(() => setSelectedIds(["a", "b"]));
      act(() => h.view.result.current.removeElementsByIds(["a"]));

      expect(h.pages[0].elements.map((e) => e.id)).toEqual(["b", "c"]);
      expect(selectedIds()).toEqual(["b"]);
    });

    it("빈 목록이면 아무것도 하지 않는다", () => {
      const h = harness([page([el("a")])]);
      const before = h.pages;
      act(() => h.view.result.current.removeElementsByIds([]));
      expect(h.pages).toBe(before);
    });

    /**
     * 재생 시간 기준으로 지정된 요소를 지우면 그 페이지의 슬라이드쇼 체류 시간이
     * 사라진 id 를 가리킨 채 남는다. 지울 때마다 기준을 다시 골라야 한다.
     */
    it("재생 시간 기준이던 요소를 지우면 기준을 다시 고른다", () => {
      const h = harness([
        page([el("a"), el("b")], { presentationTimingElementId: "a" }),
      ]);
      act(() => h.view.result.current.removeElementsByIds(["a"]));
      expect(h.pages[0].presentationTimingElementId).toBe("b");
    });

    it("기준이 아닌 요소를 지우면 기준은 그대로다", () => {
      const h = harness([
        page([el("a"), el("b")], { presentationTimingElementId: "b" }),
      ]);
      act(() => h.view.result.current.removeElementsByIds(["a"]));
      expect(h.pages[0].presentationTimingElementId).toBe("b");
    });
  });

  it("여러 요소를 현재 페이지 끝에 붙인다", () => {
    const h = harness([page([el("a")]), page([])]);
    act(() =>
      h.view.result.current.appendElementsToActivePage([el("b"), el("c")]),
    );

    expect(h.pages[0].elements.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(h.pages[1].elements).toHaveLength(0);
  });
});
