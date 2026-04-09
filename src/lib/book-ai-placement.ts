import {
  BOOK_CANVAS_DRAG_GRID_PX,
  type BookCanvasElement,
  DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
  DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
  DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
  DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
  DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
  DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
  snapBookElementTopLeftToGrid,
} from "@/lib/book-canvas";
import { defaultTextWidgetBoxHeight } from "@/lib/book-text-widget";

export type BookLayoutAiAddWidgetAction = {
  type: "add_widget";
  widget: "weather" | "digitalClock" | "news" | "text" | "image" | "video";
  anchor: string;
  /** 왼쪽 목록 1번째 슬라이드 = 1. 없으면 현재 보는 슬라이드 */
  slideNumber?: number;
  cityQuery?: string;
  text?: string;
  fontSize?: number;
  imageSearchQuery?: string;
  imageUrl?: string;
  videoSearchQuery?: string;
  videoUrl?: string;
  src?: string;
  posterSrc?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type BookLayoutAiReplaceWidgetMediaAction = {
  type: "replace_widget_media";
  elementId: string;
  widget: "image" | "video";
  imageSearchQuery?: string;
  imageUrl?: string;
  videoSearchQuery?: string;
  videoUrl?: string;
  src?: string;
  posterSrc?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
};

export type BookLayoutAiSetBackgroundAction = {
  type: "set_page_background";
  backgroundColor: string;
};

export type BookLayoutAiSetPageTitleAction = {
  type: "set_page_title";
  title: string;
  /** 왼쪽 목록 기준 1번째 슬라이드 = 1. 없으면 현재 보는 슬라이드 */
  slideNumber?: number;
};

export type BookLayoutAiSetBookTitleAction = {
  type: "set_book_title";
  title: string;
};

export type BookLayoutAiAddPageAction = {
  type: "add_page";
  count?: number;
};

export type BookLayoutAiUndoAction = { type: "undo" };
export type BookLayoutAiRedoAction = { type: "redo" };
export type BookLayoutAiRemoveCurrentPageAction = {
  type: "remove_current_page";
};

export type BookLayoutAiSetSlideDimensionsAction = {
  type: "set_slide_dimensions";
  slideWidth?: number;
  slideHeight?: number;
};

export type BookLayoutAiAction =
  | BookLayoutAiAddWidgetAction
  | BookLayoutAiReplaceWidgetMediaAction
  | BookLayoutAiSetBackgroundAction
  | BookLayoutAiSetPageTitleAction
  | BookLayoutAiSetBookTitleAction
  | BookLayoutAiAddPageAction
  | BookLayoutAiUndoAction
  | BookLayoutAiRedoAction
  | BookLayoutAiRemoveCurrentPageAction
  | BookLayoutAiSetSlideDimensionsAction;

/** 헤더 «캔버스» 입력과 동일 범위 (BookHeaderSlideDimensions). */
export const BOOK_SLIDE_CANVAS_DIM_MIN = 100;
export const BOOK_SLIDE_CANVAS_DIM_MAX = 4000;

export function clampSlideCanvasDim(n: number): number {
  return Math.min(
    BOOK_SLIDE_CANVAS_DIM_MAX,
    Math.max(BOOK_SLIDE_CANVAS_DIM_MIN, Math.round(n)),
  );
}

const DEFAULT_TEXT_FONT = 28;
const MARGIN = 24;

const ANCHOR_SET = new Set([
  "topLeft",
  "topCenter",
  "topRight",
  "middleLeft",
  "center",
  "middleRight",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
]);

function escapeRichText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageBoxSize(
  intrinsicW?: number,
  intrinsicH?: number,
): { w: number; h: number } {
  const maxW = 480;
  const maxH = 340;
  const w = intrinsicW ?? 400;
  const h = intrinsicH ?? 260;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    return { w: 400, h: 260 };
  }
  const scale = Math.min(maxW / w, maxH / h, 1);
  return {
    w: Math.max(80, Math.round(w * scale)),
    h: Math.max(60, Math.round(h * scale)),
  };
}

function hasExplicitGeometry(a: BookLayoutAiAddWidgetAction): boolean {
  return (
    typeof a.x === "number" &&
    Number.isFinite(a.x) &&
    typeof a.y === "number" &&
    Number.isFinite(a.y) &&
    typeof a.width === "number" &&
    Number.isFinite(a.width) &&
    typeof a.height === "number" &&
    Number.isFinite(a.height)
  );
}

function clampPlacementBox(
  x: number,
  y: number,
  width: number,
  height: number,
  slideW: number,
  slideH: number,
): { x: number; y: number; w: number; h: number } {
  const minW = 24;
  const minH = 16;
  const w = Math.min(slideW, Math.max(minW, Math.round(width)));
  const h = Math.min(slideH, Math.max(minH, Math.round(height)));
  const xi = Math.min(Math.max(0, Math.round(x)), Math.max(0, slideW - w));
  const yi = Math.min(Math.max(0, Math.round(y)), Math.max(0, slideH - h));
  return { x: xi, y: yi, w, h };
}

