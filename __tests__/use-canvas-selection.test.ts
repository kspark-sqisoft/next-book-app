import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  createEmptyEditorPage,
} from "@/features/book/book-canvas";
import {
  resetEditorUi,
  setSelectedIds,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";
import { useCanvasSelection } from "@/features/book/use-canvas-selection";

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

beforeEach(() => resetEditorUi());

describe("useCanvasSelection", () => {
  /** 선택은 스토어에 남는데 페이지를 옮기면 없는 id 가 섞인다 — 걸러야 인스펙터가 헛것을 편집하지 않는다 */
  it("현재 페이지에 있는 선택만 남긴다", () => {
    act(() => setSelectedIds(["a", "지워진", "b"]));
    const h = renderHook(() => useCanvasSelection(page([el("a"), el("b")])));
    expect(h.result.current.canvasSelectedIds).toEqual(["a", "b"]);
  });

  it("페이지가 없으면 빈 선택", () => {
    act(() => setSelectedIds(["a"]));
    const h = renderHook(() => useCanvasSelection(undefined));
    expect(h.result.current.canvasSelectedIds).toEqual([]);
  });

  it("속성 패널 키는 정확히 하나 선택됐을 때만 값이 있다", () => {
    const p = page([el("a"), el("b")]);
    const h = renderHook(() => useCanvasSelection(p));

    act(() => setSelectedIds(["a"]));
    expect(h.result.current.inspectorSelectionKey).toBe("a");

    act(() => setSelectedIds(["a", "b"]));
    expect(h.result.current.inspectorSelectionKey).toBe("");

    act(() => setSelectedIds([]));
    expect(h.result.current.inspectorSelectionKey).toBe("");
  });

  describe("캔버스 선택 이벤트", () => {
    it("빈 곳 클릭(id null)은 선택 해제", () => {
      const h = renderHook(() => useCanvasSelection(page([el("a")])));
      act(() => setSelectedIds(["a"]));
      act(() => h.result.current.onCanvasSelect({ id: null }));
      expect(useBookEditorUiStore.getState().selectedIds).toEqual([]);
    });

    it("shift 없이 누르면 그것 하나, shift 면 더한다", () => {
      const h = renderHook(() => useCanvasSelection(page([el("a"), el("b")])));
      act(() => h.result.current.onCanvasSelect({ id: "a" }));
      act(() => h.result.current.onCanvasSelect({ id: "b", shiftKey: true }));
      expect(useBookEditorUiStore.getState().selectedIds).toEqual(["a", "b"]);

      act(() => h.result.current.onCanvasSelect({ id: "b" }));
      expect(useBookEditorUiStore.getState().selectedIds).toEqual(["b"]);
    });
  });
});
