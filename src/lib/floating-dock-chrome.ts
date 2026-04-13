/**
 * 플로팅 채팅(`ChatDock`)·북 AI(`BookAiAssistantPanel`) FAB를 같은 높이·대칭 인셋에 두기 위한 클래스.
 * `bottom`은 너무 크면 사이트 푸터보다 위에 떠 보이므로, 컴팩트 푸터 높이 안쪽(대략 세로 중앙)에 가깝게 두도록
 * 기본·sm 모두 이전(0.75rem / 1.5rem)보다 살짝 낮춤.
 */
export const floatingDockBottomInsetClass =
  "bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]";

export const floatingDockVerticalInsetClass =
  "top-[max(0.75rem,env(safe-area-inset-top,0px))] bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:top-[max(1.5rem,env(safe-area-inset-top,0px))] sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))]";

/** 채팅: 오른쪽(LTR), 가장자리에서 한 단계 안쪽 */
export const floatingDockChatInsetEndClass = "end-4 sm:end-7";

/** 북 AI: 왼쪽(LTR), 채팅과 미러 */
export const floatingDockAiInsetStartClass = "start-4 sm:start-7";

/**
 * `ChatDock` 전역 플로팅 레이어. `AppLayout` 헤더·푸터(`z-280`), 북 접힘 스트립(`z-[250]`·`z-[260]`),
 * `BookWorkspaceShell` 바(`z-[250]`), 에디터 툴 레일 팝오버(`z-[500]`), 북 플로팅 패널(~280+)보다 위 —
 * 알럿·다이얼로그(`z-[10000]`+) 아래.
 */
export const floatingDockChatZIndexClass = "z-[3500]";

/**
 * `AppLayout` 북 라우트 사이트 헤더·푸터 **접기·펼치기** 공통 겉모습.
 * `Button`은 `variant="outline"` `size="icon-sm"`(로그아웃 `size="sm"` 과 동일 `h-7`·`w-7`) 과 함께 쓴다.
 */
export const floatingDockBookSiteChromeToggleClass =
  "pointer-events-auto shrink-0 border-border/90 bg-card/95 shadow-md ring-1 ring-black/5 backdrop-blur-md dark:ring-white/10";

/**
 * 헤더 접힘: **보이는 건 버튼만**(막대·배경 없음). 펼친 헤더와 같은 착지용 `h-12`·`items-center` 래퍼는 투명·`pointer-events-none`이라 아래 북 UI로 이벤트가 통과한다.
 */
export const floatingDockBookSiteHeaderCollapsedStripClass =
  "pointer-events-none fixed inset-x-0 top-0 z-[260]";

export const floatingDockBookSiteHeaderCollapsedStripInnerClass =
  "pointer-events-none mx-auto flex h-12 w-full max-w-3xl items-center justify-end px-4";

/**
 * 푸터 접힘: 버튼만 보임. 펼친 푸터와 같은 패딩·세로 정렬만 투명 래퍼로 맞춤.
 */
export const floatingDockBookSiteFooterCollapsedStripClass =
  "pointer-events-none fixed inset-x-0 bottom-0 z-[250]";

export const floatingDockBookSiteFooterCollapsedStripInnerClass =
  "pointer-events-none mx-auto flex w-full max-w-3xl items-center justify-end px-4 py-2 sm:py-2.5";

/** 닫힌 상태 FAB: 동일 외경·아이콘 크기(Button `size="icon"` 기본 8은 className으로 덮음) */
export const floatingDockFabButtonClass =
  "size-12 shrink-0 rounded-full p-0 [&_svg]:pointer-events-none";

export const floatingDockFabIconClass = "size-6 shrink-0";