function widgetSize(a: BookLayoutAiAddWidgetAction): { w: number; h: number } {
  if (a.widget === "weather") {
    return {
      w: DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
      h: DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
    };
  }
  if (a.widget === "digitalClock") {
    return {
      w: DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
      h: DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
    };
  }
  if (a.widget === "news") {
    return {
      w: DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
      h: DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
    };
  }
  if (a.widget === "image") {
    return imageBoxSize(a.imageWidth, a.imageHeight);
  }
  if (a.widget === "video") {
    return imageBoxSize(
      a.videoWidth ?? a.imageWidth,
      a.videoHeight ?? a.imageHeight,
    );
  }
  const fs =
    typeof a.fontSize === "number" &&
    Number.isFinite(a.fontSize) &&
    a.fontSize >= 10 &&
    a.fontSize <= 120
      ? Math.round(a.fontSize)
      : DEFAULT_TEXT_FONT;
  return {
    w: 480,
    h: defaultTextWidgetBoxHeight(fs),
  };
}

/**
 * 슬라이드 논리 좌표계에서 위젯 박스 왼쪽 위 (x,y).
 */
export function anchorToTopLeft(
  anchorRaw: string,
  slideW: number,
  slideH: number,
  widgetW: number,
  widgetH: number,
  margin = MARGIN,
): { x: number; y: number } {
  const anchor = ANCHOR_SET.has(anchorRaw) ? anchorRaw : "topLeft";
  const cx = (slideW - widgetW) / 2;
  const cy = (slideH - widgetH) / 2;
  const rx = slideW - widgetW - margin;
  const by = slideH - widgetH - margin;
  switch (anchor) {
    case "topLeft":
      return { x: margin, y: margin };
    case "topCenter":
      return { x: cx, y: margin };
    case "topRight":
      return { x: rx, y: margin };
    case "middleLeft":
      return { x: margin, y: cy };
    case "center":
      return { x: cx, y: cy };
    case "middleRight":
      return { x: rx, y: cy };
    case "bottomLeft":
      return { x: margin, y: by };
    case "bottomCenter":
      return { x: cx, y: by };
    case "bottomRight":
      return { x: rx, y: by };
    default:
      return { x: margin, y: margin };
  }
}

export function pageBackgroundActions(actions: BookLayoutAiAction[]): string[] {
  return actions
    .filter(
      (x): x is BookLayoutAiSetBackgroundAction =>
        x.type === "set_page_background",
    )
    .map((x) => x.backgroundColor);
}

export function pageTitleActions(
  actions: BookLayoutAiAction[],
): { title: string; slideNumber?: number }[] {
  return actions
    .filter(
      (x): x is BookLayoutAiSetPageTitleAction => x.type === "set_page_title",
    )
    .map((x) => {
      const sn =
        typeof x.slideNumber === "number" &&
        Number.isFinite(x.slideNumber) &&
        x.slideNumber >= 1
          ? Math.round(x.slideNumber)
          : undefined;
      return sn != null
        ? { title: x.title, slideNumber: sn }
        : { title: x.title };
    });
}

export function bookTitleActions(actions: BookLayoutAiAction[]): string[] {
  return actions
    .filter(
      (x): x is BookLayoutAiSetBookTitleAction => x.type === "set_book_title",
    )
    .map((x) => x.title);
}

/** 맨 뒤에 추가할 빈 슬라이드 수(여러 add_page 합산, 최대 20). */
export function addPagesTotalCount(actions: BookLayoutAiAction[]): number {
  let total = 0;
  for (const a of actions) {
    if (a.type !== "add_page") continue;
    const c =
      typeof a.count === "number" && Number.isFinite(a.count)
        ? Math.floor(a.count)
        : 1;
    total += Math.min(10, Math.max(1, c));
  }
  return Math.min(20, total);
}

/** 여러 set_slide_dimensions가 있으면 같은 축은 마지막 값이 적용됩니다. */
export function slideDimensionsFromActions(actions: BookLayoutAiAction[]): {
  slideWidth?: number;
  slideHeight?: number;
} {
  let slideWidth: number | undefined;
  let slideHeight: number | undefined;
  for (const a of actions) {
    if (a.type !== "set_slide_dimensions") continue;
    if (typeof a.slideWidth === "number" && Number.isFinite(a.slideWidth)) {
      slideWidth = clampSlideCanvasDim(a.slideWidth);
    }
    if (typeof a.slideHeight === "number" && Number.isFinite(a.slideHeight)) {
      slideHeight = clampSlideCanvasDim(a.slideHeight);
    }
  }
  return { slideWidth, slideHeight };
}

