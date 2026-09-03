"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

import {
  BOOK_CANVAS_DRAG_GRID_PX,
  DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
} from "@/features/book/book-canvas";
import type { BookEditorLeftTab } from "@/features/book/book-editor-panel-events";
import {
  readFloatingWidgetPaletteVisible,
  writeFloatingWidgetPaletteVisible,
} from "@/features/book/book-floating-ui-prefs";

/**
 * 북 에디터의 **UI·도구 상태**. 문서(제목·슬라이드 크기·페이지 내용)는 여기 두지 않는다.
 *
 * 왜 필요한가. 같은 상태 13개가 `BookDetailPage`(소유자 뷰)와 `BookEditorPage`(새 북)에
 * 각각 `useState` 로 선언돼 있었다 — 초기값까지 똑같은 복사본이라, 한쪽만 고치면 두 화면이
 * 조용히 달라진다. 실제로 두 화면은 그렇게 벌어져 왔다(2026-09-02 리뷰의 "동명 훅·핸들러 21개").
 * 정의를 한 곳으로 모으면 그 종류의 표류가 구조적으로 불가능해진다.
 *
 * 부수적으로 `BookSlideCanvas` 로 내려가던 props 5개가 사라진다. 나머지 props 대부분은
 * 문서를 바꾸는 콜백이라 스토어로 옮길 대상이 아니다 — 그건 별개 작업이다.
 */
export type BookEditorUiState = {
  /** 지금 보고 있는 슬라이드 */
  pageIndex: number;
  /** 캔버스에서 선택된 위젯 id */
  selectedIds: string[];
  leftDockTab: BookEditorLeftTab;
  drawingStrokeColor: string;
  drawingStrokeWidth: number;
  /** 드래그 중 가운데 기준선이 뜨는 거리 */
  centerGuideThresholdPx: number;
  /** 드래그 격자 간격 */
  dragGridPx: number;
  /** 떠 있는 위젯 팔레트 — 열림 여부는 localStorage 에 남는다 */
  floatingWidgetPaletteOpen: boolean;
  widgetDeleteOpen: boolean;
  widgetDeleteIds: string[];
  pageDeleteOpen: boolean;
  pageDeleteIndex: number | null;
  /** 동영상 위젯이 알려 온 실제 길이(초) — 미리보기 체류 시간 계산에 쓴다 */
  videoDurationByElementId: Record<string, number>;
};

/** `useState` 와 같은 형태 — 값 또는 갱신 함수를 받는다(호출부를 그대로 두기 위해) */
type Updater<T> = T | ((prev: T) => T);

type BookEditorUiActions = {
  setPageIndex: (v: Updater<number>) => void;
  setSelectedIds: (v: Updater<string[]>) => void;
  setLeftDockTab: (v: BookEditorLeftTab) => void;
  setDrawingStrokeColor: (v: string) => void;
  setDrawingStrokeWidth: (v: number) => void;
  setCenterGuideThresholdPx: (v: number) => void;
  setDragGridPx: (v: number) => void;
  /** 열림 상태를 localStorage 에도 남긴다(두 화면이 같은 규칙을 쓰도록 여기서 처리) */
  setFloatingWidgetPaletteOpen: (open: boolean) => void;
  openWidgetDelete: (ids: string[]) => void;
  closeWidgetDelete: () => void;
  openPageDelete: (index: number) => void;
  closePageDelete: () => void;
  setVideoDuration: (elementId: string, durationSec: number) => void;
  /**
   * 다른 북을 열 때 반드시 부른다.
   *
   * 스토어는 모듈 수명이라 화면을 옮겨도 값이 남는다. 초기화하지 않으면 A 북의 5번
   * 슬라이드·선택 상태가 B 북에 그대로 이어진다 — 로그아웃 시 쿼리 캐시를 비우지 않아
   * 이전 사용자 데이터가 보이던 `dbfc322` 와 같은 종류의 사고다.
   */
  resetEditorUi: () => void;
};

function initialState(): BookEditorUiState {
  return {
    pageIndex: 0,
    selectedIds: [],
    leftDockTab: "page",
    drawingStrokeColor: "#0f172a",
    drawingStrokeWidth: 4,
    centerGuideThresholdPx: DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
    dragGridPx: BOOK_CANVAS_DRAG_GRID_PX,
    // 마운트 때마다 읽던 기존 동작을 유지한다(서버에서는 localStorage 접근이 막혀 기본값)
    floatingWidgetPaletteOpen: readFloatingWidgetPaletteVisible(),
    widgetDeleteOpen: false,
    widgetDeleteIds: [],
    pageDeleteOpen: false,
    pageDeleteIndex: null,
    videoDurationByElementId: {},
  };
}

