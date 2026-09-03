import type {
  BookCanvasElement,
  BookEditorPageState,
} from "@/features/book/book-canvas";

/** 요소 종류 → 사용자에게 보여 주는 이름. 표에 없는 종류는 그냥 "위젯" */
const ELEMENT_KIND_LABEL: Partial<Record<BookCanvasElement["type"], string>> = {
  text: "텍스트 위젯",
  image: "이미지 위젯",
  video: "동영상 위젯",
  weather: "날씨 위젯",
  news: "뉴스 위젯",
  mediaPlaylist: "미디어 위젯",
  digitalClock: "디지털 시계 위젯",
  webview: "웹뷰 위젯",
  map: "지도 위젯",
  calendar: "캘린더 위젯",
  qr: "QR코드 위젯",
  chart: "차트 위젯",
  ticker: "티커 위젯",
  youtube: "유튜브 위젯",
  adSlot: "광고 위젯",
  drawing: "그리기",
};

export function bookElementKindLabel(el: BookCanvasElement): string {
  return ELEMENT_KIND_LABEL[el.type] ?? "위젯";
}

/**
 * 삭제 확인 창의 대상 이름. 여럿이면 개수로, 하나면 종류로 부른다.
 *
 * 두 화면에 22분기 if 체인으로 복사돼 있던 것을 표 하나로 바꿨다.
 */
export function widgetDeleteTargetLabel(
  ids: readonly string[],
  page: BookEditorPageState | undefined,
): string {
  if (ids.length === 0 || !page) return "위젯";
  if (ids.length > 1) return `${ids.length}개 위젯`;
  const el = page.elements.find((e) => e.id === ids[0]);
  return el ? bookElementKindLabel(el) : "위젯";
}

/** 슬라이드 삭제 확인 창의 대상 이름 — 이름이 비어 있으면 번호로 부른다 */
export function pageDeleteTargetLabel(
  index: number | null,
  pages: readonly BookEditorPageState[],
): string {
  const page = index != null ? pages[index] : undefined;
  if (index == null || !page) return "이 슬라이드";
  return page.name.trim() || `슬라이드 ${index + 1}`;
}
