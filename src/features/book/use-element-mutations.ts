"use client";

import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  type ElementZOrderOp,
  reorderBookElementsByDisplayIndex,
  reorderElementsZ,
  resolveEffectivePresentationTimingElementId,
} from "@/features/book/book-canvas";
import { setSelectedIds } from "@/features/book/editor-ui-store";

type UpdatePages = (
  recipe: (draft: Draft<BookEditorPageState>[]) => void,
) => void;

/**
 * 현재 슬라이드의 **기존 요소를 고치는** 조작들.
 *
 * `useWidgetInserters` 가 "새 요소를 놓는" 쪽을 맡는 것과 짝이다. 이 84줄이
 * `BookDetailPage` 와 `BookEditorPage` 에 글자 단위로 같은 복사본으로 있었다.
 *
 * 전부 "현재 페이지를 꺼내 없으면 그만둔다"로 시작한다 — 그 한 줄을 `mutateActivePage`
 * 하나로 모으면 나머지는 각자의 한 가지 일만 남는다.
 */
export function useElementMutations(opts: {
  activePageIndex: number;
  updatePages: UpdatePages;
}) {
  const { activePageIndex, updatePages } = opts;

  /** 현재 페이지에만 손대는 유일한 지점. 페이지가 없으면 아무것도 하지 않는다 */
  const mutateActivePage = useCallback(
    (recipe: (page: Draft<BookEditorPageState>) => void) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        recipe(p);
      });
    },
    [activePageIndex, updatePages],
  );

  const onElementChange = useCallback(
    (elId: string, patch: Partial<BookCanvasElement>) => {
      mutateActivePage((p) => {
        const el = p.elements.find((x) => x.id === elId);
        if (!el) return;
        Object.assign(el, patch);
      });
    },
    [mutateActivePage],
  );

  /** 그룹 드래그·다중 nudge — 한 번의 조작 = 한 개의 undo 엔트리 */
  const onElementsChange = useCallback(
    (patches: { id: string; patch: Partial<BookCanvasElement> }[]) => {
      mutateActivePage((p) => {
        for (const { id, patch } of patches) {
          const el = p.elements.find((x) => x.id === id);
          if (el) Object.assign(el, patch);
        }
      });
    },
    [mutateActivePage],
  );

  const onReorderZ = useCallback(
    (elementId: string, op: ElementZOrderOp) => {
      mutateActivePage((p) => {
        p.elements = reorderElementsZ(p.elements, elementId, op);
      });
    },
    [mutateActivePage],
  );

  const onLayerDragReorder = useCallback(
    (fromDisplay: number, toDisplay: number) => {
      mutateActivePage((p) => {
        p.elements = reorderBookElementsByDisplayIndex(
          p.elements,
          fromDisplay,
          toDisplay,
        );
      });
    },
    [mutateActivePage],
  );

  /**
   * 숨기면 선택에서도 뺀다 — 보이지 않는 요소가 선택된 채로 남으면 인스펙터가
   * 화면에 없는 것을 편집하게 된다.
   *
   * `visible`·`locked` 를 끌 때 `false` 가 아니라 `undefined` 를 넣는 것은 의도다.
   * 기본값이 "보임/잠금 없음"이라 키를 지워야 저장 문서가 깨끗하다.
   */
  const onLayerVisibilityChange = useCallback(
    (elementId: string, visible: boolean) => {
      onElementChange(
        elementId,
        visible
          ? ({ visible: undefined } as Partial<BookCanvasElement>)
          : { visible: false },
      );
      if (!visible) {
        setSelectedIds((prev) => prev.filter((id) => id !== elementId));
      }
    },
    [onElementChange],
  );

  const onLayerLockChange = useCallback(
    (elementId: string, locked: boolean) => {
      onElementChange(
        elementId,
        locked
          ? { locked: true }
          : ({ locked: undefined } as Partial<BookCanvasElement>),
      );
    },
    [onElementChange],
  );

  /**
   * 지운 요소가 이 페이지의 재생 시간 기준이었으면 기준을 다시 고른다 — 안 하면
   * 사라진 id 를 가리킨 채로 남아 슬라이드쇼 체류 시간이 기본값으로 되돌아간다.
   */
  const removeElementsByIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      mutateActivePage((p) => {
        p.elements = p.elements.filter((e) => !idSet.has(e.id));
        p.presentationTimingElementId =
          resolveEffectivePresentationTimingElementId(
            p.elements,
            p.presentationTimingElementId,
          );
      });
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    },
    [mutateActivePage],
  );

  /** 여러 요소를 한 번에 붙인다(템플릿·AI·붙여넣기). 선택은 호출부가 정한다 */
  const appendElementsToActivePage = useCallback(
    (els: BookCanvasElement[]) => {
      mutateActivePage((p) => {
        p.elements.push(...els);
      });
    },
    [mutateActivePage],
  );

  return useMemo(
    () => ({
      mutateActivePage,
      onElementChange,
      onElementsChange,
      onReorderZ,
      onLayerDragReorder,
      onLayerVisibilityChange,
      onLayerLockChange,
      removeElementsByIds,
      appendElementsToActivePage,
    }),
    [
      mutateActivePage,
      onElementChange,
      onElementsChange,
      onReorderZ,
      onLayerDragReorder,
      onLayerVisibilityChange,
      onLayerLockChange,
      removeElementsByIds,
      appendElementsToActivePage,
    ],
  );
}
