/**
 * 슬라이드쇼(미리보기) 페이지 전환. 서버·편집기·프레젠테이션에서 동일 식별자를 씁니다.
 * 새 효과 추가: 아래 배열·라벨·CSS(`book-presentation-transitions.css`)·백엔드 화이트리스트를 함께 수정.
 */
export const BOOK_PRESENTATION_TRANSITION_IDS = [
  "none",
  "fade",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "zoomIn",
  "blurIn",
] as const;

export type BookPresentationTransitionId =
  (typeof BOOK_PRESENTATION_TRANSITION_IDS)[number];

export const DEFAULT_BOOK_PRESENTATION_TRANSITION_MS = 450;

export const BOOK_PRESENTATION_TRANSITION_OPTIONS: {
  id: BookPresentationTransitionId;
  label: string;
}[] = [
  { id: "none", label: "없음 (즉시 전환)" },
  { id: "fade", label: "페이드" },
  { id: "slideLeft", label: "슬라이드 (오른쪽에서)" },
  { id: "slideRight", label: "슬라이드 (왼쪽에서)" },
  { id: "slideUp", label: "슬라이드 (아래에서)" },
  { id: "slideDown", label: "슬라이드 (위에서)" },
  { id: "zoomIn", label: "줌 인" },
  { id: "blurIn", label: "블러 페이드" },
];

export function isBookPresentationTransitionId(
  s: string,
): s is BookPresentationTransitionId {
  return (BOOK_PRESENTATION_TRANSITION_IDS as readonly string[]).includes(s);
}

export function normalizeBookPresentationTransition(
  raw: unknown,
): BookPresentationTransitionId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (isBookPresentationTransitionId(s)) return s;
  return "none";
}

export function clampBookPresentationTransitionMs(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_BOOK_PRESENTATION_TRANSITION_MS;
  return Math.min(2500, Math.max(80, Math.round(n)));
}
