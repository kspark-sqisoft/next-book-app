// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  duplicateBookEditorPage,
} from "@/features/book/book-canvas";

/**
 * 슬라이드 복제는 원본과 **아무 가변 값도 공유하지 않아야** 한다.
 *
 * `duplicateBookEditorPage` 는 요소를 `{ ...el, id }` 로 얕게 복사한 뒤, 일부 타입에서만
 * 중첩 값을 손으로 깊은 복사한다(weather.weatherDisplay, digitalClock.clockDisplay,
 * drawing.points). 나머지 중첩 배열은 빠져 있어 복제본과 원본이 같은 배열을 가리킨다.
 *
 * 지금 당장 깨지지는 않는다 — 화면이 배열을 제자리에서 바꾸지 않고 항상 새 배열로
 * 교체하기 때문이다(AGENTS.md 의 불변성 규칙). 즉 **규율 하나가 유일한 방어선**이고,
 * 어긋나는 순간 한 슬라이드를 고치면 다른 슬라이드가 함께 바뀐다. 규율 대신 구조로 막는다.
 */

const page = (elements: BookCanvasElement[]): BookEditorPageState => ({
  clientKey: "srv-1",
  sortOrder: 0,
  name: "원본",
  backgroundColor: "#ffffff",
  elements,
});

/** 두 값이 공유하는 객체·배열 참조를 모두 찾아 경로로 돌려준다 */
function sharedReferences(a: unknown, b: unknown, path = "$"): string[] {
  if (a === null || b === null) return [];
  if (typeof a !== "object" || typeof b !== "object") return [];
  if (a === b) return [path];
  const out: string[] = [];
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      out.push(...sharedReferences(a[i], b[i], `${path}[${i}]`));
    }
    return out;
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  for (const k of Object.keys(ra)) {
    if (k in rb) out.push(...sharedReferences(ra[k], rb[k], `${path}.${k}`));
  }
  return out;
}

describe("duplicateBookEditorPage", () => {
  it("요소 id 와 clientKey 를 새로 만든다", () => {
    const src = page([
      {
        id: "e1",
        type: "shape",
        shape: "rect",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: "#000",
      },
    ] as unknown as BookCanvasElement[]);
    const dup = duplicateBookEditorPage(src);

    expect(dup.clientKey).not.toBe(src.clientKey);
    expect(dup.elements[0]!.id).not.toBe(src.elements[0]!.id);
    expect(dup.elements).toHaveLength(1);
  });

  it("id 를 빼면 내용이 같다 — 복제가 값을 잃지 않는다", () => {
    const src = page([
      {
        id: "w1",
        type: "weather",
        x: 1,
        y: 2,
        width: 100,
        height: 50,
        weatherRightBlocks: ["humidity", "wind"],
        weatherBlockOrder: ["temp", "humidity"],
      },
    ] as unknown as BookCanvasElement[]);
    const dup = duplicateBookEditorPage(src);

    const strip = (els: BookCanvasElement[]) =>
      els.map((el) => {
        const clone: Record<string, unknown> = { ...el };
        delete clone.id;
        return clone;
      });
    expect(strip(dup.elements)).toEqual(strip(src.elements));
  });

  it("원본과 가변 참조를 하나도 공유하지 않는다", () => {
    const src = page([
      {
        id: "w1",
        type: "weather",
        x: 1,
        y: 2,
        width: 100,
        height: 50,
        weatherDisplay: { showIcon: true },
        weatherRightBlocks: ["humidity", "wind"],
        weatherBlockOrder: ["temp", "humidity"],
      },
      {
        id: "m1",
        type: "mediaPlaylist",
        x: 0,
        y: 0,
        width: 480,
        height: 270,
        mediaPlaylistItems: [
          { id: "i1", kind: "image", src: "/uploads/a.png", durationSec: 5 },
        ],
      },
      {
        id: "d1",
        type: "drawing",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        points: [1, 2, 3, 4],
        stroke: "#000",
        strokeWidth: 2,
      },
    ] as unknown as BookCanvasElement[]);

    const dup = duplicateBookEditorPage(src);
    const shared = sharedReferences(src.elements, dup.elements);

    expect(shared, `공유된 참조: ${shared.join(", ")}`).toEqual([]);
  });
});
