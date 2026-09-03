// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  type BookCanvasElement,
  type BookEditorPageState,
  createEmptyEditorPage,
} from "@/features/book/book-canvas";
import {
  bookElementKindLabel,
  pageDeleteTargetLabel,
  widgetDeleteTargetLabel,
} from "@/features/book/book-element-labels";

const el = (id: string, type: BookCanvasElement["type"]) =>
  ({ id, type, x: 0, y: 0, width: 10, height: 10 }) as BookCanvasElement;

const page = (
  elements: BookCanvasElement[],
  over: Partial<BookEditorPageState> = {},
): BookEditorPageState => ({ ...createEmptyEditorPage(0), elements, ...over });

/**
 * 삭제 확인 창에서 대상을 부르는 말. 두 화면에 22분기 if 체인으로 복사돼 있던 것을
 * 표 하나로 바꿨으므로, 표에서 종류가 빠지면 "위젯"으로 뭉뚱그려질 뿐 오류가 없다 —
 * 그래서 종류마다 고정한다.
 */
describe("bookElementKindLabel", () => {
  it.each([
    ["text", "텍스트 위젯"],
    ["image", "이미지 위젯"],
    ["video", "동영상 위젯"],
    ["weather", "날씨 위젯"],
    ["news", "뉴스 위젯"],
    ["mediaPlaylist", "미디어 위젯"],
    ["digitalClock", "디지털 시계 위젯"],
    ["webview", "웹뷰 위젯"],
    ["map", "지도 위젯"],
    ["calendar", "캘린더 위젯"],
    ["qr", "QR코드 위젯"],
    ["chart", "차트 위젯"],
    ["ticker", "티커 위젯"],
    ["youtube", "유튜브 위젯"],
    ["adSlot", "광고 위젯"],
    ["drawing", "그리기"],
  ] as const)("%s → %s", (type, label) => {
    expect(bookElementKindLabel(el("a", type))).toBe(label);
  });
});

describe("widgetDeleteTargetLabel", () => {
  it("하나면 종류로 부른다", () => {
    expect(widgetDeleteTargetLabel(["a"], page([el("a", "qr")]))).toBe(
      "QR코드 위젯",
    );
  });

  it("여럿이면 개수로 부른다", () => {
    expect(
      widgetDeleteTargetLabel(["a", "b", "c"], page([el("a", "text")])),
    ).toBe("3개 위젯");
  });

  it("대상이 없거나 페이지가 없으면 그냥 위젯", () => {
    expect(widgetDeleteTargetLabel([], page([]))).toBe("위젯");
    expect(widgetDeleteTargetLabel(["a"], undefined)).toBe("위젯");
    expect(widgetDeleteTargetLabel(["없음"], page([el("a", "text")]))).toBe(
      "위젯",
    );
  });
});

describe("pageDeleteTargetLabel", () => {
  const pages = [
    page([], { name: "표지" }),
    page([], { name: "   " }),
    page([], { name: "" }),
  ];

  it("이름이 있으면 이름으로", () => {
    expect(pageDeleteTargetLabel(0, pages)).toBe("표지");
  });

  /** 공백만 있는 이름은 없는 것으로 — 「   」라고 보여 주면 안 된다 */
  it("이름이 비었으면 1부터 세는 번호로", () => {
    expect(pageDeleteTargetLabel(1, pages)).toBe("슬라이드 2");
    expect(pageDeleteTargetLabel(2, pages)).toBe("슬라이드 3");
  });

  it("대상이 정해지지 않았으면 이 슬라이드", () => {
    expect(pageDeleteTargetLabel(null, pages)).toBe("이 슬라이드");
    expect(pageDeleteTargetLabel(9, pages)).toBe("이 슬라이드");
  });
});
