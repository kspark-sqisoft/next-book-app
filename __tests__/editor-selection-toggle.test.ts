// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";

import {
  resetEditorUi,
  setSelectedIds,
  toggleSelectedId,
  useBookEditorUiStore,
} from "@/features/book/editor-ui-store";

/**
 * 캔버스 클릭과 레이어 목록 클릭이 같은 선택 규칙을 쓴다. 두 화면 × 두 곳, 즉 네 벌의
 * 같은 코드였던 것을 스토어 액션 하나로 모았다.
 */

const selected = () => useBookEditorUiStore.getState().selectedIds;

beforeEach(() => resetEditorUi());

describe("toggleSelectedId", () => {
  it("shift 없이 누르면 그것 하나만 남는다", () => {
    setSelectedIds(["a", "b"]);
    toggleSelectedId("c");
    expect(selected()).toEqual(["c"]);
  });

  it("이미 선택된 것을 shift 없이 다시 눌러도 그대로 하나", () => {
    setSelectedIds(["a", "b"]);
    toggleSelectedId("a");
    expect(selected()).toEqual(["a"]);
  });

  it("shift 면 기존 선택에 더한다", () => {
    setSelectedIds(["a"]);
    toggleSelectedId("b", true);
    expect(selected()).toEqual(["a", "b"]);
  });

  it("shift 로 이미 선택된 것을 누르면 뺀다", () => {
    setSelectedIds(["a", "b", "c"]);
    toggleSelectedId("b", true);
    expect(selected()).toEqual(["a", "c"]);
  });

  it("shift 로 마지막 하나까지 뺄 수 있다", () => {
    setSelectedIds(["a"]);
    toggleSelectedId("a", true);
    expect(selected()).toEqual([]);
  });

  /** 같은 것을 두 번 넣어 중복이 쌓이면 인스펙터의 다중 선택 표시가 어긋난다 */
  it("shift 로 더해도 중복이 생기지 않는다", () => {
    setSelectedIds(["a"]);
    toggleSelectedId("b", true);
    toggleSelectedId("b", true);
    toggleSelectedId("b", true);
    expect(selected()).toEqual(["a", "b"]);
  });
});
