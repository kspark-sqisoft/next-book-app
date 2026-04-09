import { DEFAULT_SLIDE_HEIGHT, DEFAULT_SLIDE_WIDTH } from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

export type BookLeftDockSlideDims = {
  slideWidth: number;
  slideHeight: number;
};

/**
 * 북 편집/보기 워크스페이스 — 도킹 패널·헤더를 한 톤으로 맞출 때 사용.
 * (전문가용 툴 느낌: 얇은 구분선, 읽기 쉬운 제목 계층)
 */

export function bookDockedPanelRootClass(className?: string) {
  return cn("flex h-full min-h-0 flex-col overflow-hidden bg-card/50", className);
}

/** 오른쪽 독: 레이어 아래 **페이지·위젯 속성** 영역 — 배경으로 레이어 블록과 구분 */
export function bookRightDockInspectorShellClass(className?: string) {
  return cn(
    "min-h-0 flex-1 overflow-hidden bg-card/[0.44] dark:bg-card/[0.34]",
    className,
  );
}

/**
 * 도킹 패널 제목 행·가운데 캔버스 툴바 행 공통 — `AppLayout` 사이트 헤더와 동일 `h-12`로 한 줄로 맞음.
 */
const bookWorkspaceHeaderBandClass =
  "flex h-12 shrink-0 items-center gap-2.5 border-b border-border/70 bg-muted/[0.07] px-3 backdrop-blur-[8px]";

export function bookDockedPanelHeaderRowClass(className?: string) {
  return cn(bookWorkspaceHeaderBandClass, className);
}

/** 가운데 열: Undo/Redo·줌 툴바 줄(패널 헤더와 동일 밴드) */
export function bookCanvasToolbarRowClass(className?: string) {
  return cn(bookWorkspaceHeaderBandClass, "justify-start", className);
}

/** 헤더 제목 — 본문 톤에 가깝게 */
export function bookDockedPanelHeadingClass(className?: string) {
  return cn("text-xs font-semibold tracking-tight text-foreground", className);
}

export function bookDockedPanelHeaderIconClass(className?: string) {
  return cn("size-4 shrink-0 text-muted-foreground opacity-[0.92]", className);
}

/** Tailwind JIT용 리터럴 — 기준에 ×1.12, 가로형은 추가 ×1.18(합 ≈1.322) */
const bookLeftDockWidthClass = {
  portrait:
    "w-[min(calc(11rem*2/3*1.12),calc(100vw-5rem))] sm:w-[calc(17rem*2/3*1.12)] lg:w-[calc(20rem*2/3*1.12)]",
  landscape:
    "w-[min(calc(11rem*2/3*1.322),calc(100vw-5rem))] sm:w-[calc(17rem*2/3*1.322)] lg:w-[calc(20rem*2/3*1.322)]",
  neutral:
    "w-[min(calc(11rem*2/3*1.12),calc(100vw-5rem))] sm:w-[calc(17rem*2/3*1.12)] lg:w-[calc(20rem*2/3*1.12)]",
} as const;

function bookLeftDockWidthTier(sw: number, sh: number): keyof typeof bookLeftDockWidthClass {
  const w = Math.max(1, sw);
  const h = Math.max(1, sh);
  if (h > w) return "portrait";
  if (w > h) return "landscape";
  return "neutral";
}

/** 툴레일 오른쪽 탭 콘텐츠 열 — `flex-1`+불명확한 부모 너비면 열이 0에 가깝게 수축할 수 있어 고정 폭 계열로 둠. 슬라이드 비율에 따라 폭 배율 조정 */
export function bookLeftDockContentColumnClass(
  className?: string,
  slide?: BookLeftDockSlideDims,
) {
  const sw = slide?.slideWidth ?? DEFAULT_SLIDE_WIDTH;
  const sh = slide?.slideHeight ?? DEFAULT_SLIDE_HEIGHT;
  const tier = bookLeftDockWidthTier(sw, sh);
  return cn(
    "flex min-h-0 shrink-0 flex-col overflow-hidden border-border/50 bg-gradient-to-b from-muted/[0.08] via-card/30 to-card/40",
    bookLeftDockWidthClass[tier],
    className,
  );
}

/** 패널 하단 액션 바(페이지 추가 등) */
export function bookDockedPanelFooterClass(className?: string) {
  return cn(
    "flex shrink-0 flex-col gap-1.5 border-t border-border/70 bg-muted/[0.04] p-2 backdrop-blur-[6px]",
    className,
  );
}

/** 중앙 스테이지(툴바 아래 슬라이드 영역) — 라이트/다크에서 크롬과 구분 */
export function bookCanvasStageMatClass(className?: string) {
  return cn(
    "border-t border-border/35 bg-zinc-200/80 supports-[backdrop-filter]:backdrop-blur-[2px]",
    "dark:border-border/60 dark:bg-zinc-800/50 dark:ring-1 dark:ring-inset dark:ring-border/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    className,
  );
}