function widgetTargetSlideNumber(
  a: BookLayoutAiAddWidgetAction,
): number | undefined {
  if (
    typeof a.slideNumber === "number" &&
    Number.isFinite(a.slideNumber) &&
    a.slideNumber >= 1
  ) {
    return Math.round(a.slideNumber);
  }
  return undefined;
}

export type AiWidgetPlacement = {
  element: BookCanvasElement;
  /** 1-based; undefined면 부모의 «현재 슬라이드» */
  targetSlideNumber?: number;
};

/** add_widget → 캔버스 요소 + 대상 슬라이드 번호(겹침 완화 오프셋). */
export function widgetPlacementsFromLayoutAiActions(
  actions: BookLayoutAiAction[],
  slideW: number,
  slideH: number,
  gridPx: number = BOOK_CANVAS_DRAG_GRID_PX,
): AiWidgetPlacement[] {
  const out: AiWidgetPlacement[] = [];
  let stack = 0;
  for (const raw of actions) {
    if (raw.type !== "add_widget") continue;
    const a = raw;
    if (a.widget === "image" || a.widget === "video") {
      const src = a.src?.trim();
      if (!src || !/^https:\/\//i.test(src)) continue;
    }

    const explicit = hasExplicitGeometry(a);
    let w: number;
    let h: number;
    let snapped: { x: number; y: number };
    if (explicit) {
      const box = clampPlacementBox(
        a.x!,
        a.y!,
        a.width!,
        a.height!,
        slideW,
        slideH,
      );
      w = box.w;
      h = box.h;
      snapped = snapBookElementTopLeftToGrid(box.x, box.y, gridPx);
    } else {
      const wh = widgetSize(a);
      w = wh.w;
      h = wh.h;
      const base = anchorToTopLeft(a.anchor, slideW, slideH, w, h);
      const x = base.x + stack * 16;
      const y = base.y + stack * 16;
      stack += 1;
      snapped = snapBookElementTopLeftToGrid(x, y, gridPx);
    }
    const id = crypto.randomUUID();
    const targetSlideNumber = widgetTargetSlideNumber(a);

    if (a.widget === "weather") {
      const el: BookCanvasElement = {
        id,
        type: "weather",
        x: snapped.x,
        y: snapped.y,
        width: w,
        height: h,
        ...(a.cityQuery?.trim() ? { cityQuery: a.cityQuery.trim() } : {}),
      };
      out.push({ element: el, targetSlideNumber });
      continue;
    }
    if (a.widget === "digitalClock") {
      out.push({
        element: {
          id,
          type: "digitalClock",
          x: snapped.x,
          y: snapped.y,
          width: w,
          height: h,
        },
        targetSlideNumber,
      });
      continue;
    }
    if (a.widget === "news") {
      out.push({
        element: {
          id,
          type: "news",
          x: snapped.x,
          y: snapped.y,
          width: w,
          height: h,
        },
        targetSlideNumber,
      });
      continue;
    }
    if (a.widget === "image") {
      const src = a.src!.trim();
      out.push({
        element: {
          id,
          type: "image",
          x: snapped.x,
          y: snapped.y,
          width: w,
          height: h,
          src,
        },
        targetSlideNumber,
      });
      continue;
    }
    if (a.widget === "video") {
      const src = a.src!.trim();
      const p = a.posterSrc?.trim();
      const posterSrc = p && /^https:\/\//i.test(p) ? p : null;
      out.push({
        element: {
          id,
          type: "video",
          x: snapped.x,
          y: snapped.y,
          width: w,
          height: h,
          src,
          posterSrc,
        },
        targetSlideNumber,
      });
      continue;
    }

    const fs =
      typeof a.fontSize === "number" &&
      Number.isFinite(a.fontSize) &&
      a.fontSize >= 10 &&
      a.fontSize <= 120
        ? Math.round(a.fontSize)
        : DEFAULT_TEXT_FONT;
    const plain = a.text?.trim() || "텍스트를 입력하세요";
    const safeHtmlBody = plain
      .split("\n")
      .map((line) => escapeRichText(line))
      .join("<br/>");
    const textW = explicit ? w : 480;
    const textH = explicit ? h : defaultTextWidgetBoxHeight(fs);
    out.push({
      element: {
        id,
        type: "text",
        x: snapped.x,
        y: snapped.y,
        text: plain,
        richHtml: `<p>${safeHtmlBody}</p>`,
        fontSize: fs,
        fill: "#111827",
        width: textW,
        height: textH,
      },
      targetSlideNumber,
    });
  }
  return out;
}

/** @deprecated 구 코드 호환 — 슬라이드 번호가 필요하면 widgetPlacementsFromLayoutAiActions 사용 */
export function elementsFromLayoutAiActions(
  actions: BookLayoutAiAction[],
  slideW: number,
  slideH: number,
  gridPx?: number,
): BookCanvasElement[] {
  return widgetPlacementsFromLayoutAiActions(
    actions,
    slideW,
    slideH,
    gridPx,
  ).map((p) => p.element);
}
