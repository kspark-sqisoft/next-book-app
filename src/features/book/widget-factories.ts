import type { BookDropWidgetKind } from "@/features/book/book-canvas";
import {
  type BookCanvasElement,
  DEFAULT_BOOK_AD_SLOT_HEIGHT,
  DEFAULT_BOOK_AD_SLOT_WIDTH,
  DEFAULT_BOOK_CALENDAR_HEIGHT,
  DEFAULT_BOOK_CALENDAR_WIDTH,
  DEFAULT_BOOK_CHART_DATA,
  DEFAULT_BOOK_CHART_HEIGHT,
  DEFAULT_BOOK_CHART_TYPE,
  DEFAULT_BOOK_CHART_WIDTH,
  DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
  DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
  DEFAULT_BOOK_MAP_BBOX,
  DEFAULT_BOOK_MAP_HEIGHT,
  DEFAULT_BOOK_MAP_LAT,
  DEFAULT_BOOK_MAP_LON,
  DEFAULT_BOOK_MAP_QUERY,
  DEFAULT_BOOK_MAP_WIDTH,
  DEFAULT_BOOK_MAP_ZOOM_PCT,
  DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
  DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
  DEFAULT_BOOK_QR_HEIGHT,
  DEFAULT_BOOK_QR_VALUE,
  DEFAULT_BOOK_QR_WIDTH,
  DEFAULT_BOOK_TICKER_HEIGHT,
  DEFAULT_BOOK_TICKER_WIDTH,
  DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
  DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
  DEFAULT_BOOK_WEBVIEW_HEIGHT,
  DEFAULT_BOOK_WEBVIEW_WIDTH,
  DEFAULT_BOOK_YOUTUBE_HEIGHT,
  DEFAULT_BOOK_YOUTUBE_WIDTH,
} from "@/features/book/book-canvas";
import { defaultTextWidgetBoxHeight } from "@/features/book/book-text-widget";

/**
 * 위젯 하나를 만드는 순수 함수들.
 *
 * 이전에는 위젯 종류마다 `addXAt` 핸들러가 있었고, 그 안에서 요소 리터럴을 만든 뒤
 * 같은 3줄(페이지에 push → 선택)을 반복했다. 그 핸들러 13개가 `BookDetailPage` 와
 * `BookEditorPage` 에 **글자 단위로 같은 복사본**으로 존재했다.
 *
 * 종류마다 다른 것은 요소의 기본값뿐이므로 그 부분만 여기로 뺀다. 삽입 절차는
 * `use-widget-inserters.ts` 가 한 번만 구현한다. 순수 함수라 기본값을 테스트로 고정할 수 있다.
 */

const TEXT_FONT_SIZE = 28;

export function createTextWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "text",
    x,
    y,
    text: "텍스트를 입력하세요",
    richHtml: "<p>텍스트를 입력하세요</p>",
    fontSize: TEXT_FONT_SIZE,
    fill: "#111827",
    width: 480,
    height: defaultTextWidgetBoxHeight(TEXT_FONT_SIZE),
  };
}

export function createWeatherWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "weather",
    x,
    y,
    width: DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
    height: DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
  };
}

export function createDigitalClockWidget(
  x: number,
  y: number,
): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "digitalClock",
    x,
    y,
    width: DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
    height: DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
  };
}

export function createNewsWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "news",
    x,
    y,
    width: DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
    height: DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
  };
}

export function createTickerWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "ticker",
    x,
    y,
    width: DEFAULT_BOOK_TICKER_WIDTH,
    height: DEFAULT_BOOK_TICKER_HEIGHT,
  };
}

export function createQrWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "qr",
    x,
    y,
    width: DEFAULT_BOOK_QR_WIDTH,
    height: DEFAULT_BOOK_QR_HEIGHT,
    qrValue: DEFAULT_BOOK_QR_VALUE,
  };
}

export function createWebviewWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "webview",
    x,
    y,
    width: DEFAULT_BOOK_WEBVIEW_WIDTH,
    height: DEFAULT_BOOK_WEBVIEW_HEIGHT,
  };
}

export function createYoutubeWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "youtube",
    x,
    y,
    width: DEFAULT_BOOK_YOUTUBE_WIDTH,
    height: DEFAULT_BOOK_YOUTUBE_HEIGHT,
  };
}

export function createMapWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "map",
    x,
    y,
    width: DEFAULT_BOOK_MAP_WIDTH,
    height: DEFAULT_BOOK_MAP_HEIGHT,
    mapQuery: DEFAULT_BOOK_MAP_QUERY,
    mapLat: DEFAULT_BOOK_MAP_LAT,
    mapLon: DEFAULT_BOOK_MAP_LON,
    mapBbox: DEFAULT_BOOK_MAP_BBOX,
    mapZoomPct: DEFAULT_BOOK_MAP_ZOOM_PCT,
  };
}

export function createChartWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "chart",
    x,
    y,
    width: DEFAULT_BOOK_CHART_WIDTH,
    height: DEFAULT_BOOK_CHART_HEIGHT,
    chartType: DEFAULT_BOOK_CHART_TYPE,
    // 기본 데이터는 배열이므로 복사해서 넣는다 — 그대로 주면 위젯들이 한 배열을 공유한다
    chartData: [...DEFAULT_BOOK_CHART_DATA],
  };
}

export function createCalendarWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "calendar",
    x,
    y,
    width: DEFAULT_BOOK_CALENDAR_WIDTH,
    height: DEFAULT_BOOK_CALENDAR_HEIGHT,
  };
}

export function createAdSlotWidget(x: number, y: number): BookCanvasElement {
  return {
    id: crypto.randomUUID(),
    type: "adSlot",
    x,
    y,
    width: DEFAULT_BOOK_AD_SLOT_WIDTH,
    height: DEFAULT_BOOK_AD_SLOT_HEIGHT,
  };
}

/**
 * 팔레트 종류 → 팩토리.
 *
 * 이전에는 드롭 처리와 팔레트 더블클릭 처리가 각각 13분기 if 체인이었고, 그 두 벌이
 * 화면 두 곳에 또 복사돼 있었다(합계 400줄 남짓). 표 하나로 바꾸면 분기가 사라지고,
 * 새 위젯을 추가할 때 고칠 자리도 여기 한 곳이 된다.
 *
 * 여기 없는 종류(image·video·mediaPlaylist·pdfImport)는 파일 업로드·안내 문구처럼
 * 화면마다 다르게 처리해야 하는 것들이라 호출부에 남긴다.
 */
export const WIDGET_FACTORY_BY_KIND: Partial<
  Record<BookDropWidgetKind, (x: number, y: number) => BookCanvasElement>
> = {
  text: createTextWidget,
  weather: createWeatherWidget,
  digitalClock: createDigitalClockWidget,
  news: createNewsWidget,
  ticker: createTickerWidget,
  qr: createQrWidget,
  webview: createWebviewWidget,
  youtube: createYoutubeWidget,
  map: createMapWidget,
  chart: createChartWidget,
  calendar: createCalendarWidget,
  adSlot: createAdSlotWidget,
};
