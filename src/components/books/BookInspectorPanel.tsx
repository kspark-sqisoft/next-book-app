import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Expand,
  Film,
  FolderOpen,
  ImageIcon,
  Library,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { publicAssetUrl } from "@/lib/api";
import {
  BOOK_MEDIA_OBJECT_FIT_VALUES,
  BOOK_NEWS_CATEGORIES,
  BOOK_SHAPE_KINDS,
  BOOK_WIDGET_DEFAULT_ROUNDED_RADIUS,
  DEFAULT_MEDIA_PLAYLIST_IMAGE_DURATION_SEC,
  MEDIA_PLAYLIST_MAX_ITEMS,
  type BookCanvasElement,
  type BookShapeKind,
  type BookMediaPlaylistItem,
  type BookDigitalClockDisplay,
  type BookDigitalClockDisplayResolved,
  type BookMediaObjectFit,
  type BookWeatherDisplay,
  type BookWeatherDisplayResolved,
  parseBookClockBackground,
  parseBookWidgetTextColor,
  resolveBookDigitalClockDisplay,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveBookMediaObjectFit,
  resolveBookWeatherDisplay,
  resolveMediaPlaylistLoop,
  resolveMediaPlaylistShowControls,
  formatBookMediaClock,
  isBookElementLocked,
} from "@/lib/book-canvas";
import {
  computeMediaPlaylistPresentationDurationSec,
  DEFAULT_PRESENTATION_PLAYLIST_VIDEO_ESTIMATE_SEC,
  DEFAULT_WIDGET_PRESENTATION_SEC,
} from "@/lib/book-presentation";
import {
  defaultTextWidgetBoxHeight,
  getTextWidgetDisplayHtml,
} from "@/lib/book-text-widget";
import { BookTextRichEditor } from "@/components/books/BookTextRichEditor";
import type { BookMediaPlaylistPlaybackUiSnapshot } from "@/components/books/BookMediaPlaylistWidgetOverlay";
import { BOOK_HEX_COLOR_PRESETS } from "@/lib/book-color-presets";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookInspectorPanelProps = {
  selected: BookCanvasElement | null;
  /** 2 이상이면 여러 개 선택 상태(속성 폼 대신 안내만) */
  multiSelectionCount?: number;
  /** 슬라이드 논리 크기 — 전체 맞춤 버튼에 사용 */
  slideWidth: number;
  slideHeight: number;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onDelete: () => void;
  mediaHint?: string | null;
  /** 오른쪽 컬럼 안(레이어 패널 아래)에 넣을 때: 테두리·고정 너비 제거 */
  embedded?: boolean;
  /** 이미지·동영상: 로컬 파일로 `src` 교체(부모가 파일 input과 연결) */
  onReplaceMediaFromFile?: () => void;
  /** 이미지·동영상: 미디어 라이브러리 선택 다이얼로그 */
  onPickMediaFromLibrary?: () => void;
  /** 미디어 플레이리스트: 파일 선택 후 목록 끝에 추가 */
  onRequestAppendPlaylistMediaFromFile?: (elementId: string) => void;
  /** 미디어 플레이리스트: 라이브러리에서 선택해 목록 끝에 추가 */
  onRequestAppendPlaylistMediaFromLibrary?: (elementId: string) => void;
  /** `false`면 라이브러리 버튼 숨김 */
  mediaLibraryReplaceEnabled?: boolean;
  /** 캔버스 플레이리스트 위젯 id → 재생 중인 항목 인덱스(목록 하이라이트) */
  mediaPlaylistPlaybackByElementId?: Record<string, number>;
  /** 선택된 위젯 재생 UI(캔버스 오버레이와 동기) */
  mediaPlaylistPlaybackUiByElementId?: Record<string, BookMediaPlaylistPlaybackUiSnapshot>;
  /** 인스펙터 미니 컨트롤 → 캔버스 플레이리스트 */
  onMediaPlaylistRemoteControl?: (
    elementId: string,
    kind: "prev" | "next" | "togglePause",
  ) => void;
  /** 동영상 위젯 id → 재생 길이(초), 캔버스에서 메타 로드 후 채움 */
  videoDurationSecByElementId?: Record<string, number>;
  /** 현재 슬라이드의 미리보기 시간 기준 위젯 id */
  pagePresentationTimingElementId?: string | null;
};

