// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { useBookEditorUiStore } from "@/features/book/editor-ui-store";

const store = () => useBookEditorUiStore.getState();

beforeEach(() => {
  localStorage.clear();
  store().resetEditorUi();
});

describe("북 에디터 UI 스토어", () => {
  it("초기값이 두 화면이 쓰던 useState 기본값과 같다", () => {
    const s = store();
    expect(s.pageIndex).toBe(0);
    expect(s.selectedIds).toEqual([]);
    expect(s.leftDockTab).toBe("page");
    expect(s.drawingStrokeColor).toBe("#0f172a");
    expect(s.drawingStrokeWidth).toBe(4);
    expect(s.widgetDeleteOpen).toBe(false);
    expect(s.pageDeleteIndex).toBeNull();
    expect(s.videoDurationByElementId).toEqual({});
  });

  it("삭제 확인 다이얼로그는 열림 여부와 대상을 함께 바꾼다 — 따로 두면 어긋난 상태가 생긴다", () => {
    store().openWidgetDelete(["a", "b"]);
    expect(store().widgetDeleteOpen).toBe(true);
    expect(store().widgetDeleteIds).toEqual(["a", "b"]);

    store().closeWidgetDelete();
    expect(store().widgetDeleteOpen).toBe(false);
    expect(store().widgetDeleteIds).toEqual([]);

    store().openPageDelete(3);
    expect(store().pageDeleteOpen).toBe(true);
    expect(store().pageDeleteIndex).toBe(3);
    store().closePageDelete();
    expect(store().pageDeleteIndex).toBeNull();
  });

  it("같은 길이를 다시 보고하면 상태 객체를 바꾸지 않는다 — 불필요한 리렌더 방지", () => {
    store().setVideoDuration("v1", 12);
    const first = store().videoDurationByElementId;
    store().setVideoDuration("v1", 12);
    expect(store().videoDurationByElementId).toBe(first);

    store().setVideoDuration("v1", 13);
    expect(store().videoDurationByElementId).not.toBe(first);
    expect(store().videoDurationByElementId.v1).toBe(13);
  });

  it("팔레트 열림 상태는 localStorage 에 남는다", () => {
    store().setFloatingWidgetPaletteOpen(false);
    expect(store().floatingWidgetPaletteOpen).toBe(false);
    expect(localStorage.getItem("book-ui-floating-widget-visible")).toBe("0");

    store().setFloatingWidgetPaletteOpen(true);
    expect(localStorage.getItem("book-ui-floating-widget-visible")).toBe("1");
  });

  /**
   * 스토어는 모듈 수명이라 화면을 옮겨도 값이 남는다. 다른 북을 열 때 초기화하지 않으면
   * 앞 북의 슬라이드 위치·선택이 그대로 이어진다 — 로그아웃 시 쿼리 캐시를 비우지 않아
   * 이전 사용자 데이터가 보이던 사고(dbfc322)와 같은 종류다.
   */
  it("resetEditorUi 가 편집 상태를 초기값으로 되돌린다", () => {
    store().setPageIndex(5);
    store().setSelectedIds(["w1", "w2"]);
    store().setLeftDockTab("drawing");
    store().setVideoDuration("v1", 30);
    store().openWidgetDelete(["w1"]);

    store().resetEditorUi();

    const s = store();
    expect(s.pageIndex).toBe(0);
    expect(s.selectedIds).toEqual([]);
    expect(s.leftDockTab).toBe("page");
    expect(s.videoDurationByElementId).toEqual({});
    expect(s.widgetDeleteOpen).toBe(false);
  });

  it("리셋은 팔레트 열림 설정(localStorage)은 존중한다 — 사용자가 접어 둔 것을 되살리지 않는다", () => {
    store().setFloatingWidgetPaletteOpen(false);
    store().resetEditorUi();
    expect(store().floatingWidgetPaletteOpen).toBe(false);
  });
});
