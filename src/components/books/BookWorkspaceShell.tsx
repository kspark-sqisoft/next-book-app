"use client";

// 북 편집/보기 3열 뼈대: 좌 썸네일·중앙 캔버스·우 패널, 패널 접기
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { goBackOrPush } from "@/lib/navigate-back";
import { cn } from "@/lib/utils";

type BookWorkspaceShellProps = {
  /** 상단 가운데(제목 등) */
  titleArea: ReactNode;
  /** 상단 오른쪽 액션 */
  actions?: ReactNode;
  /** 왼쪽: 페이지 목록 */
  left: ReactNode;
  /** 가운데: 슬라이드(위젯 팔레트는 이 안에서 absolute) */
  center: ReactNode;
  /** 오른쪽: 속성 패널(없으면 보기 모드) */
  right?: ReactNode;
  /**
   * 좌·우 패널을 접힌 상태로 잠근다(모바일 보기 전용).
   * 펼침 토글은 자리를 지키되 딤 처리되어 눌리지 않는다 — 숨기면 "원래 없는 화면"으로
   * 오해하지만, 딤이면 "여기선 잠겼다"로 읽힌다.
   */
  panelsLocked?: boolean;
  className?: string;
};

const floatingToggleClass = cn(
  "pointer-events-auto size-9 shrink-0 cursor-pointer select-none rounded-full shadow-md touch-manipulation",
  "border border-border/90 bg-card/95 text-muted-foreground backdrop-blur-sm",
  "ring-1 ring-black/[0.04] dark:ring-white/10",
  "transition-[box-shadow,background-color,color] duration-150",
  "hover:bg-accent hover:text-accent-foreground hover:shadow-lg",
  "active:bg-accent/90",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/**
 * 포인터는 pointerdown에서 처리(캔버스와의 클릭 경쟁 완화).
 * 키보드/스크린리더는 click으로 한 번만 토글되도록 ref로 중복 제거.
 */
function PanelEdgeToggle({
  className,
  onPress,
  title,
  "aria-label": ariaLabel,
  disabled,
  children,
}: {
  className?: string;
  onPress: () => void;
  title: string;
  "aria-label": string;
  /** 딤 처리 + 동작 차단(패널 잠금) — Button의 disabled 스타일이 흐림을 담당 */
  disabled?: boolean;
  children: ReactNode;
}) {
  const suppressNextClick = useRef(false);
  const clearSuppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (clearSuppressTimer.current) {
          clearTimeout(clearSuppressTimer.current);
          clearSuppressTimer.current = null;
        }
        suppressNextClick.current = true;
        onPress();
        clearSuppressTimer.current = setTimeout(() => {
          suppressNextClick.current = false;
          clearSuppressTimer.current = null;
        }, 400);
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        if (suppressNextClick.current) {
          suppressNextClick.current = false;
          if (clearSuppressTimer.current) {
            clearTimeout(clearSuppressTimer.current);
            clearSuppressTimer.current = null;
          }
          return;
        }
        onPress();
      }}
    >
      {children}
    </Button>
  );
}

/**
 * 북 편집/보기 워크스페이스. `AppLayout`의 `<main>` 안에서 `flex-1 min-h-0`로 두어
 * 사이트 헤더·푸터 사이 높이를 채웁니다(전역 `fixed`로 헤더를 가리지 않음).
 * 좌·우 패널은 접어 편집 영역을 넓게 쓸 수 있습니다.
 */
export function BookWorkspaceShell({
  titleArea,
  actions,
  left,
  center,
  right,
  panelsLocked,
  className,
}: BookWorkspaceShellProps) {
  const router = useRouter();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const hasRight = right != null;
  /* 잠금 중엔 열림 상태를 지우지 않고 표시만 접는다 — 잠금이 풀리면 원래대로 복귀 */
  const leftVisible = leftOpen && !panelsLocked;
  const rightVisible = rightOpen && !panelsLocked;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col bg-background text-foreground",
        className,
      )}
    >
      <header className="relative z-[250] flex h-12 shrink-0 items-center gap-2 border-b border-border/80 bg-card/95 px-4 shadow-sm backdrop-blur-md sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          /* 목록·플레이리스트 등 진입했던 화면으로 복귀, 직접 진입이면 북 목록 */
          onClick={() => goBackOrPush(router, "/books")}
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">{titleArea}</div>
        <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {actions}
        </div>
      </header>
      {/* overflow-x: 패널 밖으로 삐져나온 토글 히트 영역이 잘리지 않게 */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-visible overflow-y-hidden">
        {leftVisible ? (
          <div className="relative z-20 flex min-h-0 shrink-0 self-stretch overflow-visible">
            <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden border-e border-border/50 bg-gradient-to-b from-card/80 to-muted/[0.06]">
              {left}
            </div>
            <PanelEdgeToggle
              className={cn(
                floatingToggleClass,
                "absolute top-1/2 right-0 z-[60] -translate-y-1/2 translate-x-1/2",
              )}
              onPress={() => setLeftOpen(false)}
              aria-label="페이지 패널 접기"
              title="페이지 패널 접기"
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </PanelEdgeToggle>
          </div>
        ) : null}

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-visible overflow-y-hidden bg-muted/15">
          <div className="relative z-0 min-h-0 flex min-w-0 flex-1 flex-col overflow-hidden">
            {center}
          </div>
          {!leftVisible ? (
            <PanelEdgeToggle
              className={cn(
                floatingToggleClass,
                "absolute top-1/2 left-3 z-[60] -translate-y-1/2",
              )}
              onPress={() => setLeftOpen(true)}
              disabled={panelsLocked}
              aria-label={
                panelsLocked
                  ? "모바일에서는 페이지 패널을 열 수 없습니다"
                  : "페이지 패널 펼치기"
              }
              title={
                panelsLocked
                  ? "모바일에서는 페이지 패널을 열 수 없습니다"
                  : "페이지 패널 펼치기"
              }
            >
              <PanelLeftOpen className="size-4" aria-hidden />
            </PanelEdgeToggle>
          ) : null}
          {hasRight && !rightVisible ? (
            <PanelEdgeToggle
              className={cn(
                floatingToggleClass,
                "absolute top-1/2 right-3 z-[60] -translate-y-1/2",
              )}
              onPress={() => setRightOpen(true)}
              disabled={panelsLocked}
              aria-label={
                panelsLocked
                  ? "모바일에서는 속성 패널을 열 수 없습니다"
                  : "속성 패널 펼치기"
              }
              title={
                panelsLocked
                  ? "모바일에서는 속성 패널을 열 수 없습니다"
                  : "속성 패널 펼치기"
              }
            >
              <PanelRightOpen className="size-4" aria-hidden />
            </PanelEdgeToggle>
          ) : null}
        </div>

        {hasRight && rightVisible ? (
          <div className="relative z-20 flex min-h-0 shrink-0 self-stretch overflow-visible">
            <PanelEdgeToggle
              className={cn(
                floatingToggleClass,
                "absolute top-1/2 left-0 z-[60] -translate-x-1/2 -translate-y-1/2",
              )}
              onPress={() => setRightOpen(false)}
              aria-label="속성 패널 접기"
              title="속성 패널 접기"
            >
              <PanelRightClose className="size-4" aria-hidden />
            </PanelEdgeToggle>
            <div className="flex h-full min-h-0 min-w-0 max-h-full flex-col overflow-hidden border-s border-border/50 bg-gradient-to-b from-card/85 to-muted/[0.05]">
              {right}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