/** 캐러셀 간격: 입력 중 1→10처럼 잠깐 범위 밖이 되므로 blur까지 draft만 두고 커밋 */
function NewsCarouselIntervalInputInner({
  elementId,
  seconds,
  onChange,
}: {
  elementId: string;
  seconds: number | undefined;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const [draft, setDraft] = useState(
    () => (seconds != null && Number.isInteger(seconds) ? String(seconds) : ""),
  );

  return (
    <div className="space-y-1">
      <Input
        id="insp-news-iv"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="기본 5"
        className="font-mono"
        value={draft}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        onBlur={() => {
          if (draft.trim() === "") {
            onChange(elementId, { newsCarouselIntervalSec: undefined });
            return;
          }
          const n = Number(draft);
          if (Number.isInteger(n) && n >= 3 && n <= 120) {
            onChange(elementId, { newsCarouselIntervalSec: n });
          } else {
            setDraft(
              seconds != null && Number.isInteger(seconds) ? String(seconds) : "",
            );
          }
        }}
      />
      <p className="text-[11px] text-muted-foreground leading-snug">3~120초, 비우면 5초</p>
    </div>
  );
}

function NewsCarouselIntervalInput(props: {
  elementId: string;
  seconds: number | undefined;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const k = `${props.elementId}:${props.seconds == null ? "u" : props.seconds}`;
  return <NewsCarouselIntervalInputInner key={k} {...props} />;
}

function InspectorPresentationHoldInputInner({
  elementId,
  value,
  onChange,
}: {
  elementId: string;
  value: number | undefined;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const [draft, setDraft] = useState(
    () => (value != null && Number.isInteger(value) ? String(value) : ""),
  );

  return (
    <div className="space-y-1">
      <Label className="text-[11px]">표시 시간(초)</Label>
      <Input
        id={`insp-pres-hold-${elementId}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={`기본 ${DEFAULT_WIDGET_PRESENTATION_SEC}`}
        className="h-8 font-mono"
        value={draft}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        onBlur={() => {
          if (draft.trim() === "") {
            onChange(elementId, { presentationHoldSec: undefined });
            return;
          }
          const n = Number(draft);
          if (Number.isInteger(n) && n >= 1 && n <= 3600) {
            onChange(elementId, { presentationHoldSec: n });
          } else {
            setDraft(
              value != null && Number.isInteger(value) ? String(value) : "",
            );
          }
        }}
      />
      <p className="text-[10px] leading-snug text-muted-foreground">
        1~3600초. 비우면 기본 {DEFAULT_WIDGET_PRESENTATION_SEC}초(또는 동영상 메타 길이)를 씁니다.
      </p>
    </div>
  );
}

function InspectorPresentationHoldInput(props: {
  elementId: string;
  value: number | undefined;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const k = `${props.elementId}:${props.value == null ? "u" : props.value}`;
  return <InspectorPresentationHoldInputInner key={k} {...props} />;
}

function InspectorPresentationTimingSection({
  el,
  pagePresentationTimingElementId,
  onChange,
  videoMetaDurationSec,
}: {
  el: BookCanvasElement;
  pagePresentationTimingElementId?: string | null;
  onChange: BookInspectorPanelProps["onChange"];
  videoMetaDurationSec?: number;
}) {
  const isTiming =
    pagePresentationTimingElementId != null &&
    pagePresentationTimingElementId !== "" &&
    pagePresentationTimingElementId === el.id;

  if (el.type === "mediaPlaylist") {
    const sum = computeMediaPlaylistPresentationDurationSec(el);
    return (
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/[0.08] p-2.5">
        <p className="text-[10px] font-semibold text-foreground">슬라이드쇼(미리보기)</p>
        {isTiming ? (
          <p className="text-[10px] font-medium text-primary">
            이 위젯이 이 페이지의 시간 기준 레이어입니다.
          </p>
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">
            페이지 속성에서 이 레이어를 시간 기준으로 고르면, 아래 합계가 슬라이드 길이가 됩니다.
          </p>
        )}
        <p className="text-[10px] leading-snug text-muted-foreground">
          목록의 이미지 표시 시간 + 동영상(메타 없으면 {DEFAULT_PRESENTATION_PLAYLIST_VIDEO_ESTIMATE_SEC}초로
          추정)을 더합니다.
        </p>
        <p className="font-mono text-sm tabular-nums">합계 약 {sum}초</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/[0.08] p-2.5">
      <p className="text-[10px] font-semibold text-foreground">슬라이드쇼(미리보기)</p>
      {isTiming ? (
        <p className="text-[10px] font-medium text-primary">
          이 위젯이 이 페이지의 시간 기준 레이어입니다.
        </p>
      ) : (
        <p className="text-[10px] leading-snug text-muted-foreground">
          이 위젯을 시간 기준으로 쓰려면 페이지 속성에서 선택하세요.
        </p>
      )}
      {el.type === "video" && videoMetaDurationSec != null && videoMetaDurationSec > 0 ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          동영상 메타 길이 약 {Math.ceil(videoMetaDurationSec)}초. 표시 시간을 비우면 미리보기 타이머에 이 길이를
          씁니다.
        </p>
      ) : null}
      <InspectorPresentationHoldInput
        elementId={el.id}
        value={el.presentationHoldSec}
        onChange={onChange}
      />
    </div>
  );
}

function bookShapeKindLabelKo(k: BookShapeKind): string {
  switch (k) {
    case "rect":
      return "사각형";
    case "roundRect":
      return "둥근 사각형";
    case "ellipse":
      return "타원";
    case "line":
      return "선";
    case "triangle":
      return "삼각형";
    case "rightTriangle":
      return "직각삼각형";
    case "arrow":
      return "화살표";
    case "chevron":
      return "쉐브론";
    case "star":
      return "별";
    case "diamond":
      return "마름모";
    case "hexagon":
      return "육각형";
    case "pentagon":
      return "오각형";
    case "octagon":
      return "팔각형";
    case "trapezoid":
      return "사다리꼴";
    case "parallelogram":
      return "평행사변형";
    case "ring":
      return "링";
    case "blockArc":
      return "블록 호";
    case "plus":
      return "더하기";
    case "cross":
      return "X자";
    default:
      return k;
  }
}

/** `type="number"`는 빈 칸·자리수 수정이 어려워 텍스트 draft + blur 시 확정 */
function InspectorStrokeWidthPxInput({
  inputId,
  label,
  value,
  min,
  max,
  onCommit,
}: {
  inputId: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(Math.round(value)));
  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="font-mono tabular-nums"
        value={draft}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(t);
        }}
        onBlur={() => {
          if (draft.trim() === "") {
            setDraft(String(Math.round(value)));
            return;
          }
          const n = Number(draft);
          if (!Number.isFinite(n)) {
            setDraft(String(Math.round(value)));
            return;
          }
          const clamped = Math.min(max, Math.max(min, Math.round(n)));
          onCommit(clamped);
          setDraft(String(clamped));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function num(v: string, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function InspectorMediaSourceSection({
  kind,
  src,
  posterSrc,
  onReplaceFile,
  onPickLibrary,
  libraryEnabled,
}: {
  kind: "image" | "video";
  src: string;
  posterSrc?: string | null;
  onReplaceFile?: () => void;
  onPickLibrary?: () => void;
  libraryEnabled?: boolean;
}) {
  const showActions =
    Boolean(onReplaceFile) || (Boolean(libraryEnabled) && Boolean(onPickLibrary));

  if (!showActions) {
    return (
      <div className="space-y-1 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
        <p className="text-[10px] font-medium text-muted-foreground">현재 주소</p>
        <p className="break-all font-mono text-[11px] leading-snug text-foreground/90">{src}</p>
        {kind === "video" && posterSrc ? (
          <p className="break-all font-mono text-[10px] leading-snug text-muted-foreground">
            포스터: {posterSrc}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      className="space-y-3 rounded-lg border-2 border-primary/25 bg-primary/6 p-3 shadow-sm dark:border-primary/30 dark:bg-primary/9"
      aria-labelledby="insp-media-source-heading"
    >
      <div className="space-y-1">
        <h3
          id="insp-media-source-heading"
          className="text-xs font-semibold tracking-wide text-primary"
        >
          미디어 소스
        </h3>
        <p className="text-[10px] leading-snug text-muted-foreground">
          아래 경로가 캔버스에 표시됩니다. 파일 또는 이 북의 미디어 라이브러리로 바꿀 수 있습니다.
        </p>
      </div>
      <div className="rounded-md border border-border bg-background/90 px-2 py-1.5">
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          {kind === "image" ? "이미지 URL" : "동영상 URL"}
        </p>
        <p className="mt-0.5 break-all font-mono text-[11px] leading-snug text-foreground">{src}</p>
      </div>
      {kind === "video" ? (
        <div className="rounded-md border border-dashed border-border/90 bg-muted/20 px-2 py-1.5">
          <p className="text-[9px] font-medium text-muted-foreground">포스터(썸네일)</p>
          <p className="mt-0.5 break-all font-mono text-[10px] leading-snug text-foreground/85">
            {posterSrc?.trim() ? posterSrc : "— 없음 —"}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {onReplaceFile ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start gap-2 border-primary/20 bg-background/80 hover:bg-background"
            onClick={onReplaceFile}
          >
            <FolderOpen className="size-4 shrink-0 opacity-80" aria-hidden />
            파일에서 바꾸기…
          </Button>
        ) : null}
        {libraryEnabled && onPickLibrary ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 w-full justify-start gap-2"
            onClick={onPickLibrary}
          >
            <Library className="size-4 shrink-0 opacity-80" aria-hidden />
            미디어 라이브러리에서 선택…
          </Button>
        ) : null}
      </div>
    </section>
  );
}

const WEATHER_INSPECTOR_FIELDS: { key: keyof BookWeatherDisplayResolved; label: string }[] = [
  { key: "temp", label: "기온" },
  { key: "feelsLike", label: "체감 온도" },
  { key: "description", label: "상태 설명" },
  { key: "icon", label: "날씨 아이콘" },
  { key: "humidity", label: "습도" },
  { key: "wind", label: "바람" },
  { key: "pm10", label: "미세먼지 (PM10)" },
  { key: "pm25", label: "초미세먼지 (PM2.5)" },
  { key: "aqi", label: "대기질 지수" },
  { key: "clock", label: "시계" },
  { key: "date", label: "날짜" },
];

function patchWeatherDisplay(
  current: BookWeatherDisplay | undefined,
  key: keyof BookWeatherDisplayResolved,
  checked: boolean,
): BookWeatherDisplay | undefined {
  const next: BookWeatherDisplay = { ...current };
  if (checked) {
    delete next[key];
  } else {
    next[key] = false;
  }
  if (Object.keys(next).length === 0) return undefined;
  return next;
}

const DIGITAL_CLOCK_INSPECTOR_FIELDS: { key: keyof BookDigitalClockDisplayResolved; label: string }[] = [
  { key: "seconds", label: "초 표시" },
  { key: "date", label: "날짜 표시" },
  { key: "hour12", label: "12시간(AM/PM)" },
];

function patchDigitalClockDisplay(
  current: BookDigitalClockDisplay | undefined,
  key: keyof BookDigitalClockDisplayResolved,
  checked: boolean,
): BookDigitalClockDisplay | undefined {
  const next: BookDigitalClockDisplay = { ...current };
  if (key === "hour12") {
    if (checked) next.hour12 = true;
    else delete next.hour12;
  } else {
    if (checked) delete next[key];
    else next[key] = false;
  }
  if (Object.keys(next).length === 0) return undefined;
  return next;
}

function digitalClockHexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) {
    return `rgba(15,23,42,${Math.min(1, Math.max(0, alpha))})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) {
    return `rgba(15,23,42,${Math.min(1, Math.max(0, alpha))})`;
  }
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

function parseDigitalClockBgForInspector(raw: string | undefined): { hex: string; alpha: number } {
  const fallback = { hex: "#0f172a", alpha: 0.92 };
  if (!raw?.trim()) return fallback;
  const s = raw.trim();
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) {
    const r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
    const a = m[4] != null ? Math.min(1, Math.max(0, parseFloat(m[4]))) : 1;
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: a };
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return { hex: s, alpha: 1 };
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1] + s[1];
    const g = s[2] + s[2];
    const b = s[3] + s[3];
    return { hex: `#${r}${g}${b}`, alpha: 1 };
  }
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    const aByte = parseInt(s.slice(7, 9), 16);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      alpha: Number.isFinite(aByte) ? Math.min(1, Math.max(0, aByte / 255)) : 1,
    };
  }
  return fallback;
}

type WidgetBackdropFieldKey = "clockBackground" | "weatherBackground" | "newsBackground";
type WidgetTextColorFieldKey =
  | "weatherTextColor"
  | "clockTextColor"
  | "newsTextColor"
  | "newsMetaColor";

