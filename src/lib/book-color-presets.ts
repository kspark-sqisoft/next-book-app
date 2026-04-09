/**
 * 리치 텍스트 글자색·슬라이드 배경 등 에디터에서 쓰는 HEX 스와치 목록.
 */
export const BOOK_HEX_COLOR_PRESETS = [
  "#000000",
  "#111827",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#9333ea",
  "#db2777",
  "#64748b",
  "#ffffff",
] as const;

export type BookHexColorPreset = (typeof BOOK_HEX_COLOR_PRESETS)[number];
