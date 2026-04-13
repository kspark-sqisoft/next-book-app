import { LayoutTemplate } from "lucide-react";
import { useMemo } from "react";

import { BookNumericIntField } from "@/components/books/BookNumericIntField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type BookCanvasElement,
  DEFAULT_PAGE_BACKGROUND,
  resolveEffectivePresentationTimingElementId,
  slideDisplayLabel,
} from "@/lib/book-canvas";
import { BOOK_HEX_COLOR_PRESETS } from "@/lib/book-color-presets";
import {
  BOOK_PRESENTATION_TRANSITION_OPTIONS,
  type BookPresentationTransitionId,
} from "@/lib/book-presentation-transition";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

type BookPagePropertiesPanelProps = {
  pageIndex: number;
  totalPages: number;
  name: string;
  onChangeName: (name: string) => void;
  backgroundColor: string;
  onChangeBackgroundColor: (color: string) => void;
  /** 레이어 패널과 같은 컬럼에 넣을 때 */
  embedded?: boolean;
  elements: BookCanvasElement[];
  presentationTimingElementId: string | null | undefined;
  onChangePresentationTimingElementId: (id: string | null) => void;
  presentationLoop: boolean;
  onChangePresentationLoop: (loop: boolean) => void;
  presentationTransition: BookPresentationTransitionId;
  onChangePresentationTransition: (v: BookPresentationTransitionId) => void;
  presentationTransitionMs: number;
  onChangePresentationTransitionMs: (ms: number) => void;
};

function hexForColorInput(css: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(css) ? css : DEFAULT_PAGE_BACKGROUND;
}

function bookElementTimingLabel(
  el: BookCanvasElement,
  displayIndex: number,
): string {
  const typeKo: Record<BookCanvasElement["type"], string> = {
    text: "텍스트",
    image: "이미지",
    video: "동영상",
    mediaPlaylist: "미디어 위젯",
    weather: "날씨",
    digitalClock: "디지털 시계",
    news: "뉴스",
    drawing: "그리기",
    shape: "도형",
  };
  const kind = typeKo[el.type] ?? el.type;
  return `${displayIndex + 1}. ${kind}`;
}