function OptionalWidgetTextColorFields({
  elementId,
  value,
  field,
  defaultHex,
  colorAriaLabel,
  defaultHint,
  labelText = "텍스트 색",
  appliedHint = "본문·아이콘(선)에 적용됩니다.",
  onChange,
}: {
  elementId: string;
  value: string | undefined;
  field: WidgetTextColorFieldKey;
  defaultHex: string;
  colorAriaLabel: string;
  defaultHint: string;
  /** 인스펙터 라벨 (기본: 텍스트 색) */
  labelText?: string;
  /** 사용자 지정 켜졌을 때 색 적용 범위 안내 */
  appliedHint?: string;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const sanitized = parseBookWidgetTextColor(value);
  const usesCustom = Boolean(sanitized);
  const { hex } = parseDigitalClockBgForInspector(sanitized);
  const colorInputValue =
    sanitized && /^#[0-9a-fA-F]{6}$/i.test(hex) ? hex : defaultHex;

  const patch = (next: string | undefined) =>
    onChange(elementId, { [field]: next } as Partial<BookCanvasElement>);

  return (
    <div className="space-y-2">
      <Label>{labelText}</Label>
      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
        <Checkbox
          checked={usesCustom}
          onCheckedChange={(c) => {
            if (c === true) {
              patch(digitalClockHexToRgba(defaultHex, 1));
            } else {
              patch(undefined);
            }
          }}
        />
        <span>사용자 지정</span>
      </label>
      {usesCustom ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="color"
            className="h-9 w-14 shrink-0 cursor-pointer px-1"
            value={colorInputValue}
            onChange={(e) => patch(digitalClockHexToRgba(e.target.value, 1))}
            aria-label={colorAriaLabel}
          />
          <span className="text-[11px] text-muted-foreground">{appliedHint}</span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{defaultHint}</p>
      )}
    </div>
  );
}

function OptionalWidgetBackdropFields({
  elementId,
  value,
  field,
  defaultRgba,
  colorAriaLabel,
  defaultHint,
  onChange,
}: {
  elementId: string;
  value: string | undefined;
  field: WidgetBackdropFieldKey;
  defaultRgba: string;
  colorAriaLabel: string;
  defaultHint: string;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const sanitized = parseBookClockBackground(value);
  const usesCustom = Boolean(sanitized);
  const { hex, alpha } = parseDigitalClockBgForInspector(sanitized);
  const alphaPct = Math.round(alpha * 100);
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#0f172a";

  const patch = (next: string | undefined) =>
    onChange(elementId, { [field]: next } as Partial<BookCanvasElement>);

  return (
    <div className="space-y-2">
      <Label>배경</Label>
      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
        <Checkbox
          checked={usesCustom}
          onCheckedChange={(c) => {
            if (c === true) {
              patch(defaultRgba);
            } else {
              patch(undefined);
            }
          }}
        />
        <span>사용자 배경색</span>
      </label>
      {usesCustom ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 shrink-0 cursor-pointer px-1"
              value={colorInputValue}
              onChange={(e) => patch(digitalClockHexToRgba(e.target.value, alpha))}
              aria-label={colorAriaLabel}
            />
            <span className="text-[11px] text-muted-foreground">
              색상 · 슬라이더는 배경 투명도(테두리·그림자도 같이 줄어듭니다)
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>배경 투명도</span>
              <span className="tabular-nums">{alphaPct}%</span>
            </div>
            <Slider
              value={[alphaPct]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => patch(digitalClockHexToRgba(colorInputValue, v / 100))}
            />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">{defaultHint}</p>
      )}
    </div>
  );
}

const MEDIA_FIT_LABELS: Record<BookMediaObjectFit, string> = {
  cover: "꽉 채움 (비율 유지, 잘림)",
  contain: "전체 보임 (여백)",
  fill: "늘이기",
  none: "원본 크기 (왼쪽 위)",
  "scale-down": "줄여 맞춤 (확대 없음)",
};

function outlineInspectorHex(resolvedColor: string): string {
  const t = resolvedColor.trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(t)) return t;
  const m = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
    return `#${toHex(+m[1])}${toHex(+m[2])}${toHex(+m[3])}`;
  }
  return "#94a3b8";
}

function ElementShapeChromeFields({
  el,
  onChange,
}: {
  el: BookCanvasElement;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const br = resolveBookElementBorderRadius(el);
  const ow = resolveBookElementOutlineWidth(el);
  const ocResolved = resolveBookElementOutlineColor(el);
  const colorPick = outlineInspectorHex(ocResolved);

  const typeHint =
    el.type === "weather" ||
    el.type === "digitalClock" ||
    el.type === "news" ||
    el.type === "mediaPlaylist"
      ? `저장하지 않으면 기본 ${BOOK_WIDGET_DEFAULT_ROUNDED_RADIUS}px(둥근 카드)입니다.`
      : el.type === "shape"
        ? "도형을 감싼 프레임(클립) 모서리입니다. 사각 도형 자체의 둥근 모서리는 인스펙터의 ‘모서리 둥글기’로 바꿉니다."
        : "텍스트·이미지·동영상은 기본 0(각진 모서리)입니다.";

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Label className="text-xs font-medium">모양</Label>
      <p className="text-[11px] text-muted-foreground">{typeHint}</p>
      <div className="space-y-1">
        <Label htmlFor={`insp-br-${el.id}`}>모서리 반지름 (px)</Label>
        <Input
          id={`insp-br-${el.id}`}
          type="number"
          min={0}
          max={2000}
          value={br}
          onChange={(e) =>
            onChange(el.id, {
              borderRadius: num(e.target.value, br, 0, 2000),
            })
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`insp-ow-${el.id}`}>외곽선 두께 (px)</Label>
        <Input
          id={`insp-ow-${el.id}`}
          type="number"
          min={0}
          max={32}
          value={ow}
          onChange={(e) => {
            const v = num(e.target.value, ow, 0, 32);
            onChange(el.id, {
              outlineWidth: v > 0 ? v : undefined,
              ...(v <= 0 ? { outlineColor: undefined } : {}),
            });
          }}
        />
      </div>
      {ow > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`insp-oc-${el.id}`}
            type="color"
            className="h-9 w-14 shrink-0 cursor-pointer px-1"
            value={/^#[0-9a-fA-F]{6}$/i.test(colorPick) ? colorPick : "#94a3b8"}
            onChange={(e) =>
              onChange(el.id, {
                outlineColor: e.target.value,
              })
            }
            aria-label="외곽선 색"
          />
          <span className="text-[11px] text-muted-foreground">외곽선 색</span>
        </div>
      ) : null}
    </div>
  );
}

function ElementOpacitySlider({
  elementId,
  opacity,
  onChange,
}: {
  elementId: string;
  opacity: number | undefined;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  const pct = Math.round(resolveBookElementOpacity(opacity) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`insp-op-${elementId}`}>불투명도</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <Slider
        id={`insp-op-${elementId}`}
        min={0}
        max={100}
        step={1}
        value={[pct]}
        onValueChange={([v]) => {
          const clamped = Math.min(100, Math.max(0, v));
          onChange(elementId, {
            opacity: clamped >= 100 ? undefined : clamped / 100,
          });
        }}
      />
      <p className="text-[11px] text-muted-foreground">
        0%는 완전 투명, 100%는 불투명입니다.
      </p>
    </div>
  );
}

