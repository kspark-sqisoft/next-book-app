"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  BookMediaPlaylistPlaybackUiSnapshot,
  BookMediaPlaylistRemoteCommand,
} from "@/components/books/BookMediaPlaylistWidgetOverlay";

/**
 * 캔버스의 미디어 플레이리스트 위젯과 속성 패널 사이의 양방향 연결.
 *
 * - 위로: 위젯이 "지금 몇 번째를 틀고 있고 UI 상태는 이렇다"를 올려 보내면 속성 패널이
 *   그 항목을 강조하고 미니 컨트롤을 그린다.
 * - 아래로: 속성 패널의 이전/다음/일시정지 버튼이 위젯에 명령을 내린다.
 *
 * 아래 방향은 상태가 아니라 **일회성 명령**이라 `seq` 를 붙인다. 같은 버튼을 연달아
 * 누르면 명령 내용이 똑같아서, 번호가 없으면 위젯이 두 번째 누름을 알아채지 못한다.
 * 위젯은 처리한 뒤 `clearRemoteCommand()` 로 비운다.
 *
 * `BookDetailPage` 와 `BookEditorPage` 에 같은 복사본으로 있던 것을 모았다.
 */
export function useMediaPlaylistPlayback(opts: {
  /** 페이지가 바뀌면 재생 상태를 버린다 — 다른 슬라이드의 위젯 id 가 남으면 안 된다 */
  activePageIndex: number;
  /** 속성 패널이 보고 있는 위젯이 바뀌면 남은 원격 명령을 버린다 */
  inspectorSelectionKey: string;
}) {
  const { activePageIndex, inspectorSelectionKey } = opts;

  /** 위젯별 재생 중 항목 인덱스 → 속성 목록 하이라이트 */
  const [playbackIndexByElementId, setPlaybackIndexByElementId] = useState<
    Record<string, number>
  >({});
  const [playbackUiByElementId, setPlaybackUiByElementId] = useState<
    Record<string, BookMediaPlaylistPlaybackUiSnapshot>
  >({});
  const remoteSeqRef = useRef(0);
  const [remoteCommand, setRemoteCommand] =
    useState<BookMediaPlaylistRemoteCommand | null>(null);

  /** 같은 인덱스면 새 객체를 만들지 않는다 — 매 프레임 리렌더를 막는다 */
  const handlePlaybackIndex = useCallback(
    (elementId: string, index: number) => {
      setPlaybackIndexByElementId((prev) =>
        prev[elementId] === index ? prev : { ...prev, [elementId]: index },
      );
    },
    [],
  );

  const handlePlaybackUiReport = useCallback(
    (elementId: string, payload: BookMediaPlaylistPlaybackUiSnapshot) => {
      setPlaybackUiByElementId((prev) => ({ ...prev, [elementId]: payload }));
    },
    [],
  );

  const clearRemoteCommand = useCallback(() => setRemoteCommand(null), []);

  const sendRemoteControl = useCallback(
    (
      elementId: string,
      kind: "prev" | "next" | "togglePause" | "jumpTo",
      index?: number,
    ) => {
      remoteSeqRef.current += 1;
      setRemoteCommand({
        targetId: elementId,
        kind,
        seq: remoteSeqRef.current,
        ...(index !== undefined ? { index } : {}),
      });
    },
    [],
  );

  /**
   * 두 초기화 모두 `queueMicrotask` 로 미룬다. 위젯이 언마운트되면서 마지막 보고를
   * 올려 보내는 일이 있어, 같은 틱에 비우면 그 보고가 새 페이지의 상태로 들어온다.
   */
  useEffect(() => {
    queueMicrotask(() => {
      setPlaybackIndexByElementId({});
      setPlaybackUiByElementId({});
    });
  }, [activePageIndex]);

  useEffect(() => {
    queueMicrotask(() => {
      setRemoteCommand(null);
    });
  }, [inspectorSelectionKey]);

  return useMemo(
    () => ({
      playbackIndexByElementId,
      playbackUiByElementId,
      remoteCommand,
      handlePlaybackIndex,
      handlePlaybackUiReport,
      clearRemoteCommand,
      sendRemoteControl,
    }),
    [
      playbackIndexByElementId,
      playbackUiByElementId,
      remoteCommand,
      handlePlaybackIndex,
      handlePlaybackUiReport,
      clearRemoteCommand,
      sendRemoteControl,
    ],
  );
}
