import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMediaPlaylistPlayback } from "@/features/book/use-media-playlist-playback";

/**
 * `BookDetailPage` 와 `BookEditorPage` 에 같은 복사본으로 있던 재생 연동을 모은 훅이다.
 * 두 화면이 이제 같은 코드를 쓰므로 여기서 깨지면 양쪽이 함께 깨진다.
 */

const ui = (over: Record<string, unknown> = {}) =>
  ({ playing: true, index: 0, count: 3, ...over }) as never;

/** 훅 안의 초기화가 queueMicrotask 로 미뤄지므로 마이크로태스크 큐를 비운다 */
const flush = () => act(async () => undefined);

function harness(activePageIndex = 0, inspectorSelectionKey = "") {
  return renderHook(
    (props: { activePageIndex: number; inspectorSelectionKey: string }) =>
      useMediaPlaylistPlayback(props),
    { initialProps: { activePageIndex, inspectorSelectionKey } },
  );
}

describe("useMediaPlaylistPlayback", () => {
  it("위젯별 재생 인덱스를 모아 둔다", () => {
    const h = harness();
    act(() => h.result.current.handlePlaybackIndex("a", 2));
    act(() => h.result.current.handlePlaybackIndex("b", 5));

    expect(h.result.current.playbackIndexByElementId).toEqual({ a: 2, b: 5 });
  });

  /** 위젯은 프레임마다 보고할 수 있다 — 같은 값이면 새 객체를 만들지 않아야 리렌더가 멎는다 */
  it("같은 인덱스를 다시 보고하면 같은 객체를 유지한다", () => {
    const h = harness();
    act(() => h.result.current.handlePlaybackIndex("a", 2));
    const first = h.result.current.playbackIndexByElementId;

    act(() => h.result.current.handlePlaybackIndex("a", 2));
    expect(h.result.current.playbackIndexByElementId).toBe(first);

    act(() => h.result.current.handlePlaybackIndex("a", 3));
    expect(h.result.current.playbackIndexByElementId).not.toBe(first);
  });

  it("재생 UI 보고를 위젯별로 갱신한다", () => {
    const h = harness();
    act(() => h.result.current.handlePlaybackUiReport("a", ui()));
    act(() => h.result.current.handlePlaybackUiReport("a", ui({ index: 1 })));

    expect(h.result.current.playbackUiByElementId.a).toMatchObject({
      index: 1,
    });
  });

  /**
   * 원격 명령은 상태가 아니라 일회성 신호다. 같은 버튼을 연달아 누르면 내용이 똑같아서,
   * `seq` 가 오르지 않으면 위젯이 두 번째 누름을 알아채지 못한다.
   */
  it("같은 명령을 반복해도 seq 가 매번 오른다", () => {
    const h = harness();
    act(() => h.result.current.sendRemoteControl("a", "next"));
    const first = h.result.current.remoteCommand;

    act(() => h.result.current.sendRemoteControl("a", "next"));
    const second = h.result.current.remoteCommand;

    expect(first).toMatchObject({ targetId: "a", kind: "next" });
    expect(second).toMatchObject({ targetId: "a", kind: "next" });
    expect(second!.seq).toBeGreaterThan(first!.seq);
  });

  it("jumpTo 만 index 를 싣는다", () => {
    const h = harness();
    act(() => h.result.current.sendRemoteControl("a", "jumpTo", 4));
    expect(h.result.current.remoteCommand).toMatchObject({ index: 4 });

    act(() => h.result.current.sendRemoteControl("a", "next"));
    expect(h.result.current.remoteCommand).not.toHaveProperty("index");
  });

  it("위젯이 처리하면 명령을 비운다", () => {
    const h = harness();
    act(() => h.result.current.sendRemoteControl("a", "prev"));
    act(() => h.result.current.clearRemoteCommand());
    expect(h.result.current.remoteCommand).toBeNull();
  });

  /** 페이지가 바뀌면 이전 슬라이드 위젯의 재생 상태가 남으면 안 된다 */
  it("페이지가 바뀌면 재생 상태를 비운다", async () => {
    const h = harness(0, "");
    act(() => h.result.current.handlePlaybackIndex("a", 2));
    act(() => h.result.current.handlePlaybackUiReport("a", ui()));

    h.rerender({ activePageIndex: 1, inspectorSelectionKey: "" });
    await flush();

    expect(h.result.current.playbackIndexByElementId).toEqual({});
    expect(h.result.current.playbackUiByElementId).toEqual({});
  });

  it("속성 패널이 보는 위젯이 바뀌면 남은 명령을 버린다", async () => {
    const h = harness(0, "a");
    act(() => h.result.current.sendRemoteControl("a", "next"));
    expect(h.result.current.remoteCommand).not.toBeNull();

    h.rerender({ activePageIndex: 0, inspectorSelectionKey: "b" });
    await flush();

    expect(h.result.current.remoteCommand).toBeNull();
  });

  /**
   * 마운트 때도 초기화 이펙트가 한 번 돌며 `queueMicrotask` 를 예약한다. 그 큐를 비우기
   * 전에 보고된 값은 뒤늦게 지워지므로, 먼저 비우고 시작해야 "유지"를 볼 수 있다.
   */
  it("같은 페이지·같은 선택으로 다시 렌더해도 상태를 유지한다", async () => {
    const h = harness(0, "a");
    await flush();
    act(() => h.result.current.handlePlaybackIndex("a", 2));

    h.rerender({ activePageIndex: 0, inspectorSelectionKey: "a" });
    await flush();

    expect(h.result.current.playbackIndexByElementId).toEqual({ a: 2 });
  });
});
