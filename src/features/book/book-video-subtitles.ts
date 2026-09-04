// 비디오 위젯 AI 자막(시뮬레이션) — 실제로는 추후 음성 인식(STT)+AI 번역으로 대체할 예정.
// 지금은 재생 시간에 따라 언어별 예시 대사를 순환해 "생성된 자막"처럼 보여준다.

export const BOOK_SUBTITLE_LANGS = [
  { value: "auto", label: "원어(자동 인식)" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
] as const;

export type BookSubtitleLang = (typeof BOOK_SUBTITLE_LANGS)[number]["value"];

export function normalizeBookSubtitleLang(v: unknown): BookSubtitleLang {
  return BOOK_SUBTITLE_LANGS.some((l) => l.value === v)
    ? (v as BookSubtitleLang)
    : "auto";
}

export function bookSubtitleLangLabel(v: unknown): string {
  return (
    BOOK_SUBTITLE_LANGS.find((l) => l.value === v)?.label ?? "원어(자동 인식)"
  );
}

/** 자막 크기 옵션 — sm이 기본(기존 크기) */
export const BOOK_SUBTITLE_SIZES = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
] as const;

export type BookSubtitleSize = (typeof BOOK_SUBTITLE_SIZES)[number]["value"];

export function normalizeBookSubtitleSize(v: unknown): BookSubtitleSize {
  return BOOK_SUBTITLE_SIZES.some((s) => s.value === v)
    ? (v as BookSubtitleSize)
    : "sm";
}

/**
 * 크기 옵션 → 자막 글자 크기(화면 px).
 *
 * 위젯 높이는 **슬라이드 단위**로 받고 마지막에 배율을 곱한다 — 텍스트 위젯과 같은 규칙.
 *
 * 예전 공식은 표시 높이의 8·11.5·15% 에 화면 px 상한(24·34·46)을 걸었다. 기본 슬라이드
 * (960×540)를 배율 1 로 보는 데스크톱 편집 화면에선 늘 상한에 걸려 실제 비율은
 * 4.4·6.3·8.5% 였는데, 배율 0.39 인 폰에선 상한에 못 미쳐 15% 가 그대로 적용돼 자막이
 * 두 배 가까이 커 보였다. 그래서 데스크톱에서 실제로 보이던 비율을 그대로 규칙으로 삼고
 * 상한을 없앤다. 작은 위젯에서 글자가 사라지지 않게 슬라이드 단위 하한(16·22·28)만 둔다
 * — 540 높이 위젯은 24·34·46, 200 높이 위젯은 16·22·28 로 예전 데스크톱과 같다.
 */
export function subtitleFontPx(
  size: unknown,
  widgetHeightSlidePx: number,
  scale: number,
): number {
  const h = Number.isFinite(widgetHeightSlidePx)
    ? Math.max(0, widgetHeightSlidePx)
    : 0;
  const s = Number.isFinite(scale) ? Math.max(0, scale) : 0;
  let slidePx: number;
  switch (normalizeBookSubtitleSize(size)) {
    case "lg":
      slidePx = Math.max(28, h * 0.085);
      break;
    case "md":
      slidePx = Math.max(22, h * 0.063);
      break;
    default:
      slidePx = Math.max(16, h * 0.044);
  }
  return Math.max(1, Math.round(slidePx * s));
}

/** 자막이 위젯 하단에서 띄우는 간격(화면 px) — 높이의 7%, 슬라이드 단위 최소 16px, 배율 반영 */
export function subtitleBottomGapPx(
  widgetHeightSlidePx: number,
  scale: number,
): number {
  const h = Number.isFinite(widgetHeightSlidePx)
    ? Math.max(0, widgetHeightSlidePx)
    : 0;
  const s = Number.isFinite(scale) ? Math.max(0, scale) : 0;
  return Math.round(Math.max(16, h * 0.07) * s);
}

/** 한 줄이 화면에 머무는 시간(초) */
const LINE_SEC = 4;

/** 시뮬레이션 대사 — 실제 구현 시 AI STT·번역 결과로 대체 */
const LINES: Record<BookSubtitleLang, string[]> = {
  auto: [
    "안녕하세요, 크레타 사이니지입니다.",
    "이 자막은 AI가 음성을 인식해 실시간으로 생성합니다.",
    "핵심 소식을 화면에서 바로 확인해 보세요.",
    "언어 설정을 바꾸면 자동으로 번역됩니다.",
    "시청해 주셔서 감사합니다.",
  ],
  ko: [
    "안녕하세요, 크레타 사이니지입니다.",
    "이 자막은 AI가 한국어로 번역해 보여줍니다.",
    "핵심 소식을 화면에서 바로 확인해 보세요.",
    "언어 설정에서 다른 언어도 고를 수 있습니다.",
    "시청해 주셔서 감사합니다.",
  ],
  en: [
    "Hello, this is Creta Signage.",
    "These captions are generated and translated by AI.",
    "Catch the key updates right on this screen.",
    "Switch the language option to translate instantly.",
    "Thanks for watching.",
  ],
  ja: [
    "こんにちは、クレタサイネージです。",
    "この字幕はAIが生成・翻訳しています。",
    "重要なお知らせを画面でご確認ください。",
    "言語設定で他の言語にも切り替えられます。",
    "ご視聴ありがとうございます。",
  ],
  zh: [
    "您好，这里是Creta数字标牌。",
    "此字幕由AI生成并翻译。",
    "请在屏幕上查看重要信息。",
    "在语言设置中可切换其他语言。",
    "感谢观看。",
  ],
};

/** 재생 시간(초) → 시뮬레이션 자막 한 줄 */
export function simulatedSubtitleLine(
  lang: unknown,
  currentTimeSec: number,
): string {
  const lines = LINES[normalizeBookSubtitleLang(lang)];
  const t = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0;
  return lines[Math.floor(t / LINE_SEC) % lines.length];
}
