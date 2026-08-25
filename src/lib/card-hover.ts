// 목록 카드 호버 반응 — 그리드와 리스트가 서로 다른 방식으로 반응한다.
//
// 그리드는 카드가 살짝 떠오르며 커지고(애플 계열 카드 인터랙션), 리스트는 행 높이가
// 흔들리면 목록 전체가 출렁이므로 크기를 건드리지 않고 배경만 바꾼다.
//
// 움직이는 속성은 scale·translate·box-shadow 뿐이라 레이아웃을 다시 계산하지 않는다.
// (Tailwind v4의 `scale-*`·`translate-*` 는 `transform` 이 아니라 동명의 개별 CSS 속성을
//  쓰므로, 트랜지션 목록에 `transform` 만 적으면 크기가 즉시 튄다.)
// 속도는 애플 스토어 카드 감각에 맞춘다 — 0.5초, 초반이 급하지 않은 완만한 커브.
// 키보드 사용자를 위해 focus-within에도 같은 반응을 주고, 동작 줄이기 설정에서는
// 크기·위치 변화를 빼고 윤곽선·그림자만 남긴다.
//
// 윤곽선은 `border`가 아니라 `ring` 으로 바꾼다 — `ui/card` 의 기본이 `ring-1 ring-foreground/10`
// 이라 border-width가 0이고, `hover:border-*` 는 화면에 아무 변화도 만들지 못한다.
// ring 은 box-shadow로 그려지므로 그림자와 같은 트랜지션을 탄다.

/**
 * 그리드 카드 — 떠오르며 살짝 확대.
 *
 * 확대된 카드가 옆 카드에 가리지 않도록 `relative` + `z-10`을 함께 건다.
 * 카드 안에서 위치를 잡는 요소들은 모두 안쪽 `relative` 래퍼를 기준으로 하므로
 * 카드에 `relative`를 더해도 배치가 달라지지 않는다.
 */
export const GRID_CARD_HOVER = [
  // 애플 스토어 카드처럼 천천히 — 0.5초에 완만한 커브(초반이 급하지 않다)
  "relative transition-[scale,translate,box-shadow] duration-500",
  "ease-[cubic-bezier(0.28,0.11,0.32,1)]",
  "hover:z-10 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg hover:ring-primary/50",
  "focus-within:z-10 focus-within:-translate-y-1 focus-within:scale-[1.02]",
  "focus-within:shadow-lg focus-within:ring-primary/50",
  "motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100",
  "motion-reduce:focus-within:translate-y-0 motion-reduce:focus-within:scale-100",
].join(" ");

/** 리스트 행 — 크기는 그대로, 배경과 윤곽선만 반응 */
export const LIST_ROW_HOVER = [
  "transition-[background-color,box-shadow] duration-300",
  "ease-[cubic-bezier(0.28,0.11,0.32,1)]",
  "hover:bg-muted/50 hover:ring-primary/50",
  "focus-within:bg-muted/50 focus-within:ring-primary/50",
].join(" ");

/**
 * 한 카드 안에 행을 나눠 담는 목록(디바이스 리스트처럼 `divide-y` 구조)의 행.
 * 행마다 윤곽선이 없으니 배경만 바꾼다.
 */
export const LIST_ROW_INSIDE_CARD_HOVER = [
  "transition-colors duration-300 ease-[cubic-bezier(0.28,0.11,0.32,1)]",
  "hover:bg-muted/50 focus-within:bg-muted/50",
].join(" ");

/**
 * 카드 목록 그리드의 열 수 — 목록 화면들이 같은 리듬을 쓰도록 한곳에 모아 둔다.
 *
 * 넓은 화면에서 4열까지 늘려 봤지만 카드가 잘게 쪼개져 보여 3열로 되돌렸다.
 * 열을 늘리려면 본문 컬럼 폭(`AppLayout`)도 함께 넓혀야 카드 크기가 유지된다.
 */
export const CARD_GRID_COLUMNS = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
