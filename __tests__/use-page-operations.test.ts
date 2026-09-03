import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  createEmptyEditorPage,
} from "@/features/book/book-canvas";
import {
  resetEditorUi,
  setPageIndex,
  setSelectedIds,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";
import { usePageOperations } from "@/features/book/use-page-operations";

/**
 * `BookDetailPage` 와 `BookEditorPage` 에 같은 복사본으로 있던 63줄을 모은 훅이다.
 * 두 화면이 이제 같은 코드를 쓰므로 여기서 깨지면 양쪽이 함께 깨진다.
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
  const commitPages = (
    recipe: (prev: BookEditorPageState[]) => BookEditorPageState[],
  ) => {
    pages = recipe(pages);
  };
  const view = renderHook(() =>
    usePageOperations({
      activePageIndex,
      pageCount: initial.length,
      commitPages,
    }),
  );
  return {
    view,
    get pages() {
      return pages;
    },
  };
}

const pageIndex = () => useBookEditorUiStore.getState().pageIndex;
const selectedIds = () => useBookEditorUiStore.getState().selectedIds;

beforeEach(() => resetEditorUi());

describe("usePageOperations", () => {
  it("지정 위치에 페이지를 넣고 그 페이지로 이동한다", () => {
    const h = harness([pageAt(0), pageAt(1)]);
    act(() => h.view.result.current.addPageAtInsertIndex(1));

    expect(h.pages).toHaveLength(3);
    expect(pageIndex()).toBe(1);
  });

  /** 순서가 바뀌면 sortOrder 를 다시 매겨야 사이드바 순서와 저장 순서가 어긋나지 않는다 */
  it("삽입 뒤 sortOrder 를 위치에 맞춰 다시 매긴다", () => {
    const h = harness([pageAt(0), pageAt(1), pageAt(2)]);
    act(() => h.view.result.current.addPageAtInsertIndex(1));

    expect(h.pages.map((p) => p.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("복제본은 원본 바로 뒤에 들어가고 그 페이지로 이동한다", () => {
    const h = harness([pageAt(0), pageAt(1)]);
    const originalKey = h.pages[0].clientKey;

    act(() => h.view.result.current.duplicatePageAt(0));

    expect(h.pages).toHaveLength(3);
    expect(pageIndex()).toBe(1);
    // 복제본은 새 clientKey 를 받아야 한다 — 같으면 목록 key 가 겹쳐 렌더가 엉킨다
    expect(h.pages[1].clientKey).not.toBe(originalKey);
    expect(h.pages.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
  });

  it("범위 밖 인덱스는 복제하지 않는다", () => {
    const h = harness([pageAt(0)]);
    const before = h.pages;
    act(() => h.view.result.current.duplicatePageAt(3));
    expect(h.pages).toBe(before);
  });

  /**
   * 페이지를 옮기면 선택을 비운다. 남겨 두면 다른 페이지의 요소가 선택된 채로 남아
   * 인스펙터가 화면에 없는 것을 편집한다.
   */
  it("페이지를 더하거나 복제하면 선택을 비운다", () => {
    const h = harness([pageAt(0, { elements: [el("a")] })]);

    act(() => setSelectedIds(["a"]));
    act(() => h.view.result.current.addPageAtInsertIndex(1));
    expect(selectedIds()).toEqual([]);

    act(() => setSelectedIds(["a"]));
    act(() => h.view.result.current.duplicatePageAt(0));
    expect(selectedIds()).toEqual([]);
  });

  /** 삭제는 확인 창을 거친다 — 요청만으로 지워지면 안 된다 */
  it("삭제 요청은 확인 창을 열 뿐 지우지 않는다", () => {
    const h = harness([pageAt(0), pageAt(1)]);
    act(() => h.view.result.current.requestRemovePageAt(1));

    expect(useBookEditorUiStore.getState().pageDeleteOpen).toBe(true);
    expect(useBookEditorUiStore.getState().pageDeleteIndex).toBe(1);
    expect(h.pages).toHaveLength(2);
  });

  it("확인하면 지우고 창을 닫는다", () => {
    const h = harness([pageAt(0), pageAt(1)], 1);
    act(() => h.view.result.current.requestRemovePageAt(1));
    act(() => h.view.result.current.confirmRemovePageAt());

    expect(h.pages).toHaveLength(1);
    expect(useBookEditorUiStore.getState().pageDeleteOpen).toBe(false);
    // 마지막 페이지를 지웠으므로 앞 페이지로 물러난다
    expect(pageIndex()).toBe(0);
  });

  /** 페이지가 0개인 편집 화면은 성립하지 않는다 */
  it("마지막 한 장은 지우지 않는다", () => {
    const h = harness([pageAt(0)]);
    act(() => h.view.result.current.requestRemovePageAt(0));
    act(() => h.view.result.current.confirmRemovePageAt());

    expect(h.pages).toHaveLength(1);
  });

  it("AI 의 현재 페이지 삭제 요청은 활성 인덱스를 가리킨다", () => {
    const h = harness([pageAt(0), pageAt(1), pageAt(2)], 2);
    act(() => h.view.result.current.requestRemoveCurrentPageForAi());

    expect(useBookEditorUiStore.getState().pageDeleteIndex).toBe(2);
  });

  describe("순서 바꾸기", () => {
    it("드래그한 페이지가 목표 위치로 간다", () => {
      const h = harness([pageAt(0), pageAt(1), pageAt(2)]);
      const keys = h.pages.map((p) => p.clientKey);
      act(() => h.view.result.current.reorderPages(0, 2));
      expect(h.pages.map((p) => p.clientKey)).toEqual([
        keys[1],
        keys[2],
        keys[0],
      ]);
    });

    /** 보고 있던 슬라이드가 옮겨졌으면 따라가야 한다 — 갑자기 다른 슬라이드가 보이면 안 된다 */
    it("활성 페이지가 옮겨지면 따라간다", () => {
      const h = harness([pageAt(0), pageAt(1), pageAt(2)], 0);
      act(() => setPageIndex(0));
      act(() => h.view.result.current.reorderPages(0, 2));
      expect(pageIndex()).toBe(2);
    });

    it("같은 자리로는 아무것도 하지 않는다", () => {
      const h = harness([pageAt(0), pageAt(1)]);
      const before = h.pages;
      act(() => h.view.result.current.reorderPages(1, 1));
      expect(h.pages).toBe(before);
    });
  });
});