export function BookPagePropertiesPanel({
  pageIndex,
  totalPages,
  name,
  onChangeName,
  backgroundColor,
  onChangeBackgroundColor,
  embedded = false,
  elements,
  presentationTimingElementId,
  onChangePresentationTimingElementId,
  presentationLoop,
  onChangePresentationLoop,
  presentationTransition,
  onChangePresentationTransition,
  presentationTransitionMs,
  onChangePresentationTransitionMs,
}: BookPagePropertiesPanelProps) {
  const preview = slideDisplayLabel(name, pageIndex);
  const pickerValue = hexForColorInput(backgroundColor.trim());

  const layerOptions = useMemo(() => {
    const rev = [...elements].reverse();
    return rev.map((el, displayIndex) => ({
      id: el.id,
      label: bookElementTimingLabel(el, displayIndex),
    }));
  }, [elements]);

  const timingSelectValue =
    elements.length === 0
      ? ""
      : (resolveEffectivePresentationTimingElementId(
          elements,
          presentationTimingElementId,
        ) ?? "");

  const Root = embedded ? "div" : "aside";
  return (
    <Root
      className={cn(
        bookDockedPanelRootClass("max-h-full"),
        embedded ? "min-w-0" : "w-80 shrink-0 border-l border-border/70",
      )}
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <LayoutTemplate
          className={bookDockedPanelHeaderIconClass()}
          aria-hidden
        />
        <span className={bookDockedPanelHeadingClass()}>페이지 속성</span>
      </div>
      <div className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-4 p-3">
          <p className="rounded-md border border-border/50 bg-muted/[0.06] px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
            슬라이드 크기는 상단 바의 캔버스 W·H에서 바꿀 수 있습니다.
          </p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">이 슬라이드</p>
            <p className="text-xs text-muted-foreground">
              목록에서 선택한 페이지 ({pageIndex + 1} / {totalPages})
            </p>
            <Label htmlFor="page-name">슬라이드 이름</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => onChangeName(e.target.value.slice(0, 120))}
              placeholder={`슬라이드 ${pageIndex + 1}`}
              maxLength={120}
            />
            <p className="text-[11px] text-muted-foreground">
              목록 표시: {preview}
            </p>
          </div>
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/[0.06] p-2.5">
            <p className="text-xs font-medium text-foreground">
              미리보기(슬라이드쇼)
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              레이어 목록의 「기준」체크로 이 페이지의 시간 기준 위젯을 고를 수
              있습니다(한 페이지에 위젯이 있으면 항상 하나는 기준이며, 같은
              체크를 다시 눌러 해제할 수 없습니다). 미디어(플레이리스트) 위젯은
              목록 항목 시간 합이 슬라이드 길이입니다. 그 외 위젯은 기본
              10초이며 레이어 목록·위젯 속성에서 바꿀 수 있습니다. 아래에서도
              기준을 고를 수 있습니다.
            </p>
            <div className="space-y-1">
              <Label className="text-[11px]">시간 기준 레이어</Label>
              {elements.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  이 슬라이드에 위젯이 없습니다.
                </p>
              ) : (
                <Select
                  value={timingSelectValue}
                  onValueChange={(v) => onChangePresentationTimingElementId(v)}
                >
                  <SelectTrigger size="sm" className="h-9 w-full">
                    <SelectValue placeholder="레이어 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {layerOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-0.5 py-1 hover:bg-muted/30">
              <Checkbox
                checked={presentationLoop}
                onCheckedChange={(c) => onChangePresentationLoop(c === true)}
                className="mt-0.5"
                aria-label="마지막 슬라이드 후 처음으로 반복"
              />
              <span className="text-[11px] leading-snug text-foreground">
                마지막 슬라이드 후 처음으로 반복
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  끄면 마지막 페이지에서 멈춥니다.
                </span>
              </span>
            </label>
            <div className="space-y-1 border-t border-border/40 pt-2">
              <Label className="text-[11px]">이 슬라이드로 전환될 때</Label>
              <p className="text-[10px] leading-snug text-muted-foreground">
                미리보기(/preview)에서 이 페이지가 나타날 때 적용됩니다. 첫
                슬라이드는 애니메이션을 쓰지 않습니다.
              </p>
              <Select
                value={presentationTransition}
                onValueChange={(v) =>
                  onChangePresentationTransition(
                    v as BookPresentationTransitionId,
                  )
                }
              >
                <SelectTrigger size="sm" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOK_PRESENTATION_TRANSITION_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-end gap-2">
                <BookNumericIntField
                  fieldKey={`page-${pageIndex}-pres-trans-ms`}
                  htmlId="pres-trans-ms"
                  label={
                    <span className="text-[11px]">전환 시간(ms)</span>
                  }
                  value={presentationTransitionMs}
                  min={80}
                  max={2500}
                  step={10}
                  maxDigits={4}
                  className="space-y-1"
                  inputClassName="h-8 w-[5.5rem] font-mono text-xs"
                  onCommit={onChangePresentationTransitionMs}
                />
                <span className="pb-2 text-[10px] text-muted-foreground">
                  80–2500
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-bg-hex">슬라이드 배경색</Label>
            <p className="text-[11px] text-muted-foreground">자주 쓰는 색</p>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
              {BOOK_HEX_COLOR_PRESETS.map((c) => {
                const active =
                  backgroundColor.trim().replace(/\s/g, "").toLowerCase() ===
                  c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`배경 ${c}`}
                    aria-pressed={active}
                    className={cn(
                      "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                      active && "ring-2 ring-primary ring-offset-2",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => onChangeBackgroundColor(c)}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="page-bg-picker"
                type="color"
                value={pickerValue}
                onChange={(e) => onChangeBackgroundColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background"
                aria-label="배경 색 선택"
              />
              <Input
                id="page-bg-hex"
                className="min-w-0 flex-1 font-mono text-xs"
                value={backgroundColor}
                onChange={(e) =>
                  onChangeBackgroundColor(e.target.value.slice(0, 64))
                }
                placeholder="#ffffff 또는 rgb(…)"
                maxLength={64}
                spellCheck={false}
                aria-label="배경 색 코드"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onChangeBackgroundColor(DEFAULT_PAGE_BACKGROUND)}
            >
              배경을 기본(흰색)으로
            </Button>
            <p className="text-[11px] text-muted-foreground">
              #RRGGBB, rgb(), hsl() 등 브라우저가 이해하는 색 문자열을 쓸 수
              있습니다.
            </p>
          </div>
        </div>
      </div>
    </Root>
  );
}
