import { Blocks, FileStack, ImagePlus, LayoutTemplate, Pencil, Shapes } from "lucide-react";
import type { BookEditorLeftTab } from "@/lib/book-editor-panel-events";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const railBtn = cn(
  "relative size-10 shrink-0 rounded-xl border border-transparent text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-150",
  "hover:bg-muted/70 hover:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const railBtnActive = cn(
  "border-primary/40 bg-primary/14 text-primary shadow-sm ring-1 ring-primary/10",
  "hover:bg-primary/[0.18] hover:text-primary",
);

export type BookEditorToolRailProps = {
  className?: string;
  activeTab: BookEditorLeftTab;
  onActiveTabChange: (tab: BookEditorLeftTab) => void;
  mediaLibraryEnabled?: boolean;
  mediaDisabledHint?: string;
};

/** 워크스페이스 최좌측 세로 탭 — 페이지 / 위젯 / 미디어 / 템플릿 / Elements / 드로잉 */
export function BookEditorToolRail({
  className,
  activeTab,
  onActiveTabChange,
  mediaLibraryEnabled = true,
  mediaDisabledHint = "북을 저장한 뒤 이 화면에서 미디어 라이브러리를 쓸 수 있어요.",
}: BookEditorToolRailProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <nav
        className={cn(
          "flex w-14 shrink-0 flex-col items-center gap-1 border-e border-border/60 bg-gradient-to-b from-muted/[0.12] via-card/50 to-card/30 py-2.5 backdrop-blur-sm",
          className,
        )}
        aria-label="편집 메뉴"
      >
        <RailTooltip label="페이지 — 슬라이드 목록 (이름·배경은 오른쪽 패널)">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "page" && railBtnActive)}
            aria-pressed={activeTab === "page"}
            onClick={() => onActiveTabChange("page")}
          >
            <FileStack className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip label="위젯 — 텍스트·이미지·동영상 등을 슬라이드로 끌어 넣기">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "widgets" && railBtnActive)}
            aria-pressed={activeTab === "widgets"}
            onClick={() => onActiveTabChange("widgets")}
          >
            <Blocks className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip
          label={
            mediaLibraryEnabled
              ? "미디어 라이브러리 — 업로드·재사용"
              : mediaDisabledHint
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              railBtn,
              activeTab === "media" && mediaLibraryEnabled && railBtnActive,
            )}
            aria-pressed={activeTab === "media"}
            disabled={!mediaLibraryEnabled}
            onClick={() => {
              if (mediaLibraryEnabled) onActiveTabChange("media");
            }}
          >
            <ImagePlus className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>

        <div className="my-1 h-px w-8 bg-border/60" role="separator" aria-hidden />

        <RailTooltip label="템플릿 — 슬라이드에 제목·본문 등 예시 블록 추가">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "templates" && railBtnActive)}
            aria-pressed={activeTab === "templates"}
            onClick={() => onActiveTabChange("templates")}
          >
            <LayoutTemplate className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip label="Elements — 사각형·화살표 등 도형 추가">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "elements" && railBtnActive)}
            aria-pressed={activeTab === "elements"}
            onClick={() => onActiveTabChange("elements")}
          >
            <Shapes className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip label="드로잉 — 슬라이드에서 자유 곡선 그리기">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "drawing" && railBtnActive)}
            aria-pressed={activeTab === "drawing"}
            onClick={() => onActiveTabChange("drawing")}
          >
            <Pencil className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
      </nav>
    </TooltipProvider>
  );
}

function RailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
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