function MediaObjectFitFields({
  elementId,
  value,
  onChange,
}: {
  elementId: string;
  value: BookMediaObjectFit | undefined;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  const v = resolveBookMediaObjectFit(value);
  return (
    <div className="space-y-1">
      <Label htmlFor="insp-objfit">프레임 맞춤</Label>
      <Select
        value={v}
        onValueChange={(next) =>
          onChange(elementId, { objectFit: next as BookMediaObjectFit })
        }
      >
        <SelectTrigger id="insp-objfit" className="w-full max-w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOK_MEDIA_OBJECT_FIT_VALUES.map((fit) => (
            <SelectItem key={fit} value={fit}>
              {MEDIA_FIT_LABELS[fit]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MediaPlaylistInspectorItemThumb({ item }: { item: BookMediaPlaylistItem }) {
  const [broken, setBroken] = useState(false);

  const frameClass =
    "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40";

  if (item.kind === "image") {
    const raw = item.src?.trim() ?? "";
    const src = raw ? (publicAssetUrl(raw) ?? raw) : "";
    if (!src || broken) {
      return (
        <div className={frameClass} aria-hidden>
          <ImageIcon className="size-6 text-muted-foreground" />
        </div>
      );
    }
    return (
      <img
        alt=""
        src={src}
        className="size-14 shrink-0 rounded-md border border-border/60 object-cover"
        onError={() => setBroken(true)}
      />
    );
  }

  const posterRaw = item.posterSrc?.trim() ?? "";
  const poster = posterRaw ? (publicAssetUrl(posterRaw) ?? posterRaw) : "";
  if (poster && !broken) {
    return (
      <img
        alt=""
        src={poster}
        className="size-14 shrink-0 rounded-md border border-border/60 object-cover"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className={frameClass} aria-hidden>
      <Film className="size-6 text-muted-foreground" />
    </div>
  );
}

/** 캔버스 미디어 위젯 하단 컨트롤과 동일 동작(미니) — 캔버스 선택 시 동기 */
function MediaPlaylistInspectorMiniBar({
  el,
  items,
  playbackUi,
  highlightIndex,
  onRemote,
}: {
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>;
  items: BookMediaPlaylistItem[];
  playbackUi?: BookMediaPlaylistPlaybackUiSnapshot;
  highlightIndex?: number;
  onRemote?: (kind: "prev" | "next" | "togglePause") => void;
}) {
  const loop = resolveMediaPlaylistLoop(el);
  const n = items.length;
  const safeHighlight =
    highlightIndex != null && highlightIndex >= 0 && highlightIndex < n ? highlightIndex : 0;
  const idx =
    playbackUi != null && playbackUi.index >= 0 && playbackUi.index < n
      ? playbackUi.index
      : safeHighlight;
  const progress = playbackUi?.progress ?? 0;
  const cur = playbackUi?.currentSec ?? 0;
  const tot = playbackUi?.totalSec ?? 0;
  const paused = playbackUi?.paused ?? false;
  const atFirst = n === 0 || (!loop && idx <= 0);
  const atLast = n === 0 || (!loop && idx >= n - 1);
  const disabled = n === 0 || !onRemote;

  return (
    <div
      className="my-3 flex min-h-10 items-center gap-1 rounded-lg border border-border bg-muted/45 px-2.5 py-2 shadow-sm backdrop-blur-sm dark:bg-muted/35"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-35"
        aria-label="이전"
        disabled={disabled || atFirst}
        onClick={() => onRemote?.("prev")}
      >
        <SkipBack className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-background/80 disabled:opacity-35 dark:hover:bg-background/25"
        aria-label={paused ? "재생" : "일시정지"}
        disabled={disabled}
        onClick={() => onRemote?.("togglePause")}
      >
        {paused ? (
          <Play className="size-3.5 pl-0.5" aria-hidden />
        ) : (
          <Pause className="size-3.5" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-35"
        aria-label="다음"
        disabled={disabled || atLast}
        onClick={() => onRemote?.("next")}
      >
        <SkipForward className="size-3.5" aria-hidden />
      </button>
      <div className="relative h-1.5 min-w-0 flex-1 rounded-full bg-foreground/10 dark:bg-foreground/15">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
        {n > 0 ? `${idx + 1}/${n}` : "0/0"}
      </span>
      <span className="w-[4.25rem] shrink-0 text-right font-mono text-[10px] tabular-nums leading-none text-muted-foreground">
        {tot > 0
          ? `${formatBookMediaClock(cur)} / ${formatBookMediaClock(tot)}`
          : "— / —"}
      </span>
    </div>
  );
}

function MediaPlaylistInspectorBody({
  el,
  onChange,
  onRequestAppendPlaylistMediaFromFile,
  onRequestAppendPlaylistMediaFromLibrary,
  onRequestDeletePlaylistItem,
  mediaLibraryReplaceEnabled,
  activePlaybackItemIndex,
  playbackUi,
  onMediaPlaylistRemoteControl,
}: {
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>;
  onChange: BookInspectorPanelProps["onChange"];
  onRequestAppendPlaylistMediaFromFile?: BookInspectorPanelProps["onRequestAppendPlaylistMediaFromFile"];
  onRequestAppendPlaylistMediaFromLibrary?: BookInspectorPanelProps["onRequestAppendPlaylistMediaFromLibrary"];
  onRequestDeletePlaylistItem?: (index: number) => void;
  mediaLibraryReplaceEnabled?: boolean;
  activePlaybackItemIndex?: number;
  playbackUi?: BookMediaPlaylistPlaybackUiSnapshot;
  onMediaPlaylistRemoteControl?: BookInspectorPanelProps["onMediaPlaylistRemoteControl"];
}) {
  const items = el.mediaPlaylistItems ?? [];
  const setItems = (next: BookMediaPlaylistItem[]) =>
    onChange(el.id, { mediaPlaylistItems: next });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    const a = copy[i];
    const b = copy[j];
    if (!a || !b) return;
    copy[i] = b;
    copy[j] = a;
    setItems(copy);
  };

  const updateItem = (i: number, patch: Partial<BookMediaPlaylistItem>) => {
    const copy = [...items];
    const cur = copy[i];
    if (!cur) return;
    copy[i] = { ...cur, ...patch } as BookMediaPlaylistItem;
    setItems(copy);
  };

  const playlistItemIdsKey = items.map((p) => p.id).join(",");

  const listScrollRef = useRef<HTMLDivElement>(null);
  const itemRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevActivePlaybackIndexRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    prevActivePlaybackIndexRef.current = undefined;
  }, [el.id]);

  useEffect(() => {
    const idx = activePlaybackItemIndex;
    if (idx === prevActivePlaybackIndexRef.current) return;

    if (idx === undefined || idx < 0 || idx >= items.length) {
      prevActivePlaybackIndexRef.current = idx;
      return;
    }

    const listEl = listScrollRef.current;
    const rowEl = itemRowRefs.current.get(idx);
    if (!listEl || !rowEl) return;

    prevActivePlaybackIndexRef.current = idx;

    const raf = requestAnimationFrame(() => {
      const listRect = listEl.getBoundingClientRect();
      const rowRect = rowEl.getBoundingClientRect();
      const nextTop = listEl.scrollTop + (rowRect.top - listRect.top);
      listEl.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [activePlaybackItemIndex, items.length, playlistItemIdsKey]);

  return (
    <>
      {/* 잠긴 위젯은 상위에 pointer-events-none이 있어, 미디어 목록은 여기서 다시 받도록 함 */}
      <div className="pointer-events-auto">
      <p className="text-xs text-muted-foreground leading-relaxed">
        순서대로 재생됩니다. 이미지는 기본 {DEFAULT_MEDIA_PLAYLIST_IMAGE_DURATION_SEC}초이며 항목마다 바꿀 수
        있습니다. 동영상은 파일 길이만큼 재생됩니다.
      </p>
      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={resolveMediaPlaylistLoop(el)}
            onCheckedChange={(c) =>
              onChange(el.id, {
                mediaPlaylistLoop: c === false ? false : undefined,
              })
            }
          />
          <span>반복 재생</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={resolveMediaPlaylistShowControls(el)}
            onCheckedChange={(c) =>
              onChange(el.id, {
                mediaPlaylistShowControls: c === false ? false : undefined,
              })
            }
          />
          <span>진행 바·이전/다음·일시정지 표시</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRequestAppendPlaylistMediaFromFile ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={items.length >= MEDIA_PLAYLIST_MAX_ITEMS}
            onClick={() => onRequestAppendPlaylistMediaFromFile(el.id)}
          >
            파일에서 미디어 추가
          </Button>
        ) : null}
        {mediaLibraryReplaceEnabled && onRequestAppendPlaylistMediaFromLibrary ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={items.length >= MEDIA_PLAYLIST_MAX_ITEMS}
            onClick={() => onRequestAppendPlaylistMediaFromLibrary(el.id)}
          >
            라이브러리에서 미디어 추가
          </Button>
        ) : null}
      </div>
      <MediaPlaylistInspectorMiniBar
        el={el}
        items={items}
        playbackUi={playbackUi}
        highlightIndex={activePlaybackItemIndex}
        onRemote={
          onMediaPlaylistRemoteControl
            ? (kind) => onMediaPlaylistRemoteControl(el.id, kind)
            : undefined
        }
      />
      <div
        ref={listScrollRef}
        className="max-h-96 space-y-2 overflow-y-auto overflow-x-hidden pr-3 scroll-smooth"
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">항목이 없습니다.</p>
        ) : (
          items.map((it, i) => (
            <div
              key={it.id}
              ref={(node) => {
                if (node) itemRowRefs.current.set(i, node);
                else itemRowRefs.current.delete(i);
              }}
              className={cn(
                "rounded-md border p-2 transition-colors",
                activePlaybackItemIndex === i
                  ? "border-primary bg-primary/[0.07] ring-2 ring-primary/35"
                  : "border-border/80 bg-muted/20",
              )}
            >
              <div className="flex gap-2">
                <MediaPlaylistInspectorItemThumb
                  key={`${it.id}:${it.src}:${it.kind === "video" ? (it.posterSrc ?? "") : ""}`}
                  item={it}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {/* 목록에 overflow-x-hidden 이므로 가로 넘치면 오른쪽이 잘림 — 라벨 truncate로 넘침 방지 */}
                  <div className="flex min-w-0 items-center justify-between gap-1">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
                      {i + 1}. {it.kind === "image" ? "이미지" : "동영상"}
                      {activePlaybackItemIndex === i ? (
                        <span className="ml-1.5 rounded bg-primary/15 px-1 py-px text-[10px] font-semibold text-primary">
                          재생 중
                        </span>
                      ) : null}
                    </span>
                    {/* 오른쪽 끝은 overflow-x-hidden 에 잘리기 쉬움 → 삭제를 맨 앞(더 안쪽)에 둠 */}
                    <div className="relative z-10 isolate flex shrink-0 items-center gap-1 pr-2.5">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="text-destructive"
                        aria-label="삭제"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRequestDeletePlaylistItem?.(i);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label="위로"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label="아래로"
                        disabled={i === items.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">미디어 URL</Label>
                    <Input
                      className="font-mono text-xs"
                      placeholder={
                        it.kind === "image"
                          ? "/uploads/… 또는 https://…"
                          : "/uploads/… 비디오"
                      }
                      value={it.src}
                      onChange={(e) => updateItem(i, { src: e.target.value })}
                    />
                  </div>
                  {it.kind === "image" ? (
                    <div className="space-y-1">
                      <Label className="text-[11px]">표시 시간(초)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        placeholder={`기본 ${DEFAULT_MEDIA_PLAYLIST_IMAGE_DURATION_SEC}`}
                        value={
                          typeof it.durationSec === "number" && it.durationSec >= 1
                            ? it.durationSec
                            : ""
                        }
                        onChange={(e) => {
                          const t = e.target.value.trim();
                          if (t === "") {
                            updateItem(i, { durationSec: undefined });
                            return;
                          }
                          const n = Number(t);
                          if (Number.isInteger(n) && n >= 1 && n <= 600) {
                            updateItem(i, { durationSec: n });
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-[11px]">포스터 URL (선택)</Label>
                      <Input
                        className="font-mono text-xs"
                        placeholder="비우면 없음"
                        value={it.posterSrc ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          updateItem(i, { posterSrc: v === "" ? null : v });
                        }}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-[11px]">프레임 맞춤</Label>
                    <Select
                      value={resolveBookMediaObjectFit(it.objectFit)}
                      onValueChange={(next) =>
                        updateItem(i, { objectFit: next as BookMediaObjectFit })
                      }
                    >
                      <SelectTrigger size="sm" className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOK_MEDIA_OBJECT_FIT_VALUES.map((fit) => (
                          <SelectItem key={fit} value={fit}>
                            {MEDIA_FIT_LABELS[fit]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </>
  );
}

export function BookInspectorPanel({
  selected,
  multiSelectionCount = 0,
  slideWidth,
  slideHeight,
  onChange,
  onDelete,
  mediaHint,
  embedded = false,
  onReplaceMediaFromFile,
  onPickMediaFromLibrary,
  onRequestAppendPlaylistMediaFromFile,
  onRequestAppendPlaylistMediaFromLibrary,
  mediaLibraryReplaceEnabled = false,
  mediaPlaylistPlaybackByElementId,
  mediaPlaylistPlaybackUiByElementId,
  onMediaPlaylistRemoteControl,
  videoDurationSecByElementId,
  pagePresentationTimingElementId,
}: BookInspectorPanelProps) {
  const Root = embedded ? "div" : "aside";
  const [playlistItemDelete, setPlaylistItemDelete] = useState<{
    elementId: string;
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!playlistItemDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaylistItemDelete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playlistItemDelete]);

  const showPlaylistDeleteModal =
    playlistItemDelete != null &&
    selected?.type === "mediaPlaylist" &&
    selected.id === playlistItemDelete.elementId;

  const playlistDeleteItems =
    showPlaylistDeleteModal && selected.type === "mediaPlaylist"
      ? (selected.mediaPlaylistItems ?? [])
      : [];
  const playlistDeleteIdx = playlistItemDelete?.index ?? -1;
  const playlistDeleteTargetItem =
    playlistDeleteIdx >= 0 && playlistDeleteIdx < playlistDeleteItems.length
      ? playlistDeleteItems[playlistDeleteIdx]
      : undefined;

  const playlistDeleteConfirmLayer =
    showPlaylistDeleteModal ? (
      <div
        role="presentation"
        className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/50 p-4"
        onClick={() => setPlaylistItemDelete(null)}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="playlist-item-delete-title"
          className="w-full max-w-sm rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="playlist-item-delete-title"
            className="text-base font-semibold tracking-tight"
          >
            미디어 항목을 삭제할까요?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {playlistDeleteTargetItem != null && playlistDeleteIdx >= 0
              ? `목록 ${playlistDeleteIdx + 1}번 ${
                  playlistDeleteTargetItem.kind === "image" ? "이미지" : "동영상"
                } 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
              : "이 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다."}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPlaylistItemDelete(null)}>
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const t = playlistItemDelete;
                if (!t) return;
                const cur =
                  selected?.type === "mediaPlaylist" && selected.id === t.elementId
                    ? (selected.mediaPlaylistItems ?? [])
                    : [];
                if (t.index < 0 || t.index >= cur.length) {
                  setPlaylistItemDelete(null);
                  return;
                }
                onChange(t.elementId, {
                  mediaPlaylistItems: cur.filter((_, i) => i !== t.index),
                });
                setPlaylistItemDelete(null);
              }}
            >
              삭제
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
    <Root
      className={cn(
        bookDockedPanelRootClass("max-h-full"),
        embedded ? "min-w-0" : "w-80 shrink-0 border-l border-border/70",
      )}
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <SlidersHorizontal className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>위젯 속성</span>
      </div>
      <div className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-4 p-3">
          {multiSelectionCount >= 2 ? (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/[0.08] p-3 shadow-sm">
              <p className="text-sm font-semibold text-foreground">
                위젯 {multiSelectionCount}개 선택됨
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                한 번에 하나만 속성을 편집할 수 있습니다. Shift+클릭으로 선택을 추가·해제하고, 캔버스 빈 곳을
                눌러 모두 해제할 수 있습니다. Delete로 선택 항목을 함께 삭제할 수 있습니다.
              </p>
              <Button type="button" variant="destructive" size="sm" className="w-full" onClick={onDelete}>
                선택 항목 모두 삭제…
              </Button>
            </div>
          ) : !selected ? (
            <p className="rounded-md border border-dashed border-border/60 bg-muted/[0.05] px-3 py-4 text-center text-sm leading-relaxed text-muted-foreground">
              캔버스에서 위젯을 선택하면 이 패널에서 글자·위치·크기를 바꿀 수 있습니다.
            </p>
          ) : (
            <>
              {isBookElementLocked(selected) ? (
                <p className="mb-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs text-amber-900 dark:text-amber-100">
                  잠긴 위젯입니다. 레이어 목록의 자물쇠로 잠금을 해제한 뒤 편집할 수 있습니다.
                </p>
              ) : null}
              <div
                className={cn(
                  "space-y-4",
                  isBookElementLocked(selected) &&
                    selected.type !== "mediaPlaylist" &&
                    "pointer-events-none opacity-[0.68]",
                )}
              >
                {selected.type === "text" ? (
                  <>
                    <div className="space-y-1">
                      <Label>내용 (리치 텍스트)</Label>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        문단 좌·우·가운데 맞춤과 위젯 박스 안 세로(위·중·아래)는 바로 아래 도구 모음에서 같이
                        설정합니다.
                      </p>
                      <BookTextRichEditor
                        widgetKey={selected.id}
                        html={getTextWidgetDisplayHtml(selected)}
                        onRichPatch={(p) =>
                          onChange(selected.id, { richHtml: p.richHtml, text: p.text })
                        }
                        verticalAlign={
                          selected.verticalAlign === "middle" ||
                            selected.verticalAlign === "bottom"
                            ? selected.verticalAlign
                            : "top"
                        }
                        onVerticalAlignChange={(v) =>
                          onChange(selected.id, { verticalAlign: v })
                        }
                      />
                    </div>
                    <InspectorClampedSizeInput
                      elementId={selected.id}
                      value={selected.fontSize}
                      min={10}
                      max={120}
                      htmlId="insp-fs"
                      label="글자 크기 (pt)"
                      onCommit={(n) => onChange(selected.id, { fontSize: n })}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="insp-fill">기본 글자색</Label>
                      <p className="text-[11px] text-muted-foreground">
                        리치 텍스트에 색이 없는 구간·플레인 미리보기에 쓰입니다.
                      </p>
                      <p className="text-[11px] text-muted-foreground">자주 쓰는 색</p>
                      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
                        {BOOK_HEX_COLOR_PRESETS.map((c) => {
                          const fillNorm = selected.fill.trim().replace(/\s/g, "").toLowerCase();
                          const active = fillNorm === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              aria-label={`기본 글자색 ${c}`}
                              aria-pressed={active}
                              className={cn(
                                "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                                active && "ring-2 ring-primary ring-offset-2",
                              )}
                              style={{ backgroundColor: c }}
                              onClick={() => onChange(selected.id, { fill: c })}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="insp-fill"
                          type="color"
                          className="h-9 w-14 shrink-0 cursor-pointer px-1"
                          value={selected.fill.startsWith("#") ? selected.fill : "#111827"}
                          onChange={(e) => onChange(selected.id, { fill: e.target.value })}
                          aria-label="기본 글자색 직접 선택"
                        />
                        <span className="text-[11px] text-muted-foreground">팔레트로 직접 선택</span>
                      </div>
                    </div>
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <InspectorClampedSizeInput
                      elementId={selected.id}
                      value={selected.width ?? 640}
                      min={80}
                      max={2000}
                      htmlId="insp-tw"
                      label="줄 너비"
                      onCommit={(n) => onChange(selected.id, { width: n })}
                    />
                    <InspectorClampedSizeInput
                      elementId={selected.id}
                      value={Math.round(
                        selected.height ?? defaultTextWidgetBoxHeight(selected.fontSize),
                      )}
                      min={28}
                      max={4000}
                      htmlId="insp-th"
                      label="박스 높이"
                      onCommit={(n) => onChange(selected.id, { height: n })}
                    />
                    <ElementShapeChromeFields el={selected} onChange={onChange} />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : selected.type === "weather" ? (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      OpenWeatherMap(지오코딩·날씨·대기질)을 사용합니다. 서버에{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">OPENWEATHERMAP_API_KEY</code>가
                      필요합니다.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="insp-weather-city">도시 / 지역</Label>
                      <Input
                        id="insp-weather-city"
                        placeholder="비우면 서울 · 예: Seoul,KR, Busan,KR"
                        value={selected.cityQuery ?? ""}
                        maxLength={120}
                        onChange={(e) => {
                          const v = e.target.value;
                          onChange(selected.id, {
                            cityQuery: v.trim() === "" ? undefined : v,
                          });
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        검색어 뒤에 국가 코드를 붙이면 더 정확합니다.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>표시 항목</Label>
                      <p className="text-[11px] text-muted-foreground">
                        날씨만 남기면 큰 기온 카드, 대기 항목만 켜면 대기질 전용 톤으로 바뀝니다. 시계·날짜만 켠 경우·기온·아이콘 없이
                        습도 등만 켠 경우에도 빈 칸 없이 한 열로 정리됩니다.
                      </p>
                      <div className="flex flex-col gap-2">
                        {WEATHER_INSPECTOR_FIELDS.map(({ key, label }) => {
                          const disp = resolveBookWeatherDisplay(selected.weatherDisplay);
                          return (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-2 text-sm leading-none"
                            >
                              <Checkbox
                                checked={disp[key]}
                                onCheckedChange={(c) => {
                                  const on = c === true;
                                  onChange(selected.id, {
                                    weatherDisplay: patchWeatherDisplay(selected.weatherDisplay, key, on),
                                  });
                                }}
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <OptionalWidgetBackdropFields
                      elementId={selected.id}
                      value={selected.weatherBackground}
                      field="weatherBackground"
                      defaultRgba="rgba(14,165,233,0.88)"
                      colorAriaLabel="날씨 카드 배경색"
                      defaultHint="끄면 날씨/대기 테마 일러스트 배경을 씁니다."
                      onChange={onChange}
                    />
                    <OptionalWidgetTextColorFields
                      elementId={selected.id}
                      value={selected.weatherTextColor}
                      field="weatherTextColor"
                      defaultHex="#ffffff"
                      colorAriaLabel="날씨 위젯 글자색"
                      defaultHint="끄면 배경 테마에 맞는 기본 글자색을 씁니다."
                      onChange={onChange}
                    />
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <ElementShapeChromeFields el={selected} onChange={onChange} />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : selected.type === "news" ? (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <a
                        href="https://newsapi.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        NewsAPI.org
                      </a>{" "}
                      top-headlines. 서버{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">NEWSAPI_KEY</code> 필요.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="insp-news-country">국가 코드 (ISO 2자)</Label>
                      <Input
                        id="insp-news-country"
                        maxLength={2}
                        placeholder="KR"
                        className="font-mono uppercase"
                        title="한 글자만 있어도 입력 가능합니다. 비우면 기본 kr로 요청됩니다."
                        value={(selected.newsCountry ?? "").toUpperCase()}
                        onChange={(e) => {
                          const v = e.target.value
                            .replace(/[^a-zA-Z]/g, "")
                            .slice(0, 2)
                            .toLowerCase();
                          onChange(selected.id, {
                            newsCountry: v === "" ? undefined : v,
                          });
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        비우면 <span className="font-mono">kr</span>, 한 자리만 있으면 입력 마칠 때까지 위젯은{" "}
                        <span className="font-mono">kr</span>로 불러옵니다.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="insp-news-cat">카테고리</Label>
                      <Select
                        value={selected.newsCategory ?? "__all__"}
                        onValueChange={(v) =>
                          onChange(selected.id, {
                            newsCategory: v === "__all__" ? undefined : v,
                          })
                        }
                      >
                        <SelectTrigger id="insp-news-cat">
                          <SelectValue placeholder="전체" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">전체</SelectItem>
                          {BOOK_NEWS_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="insp-news-ps">기사 수 (1~10)</Label>
                        <Input
                          id="insp-news-ps"
                          type="number"
                          min={1}
                          max={10}
                          value={selected.newsPageSize ?? 5}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            onChange(selected.id, {
                              newsPageSize:
                                Number.isInteger(n) && n >= 1 && n <= 10 ? n : undefined,
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="insp-news-iv">캐러셀 간격(초)</Label>
                        <NewsCarouselIntervalInput
                          elementId={selected.id}
                          seconds={selected.newsCarouselIntervalSec}
                          onChange={onChange}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="insp-news-mode">표시 방식</Label>
                      <Select
                        value={selected.newsDisplayMode ?? "carousel"}
                        onValueChange={(v) =>
                          onChange(selected.id, {
                            newsDisplayMode: v === "list" ? "list" : "carousel",
                          })
                        }
                      >
                        <SelectTrigger id="insp-news-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carousel">캐러셀 (한 줄씩 전환)</SelectItem>
                          <SelectItem value="list">목록 (여러 줄)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        캐러셀은 위 간격마다 부드럽게 다음 기사로 넘어갑니다.
                      </p>
                    </div>
                    <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 px-2.5 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">표시 항목</p>
                      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
                        <Checkbox
                          checked={selected.newsShowHeader !== false}
                          onCheckedChange={(c) =>
                            onChange(selected.id, {
                              newsShowHeader: c === true,
                            })
                          }
                        />
                        <span>상단 헤더 (아이콘·제목·캐러셀 번호)</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
                        <Checkbox
                          checked={selected.newsShowSource !== false}
                          onCheckedChange={(c) =>
                            onChange(selected.id, {
                              newsShowSource: c === true,
                            })
                          }
                        />
                        <span>기사 출처</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
                        <Checkbox
                          checked={selected.newsLinksEnabled !== false}
                          onCheckedChange={(c) =>
                            onChange(selected.id, {
                              newsLinksEnabled: c === true,
                            })
                          }
                        />
                        <span>제목 링크 (원문 열기)</span>
                      </label>
                    </div>
                    <OptionalWidgetBackdropFields
                      elementId={selected.id}
                      value={selected.newsBackground}
                      field="newsBackground"
                      defaultRgba="rgba(15,23,42,0.92)"
                      colorAriaLabel="뉴스 카드 배경색"
                      defaultHint="끄면 기본 다크 그라데이션을 씁니다."
                      onChange={onChange}
                    />
                    <OptionalWidgetTextColorFields
                      elementId={selected.id}
                      value={selected.newsTextColor}
                      field="newsTextColor"
                      defaultHex="#ffffff"
                      colorAriaLabel="뉴스 제목·링크 색"
                      defaultHint="끄면 밝은 기본 제목색을 씁니다."
                      labelText="제목·링크 색"
                      appliedHint="기사 제목 링크에 적용됩니다."
                      onChange={onChange}
                    />
                    <OptionalWidgetTextColorFields
                      elementId={selected.id}
                      value={selected.newsMetaColor}
                      field="newsMetaColor"
                      defaultHex="#cbd5e1"
                      colorAriaLabel="뉴스 보조 글자색"
                      defaultHint="끄면 제목색(또는 기본)에 맞춰 출처·헤더가 보입니다."
                      labelText="출처·헤더 색"
                      appliedHint="상단 띠·출처·캐러셀 번호에 적용됩니다."
                      onChange={onChange}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="insp-news-section-title">상단 제목</Label>
                      <Input
                        id="insp-news-section-title"
                        maxLength={36}
                        placeholder="Headlines"
                        value={selected.newsSectionTitle ?? ""}
                        onChange={(e) => {
                          const t = e.target.value.replace(/[<>]/g, "").slice(0, 36);
                          onChange(selected.id, {
                            newsSectionTitle: t.trim() === "" ? undefined : t,
                          });
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        비우면 &quot;Headlines&quot; 로 표시합니다.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="insp-news-title-fs">제목 글자(px)</Label>
                        <Input
                          id="insp-news-title-fs"
                          type="number"
                          min={10}
                          max={32}
                          placeholder="자동"
                          value={selected.newsTitleFontSize ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              onChange(selected.id, { newsTitleFontSize: undefined });
                              return;
                            }
                            const n = Number(raw);
                            onChange(selected.id, {
                              newsTitleFontSize:
                                Number.isInteger(n) && n >= 10 && n <= 32 ? n : undefined,
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="insp-news-meta-fs">보조 글자(px)</Label>
                        <Input
                          id="insp-news-meta-fs"
                          type="number"
                          min={8}
                          max={22}
                          placeholder="자동"
                          value={selected.newsMetaFontSize ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              onChange(selected.id, { newsMetaFontSize: undefined });
                              return;
                            }
                            const n = Number(raw);
                            onChange(selected.id, {
                              newsMetaFontSize:
                                Number.isInteger(n) && n >= 8 && n <= 22 ? n : undefined,
                            });
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="insp-news-clamp">제목 줄 수</Label>
                        <Input
                          id="insp-news-clamp"
                          type="number"
                          min={1}
                          max={6}
                          placeholder="목록3·캐4"
                          value={selected.newsTitleLineClamp ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              onChange(selected.id, { newsTitleLineClamp: undefined });
                              return;
                            }
                            const n = Number(raw);
                            onChange(selected.id, {
                              newsTitleLineClamp:
                                Number.isInteger(n) && n >= 1 && n <= 6 ? n : undefined,
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="insp-news-pad">안쪽 여백(px)</Label>
                        <Input
                          id="insp-news-pad"
                          type="number"
                          min={4}
                          max={40}
                          placeholder="자동"
                          value={selected.newsContentPaddingPx ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              onChange(selected.id, { newsContentPaddingPx: undefined });
                              return;
                            }
                            const n = Number(raw);
                            onChange(selected.id, {
                              newsContentPaddingPx:
                                Number.isInteger(n) && n >= 4 && n <= 40 ? n : undefined,
                            });
                          }}
                        />
                      </div>
                    </div>
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <ElementShapeChromeFields el={selected} onChange={onChange} />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : selected.type === "digitalClock" ? (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      브라우저 로컬 시간 기준입니다. 초 표시를 끄면 분이 바뀔 때만 갱신됩니다.
                    </p>
                    <div className="space-y-2">
                      <Label>표시</Label>
                      <div className="flex flex-col gap-2">
                        {DIGITAL_CLOCK_INSPECTOR_FIELDS.map(({ key, label }) => {
                          const disp = resolveBookDigitalClockDisplay(selected.clockDisplay);
                          const checked = disp[key];
                          return (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-2 text-sm leading-none"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const on = c === true;
                                  onChange(selected.id, {
                                    clockDisplay: patchDigitalClockDisplay(selected.clockDisplay, key, on),
                                  });
                                }}
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <OptionalWidgetBackdropFields
                      elementId={selected.id}
                      value={selected.clockBackground}
                      field="clockBackground"
                      defaultRgba="rgba(15,23,42,0.92)"
                      colorAriaLabel="시계 배경색"
                      defaultHint="끄면 기본 그라데이션 배경을 씁니다."
                      onChange={onChange}
                    />
                    <OptionalWidgetTextColorFields
                      elementId={selected.id}
                      value={selected.clockTextColor}
                      field="clockTextColor"
                      defaultHex="#ffffff"
                      colorAriaLabel="디지털 시계 글자색"
                      defaultHint="끄면 밝은 기본 글자색을 씁니다."
                      onChange={onChange}
                    />
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <ElementShapeChromeFields el={selected} onChange={onChange} />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : selected.type === "drawing" ? (
                  <>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      자유 곡선입니다. 선 좌표는 박스 안에서 상대 위치로 저장되며, 박스를 옮기거나 크기를 바꿔도 모양이
                      함께 이동합니다.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">선 색</Label>
                      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
                        {BOOK_HEX_COLOR_PRESETS.map((c) => {
                          const strokeNorm = selected.stroke.trim().replace(/\s/g, "").toLowerCase();
                          const active = strokeNorm === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              aria-label={`선 색 ${c}`}
                              aria-pressed={active}
                              className={cn(
                                "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                                active && "ring-2 ring-primary ring-offset-2",
                              )}
                              style={{ backgroundColor: c }}
                              onClick={() => onChange(selected.id, { stroke: c })}
                            />
                          );
                        })}
                      </div>
                      <Input
                        type="color"
                        className="h-9 w-14 shrink-0 cursor-pointer px-1"
                        value={
                          selected.stroke.startsWith("#") && selected.stroke.length >= 7
                            ? selected.stroke.slice(0, 7)
                            : "#000000"
                        }
                        onChange={(e) => onChange(selected.id, { stroke: e.target.value })}
                        aria-label="선 색 직접 선택"
                      />
                    </div>
                    <InspectorStrokeWidthPxInput
                      key={`${selected.id}-insp-draw-sw-${Math.round(selected.strokeWidth)}`}
                      inputId="insp-draw-sw"
                      label="선 굵기 (px)"
                      value={selected.strokeWidth}
                      min={1}
                      max={48}
                      onCommit={(n) =>
                        onChange(selected.id, { strokeWidth: n })
                      }
                    />
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : selected.type === "shape" ? (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="insp-shape-kind" className="text-xs text-muted-foreground">
                        도형 종류
                      </Label>
                      <Select
                        value={selected.shapeKind}
                        onValueChange={(v) =>
                          onChange(selected.id, {
                            shapeKind: v as BookShapeKind,
                          })
                        }
                      >
                        <SelectTrigger id="insp-shape-kind" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOK_SHAPE_KINDS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {bookShapeKindLabelKo(k)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selected.shapeKind === "rect" ||
                    selected.shapeKind === "roundRect" ? (
                      <div className="space-y-1">
                        <Label htmlFor="insp-shape-cr">모서리 둥글기 (px)</Label>
                        <Input
                          id="insp-shape-cr"
                          type="number"
                          min={0}
                          max={200}
                          value={Math.round(selected.cornerRadius ?? 0)}
                          onChange={(e) =>
                            onChange(selected.id, {
                              cornerRadius: num(
                                e.target.value,
                                selected.cornerRadius ?? 0,
                                0,
                                200,
                              ),
                            })
                          }
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">면 색</Label>
                      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
                        {BOOK_HEX_COLOR_PRESETS.map((c) => {
                          const fillNorm = (selected.fill ?? "")
                            .trim()
                            .replace(/\s/g, "")
                            .toLowerCase();
                          const active = fillNorm === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              aria-label={`면 색 ${c}`}
                              aria-pressed={active}
                              className={cn(
                                "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                                active && "ring-2 ring-primary ring-offset-2",
                              )}
                              style={{ backgroundColor: c }}
                              onClick={() => onChange(selected.id, { fill: c })}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="color"
                          className="h-9 w-14 shrink-0 cursor-pointer px-1"
                          value={
                            selected.fill.startsWith("#") && selected.fill.length >= 7
                              ? selected.fill.slice(0, 7)
                              : selected.fill === "transparent"
                                ? "#cbd5e1"
                                : "#94a3b8"
                          }
                          onChange={(e) => onChange(selected.id, { fill: e.target.value })}
                          aria-label="면 색 직접 선택"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => onChange(selected.id, { fill: "transparent" })}
                        >
                          투명
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">선 색</Label>
                      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
                        {BOOK_HEX_COLOR_PRESETS.map((c) => {
                          const strokeNorm = selected.stroke.trim().replace(/\s/g, "").toLowerCase();
                          const active = strokeNorm === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              aria-label={`선 색 ${c}`}
                              aria-pressed={active}
                              className={cn(
                                "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                                active && "ring-2 ring-primary ring-offset-2",
                              )}
                              style={{ backgroundColor: c }}
                              onClick={() => onChange(selected.id, { stroke: c })}
                            />
                          );
                        })}
                      </div>
                      <Input
                        type="color"
                        className="h-9 w-14 shrink-0 cursor-pointer px-1"
                        value={
                          selected.stroke.startsWith("#") && selected.stroke.length >= 7
                            ? selected.stroke.slice(0, 7)
                            : "#000000"
                        }
                        onChange={(e) => onChange(selected.id, { stroke: e.target.value })}
                        aria-label="선 색 직접 선택"
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <InspectorStrokeWidthPxInput
                          key={`${selected.id}-insp-shape-sw-${Math.round(selected.strokeWidth)}`}
                          inputId="insp-shape-sw"
                          label="선 굵기 (px) · 0이면 테두리 없음"
                          value={selected.strokeWidth}
                          min={0}
                          max={32}
                          onCommit={(n) =>
                            onChange(selected.id, { strokeWidth: n })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 text-xs"
                        onClick={() => onChange(selected.id, { strokeWidth: 0 })}
                      >
                        선 없음
                      </Button>
                    </div>
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <ElementShapeChromeFields el={selected} onChange={onChange} />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : selected.type === "image" ? (
                  <>
                    <InspectorMediaSourceSection
                      kind="image"
                      src={selected.src}
                      onReplaceFile={onReplaceMediaFromFile}
                      onPickLibrary={onPickMediaFromLibrary}
                      libraryEnabled={mediaLibraryReplaceEnabled}
                    />
                    <Separator className="my-1 bg-border/80" />
                    <div className="space-y-3">
                      <p className="text-[10px] font-medium text-muted-foreground">표시</p>
                      <MediaObjectFitFields
                        elementId={selected.id}
                        value={selected.objectFit}
                        onChange={onChange}
                      />
                      <ElementOpacitySlider
                        elementId={selected.id}
                        opacity={selected.opacity}
                        onChange={onChange}
                      />
                      <ElementShapeChromeFields el={selected} onChange={onChange} />
                      <PositionSizeFields el={selected} onChange={onChange} />
                    </div>
                  </>
                ) : selected.type === "video" ? (
                  <>
                    <InspectorMediaSourceSection
                      kind="video"
                      src={selected.src}
                      posterSrc={selected.posterSrc}
                      onReplaceFile={onReplaceMediaFromFile}
                      onPickLibrary={onPickMediaFromLibrary}
                      libraryEnabled={mediaLibraryReplaceEnabled}
                    />
                    <Separator className="my-1 bg-border/80" />
                    <div className="space-y-3">
                      <p className="text-[10px] font-medium text-muted-foreground">표시</p>
                      <div className="space-y-1">
                        <Label className="text-[11px]">재생 길이</Label>
                        <div className="rounded-md border border-border/70 bg-muted/25 px-2 py-1.5 font-mono text-xs text-muted-foreground">
                          {(() => {
                            const dur = videoDurationSecByElementId?.[selected.id];
                            return dur != null && dur > 0
                              ? formatBookMediaClock(dur)
                              : "메타데이터를 불러오는 중…";
                          })()}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          파일에서 읽은 길이이며 수정할 수 없습니다.
                        </p>
                      </div>
                      <MediaObjectFitFields
                        elementId={selected.id}
                        value={selected.objectFit}
                        onChange={onChange}
                      />
                      <ElementOpacitySlider
                        elementId={selected.id}
                        opacity={selected.opacity}
                        onChange={onChange}
                      />
                      <ElementShapeChromeFields el={selected} onChange={onChange} />
                      <PositionSizeFields el={selected} onChange={onChange} />
                    </div>
                  </>
                ) : selected.type === "mediaPlaylist" ? (
                  <>
                    <MediaPlaylistInspectorBody
                      el={selected}
                      onChange={onChange}
                      onRequestAppendPlaylistMediaFromFile={
                        onRequestAppendPlaylistMediaFromFile
                      }
                      onRequestAppendPlaylistMediaFromLibrary={
                        onRequestAppendPlaylistMediaFromLibrary
                      }
                      onRequestDeletePlaylistItem={(index) =>
                        setPlaylistItemDelete({ elementId: selected.id, index })
                      }
                      mediaLibraryReplaceEnabled={mediaLibraryReplaceEnabled}
                      activePlaybackItemIndex={
                        mediaPlaylistPlaybackByElementId?.[selected.id]
                      }
                      playbackUi={mediaPlaylistPlaybackUiByElementId?.[selected.id]}
                      onMediaPlaylistRemoteControl={onMediaPlaylistRemoteControl}
                    />
                    <Separator className="my-1 bg-border/80" />
                    <ElementOpacitySlider
                      elementId={selected.id}
                      opacity={selected.opacity}
                      onChange={onChange}
                    />
                    <ElementShapeChromeFields el={selected} onChange={onChange} />
                    <PositionSizeFields el={selected} onChange={onChange} />
                  </>
                ) : null}

                {selected ? (
                  <div className="flex flex-col gap-2">
                    <InspectorPresentationTimingSection
                      el={selected}
                      pagePresentationTimingElementId={pagePresentationTimingElementId}
                      onChange={onChange}
                      videoMetaDurationSec={
                        selected.type === "video"
                          ? videoDurationSecByElementId?.[selected.id]
                          : undefined
                      }
                    />
                    {selected.type !== "drawing" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          onChange(selected.id, {
                            x: 0,
                            y: 0,
                            width: slideWidth,
                            height: slideHeight,
                          })
                        }
                      >
                        <Expand className="mr-1.5 size-3.5" aria-hidden />
                        슬라이드 전체(0,0)로 맞추기
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={onDelete}
                    >
                      <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                      위젯 삭제
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {mediaHint ? <p className="text-xs text-amber-600 dark:text-amber-400">{mediaHint}</p> : null}
        </div>
      </div>
    </Root>
    {playlistDeleteConfirmLayer && typeof document !== "undefined"
      ? createPortal(playlistDeleteConfirmLayer, document.body)
      : null}
    </>
  );
}

/**
 * 너비·높이: 매 글자마다 min(24) 클램프하면 56→5 입력 시 24로 튀는 문제가 있어 blur·Enter에만 반영.
 */
function InspectorClampedSizeInputInner({
  value,
  min,
  max,
  htmlId,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  htmlId: string;
  label: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(Math.round(value)));

  const commit = () => {
    if (draft.trim() === "") {
      setDraft(String(Math.round(value)));
      return;
    }
    const n = Number(draft);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setDraft(String(Math.round(value)));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onCommit(clamped);
    setDraft(String(clamped));
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={htmlId}>{label}</Label>
      <Input
        id={htmlId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="font-mono tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function InspectorClampedSizeInput(props: {
  elementId: string;
  value: number;
  min: number;
  max: number;
  htmlId: string;
  label: string;
  onCommit: (n: number) => void;
}) {
  const { elementId, ...rest } = props;
  const k = `${elementId}:${props.htmlId}:${Math.round(props.value)}`;
  return <InspectorClampedSizeInputInner key={k} {...rest} />;
}

function PositionSizeFields({
  el,
  onChange,
}: {
  el: BookCanvasElement;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  const rotDeg = Math.round(resolveBookElementRotation(el.rotation));
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="insp-x">X</Label>
        <Input
          id="insp-x"
          type="number"
          value={Math.round(el.x)}
          onChange={(e) => onChange(el.id, { x: num(e.target.value, el.x, 0, 4000) })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="insp-y">Y</Label>
        <Input
          id="insp-y"
          type="number"
          value={Math.round(el.y)}
          onChange={(e) => onChange(el.id, { y: num(e.target.value, el.y, 0, 4000) })}
        />
      </div>
      {el.type !== "text" ? (
        <>
          <InspectorClampedSizeInput
            elementId={el.id}
            value={el.width}
            min={24}
            max={4000}
            htmlId="insp-w"
            label="너비"
            onCommit={(n) => onChange(el.id, { width: n })}
          />
          <InspectorClampedSizeInput
            elementId={el.id}
            value={el.height}
            min={24}
            max={4000}
            htmlId="insp-h"
            label="높이"
            onCommit={(n) => onChange(el.id, { height: n })}
          />
        </>
      ) : (
        <>
          <div className="col-span-2 text-xs text-muted-foreground">
            텍스트 박스 크기는 캔버스에서 모서리를 드래그하거나 &quot;줄 너비&quot;로 조절합니다.
          </div>
        </>
      )}
      <div className="col-span-2 space-y-1">
        <Label htmlFor="insp-rot">회전 (°)</Label>
        <Input
          id="insp-rot"
          type="number"
          min={-360}
          max={360}
          step={1}
          value={rotDeg}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            const clamped = Math.min(360, Math.max(-360, Math.round(n)));
            onChange(el.id, {
              rotation: clamped === 0 ? undefined : clamped,
            });
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          시계 방향이 양수입니다. 변형 핸들로도 돌릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}
