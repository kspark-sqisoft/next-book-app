"use client";

// 워크스페이스 최좌측 세로 탭 — 페이지 / 위젯 / 미디어 라이브러리 / 템플릿 / Elements / 드로잉.
// (팔레트의 「미디어」 위젯과 헷갈리지 않게 레일 쪽은 '미디어 라이브러리'로 적는다)
//
// 크레타 사이드바와 같은 규칙: 기본은 펼침(아이콘 + 이름), 접으면 아이콘만 남고
// 접힘 상태는 localStorage에 기억한다. 아이콘 색은 항목마다 달라 접었을 때도
// 색으로 자리를 찾을 수 있게 한다(글자에는 색을 입히지 않는다).
import {
  Blocks,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  FileStack,
  ImagePlus,
  LayoutTemplate,
  type LucideIcon,
  Pencil,
  Shapes,
  Wand2,
} from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BookEditorLeftTab } from "@/lib/book-editor-panel-events";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "book.editor.rail.collapsed";
const COLLAPSED_EVENT = "book-editor-rail-collapsed-change";

/** 기본은 펼침 — 저장된 값이 "1"일 때만 접는다 */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* 저장 실패는 무시 */
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const railBtn = cn(
  "relative h-10 w-full shrink-0 justify-start gap-2.5 rounded-xl border border-transparent px-2.5 text-muted-foreground",
  "transition-[color,background-color,border-color,box-shadow] duration-150",
  "hover:bg-muted/70 hover:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const railBtnCollapsed = "w-10 justify-center px-0";

const railBtnActive = cn(
  "border-primary/40 bg-primary/14 text-primary shadow-sm ring-1 ring-primary/10",
  "hover:bg-primary/[0.18] hover:text-primary",
);

type RailItem = {
  key: string;
  /** 펼쳤을 때 보이는 이름 */
  label: string;
  /** 툴팁 — 이름만으로 부족한 설명 */
  tooltip: string;
  icon: LucideIcon;
  iconClass: string;
  /** 탭 항목이면 지정 — 없으면 눌렀을 때 창을 여는 액션 */
  tab?: BookEditorLeftTab;
  onClick?: () => void;
  disabled?: boolean;
  /** 위쪽에 구분선을 둔다 */
  separatorBefore?: boolean;
};

export type BookEditorToolRailProps = {
  className?: string;
  activeTab: BookEditorLeftTab;
  onActiveTabChange: (tab: BookEditorLeftTab) => void;
  mediaLibraryEnabled?: boolean;
  mediaDisabledHint?: string;
  /** 있으면 "이미지 편집" 항목 표시 — 전체 화면 편집 창을 연다(탭 아님) */
  onOpenImageEditor?: () => void;
  /** 있으면 "비디오 편집" 항목 표시 */
  onOpenVideoEditor?: () => void;
};

export function BookEditorToolRail({
  className,
  activeTab,
  onActiveTabChange,
  mediaLibraryEnabled = true,
  mediaDisabledHint = "북을 저장한 뒤 이 화면에서 미디어 라이브러리를 쓸 수 있어요.",
  onOpenImageEditor,
  onOpenVideoEditor,
}: BookEditorToolRailProps) {
  // localStorage를 외부 스토어로 구독 — 서버 스냅샷은 항상 펼침(SSR 불일치 방지)
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );

  const items: RailItem[] = [
    {
      key: "page",
      tab: "page",
      label: "페이지",
      tooltip: "페이지 — 슬라이드 목록 (이름·배경은 오른쪽 패널)",
      icon: FileStack,
      iconClass: "text-sky-500 dark:text-sky-400",
    },
    {
      key: "widgets",
      tab: "widgets",
      label: "위젯",
      tooltip: "위젯 — 텍스트·이미지·동영상 등을 슬라이드로 끌어 넣기",
      icon: Blocks,
      iconClass: "text-violet-500 dark:text-violet-400",
    },
    {
      key: "media",
      tab: "media",
      label: "미디어 라이브러리",
      tooltip: mediaLibraryEnabled
        ? "미디어 라이브러리 — 업로드·재사용"
        : mediaDisabledHint,
      icon: ImagePlus,
      iconClass: "text-rose-500 dark:text-rose-400",
      disabled: !mediaLibraryEnabled,
    },
    {
      key: "templates",
      tab: "templates",
      label: "템플릿",
      tooltip: "템플릿 — 슬라이드에 제목·본문 등 예시 블록 추가",
      icon: LayoutTemplate,
      iconClass: "text-amber-500 dark:text-amber-400",
      separatorBefore: true,
    },
    {
      key: "elements",
      tab: "elements",
      label: "Elements",
      tooltip: "Elements — 사각형·화살표 등 도형 추가",
      icon: Shapes,
      iconClass: "text-emerald-500 dark:text-emerald-400",
    },
    {
      key: "drawing",
      tab: "drawing",
      label: "드로잉",
      tooltip: "드로잉 — 슬라이드에서 자유 곡선 그리기",
      icon: Pencil,
      iconClass: "text-orange-500 dark:text-orange-400",
    },
    ...(onOpenImageEditor
      ? [
          {
            key: "image-editor",
            label: "이미지 편집",
            tooltip:
              "이미지 편집 — 자르기·필터·주석 후 미디어 라이브러리로 내보내기",
            icon: Wand2,
            iconClass: "text-cyan-500 dark:text-cyan-400",
            onClick: onOpenImageEditor,
            separatorBefore: true,
          } satisfies RailItem,
        ]
      : []),
    ...(onOpenVideoEditor
      ? [
          {
            key: "video-editor",
            label: "비디오 편집",
            tooltip:
              "비디오 편집 — 컷 편집·합성 후 미디어 라이브러리로 내보내기",
            icon: Clapperboard,
            iconClass: "text-fuchsia-500 dark:text-fuchsia-400",
            onClick: onOpenVideoEditor,
            separatorBefore: !onOpenImageEditor,
          } satisfies RailItem,
        ]
      : []),
  ];

  return (
    <TooltipProvider delayDuration={400}>
      <nav
        className={cn(
          "flex shrink-0 flex-col border-e border-border/60 bg-gradient-to-b from-muted/[0.12] via-card/50 to-card/30 py-2.5 backdrop-blur-sm",
          "transition-[width] duration-200",
          /* 펼침 폭은 가장 긴 라벨("미디어 라이브러리" 94px)에 맞춘다 —
             18(좌) + 22(아이콘) + 10(간격) + 94(라벨) + 18(우) = 162px, 여유 4px */
          collapsed ? "w-14 items-center" : "w-[166px] px-2",
          className,
        )}
        aria-label="편집 메뉴"
      >
        <div
          className={cn(
            "flex flex-1 flex-col gap-1",
            collapsed ? "items-center" : "w-full",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.tab != null && activeTab === item.tab;
            return (
              <div key={item.key} className="contents">
                {item.separatorBefore ? (
                  <div
                    className={cn(
                      "my-1 h-px bg-border/60",
                      collapsed ? "w-8" : "w-full",
                    )}
                    role="separator"
                    aria-hidden
                  />
                ) : null}
                <RailTooltip label={item.tooltip}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      railBtn,
                      collapsed && railBtnCollapsed,
                      active && railBtnActive,
                    )}
                    aria-label={collapsed ? item.label : undefined}
                    aria-pressed={item.tab != null ? active : undefined}
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      if (item.tab != null) onActiveTabChange(item.tab);
                      else item.onClick?.();
                    }}
                  >
                    <Icon
                      className={cn(
                        "size-[22px] shrink-0",
                        !item.disabled && item.iconClass,
                      )}
                      aria-hidden
                    />
                    {!collapsed ? (
                      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">
                        {item.label}
                      </span>
                    ) : null}
                  </Button>
                </RailTooltip>
              </div>
            );
          })}
        </div>

        <div
          className={cn(
            "mt-1 border-t border-border/60 pt-2",
            collapsed ? "w-8" : "w-full",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-9 w-full justify-start gap-2 rounded-xl px-2.5 text-xs text-muted-foreground",
              "hover:bg-muted/70 hover:text-foreground",
              collapsed && "w-10 justify-center px-0",
            )}
            aria-pressed={collapsed}
            aria-label={collapsed ? "편집 메뉴 펼치기" : "편집 메뉴 접기"}
            title={collapsed ? "편집 메뉴 펼치기" : "편집 메뉴 접기"}
            onClick={() => writeCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronsRight className="size-4 shrink-0" aria-hidden />
            ) : (
              <>
                <ChevronsLeft className="size-4 shrink-0" aria-hidden />
                접기
              </>
            )}
          </Button>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        arrowClassName="bg-zinc-900 fill-zinc-900 dark:bg-zinc-100 dark:fill-zinc-100"
        className={cn(
          "z-[500] max-w-[min(280px,calc(100vw-4rem))] px-3 py-2 text-left text-[13px] font-medium leading-snug",
          /* 기본 Tooltip은 text-background인데 bg-popover만 쓰면 대비가 무너짐 — 라이트/다크 모두 선명하게 */
          "border border-zinc-700/90 bg-zinc-900 text-zinc-50 shadow-xl",
          "dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-2xl",
        )}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
