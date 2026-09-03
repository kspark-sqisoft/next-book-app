"use client";

import type { Draft } from "immer";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import {
  type BookCanvasElement,
  type BookDropWidgetKind,
  type BookEditorPageState,
  type BookShapeKind,
  createBookShapeElement,
  DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
  DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
  placeBookShapeElementAtPointer,
} from "@/features/book/book-canvas";
import { setSelectedIds } from "@/features/book/editor-ui-store";
import { WIDGET_FACTORY_BY_KIND } from "@/features/book/widget-factories";

type UpdatePages = (
  recipe: (draft: Draft<BookEditorPageState>[]) => void,
) => void;

/**
 * "위젯 하나를 현재 슬라이드에 놓고 선택한다"는 절차를 한 번만 구현한다.
 *
 * 이전에는 위젯 종류마다 `addXAt` 핸들러가 있었고 그 안에 같은 3줄이 반복됐다.
 * 그 핸들러 13개가 `BookDetailPage` 와 `BookEditorPage` 에 **글자 단위로 같은 복사본**으로
 * 존재했다(2026-09-02 리뷰의 "동명 핸들러 21개"). 종류별 차이는 기본값뿐이라
 * `widget-factories.ts` 로 빼고, 절차는 여기 하나로 모았다.
 */
export function useWidgetInserters(opts: {
  activePageIndex: number;
  updatePages: UpdatePages;
  slideWidth: number;
  slideHeight: number;
  /**
   * 빈 이미지·동영상 자리를 놓은 뒤 띄우는 안내. 화면마다 다음 할 일이 달라서 받는다 —
   * 저장된 북은 바로 우클릭으로 채울 수 있고, 새 북은 저장해야 업로드가 열린다.
   */
  emptyMediaHint: (kind: "image" | "video") => string;
}) {
  const {
    activePageIndex,
    updatePages,
    slideWidth,
    slideHeight,
    emptyMediaHint,
  } = opts;

  /** 현재 슬라이드 맨 위에 올리고 선택 — 모든 삽입이 거쳐 가는 유일한 지점 */
  const appendElement = useCallback(
    (el: BookCanvasElement) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements.push(el as Draft<BookCanvasElement>);
      });
      setSelectedIds([el.id]);
    },
    [activePageIndex, updatePages],
  );

  /** 도형은 슬라이드 크기에 맞춰 만들고 포인터 위치로 옮긴 뒤 넣는다 */
  const addShapeAt = useCallback(
    (x: number, y: number, kind: BookShapeKind) => {
      const base = createBookShapeElement(kind, slideWidth, slideHeight);
      appendElement(
        placeBookShapeElementAtPointer(base, x, y, slideWidth, slideHeight),
      );
    },
    [appendElement, slideHeight, slideWidth],
  );

  const addFromElementsPanel = useCallback(
    (kind: BookShapeKind) => {
      appendElement(createBookShapeElement(kind, slideWidth, slideHeight));
    },
    [appendElement, slideHeight, slideWidth],
  );

  /**
   * 팔레트 종류로 바로 삽입. 표에 없는 종류(미디어·PDF 등 화면마다 다르게 다뤄야 하는 것)면
   * `false` 를 돌려주어 호출부가 이어서 처리하게 한다.
   */
  const addByKind = useCallback(
    (kind: BookDropWidgetKind, x: number, y: number): boolean => {
      const make = WIDGET_FACTORY_BY_KIND[kind];
      if (!make) return false;
      appendElement(make(x, y));
      return true;
    },
    [appendElement],
  );

  /**
   * 슬라이드 한가운데에 삽입(팔레트 더블 클릭).
   *
   * 이전에는 종류마다 기본 크기를 다시 적어 가운데를 계산했다. 요소를 먼저 만들면
   * 크기가 그 안에 있으므로 표를 따로 둘 필요가 없다 — 기본값이 바뀌어도 자동으로 따라간다.
   */
  const addByKindCentered = useCallback(
    (kind: BookDropWidgetKind): boolean => {
      const make = WIDGET_FACTORY_BY_KIND[kind];
      if (!make) return false;
      const el = make(0, 0);
      appendElement({
        ...el,
        x: Math.max(0, Math.round((slideWidth - (el.width ?? 0)) / 2)),
        y: Math.max(0, Math.round((slideHeight - (el.height ?? 0)) / 2)),
      });
      return true;
    },
    [appendElement, slideHeight, slideWidth],
  );

  const addMediaPlaylistAt = useCallback(
    (x: number, y: number) => {
      appendElement({
        id: crypto.randomUUID(),
        type: "mediaPlaylist",
        x,
        y,
        width: DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
        height: DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
        mediaPlaylistItems: [],
      });
    },
    [appendElement],
  );

  /**
   * 이미지·동영상은 미디어 위젯과 같은 흐름 — 빈 자리를 먼저 놓고 나중에 채운다.
   * (드롭 이벤트 안에서 파일 선택창을 열면 브라우저가 드래그 세션을 정리하는 중이라
   *  창이 열리지 않는 일이 있었다. 배치해 두고 우클릭·인스펙터로 채우면 그 문제가 없다)
   */
  const addEmptyMediaAt = useCallback(
    (x: number, y: number, kind: "image" | "video") => {
      const id = crypto.randomUUID();
      appendElement(
        kind === "image"
          ? { id, type: "image", x, y, width: 400, height: 260, src: "" }
          : {
              id,
              type: "video",
              x,
              y,
              width: 480,
              height: 270,
              src: "",
              posterSrc: null,
            },
      );
      toast.info(emptyMediaHint(kind));
    },
    [appendElement, emptyMediaHint],
  );

  return useMemo(
    () => ({
      appendElement,
      addByKind,
      addByKindCentered,
      addShapeAt,
      addFromElementsPanel,
      addMediaPlaylistAt,
      addEmptyMediaAt,
    }),
    [
      appendElement,
      addByKind,
      addByKindCentered,
      addShapeAt,
      addFromElementsPanel,
      addMediaPlaylistAt,
      addEmptyMediaAt,
    ],
  );
}
