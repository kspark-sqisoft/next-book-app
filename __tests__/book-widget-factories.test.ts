// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  BOOK_DROP_WIDGET_KINDS,
  type BookDropWidgetKind,
  DEFAULT_BOOK_CHART_DATA,
  DEFAULT_BOOK_MAP_QUERY,
  DEFAULT_BOOK_QR_VALUE,
} from "@/features/book/book-canvas";
import {
  createAdSlotWidget,
  createCalendarWidget,
  createChartWidget,
  createDigitalClockWidget,
  createMapWidget,
  createNewsWidget,
  createQrWidget,
  createTextWidget,
  createTickerWidget,
  createWeatherWidget,
  createWebviewWidget,
  createYoutubeWidget,
  WIDGET_FACTORY_BY_KIND,
} from "@/features/book/widget-factories";

/**
 * 팩토리의 기본값은 사용자가 위젯을 놓는 순간 바로 보이는 값이다.
 * 두 화면에 흩어져 있던 리터럴을 한 곳으로 모으면서 값이 바뀌지 않았는지 고정한다.
 */
const factories = [
  ["text", createTextWidget],
  ["weather", createWeatherWidget],
  ["digitalClock", createDigitalClockWidget],
  ["news", createNewsWidget],
  ["ticker", createTickerWidget],
  ["qr", createQrWidget],
  ["webview", createWebviewWidget],
  ["youtube", createYoutubeWidget],
  ["map", createMapWidget],
  ["chart", createChartWidget],
  ["calendar", createCalendarWidget],
  ["adSlot", createAdSlotWidget],
] as const;

describe("위젯 팩토리", () => {
  it.each(factories)(
    "%s — 좌표·타입·크기를 갖춘 요소를 만든다",
    (type, make) => {
      const el = make(12, 34);
      expect(el.type).toBe(type);
      expect(el.x).toBe(12);
      expect(el.y).toBe(34);
      expect(el.width).toBeGreaterThan(0);
      expect(el.height).toBeGreaterThan(0);
    },
  );

  it.each(factories)("%s — 부를 때마다 새 id", (_type, make) => {
    expect(make(0, 0).id).not.toBe(make(0, 0).id);
  });

  it("텍스트는 편집을 유도하는 기본 문구를 넣는다", () => {
    const el = createTextWidget(0, 0);
    if (el.type !== "text") throw new Error("text 여야 한다");
    expect(el.text).toBe("텍스트를 입력하세요");
    expect(el.richHtml).toBe("<p>텍스트를 입력하세요</p>");
    expect(el.fontSize).toBe(28);
  });

  it("QR·지도는 바로 보이도록 기본 값을 채운다", () => {
    const qr = createQrWidget(0, 0);
    if (qr.type !== "qr") throw new Error("qr 여야 한다");
    expect(qr.qrValue).toBe(DEFAULT_BOOK_QR_VALUE);

    const map = createMapWidget(0, 0);
    if (map.type !== "map") throw new Error("map 이어야 한다");
    expect(map.mapQuery).toBe(DEFAULT_BOOK_MAP_QUERY);
  });

  /**
   * 기본 차트 데이터는 배열이다. 그대로 넣으면 위젯 여러 개가 **한 배열을 공유**해
   * 한쪽을 고칠 때 다른 쪽도 바뀐다. 복제 함수에서 겪은 것과 같은 종류의 함정이다.
   */
  it("차트 기본 데이터는 위젯마다 별개 배열이다", () => {
    const a = createChartWidget(0, 0);
    const b = createChartWidget(0, 0);
    if (a.type !== "chart" || b.type !== "chart")
      throw new Error("chart 여야 한다");
    expect(a.chartData).toEqual(DEFAULT_BOOK_CHART_DATA);
    expect(a.chartData).not.toBe(DEFAULT_BOOK_CHART_DATA);
    expect(a.chartData).not.toBe(b.chartData);
  });
});

/**
 * 드롭·팔레트 처리가 13분기 if 체인에서 표 하나로 바뀌면서, 종류를 표에 넣는 것을
 * 잊어도 **타입은 통과한다**(`Partial<Record<…>>`). 그 경우 화면은 조용히
 * "지원하지 않는 위젯 종류입니다" 토스트를 띄운다 — 오류 없이 기능만 사라진다.
 * 그래서 표의 열쇠 집합 자체를 고정한다.
 */
describe("팔레트 종류 → 팩토리 표", () => {
  /** 표에 없어야 하는 것들 — 파일 업로드·안내 문구처럼 화면마다 다르게 다룬다 */
  const HANDLED_PER_SCREEN: readonly BookDropWidgetKind[] = [
    "image",
    "video",
    "mediaPlaylist",
    "pdfImport",
  ];

  it("화면별로 다루는 4종을 뺀 모든 종류를 덮는다", () => {
    const expected = BOOK_DROP_WIDGET_KINDS.filter(
      (kind) => !HANDLED_PER_SCREEN.includes(kind),
    );
    expect(Object.keys(WIDGET_FACTORY_BY_KIND).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it("표의 팩토리는 요청한 종류의 요소를 그 좌표에 만든다", () => {
    for (const [kind, make] of Object.entries(WIDGET_FACTORY_BY_KIND)) {
      const el = make?.(12, 34);
      expect(el?.type).toBe(kind);
      expect(el?.x).toBe(12);
      expect(el?.y).toBe(34);
    }
  });

  /** 가운데 정렬은 요소의 width/height 로 계산한다 — 없으면 왼쪽 위로 붙는다 */
  it("표의 모든 팩토리가 크기를 채운다", () => {
    for (const make of Object.values(WIDGET_FACTORY_BY_KIND)) {
      const el = make?.(0, 0);
      expect(el?.width).toBeGreaterThan(0);
      expect(el?.height).toBeGreaterThan(0);
    }
  });
});