function createEditorUiStore() {
  return create<BookEditorUiState & BookEditorUiActions>()(
    devtools(
      (set) => ({
        ...initialState(),

        setPageIndex: (v) =>
          set((s) => ({
            pageIndex: typeof v === "function" ? v(s.pageIndex) : v,
          })),
        setSelectedIds: (v) =>
          set((s) => {
            const next = typeof v === "function" ? v(s.selectedIds) : v;
            // 같은 내용이면 새 배열을 만들지 않는다 — 캔버스가 불필요하게 다시 그려진다
            if (
              next.length === s.selectedIds.length &&
              next.every((id, i) => id === s.selectedIds[i])
            ) {
              return s;
            }
            return { selectedIds: next };
          }),
        setLeftDockTab: (leftDockTab) => set({ leftDockTab }),
        setDrawingStrokeColor: (drawingStrokeColor) =>
          set({ drawingStrokeColor }),
        setDrawingStrokeWidth: (drawingStrokeWidth) =>
          set({ drawingStrokeWidth }),
        setCenterGuideThresholdPx: (centerGuideThresholdPx) =>
          set({ centerGuideThresholdPx }),
        setDragGridPx: (dragGridPx) => set({ dragGridPx }),

        setFloatingWidgetPaletteOpen: (open) => {
          writeFloatingWidgetPaletteVisible(open);
          set({ floatingWidgetPaletteOpen: open });
        },

        openWidgetDelete: (ids) =>
          set({ widgetDeleteOpen: true, widgetDeleteIds: ids }),
        closeWidgetDelete: () =>
          set({ widgetDeleteOpen: false, widgetDeleteIds: [] }),
        openPageDelete: (index) =>
          set({ pageDeleteOpen: true, pageDeleteIndex: index }),
        closePageDelete: () =>
          set({ pageDeleteOpen: false, pageDeleteIndex: null }),

        setVideoDuration: (elementId, durationSec) =>
          set((s) =>
            s.videoDurationByElementId[elementId] === durationSec
              ? s
              : {
                  videoDurationByElementId: {
                    ...s.videoDurationByElementId,
                    [elementId]: durationSec,
                  },
                },
          ),

        resetEditorUi: () => set(initialState()),
      }),
      { name: "book-editor-ui" },
    ),
  );
}

/**
 * HMR·중복 클라이언트 청크로 이 모듈이 두 번 평가되면 `create()` 가 두 번 돌아 서로 다른
 * 스토어가 된다. 한쪽에 쓰고 다른 쪽을 구독하면 선택이 반영되지 않는 식으로 조용히 어긋난다.
 * `auth-store` 와 같은 방식으로 브라우저에서는 하나만 남긴다.
 */
const globalForEditorUi = globalThis as unknown as {
  __NEXT_BOOK_APP_EDITOR_UI_STORE__?: ReturnType<typeof createEditorUiStore>;
};

export const useBookEditorUiStore =
  (typeof window !== "undefined" &&
    globalForEditorUi.__NEXT_BOOK_APP_EDITOR_UI_STORE__) ||
  (() => {
    const store = createEditorUiStore();
    if (typeof window !== "undefined") {
      globalForEditorUi.__NEXT_BOOK_APP_EDITOR_UI_STORE__ = store;
    }
    return store;
  })();

/**
 * 액션을 **모듈 상수 함수**로도 내보낸다.
 *
 * 훅 셀렉터(`useBookEditorUiStore((s) => s.setX)`)로 받으면 React Compiler 가 그 값의
 * 안정성을 증명하지 못해, 기존 `useCallback(..., [])` 들이 전부
 * "Existing memoization could not be preserved" 로 최적화에서 빠진다. 스토어 액션은 스토어
 * 수명 동안 동일하므로 모듈 상수로 노출하면 컴파일러가 안정적이라고 보고, 호출부의
 * 의존성 배열을 손대지 않아도 된다.
 *
 * 상태(값)는 반드시 훅 셀렉터로 구독해야 한다 — 이쪽은 변해야 리렌더가 일어난다.
 */
const s = () => useBookEditorUiStore.getState();

export const setPageIndex: BookEditorUiActions["setPageIndex"] = (v) =>
  s().setPageIndex(v);
export const setSelectedIds: BookEditorUiActions["setSelectedIds"] = (v) =>
  s().setSelectedIds(v);
export const setLeftDockTab: BookEditorUiActions["setLeftDockTab"] = (v) =>
  s().setLeftDockTab(v);
export const setDrawingStrokeColor: BookEditorUiActions["setDrawingStrokeColor"] =
  (v) => s().setDrawingStrokeColor(v);
export const setDrawingStrokeWidth: BookEditorUiActions["setDrawingStrokeWidth"] =
  (v) => s().setDrawingStrokeWidth(v);
export const setCenterGuideThresholdPx: BookEditorUiActions["setCenterGuideThresholdPx"] =
  (v) => s().setCenterGuideThresholdPx(v);
export const setDragGridPx: BookEditorUiActions["setDragGridPx"] = (v) =>
  s().setDragGridPx(v);
export const setFloatingWidgetPaletteOpen: BookEditorUiActions["setFloatingWidgetPaletteOpen"] =
  (open) => s().setFloatingWidgetPaletteOpen(open);
export const openWidgetDelete: BookEditorUiActions["openWidgetDelete"] = (
  ids,
) => s().openWidgetDelete(ids);
export const closeWidgetDelete: BookEditorUiActions["closeWidgetDelete"] = () =>
  s().closeWidgetDelete();
export const openPageDelete: BookEditorUiActions["openPageDelete"] = (i) =>
  s().openPageDelete(i);
export const closePageDelete: BookEditorUiActions["closePageDelete"] = () =>
  s().closePageDelete();
export const setVideoDuration: BookEditorUiActions["setVideoDuration"] = (
  id,
  sec,
) => s().setVideoDuration(id, sec);
export const resetEditorUi: BookEditorUiActions["resetEditorUi"] = () =>
  s().resetEditorUi();
