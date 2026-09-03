import { act, renderHook } from "@testing-library/react";
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
import { useWidgetDeleteFlow } from "@/features/book/use-widget-delete-flow";

/**
 * 위젯 삭제는 "요청 → 확인 → 제거" 세 단계다. 요청 경로가 넷인데 실제 제거는 한 곳에서만
 * 일어나야 한다. 두 화면에 같은 복사본으로 있던 것을 모았다.
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

const page = (elements: BookCanvasElement[]): BookEditorPageState => ({
  ...createEmptyEditorPage(0),
  elements,
});

const store = () => useBookEditorUiStore.getState();

function harness(activePage: BookEditorPageState, selected: string[]) {
  const removeElementsByIds = vi.fn();
  const view = renderHook(() =>
    useWidgetDeleteFlow({
      activePage,
      canvasSelectedIds: selected,
      removeElementsByIds,
    }),
  );
  return { view, removeElementsByIds };
}

beforeEach(() => resetEditorUi());

describe("useWidgetDeleteFlow", () => {
  /** 요청만으로 지워지면 확인 창이 의미가 없다 */
  it("요청은 확인 창만 열고 지우지 않는다", () => {
    const h = harness(page([el("a")]), []);
    act(() => h.view.result.current.requestRemoveWidget("a"));

    expect(store().widgetDeleteOpen).toBe(true);
    expect(store().widgetDeleteIds).toEqual(["a"]);
    expect(h.removeElementsByIds).not.toHaveBeenCalled();
  });

  it("확인하면 그 대상을 지우고 창을 닫는다", () => {
    const h = harness(page([el("a")]), []);
    act(() => h.view.result.current.requestRemoveWidget("a"));
    act(() => h.view.result.current.confirmRemoveWidget());

    expect(h.removeElementsByIds).toHaveBeenCalledWith(["a"]);
    expect(store().widgetDeleteOpen).toBe(false);
  });

  it("대상 없이 확인해도 지우지 않고 창만 닫는다", () => {
    const h = harness(page([el("a")]), []);
    act(() => h.view.result.current.confirmRemoveWidget());
    expect(h.removeElementsByIds).not.toHaveBeenCalled();
  });

  describe("선택 기준 삭제", () => {
    /** 인스펙터의 삭제는 정확히 하나가 선택됐을 때만 — 여럿이면 어느 것인지 모호하다 */
    it("하나 선택됐을 때만 요청한다", () => {
      harness(page([el("a"), el("b")]), [
        "a",
        "b",
      ]).view.result.current.removeSelected();
      expect(store().widgetDeleteOpen).toBe(false);

      const one = harness(page([el("a")]), ["a"]);
      act(() => one.view.result.current.removeSelected());
      expect(store().widgetDeleteIds).toEqual(["a"]);
    });

    it("일괄 삭제는 선택 전부를 대상으로 한다", () => {
      const h = harness(page([el("a"), el("b")]), ["a", "b"]);
      act(() => h.view.result.current.removeSelectedBulk());
      expect(store().widgetDeleteIds).toEqual(["a", "b"]);
    });

    it("선택이 없으면 일괄 삭제도 열리지 않는다", () => {
      const h = harness(page([el("a")]), []);
      act(() => h.view.result.current.removeSelectedBulk());
      expect(store().widgetDeleteOpen).toBe(false);
    });
  });

  it("확인 창 문구는 대상 종류·개수를 따른다", () => {
    const h = harness(page([el("a"), el("b")]), ["a", "b"]);
    expect(h.view.result.current.widgetDeleteKindLabel).toBe("위젯");

    act(() => h.view.result.current.requestRemoveWidget("a"));
    expect(h.view.result.current.widgetDeleteKindLabel).toBe("텍스트 위젯");

    act(() => h.view.result.current.removeSelectedBulk());
    expect(h.view.result.current.widgetDeleteKindLabel).toBe("2개 위젯");
  });
});
