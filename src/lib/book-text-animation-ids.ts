/**
 * 텍스트 위젯 애니메이션 식별자 — **서버·클라이언트 공용 단일 출처.**
 *
 * 이전에는 같은 목록이 두 벌이었다. 클라이언트 `book-text-animation.ts`의
 * `BOOK_TEXT_ANIMATION_IDS`와 서버 `books.service.ts`의 `BOOK_TEXT_ANIMATIONS` 화이트리스트가
 * "동일 키 유지"라는 주석에 기대 손으로 동기화됐다. 한쪽에만 효과를 추가하면 저장은
 * 되는데 서버 검증에서 조용히 떨어지거나(또는 그 반대) 타입만 맞고 동작이 어긋난다.
 *
 * 렌더링 로직(CSS 변수·글자 분할)은 무겁고 브라우저 전용이라 서버가 가져갈 수 없으므로,
 * 식별자만 이 파일로 떼어 양쪽이 함께 import 한다.
 */
export const BOOK_TEXT_ANIMATION_IDS = [
  "none",
  "typewriter",
  "fadeIn",
  "slideUp",
  "zoomIn",
  "blurIn",
  "charPop",
  "wordFade",
  "wave",
  "marquee",
  "scrollUp",
] as const;

export type BookTextAnimationId = (typeof BOOK_TEXT_ANIMATION_IDS)[number];

const ID_SET: ReadonlySet<string> = new Set(BOOK_TEXT_ANIMATION_IDS);

export function isBookTextAnimationId(s: string): s is BookTextAnimationId {
  return ID_SET.has(s);
}
