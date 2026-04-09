/**
 * 북 슬라이드 캔버스(Konva)와 API `elementsJson`에 맞춘 요소 타입.
 */

import type Konva from "konva";

import {
  type BookPresentationTransitionId,
  clampBookPresentationTransitionMs,
  DEFAULT_BOOK_PRESENTATION_TRANSITION_MS,
  normalizeBookPresentationTransition,
} from "@/lib/book-presentation-transition";

export const BOOK_MEDIA_OBJECT_FIT_VALUES = [
  "cover",
  "contain",
  "fill",
  "none",
  "scale-down",
] as const;
export type BookMediaObjectFit = (typeof BOOK_MEDIA_OBJECT_FIT_VALUES)[number];
export const DEFAULT_BOOK_MEDIA_OBJECT_FIT: BookMediaObjectFit = "cover";

export function parseBookMediaObjectFit(
  raw: unknown,
): BookMediaObjectFit | undefined {
  if (typeof raw !== "string") return undefined;
  return (BOOK_MEDIA_OBJECT_FIT_VALUES as readonly string[]).includes(raw)
    ? (raw as BookMediaObjectFit)
    : undefined;
}

export function resolveBookMediaObjectFit(
  raw: BookMediaObjectFit | undefined,
): BookMediaObjectFit {
  return raw ?? DEFAULT_BOOK_MEDIA_OBJECT_FIT;
}

/** 요소 불투명도 0~1. 생략 시 1(완전 불투명). */
export const DEFAULT_BOOK_ELEMENT_OPACITY = 1;

export function resolveBookElementOpacity(opacity: number | undefined): number {
  if (typeof opacity !== "number" || !Number.isFinite(opacity))
    return DEFAULT_BOOK_ELEMENT_OPACITY;
  return Math.min(1, Math.max(0, opacity));
}

/** 도(°) 단위, 생략 시 0 */
export const DEFAULT_BOOK_ELEMENT_ROTATION = 0;

export function resolveBookElementRotation(deg: number | undefined): number {
  if (typeof deg !== "number" || !Number.isFinite(deg))
    return DEFAULT_BOOK_ELEMENT_ROTATION;
  return deg;
}

/** 캔버스·썸네일·보기 모드에서 그립니다. `visible === false`만 숨김(생략·true = 보임). */
export function isBookElementVisible(el: { visible?: boolean }): boolean {
  return el.visible !== false;
}

/** `locked === true`이면 캔버스에서 이동·변형·삭제(컨텍스트) 불가. 레이어 패널에서만 잠금 해제·삭제 가능. */
export function isBookElementLocked(el: { locked?: boolean }): boolean {
  return el.locked === true;
}

/**
 * 저장값: (x,y) = Konva `getTransform().point({0,0})` (로컬 왼쪽 위), rotation = `node.rotation()` 도.
 * 피벗 (cx,cy) = `node.x()/y()` 와 같아야 하며, TL에서 중심까지 벡터 (w/2,h/2)를 rotation만큼 돌린 값을 더합니다.
 * (Konva 10 `Rect` + offset 반크기로 런타임 대조해 부호 확정.)
 */
export function bookElementPivotKonva(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): {
  cx: number;
  cy: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
} {
  const w = el.width;
  const h = el.height;
  const deg = resolveBookElementRotation(el.rotation);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = el.x + (w / 2) * cos - (h / 2) * sin;
  const cy = el.y + (w / 2) * sin + (h / 2) * cos;
  return {
    cx,
    cy,
    offsetX: w / 2,
    offsetY: h / 2,
    rotation: deg,
  };
}

/**
 * HTML 오버레이(`transform-origin: center`)용: 부모 좌표에서 회전축(중심)이 (cx,cy)가 되도록
 * 배치 박스의 왼쪽 위(논리 좌표).
 */
export function bookElementOverlayTopLeftFromPivot(
  pivot: ReturnType<typeof bookElementPivotKonva>,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: pivot.cx - width / 2,
    y: pivot.cy - height / 2,
  };
}

/**
 * 드래그·변형 후 저장용 (x,y): 로컬 원점 (0,0)이 박스 왼쪽 위일 때( Rect / clip 과 동일 ),
 * Konva가 적용하는 변환 순서와 동일하게 부모 좌표로 옮깁니다. 수식 역변환보다 정확합니다.
 */
export function konvaBookTopLeftFromNode(node: Konva.Node): {
  x: number;
  y: number;
} {
  const p = node.getTransform().point({ x: 0, y: 0 });
  return { x: p.x, y: p.y };
}

/** `BookSlideCanvas` 위젯 히트: `Group`(중심·회전) 안의 투명 `Rect` — Transformer가 로컬 좌상단 기준으로 잡기 쉬움 */
export const KONVA_BOOK_WIDGET_HIT_RECT_NAME = "bookWidgetHitRect";

/**
 * 박스 중심 (cx,cy)·크기·회전(도)에서 저장용 왼쪽 위 좌표.
 * `bookElementPivotKonva`의 역변환(회전축 = 중심).
 */
export function bookElementTopLeftFromCenterRotation(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotationDeg: number,
): { x: number; y: number } {
  const deg = resolveBookElementRotation(rotationDeg);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx - (width / 2) * cos + (height / 2) * sin,
    y: cy - (width / 2) * sin - (height / 2) * cos,
  };
}

/** 드래그 종료 시: 중심 `Group`+히트 Rect 셸 vs 기존 offset `Rect` */
export function konvaBookTopLeftFromCommitNode(
  node: Konva.Node,
  logicalW: number,
  logicalH: number,
): { x: number; y: number } {
  if (node.getClassName() === "Group") {
    const inner = (node as Konva.Container).findOne(
      `.${KONVA_BOOK_WIDGET_HIT_RECT_NAME}`,
    ) as Konva.Node | undefined;
    if (inner) {
      return bookElementTopLeftFromCenterRotation(
        node.x(),
        node.y(),
        logicalW,
        logicalH,
        node.rotation(),
      );
    }
  }
  return konvaBookTopLeftFromNode(node);
}

export function snapKonvaBookCenterPivotGroupToGrid(
  node: Konva.Node,
  logical: { width: number; height: number; rotation?: number },
  gridPx: number = BOOK_CANVAS_DRAG_GRID_PX,
): void {
  const rot = logical.rotation ?? node.rotation();
  const tl = bookElementTopLeftFromCenterRotation(
    node.x(),
    node.y(),
    logical.width,
    logical.height,
    rot,
  );
  const snapped = snapBookElementTopLeftToGrid(tl.x, tl.y, gridPx);
  if (snapped.x === tl.x && snapped.y === tl.y) return;
  const p = bookElementPivotKonva({
    x: snapped.x,
    y: snapped.y,
    width: logical.width,
    height: logical.height,
    rotation: rot,
  });
  node.x(p.cx);
  node.y(p.cy);
}

/** 드래그 시 저장 좌표(박스 왼쪽 위)를 이 간격(px)에 맞춥니다. */
export const BOOK_CANVAS_DRAG_GRID_PX = 4;

export function snapBookElementTopLeftToGrid(
  topLeftX: number,
  topLeftY: number,
  gridPx: number = BOOK_CANVAS_DRAG_GRID_PX,
): { x: number; y: number } {
  return {
    x: Math.round(topLeftX / gridPx) * gridPx,
    y: Math.round(topLeftY / gridPx) * gridPx,
  };
}

/**
 * Konva 노드(중심 피벗)를 유지한 채 논리 좌표 왼쪽 위만 그리드에 스냅합니다.
 * react-konva `Rect`/`Group` 드래그 중·종료 시 호출.
 */
export function snapKonvaBookNodePositionToGrid(
  node: Konva.Node,
  logical: { width: number; height: number; rotation?: number },
  gridPx: number = BOOK_CANVAS_DRAG_GRID_PX,
): void {
  if (
    node.getClassName() === "Group" &&
    (node as Konva.Container).findOne(`.${KONVA_BOOK_WIDGET_HIT_RECT_NAME}`)
  ) {
    snapKonvaBookCenterPivotGroupToGrid(node, logical, gridPx);
    return;
  }
  const tl = konvaBookTopLeftFromNode(node);
  const snapped = snapBookElementTopLeftToGrid(tl.x, tl.y, gridPx);
  if (snapped.x === tl.x && snapped.y === tl.y) return;
  const p = bookElementPivotKonva({
    x: snapped.x,
    y: snapped.y,
    width: logical.width,
    height: logical.height,
    rotation: logical.rotation ?? node.rotation(),
  });
  node.x(p.cx);
  node.y(p.cy);
}

/** 뉴스 위젯 나열 방식 */
export type BookNewsDisplayMode = "list" | "carousel";

/** 미디어 위젯: 이미지 한 장. `durationSec` 생략 시 5초. */
export type BookMediaPlaylistImageItem = {
  id: string;
  kind: "image";
  src: string;
  /** 표시 시간(초) 1~600, 생략 시 기본 5 */
  durationSec?: number;
  objectFit?: BookMediaObjectFit;
};

/** 미디어 위젯: 동영상. 길이는 메타데이터 기준. */
export type BookMediaPlaylistVideoItem = {
  id: string;
  kind: "video";
  src: string;
  posterSrc: string | null;
  objectFit?: BookMediaObjectFit;
};

export type BookMediaPlaylistItem =
  | BookMediaPlaylistImageItem
  | BookMediaPlaylistVideoItem;

/** 미디어 위젯 기본 프레임 — 16:9에 가깝게 */
export const DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH = 480;
export const DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT = 270;
export const DEFAULT_MEDIA_PLAYLIST_IMAGE_DURATION_SEC = 5;
export const MEDIA_PLAYLIST_MAX_ITEMS = 40;

export function resolveMediaPlaylistImageDurationSec(
  item: BookMediaPlaylistImageItem,
): number {
  const n = item.durationSec;
  if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 600) {
    return n;
  }
  return DEFAULT_MEDIA_PLAYLIST_IMAGE_DURATION_SEC;
}

/** Konva 기본 도형(요소 패널에서 추가) */
export const BOOK_SHAPE_KINDS = [
  "rect",
  "roundRect",
  "ellipse",
  "line",
  "triangle",
  "rightTriangle",
  "arrow",
  "chevron",
  "star",
  "diamond",
  "hexagon",
  "pentagon",
  "octagon",
  "trapezoid",
  "parallelogram",
  "ring",
  "blockArc",
  "plus",
  "cross",
] as const;
export type BookShapeKind = (typeof BOOK_SHAPE_KINDS)[number];

export const DEFAULT_BOOK_SHAPE_WIDTH = 200;
export const DEFAULT_BOOK_SHAPE_HEIGHT = 120;

export type BookCanvasElement =
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      /** 평문(썸네일·검색·구버전 호환). 리치 HTML과 함께 유지합니다. */
      text: string;
      /** TipTap 등에서 생성한 정제된 HTML 조각(선택). */
      richHtml?: string;
      fontSize: number;
      fill: string;
      width?: number;
      /** 리치 텍스트 박스 논리 높이(Konva 히트·오버레이). 없으면 기본값 계산. */
      height?: number;
      /**
       * 위젯 박스 안에서 텍스트 블록의 세로 위치(박스가 글보다 클 때).
       * 생략·top = 상단.
       */
      verticalAlign?: "top" | "middle" | "bottom";
      /** 0~1, 생략 시 1 */
      opacity?: number;
      /** 시계 방향 도(°), 생략 시 0 */
      rotation?: number;
      /** 모서리 둥글기(논리 px). 생략 시 0(각진 기본). */
      borderRadius?: number;
      /** 외곽선 두께(논리 px). 0이면 없음. */
      outlineWidth?: number;
      /** 외곽선 색(CSS). outlineWidth가 0보다 클 때. */
      outlineColor?: string;
      /** false면 캔버스·보기에서 숨김(레이어 목록에는 남음). 생략·true = 보임 */
      visible?: boolean;
      /** true면 캔버스에서 위치·크기·삭제 등 편집 불가 */
      locked?: boolean;
      /** 슬라이드쇼: 시간 기준 레이어일 때 표시 초(미디어 플레이리스트는 항목 합으로 계산) */
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      /** 프레임 안 표시 방식(CSS object-fit과 동일). 생략 시 cover */
      objectFit?: BookMediaObjectFit;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "video";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      posterSrc: string | null;
      objectFit?: BookMediaObjectFit;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "weather";
      x: number;
      y: number;
      width: number;
      height: number;
      /** OpenWeather Geocoding 쿼리. 비우면 서울. 예: `Seoul,KR` */
      cityQuery?: string;
      /** 항목별 표시. `false`만 숨김, 생략·undefined는 표시(기본). */
      weatherDisplay?: BookWeatherDisplay;
      /** 카드 배경 CSS 색. 없으면 기본 일러스트 배경. */
      weatherBackground?: string;
      /** 본문·아이콘 색(CSS). 없으면 배경 테마에 맞는 기본 톤. */
      weatherTextColor?: string;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "digitalClock";
      x: number;
      y: number;
      width: number;
      height: number;
      /** 초·날짜는 `false`면 숨김. `hour12: true`면 12시간(AM/PM). */
      clockDisplay?: BookDigitalClockDisplay;
      /** 배경 CSS 색(`rgba`, `#rrggbb` 등). 없으면 기본 그라데이션. */
      clockBackground?: string;
      /** 시간·날짜 글자 색(CSS). 없으면 밝은 기본색. */
      clockTextColor?: string;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "news";
      x: number;
      y: number;
      width: number;
      height: number;
      /** ISO 3166-1 alpha-2. 생략 시 kr */
      newsCountry?: string;
      /** NewsAPI category. 생략 시 전체 성격의 헤드라인 */
      newsCategory?: string;
      /** 1~10, 기본 5 */
      newsPageSize?: number;
      /** list: 여러 줄 나열, carousel: 한 줄씩 전환 */
      newsDisplayMode?: BookNewsDisplayMode;
      /** 캐러셀 전환 간격(초) 3~120, 기본 5 */
      newsCarouselIntervalSec?: number;
      newsBackground?: string;
      /** 기사 제목·링크 색 (생략 시 테마 기본) */
      newsTextColor?: string;
      /** 출처·헤더·캐러셀 카운터 등 보조 텍스트 색 (생략 시 제목색 또는 기본) */
      newsMetaColor?: string;
      /** 제목 글꼴 크기(px), 10~32. 생략 시 위젯 높이에 비례 */
      newsTitleFontSize?: number;
      /** 보조 글꼴 크기(px), 8~22 */
      newsMetaFontSize?: number;
      /** 상단 띠 제목 (기본 Headlines), 최대 36자 */
      newsSectionTitle?: string;
      /** 제목 최대 줄 수(말줄임), 1~6 */
      newsTitleLineClamp?: number;
      /** 본문 영역 안쪽 여백(캔버스 px), 4~40 */
      newsContentPaddingPx?: number;
      /** false면 상단 아이콘·섹션 제목·캐러셀 번호 숨김 (기본 표시) */
      newsShowHeader?: boolean;
      /** false면 기사 출처(미디어명) 숨김 (기본 표시) */
      newsShowSource?: boolean;
      /** false면 제목을 링크로 열지 않음 (기본 클릭 시 원문) */
      newsLinksEnabled?: boolean;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "mediaPlaylist";
      x: number;
      y: number;
      width: number;
      height: number;
      /** 이미지·동영상 슬라이드(앞에서부터 순서대로 재생). */
      mediaPlaylistItems?: BookMediaPlaylistItem[];
      /** true(기본): 끝나면 처음부터 반복. false: 한 번만 재생 후 마지막에 정지. */
      mediaPlaylistLoop?: boolean;
      /** false면 진행 바·다음 버튼 숨김(기본 표시). */
      mediaPlaylistShowControls?: boolean;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "drawing";
      /** 바운딩 박스 중심(다른 위젯과 동일 피벗) */
      x: number;
      y: number;
      width: number;
      height: number;
      /** 박스 좌상단 기준 로컬 좌표 [x1,y1,x2,y2, …] */
      points: number[];
      stroke: string;
      strokeWidth: number;
      opacity?: number;
      rotation?: number;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    }
  | {
      id: string;
      type: "shape";
      x: number;
      y: number;
      width: number;
      height: number;
      shapeKind: BookShapeKind;
      /** 면 색(CSS). 선 전용 도형은 투명 가능 */
      fill: string;
      stroke: string;
      strokeWidth: number;
      /** shapeKind가 rect·roundRect일 때만(논리 px) */
      cornerRadius?: number;
      opacity?: number;
      rotation?: number;
      borderRadius?: number;
      outlineWidth?: number;
      outlineColor?: string;
      visible?: boolean;
      locked?: boolean;
      presentationHoldSec?: number;
    };

export function createBookShapeElement(
  shapeKind: BookShapeKind,
  pageW: number,
  pageH: number,
): Extract<BookCanvasElement, { type: "shape" }> {
  const isLineLike =
    shapeKind === "line" || shapeKind === "arrow" || shapeKind === "cross";
  const isSquareish =
    shapeKind === "diamond" ||
    shapeKind === "hexagon" ||
    shapeKind === "pentagon" ||
    shapeKind === "octagon" ||
    shapeKind === "ring" ||
    shapeKind === "blockArc";
  let w = DEFAULT_BOOK_SHAPE_WIDTH;
  let h = DEFAULT_BOOK_SHAPE_HEIGHT;
  if (isLineLike && shapeKind !== "cross") {
    w = Math.min(280, Math.max(120, Math.round(pageW * 0.45)));
    h = 32;
  } else if (shapeKind === "cross") {
    const s = Math.min(120, Math.round(Math.min(pageW, pageH) * 0.18));
    w = s;
    h = s;
  } else if (shapeKind === "ring") {
    const s = Math.min(160, Math.round(Math.min(pageW, pageH) * 0.22));
    w = s;
    h = s;
  } else if (shapeKind === "plus") {
    const s = Math.min(112, Math.round(Math.min(pageW, pageH) * 0.17));
    w = s;
    h = s;
  } else if (shapeKind === "chevron") {
    w = Math.min(240, Math.round(pageW * 0.38));
    h = Math.min(100, Math.round(pageH * 0.2));
  } else if (shapeKind === "rightTriangle") {
    w = DEFAULT_BOOK_SHAPE_WIDTH;
    h = Math.min(160, Math.round(pageH * 0.32));
  } else if (isSquareish) {
    const s = Math.min(168, Math.round(Math.min(pageW, pageH) * 0.24));
    w = s;
    h = s;
  }
  const x = Math.max(16, Math.round((pageW - w) / 2));
  const y = Math.max(16, Math.round((pageH - h) / 2));
  const baseFill = isLineLike ? "transparent" : "rgba(59,130,246,0.28)";
  const cornerRound =
    shapeKind === "roundRect"
      ? Math.min(28, Math.round(Math.min(w, h) * 0.14))
      : undefined;
  return {
    id: crypto.randomUUID(),
    type: "shape",
    x,
    y,
    width: w,
    height: h,
    shapeKind,
    fill: baseFill,
    stroke: "#1e40af",
    strokeWidth: 3,
    ...(shapeKind === "rect" ? { cornerRadius: 10 } : {}),
    ...(cornerRound !== undefined ? { cornerRadius: cornerRound } : {}),
  };
}

/** 드롭 지점을 박스 중심으로 보고 x,y(좌상단)를 페이지 안에 맞춥니다. */
export function placeBookShapeElementAtPointer(
  el: Extract<BookCanvasElement, { type: "shape" }>,
  pointerX: number,
  pointerY: number,
  pageW: number,
  pageH: number,
): Extract<BookCanvasElement, { type: "shape" }> {
  const w = el.width;
  const h = el.height;
  let x = Math.round(pointerX - w / 2);
  let y = Math.round(pointerY - h / 2);
  x = Math.max(0, Math.min(x, pageW - w));
  y = Math.max(0, Math.min(y, pageH - h));
  return { ...el, x, y };
}

export function resolveMediaPlaylistLoop(
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>,
): boolean {
  return el.mediaPlaylistLoop !== false;
}

export function resolveMediaPlaylistShowControls(
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>,
): boolean {
  return el.mediaPlaylistShowControls !== false;
}

/** 미디어 재생 시간 표시용 `m:ss` (속성 패널·오버레이 공통) */
export function formatBookMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 날씨 위젯 표시 플래그(저장용). `false` = 숨김. */
export type BookWeatherDisplay = Partial<{
  temp: boolean;
  feelsLike: boolean;
  description: boolean;
  icon: boolean;
  humidity: boolean;
  wind: boolean;
  pm25: boolean;
  pm10: boolean;
  aqi: boolean;
  clock: boolean;
  date: boolean;
}>;

export type BookWeatherDisplayResolved = {
  temp: boolean;
  feelsLike: boolean;
  description: boolean;
  icon: boolean;
  humidity: boolean;
  wind: boolean;
  pm25: boolean;
  pm10: boolean;
  aqi: boolean;
  clock: boolean;
  date: boolean;
};

/** 모두 끄면 기본(전체 표시)으로 되돌립니다. */
export function resolveBookWeatherDisplay(
  raw?: BookWeatherDisplay | null,
): BookWeatherDisplayResolved {
  const out: BookWeatherDisplayResolved = {
    temp: raw?.temp !== false,
    feelsLike: raw?.feelsLike !== false,
    description: raw?.description !== false,
    icon: raw?.icon !== false,
    humidity: raw?.humidity !== false,
    wind: raw?.wind !== false,
    pm25: raw?.pm25 !== false,
    pm10: raw?.pm10 !== false,
    aqi: raw?.aqi !== false,
    clock: raw?.clock !== false,
    date: raw?.date !== false,
  };
  if (!Object.values(out).some(Boolean)) {
    return {
      temp: true,
      feelsLike: true,
      description: true,
      icon: true,
      humidity: true,
      wind: true,
      pm25: true,
      pm10: true,
      aqi: true,
      clock: true,
      date: true,
    };
  }
  return out;
}

/** 디지털 시계 표시 플래그(저장용). 초·날짜는 `false` = 숨김, `hour12`만 `true` 저장 시 12시간제. */
export type BookDigitalClockDisplay = Partial<{
  seconds: boolean;
  date: boolean;
  hour12: boolean;
}>;

export type BookDigitalClockDisplayResolved = {
  seconds: boolean;
  date: boolean;
  hour12: boolean;
};

export function resolveBookDigitalClockDisplay(
  raw?: BookDigitalClockDisplay | null,
): BookDigitalClockDisplayResolved {
  return {
    seconds: raw?.seconds !== false,
    date: raw?.date !== false,
    hour12: raw?.hour12 === true,
  };
}

const CLOCK_BACKGROUND_MAX_LEN = 80;

/** 저장/로드용: 위험한 값·길이 초과는 제거(undefined). */
export function parseBookClockBackground(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().slice(0, CLOCK_BACKGROUND_MAX_LEN);
  if (!s) return undefined;
  if (/[<>]/.test(s) || /url\s*\(/i.test(s)) return undefined;
  return s;
}

/** 시계·날씨 공통: `parseBookClockBackground`와 동일. */
export function parseBookWeatherBackground(raw: unknown): string | undefined {
  return parseBookClockBackground(raw);
}

/** 위젯 글자색(저장값 검증). 배경과 동일 규칙(길이·금지 문자). */
export function parseBookWidgetTextColor(raw: unknown): string | undefined {
  return parseBookClockBackground(raw);
}

/**
 * 배경 CSS에서 알파 추출. `rgb`·`#rrggbb`는 1, `rgba`·`#rrggbbaa`는 해당 알파.
 * 썸네일·테두리 강도에 사용.
 */
export function bookWidgetBackdropAlphaFromCss(css: string): number {
  const s = css.trim();
  const rgba = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/i.exec(
    s,
  );
  if (rgba) return Math.min(1, Math.max(0, parseFloat(rgba[1])));
  if (/^rgb\(/i.test(s)) return 1;
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    const byte = parseInt(s.slice(7, 9), 16);
    return Number.isFinite(byte) ? Math.min(1, Math.max(0, byte / 255)) : 1;
  }
  return 1;
}

/** 사용자 지정 배경일 때 테두리·그림자. 배경 알파와 비례(알파 0이면 윤곽·그림자 없음). */
export function bookWidgetBackdropChromeStyle(css: string): {
  border: string;
  boxShadow: string;
} {
  const t = bookWidgetBackdropAlphaFromCss(css);
  if (t < 0.02) {
    return { border: "none", boxShadow: "none" };
  }
  const borderA = t * 0.28;
  const shadowA = t * 0.48;
  return {
    border: `1px solid rgba(255,255,255,${borderA})`,
    boxShadow: `0 12px 40px -8px rgba(0,0,0,${shadowA})`,
  };
}

/** 날씨·시계 등에서 필드 생략 시 쓰는 기본 둥근 정도(논리 px). 텍스트·이미지·비디오 생략 시 0. */
export const BOOK_WIDGET_DEFAULT_ROUNDED_RADIUS = 16;

const BOOK_WIDGET_BORDER_RADIUS_MAX = 2000;
const BOOK_WIDGET_OUTLINE_WIDTH_MAX = 32;
const BOOK_OUTLINE_COLOR_MAX_LEN = 80;

export function parseBookOutlineColor(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().slice(0, BOOK_OUTLINE_COLOR_MAX_LEN);
  if (!s) return undefined;
  if (/[<>]/.test(s) || /url\s*\(/i.test(s)) return undefined;
  return s;
}

function parseStoredBorderRadius(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  return Math.min(BOOK_WIDGET_BORDER_RADIUS_MAX, Math.max(0, raw));
}

function parseStoredOutlineWidth(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const v = Math.min(BOOK_WIDGET_OUTLINE_WIDTH_MAX, Math.max(0, raw));
  return v > 0 ? v : undefined;
}

/** 저장된 값 + 타입별 기본(텍스트·미디어 0, 날씨·시계 16). */
export function resolveBookElementBorderRadius(el: BookCanvasElement): number {
  if (el.type === "drawing") return 0;
  if (typeof el.borderRadius === "number" && Number.isFinite(el.borderRadius)) {
    return Math.min(
      BOOK_WIDGET_BORDER_RADIUS_MAX,
      Math.max(0, el.borderRadius),
    );
  }
  if (
    el.type === "weather" ||
    el.type === "digitalClock" ||
    el.type === "news" ||
    el.type === "mediaPlaylist"
  ) {
    return BOOK_WIDGET_DEFAULT_ROUNDED_RADIUS;
  }
  return 0;
}

export function resolveBookElementOutlineWidth(el: BookCanvasElement): number {
  if (el.type === "drawing") return 0;
  if (typeof el.outlineWidth !== "number" || !Number.isFinite(el.outlineWidth))
    return 0;
  return Math.min(BOOK_WIDGET_OUTLINE_WIDTH_MAX, Math.max(0, el.outlineWidth));
}

/** outlineWidth가 0이면 의미 없음. */
export function resolveBookElementOutlineColor(el: BookCanvasElement): string {
  if (el.type === "drawing") return "transparent";
  if (resolveBookElementOutlineWidth(el) <= 0) return "transparent";
  const c = parseBookOutlineColor(el.outlineColor);
  return c ?? "rgba(148,163,184,0.95)";
}

/** Konva clip·스냅샷용 둥근 사각 경로. */
export function canvasRoundRectPath(
  ctx: {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
    closePath: () => void;
    rect: (x: number, y: number, w: number, h: number) => void;
  },
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(Math.max(0, r), w / 2, h / 2);
  if (rad <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function widgetChromePatch(o: Record<string, unknown>): {
  borderRadius?: number;
  outlineWidth?: number;
  outlineColor?: string;
} {
  const br = parseStoredBorderRadius(o.borderRadius);
  const ow = parseStoredOutlineWidth(o.outlineWidth);
  const oc = parseBookOutlineColor(o.outlineColor);
  return {
    ...(br !== undefined ? { borderRadius: br } : {}),
    ...(ow !== undefined ? { outlineWidth: ow } : {}),
    ...(oc !== undefined ? { outlineColor: oc } : {}),
  };
}

export type BookEditorPageState = {
  /** 목록 key·드래그 식별(서버 페이지는 보통 `srv-{id}`) */
  clientKey: string;
  sortOrder: number;
  /** 비우면 사이드바에 "슬라이드 n" 표시 */
  name: string;
  /** 슬라이드 배경(CSS 색, Konva Stage 배경과 동일) */
  backgroundColor: string;
  elements: BookCanvasElement[];
  /** 미리보기 페이지 체류 시간 기준 위젯 id(같은 페이지 elements 내) */
  presentationTimingElementId?: string | null;
  /** 슬라이드쇼에서 이 페이지로 들어올 때 전환(기본 none) */
  presentationTransition?: BookPresentationTransitionId;
  /** 전환 지속(ms) */
  presentationTransitionMs?: number;
};

/**
 * 시간 기준 레이어 id. 위젯이 하나 이상이면 항상 하나(저장값이 유효하지 않으면 배열 첫 요소 = 먼저 추가된 레이어).
 */
export function resolveEffectivePresentationTimingElementId(
  elements: BookCanvasElement[],
  stored: string | null | undefined,
): string | null {
  if (elements.length === 0) return null;
  const t = typeof stored === "string" ? stored.trim() : "";
  if (t && elements.some((e) => e.id === t)) return t;
  return elements[0]!.id;
}

export const DEFAULT_SLIDE_WIDTH = 960;
export const DEFAULT_SLIDE_HEIGHT = 540;

/** 날씨 위젯 기본 프레임(px) — 2열 기본 배치가 위·아래 여백 맞게 들어가도록 높이를 다소 타이트하게 */
export const DEFAULT_BOOK_WEATHER_WIDGET_WIDTH = 364;
export const DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT = 220;
/** 뉴스 위젯 기본 프레임(px) — 캐러셀 1줄·목록 여러 줄 */
export const DEFAULT_BOOK_NEWS_WIDGET_WIDTH = 420;
export const DEFAULT_BOOK_NEWS_WIDGET_HEIGHT = 200;
/** 디지털 시계 위젯 기본 프레임(px) */
export const DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH = 280;
export const DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT = 96;
export const DEFAULT_PAGE_BACKGROUND = "#ffffff";

const PAGE_BG_MAX_LEN = 64;

/** 페이지 배경 문자열 정리(빈 값·위험 패턴은 기본 흰색). */
export function sanitizePageBackgroundColor(raw: string): string {
  const s = raw.trim().slice(0, PAGE_BG_MAX_LEN);
  if (!s) return DEFAULT_PAGE_BACKGROUND;
  if (/[<>]/.test(s) || /url\s*\(/i.test(s)) return DEFAULT_PAGE_BACKGROUND;
  return s;
}

/** Pexels·Vimeo 재생 URL은 쿼리·서명이 길어 500자면 잘려 서버 검증 실패함 — 백엔드와 동일 상한 */
const BOOK_MEDIA_SRC_MAX = 2000;

/**
 * 저장 시 `src`·`posterSrc`: `/uploads/...`·`/cards/...`는 그대로 두고, 외부 https URL은 상한까지 유지합니다.
 */
export function bookMediaSrcForApi(
  src: string,
  maxLen = BOOK_MEDIA_SRC_MAX,
): string {
  const t = src.trim();
  if (!t) return t;
  const noQuery = t.includes("?") ? t.slice(0, t.indexOf("?")) : t;
  const uploadsIdx = noQuery.indexOf("/uploads/");
  if (uploadsIdx >= 0) {
    return noQuery.slice(uploadsIdx, uploadsIdx + maxLen);
  }
  const cardsIdx = noQuery.indexOf("/cards/");
  if (cardsIdx >= 0) {
    return noQuery.slice(cardsIdx, cardsIdx + maxLen);
  }
  return t.slice(0, maxLen);
}

function finiteXY(x: unknown, y: unknown): { x: number; y: number } {
  const nx = Number(x);
  const ny = Number(y);
  return {
    x: Number.isFinite(nx) ? nx : 0,
    y: Number.isFinite(ny) ? ny : 0,
  };
}

function finiteWH(
  w: unknown,
  h: unknown,
  fallbackW: number,
  fallbackH: number,
) {
  const nw = Number(w);
  const nh = Number(h);
  return {
    width: Number.isFinite(nw) ? nw : fallbackW,
    height: Number.isFinite(nh) ? nh : fallbackH,
  };
}

/** API 본문: `visible: false`·`locked: true`만 명시(나머지 키 생략). */
function finalizeElementForApi(el: BookCanvasElement): BookCanvasElement {
  const copy = {
    ...(el as BookCanvasElement & { visible?: boolean; locked?: boolean }),
  };
  if (copy.visible !== false) delete copy.visible;
  if (copy.locked !== true) delete copy.locked;
  return copy as BookCanvasElement;
}

/** POST/PATCH `pages[].elements` 직전: 숫자·경로 정규화로 서버 검증 실패를 줄임 */
function normalizeBookElementsForSave(
  elements: BookCanvasElement[],
): BookCanvasElement[] {
  return elements.map((el) => {
    const xy = finiteXY(el.x, el.y);
    if (el.type === "image") {
      const wh = finiteWH(el.width, el.height, 320, 180);
      return finalizeElementForApi({
        ...el,
        ...xy,
        ...wh,
        src: bookMediaSrcForApi(el.src),
      });
    }
    if (el.type === "video") {
      const wh = finiteWH(el.width, el.height, 480, 270);
      const ps = el.posterSrc;
      return finalizeElementForApi({
        ...el,
        ...xy,
        ...wh,
        src: bookMediaSrcForApi(el.src),
        posterSrc:
          ps != null && String(ps).trim() !== ""
            ? bookMediaSrcForApi(String(ps))
            : ps,
      });
    }
    if (el.type === "weather") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
        DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "digitalClock") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
        DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "news") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
        DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "mediaPlaylist") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
        DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
      );
      const rawItems = Array.isArray(el.mediaPlaylistItems)
        ? el.mediaPlaylistItems
        : [];
      const mediaPlaylistItems: BookMediaPlaylistItem[] = [];
      for (const it of rawItems) {
        const srcTrim = typeof it.src === "string" ? it.src.trim() : "";
        if (!srcTrim) continue;
        if (it.kind === "image") {
          mediaPlaylistItems.push({
            id: it.id,
            kind: "image",
            src: bookMediaSrcForApi(srcTrim),
            ...(typeof it.durationSec === "number" &&
            Number.isInteger(it.durationSec) &&
            it.durationSec >= 1 &&
            it.durationSec <= 600
              ? { durationSec: it.durationSec }
              : {}),
            ...(it.objectFit ? { objectFit: it.objectFit } : {}),
          });
          continue;
        }
        const ps = it.posterSrc;
        mediaPlaylistItems.push({
          id: it.id,
          kind: "video",
          src: bookMediaSrcForApi(srcTrim),
          posterSrc:
            ps != null && String(ps).trim() !== ""
              ? bookMediaSrcForApi(String(ps))
              : null,
          ...(it.objectFit ? { objectFit: it.objectFit } : {}),
        });
      }
      return finalizeElementForApi({
        ...el,
        ...xy,
        ...wh,
        mediaPlaylistItems,
      });
    }
    if (el.type === "shape") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_SHAPE_WIDTH,
        DEFAULT_BOOK_SHAPE_HEIGHT,
      );
      const sw = Number(el.strokeWidth);
      const strokeW = Number.isFinite(sw)
        ? Math.min(32, Math.max(0, Math.round(sw)))
        : 3;
      const fill =
        typeof el.fill === "string" && el.fill.trim()
          ? el.fill.trim().slice(0, 40)
          : "rgba(59,130,246,0.28)";
      const stroke =
        typeof el.stroke === "string" && el.stroke.trim()
          ? el.stroke.trim().slice(0, 40)
          : "#1e40af";
      const kind = BOOK_SHAPE_KINDS.includes(el.shapeKind)
        ? el.shapeKind
        : "rect";
      const crRaw = el.cornerRadius;
      const cornerRadius =
        (kind === "rect" || kind === "roundRect") &&
        typeof crRaw === "number" &&
        Number.isFinite(crRaw)
          ? Math.min(200, Math.max(0, crRaw))
          : undefined;
      const { cornerRadius: _stripCr, ...shapeRest } = el;
      void _stripCr;
      return finalizeElementForApi({
        ...shapeRest,
        ...xy,
        width: Math.min(4000, Math.max(10, wh.width)),
        height: Math.min(4000, Math.max(10, wh.height)),
        shapeKind: kind,
        fill,
        stroke,
        strokeWidth: strokeW,
        ...(cornerRadius !== undefined ? { cornerRadius } : {}),
      });
    }
    if (el.type === "drawing") {
      const wh = finiteWH(el.width, el.height, 16, 16);
      const ptsIn = Array.isArray(el.points) ? el.points : [];
      const pts: number[] = [];
      for (let i = 0; i < ptsIn.length && pts.length < 4096; i++) {
        const n = Number(ptsIn[i]);
        if (Number.isFinite(n)) pts.push(n);
      }
      if (pts.length % 2 === 1) pts.pop();
      const sw = Number(el.strokeWidth);
      const strokeW = Number.isFinite(sw) ? Math.min(32, Math.max(1, sw)) : 4;
      const stroke =
        typeof el.stroke === "string" && el.stroke.trim()
          ? el.stroke.trim().slice(0, 40)
          : "#1e293b";
      return finalizeElementForApi({
        ...el,
        ...xy,
        ...wh,
        type: "drawing",
        points: pts,
        stroke,
        strokeWidth: strokeW,
      });
    }
    const fs = Number(el.fontSize);
    const fontSize = Number.isFinite(fs) && fs >= 8 && fs <= 200 ? fs : 24;
    const out: BookCanvasElement = { ...el, ...xy, type: "text", fontSize };
    const w = el.width != null ? Number(el.width) : undefined;
    const h = el.height != null ? Number(el.height) : undefined;
    if (w != null && Number.isFinite(w)) out.width = w;
    if (h != null && Number.isFinite(h)) out.height = h;
    return finalizeElementForApi(out);
  });
}

export function slideDisplayLabel(
  name: string | undefined | null,
  indexZero: number,
): string {
  const t = name?.trim();
  if (t) return t;
  return `슬라이드 ${indexZero + 1}`;
}

/** 빈 제목 또는 `슬라이드 12` 형태만 현재 순서에 맞게 다시 번호 매김(직접 지은 제목은 유지). */
export const AUTO_SLIDE_TITLE_RE = /^슬라이드\s*\d+$/;

export function applyAutoSlideNamesByIndex(
  pages: BookEditorPageState[],
): BookEditorPageState[] {
  return pages.map((p, i) => {
    const t = (p.name ?? "").trim();
    if (t === "" || AUTO_SLIDE_TITLE_RE.test(t)) {
      return { ...p, name: `슬라이드 ${i + 1}` };
    }
    return p;
  });
}

export function createEmptyEditorPage(sortOrder: number): BookEditorPageState {
  return {
    clientKey: crypto.randomUUID(),
    sortOrder,
    name: "",
    backgroundColor: DEFAULT_PAGE_BACKGROUND,
    elements: [],
    presentationTransition: "none",
    presentationTransitionMs: DEFAULT_BOOK_PRESENTATION_TRANSITION_MS,
  };
}

/** 같은 내용의 새 페이지(새 `clientKey`·요소 `id`). 목록에 바로 아래에 끼워 넣은 뒤 `applyAutoSlideNamesByIndex` 권장. */
export function duplicateBookEditorPage(
  page: BookEditorPageState,
): BookEditorPageState {
  const oldTiming = page.presentationTimingElementId?.trim() ?? "";
  let mappedTimingId: string | null = null;
  const elements = page.elements.map((el) => {
    const id = crypto.randomUUID();
    if (oldTiming !== "" && el.id === oldTiming) mappedTimingId = id;
    if (el.type === "text") {
      return { ...el, id };
    }
    if (el.type === "image") {
      return { ...el, id };
    }
    if (el.type === "weather") {
      return {
        ...el,
        id,
        ...(el.cityQuery !== undefined ? { cityQuery: el.cityQuery } : {}),
        ...(el.weatherDisplay !== undefined
          ? { weatherDisplay: { ...el.weatherDisplay } }
          : {}),
        ...(el.weatherBackground !== undefined
          ? { weatherBackground: el.weatherBackground }
          : {}),
        ...(el.weatherTextColor !== undefined
          ? { weatherTextColor: el.weatherTextColor }
          : {}),
        ...(el.borderRadius !== undefined
          ? { borderRadius: el.borderRadius }
          : {}),
        ...(el.outlineWidth !== undefined
          ? { outlineWidth: el.outlineWidth }
          : {}),
        ...(el.outlineColor !== undefined
          ? { outlineColor: el.outlineColor }
          : {}),
      };
    }
    if (el.type === "digitalClock") {
      return {
        ...el,
        id,
        ...(el.clockDisplay !== undefined
          ? { clockDisplay: { ...el.clockDisplay } }
          : {}),
        ...(el.clockBackground !== undefined
          ? { clockBackground: el.clockBackground }
          : {}),
        ...(el.clockTextColor !== undefined
          ? { clockTextColor: el.clockTextColor }
          : {}),
        ...(el.borderRadius !== undefined
          ? { borderRadius: el.borderRadius }
          : {}),
        ...(el.outlineWidth !== undefined
          ? { outlineWidth: el.outlineWidth }
          : {}),
        ...(el.outlineColor !== undefined
          ? { outlineColor: el.outlineColor }
          : {}),
      };
    }
    if (el.type === "news") {
      return {
        ...el,
        id,
        ...(el.newsCountry !== undefined
          ? { newsCountry: el.newsCountry }
          : {}),
        ...(el.newsCategory !== undefined
          ? { newsCategory: el.newsCategory }
          : {}),
        ...(el.newsPageSize !== undefined
          ? { newsPageSize: el.newsPageSize }
          : {}),
        ...(el.newsDisplayMode !== undefined
          ? { newsDisplayMode: el.newsDisplayMode }
          : {}),
        ...(el.newsCarouselIntervalSec !== undefined
          ? { newsCarouselIntervalSec: el.newsCarouselIntervalSec }
          : {}),
        ...(el.newsBackground !== undefined
          ? { newsBackground: el.newsBackground }
          : {}),
        ...(el.newsTextColor !== undefined
          ? { newsTextColor: el.newsTextColor }
          : {}),
        ...(el.newsMetaColor !== undefined
          ? { newsMetaColor: el.newsMetaColor }
          : {}),
        ...(el.newsTitleFontSize !== undefined
          ? { newsTitleFontSize: el.newsTitleFontSize }
          : {}),
        ...(el.newsMetaFontSize !== undefined
          ? { newsMetaFontSize: el.newsMetaFontSize }
          : {}),
        ...(el.newsSectionTitle !== undefined
          ? { newsSectionTitle: el.newsSectionTitle }
          : {}),
        ...(el.newsTitleLineClamp !== undefined
          ? { newsTitleLineClamp: el.newsTitleLineClamp }
          : {}),
        ...(el.newsContentPaddingPx !== undefined
          ? { newsContentPaddingPx: el.newsContentPaddingPx }
          : {}),
        ...(typeof el.newsShowHeader === "boolean"
          ? { newsShowHeader: el.newsShowHeader }
          : {}),
        ...(typeof el.newsShowSource === "boolean"
          ? { newsShowSource: el.newsShowSource }
          : {}),
        ...(typeof el.newsLinksEnabled === "boolean"
          ? { newsLinksEnabled: el.newsLinksEnabled }
          : {}),
        ...(el.borderRadius !== undefined
          ? { borderRadius: el.borderRadius }
          : {}),
        ...(el.outlineWidth !== undefined
          ? { outlineWidth: el.outlineWidth }
          : {}),
        ...(el.outlineColor !== undefined
          ? { outlineColor: el.outlineColor }
          : {}),
      };
    }
    if (el.type === "mediaPlaylist") {
      return {
        ...el,
        id,
        mediaPlaylistItems: (el.mediaPlaylistItems ?? []).map((it) => ({
          ...it,
          id: crypto.randomUUID(),
        })),
        ...(el.borderRadius !== undefined
          ? { borderRadius: el.borderRadius }
          : {}),
        ...(el.outlineWidth !== undefined
          ? { outlineWidth: el.outlineWidth }
          : {}),
        ...(el.outlineColor !== undefined
          ? { outlineColor: el.outlineColor }
          : {}),
      };
    }
    if (el.type === "drawing") {
      return { ...el, id, points: [...el.points] };
    }
    if (el.type === "shape") {
      return { ...el, id };
    }
    return { ...el, id };
  });
  return {
    clientKey: crypto.randomUUID(),
    sortOrder: page.sortOrder,
    name: page.name,
    backgroundColor: page.backgroundColor,
    elements,
    presentationTimingElementId: resolveEffectivePresentationTimingElementId(
      elements,
      mappedTimingId,
    ),
    presentationTransition: normalizeBookPresentationTransition(
      page.presentationTransition,
    ),
    presentationTransitionMs: clampBookPresentationTransitionMs(
      page.presentationTransitionMs,
    ),
  };
}

/** PATCH /books/:id `pages` 본문용 */
export function toBookPagePayloads(pages: BookEditorPageState[]) {
  return pages.map((p, i) => ({
    sortOrder: i,
    name: p.name,
    backgroundColor: sanitizePageBackgroundColor(
      p.backgroundColor || DEFAULT_PAGE_BACKGROUND,
    ),
    elements: normalizeBookElementsForSave(p.elements),
    presentationTimingElementId: resolveEffectivePresentationTimingElementId(
      p.elements,
      p.presentationTimingElementId,
    ),
    presentationTransition: normalizeBookPresentationTransition(
      p.presentationTransition,
    ),
    presentationTransitionMs: clampBookPresentationTransitionMs(
      p.presentationTransitionMs,
    ),
  }));
}

export function reorderPagesArray<T>(
  pages: T[],
  from: number,
  to: number,
): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= pages.length ||
    to >= pages.length
  ) {
    return pages;
  }
  const next = [...pages];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** 드래그로 `from`→`to` 이동한 뒤, 이전에 `active`였던 페이지의 새 인덱스 */
export function pageIndexAfterReorder(
  active: number,
  from: number,
  to: number,
): number {
  if (from === to) return active;
  if (active === from) return to;
  if (from < to) {
    if (active > from && active <= to) return active - 1;
    return active;
  }
  if (active >= to && active < from) return active + 1;
  return active;
}

/** `removedIndex` 페이지를 제거한 뒤 선택 인덱스를 보정합니다. */
export function pageIndexAfterRemove(
  active: number,
  removedIndex: number,
  prevLength: number,
): number {
  if (prevLength <= 1) return 0;
  const newLen = prevLength - 1;
  if (removedIndex < active) return active - 1;
  if (removedIndex === active) return Math.min(active, newLen - 1);
  return active;
}

/** 슬라이드 요소 배열: 앞쪽이 아래(먼저 그림), 뒤쪽이 위 */
export type ElementZOrderOp = "forward" | "backward" | "front" | "back";

export function reorderElementsZ(
  elements: BookCanvasElement[],
  elementId: string,
  op: ElementZOrderOp,
): BookCanvasElement[] {
  const i = elements.findIndex((e) => e.id === elementId);
  if (i === -1) return elements;
  const next = [...elements];

  if (op === "front") {
    const [item] = next.splice(i, 1);
    next.push(item);
    return next;
  }
  if (op === "back") {
    const [item] = next.splice(i, 1);
    next.unshift(item);
    return next;
  }
  if (op === "forward") {
    if (i >= next.length - 1) return elements;
    const [item] = next.splice(i, 1);
    next.splice(i + 1, 0, item);
    return next;
  }
  if (op === "backward") {
    if (i <= 0) return elements;
    const [item] = next.splice(i, 1);
    next.splice(i - 1, 0, item);
    return next;
  }
  return elements;
}

/**
 * 레이어 패널 표시 순서(위가 앞·아래가 뒤)에서 `fromDisplay`를 `toDisplay`로 옮깁니다.
 * 내부 배열은 [뒤→앞]이므로 역순으로 변환해 적용합니다.
 */
export function reorderBookElementsByDisplayIndex(
  elements: BookCanvasElement[],
  fromDisplay: number,
  toDisplay: number,
): BookCanvasElement[] {
  const n = elements.length;
  if (n <= 1 || fromDisplay === toDisplay) return elements;
  if (fromDisplay < 0 || toDisplay < 0 || fromDisplay >= n || toDisplay >= n) {
    return elements;
  }
  const rev = [...elements].reverse();
  const moved = rev.splice(fromDisplay, 1)[0];
  if (!moved) return elements;
  rev.splice(toDisplay, 0, moved);
  return rev.reverse();
}

function parseElementOpacity(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const v = Math.min(1, Math.max(0, raw));
  return v === DEFAULT_BOOK_ELEMENT_OPACITY ? undefined : v;
}

function parseElementRotation(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const v = Math.min(360, Math.max(-360, raw));
  return v === DEFAULT_BOOK_ELEMENT_ROTATION ? undefined : v;
}

const WEATHER_DISPLAY_KEYS = [
  "temp",
  "feelsLike",
  "description",
  "icon",
  "humidity",
  "wind",
  "pm25",
  "pm10",
  "aqi",
  "clock",
  "date",
] as const;

const DIGITAL_CLOCK_DISPLAY_KEYS = ["seconds", "date", "hour12"] as const;

function parseBookDigitalClockDisplay(
  raw: unknown,
): BookDigitalClockDisplay | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw))
    return undefined;
  const o = raw as Record<string, unknown>;
  const out: BookDigitalClockDisplay = {};
  let any = false;
  for (const k of DIGITAL_CLOCK_DISPLAY_KEYS) {
    if (k in o && typeof o[k] === "boolean") {
      (out as Record<string, boolean>)[k] = o[k] as boolean;
      any = true;
    }
  }
  return any ? out : undefined;
}

function parseBookWeatherDisplay(raw: unknown): BookWeatherDisplay | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw))
    return undefined;
  const o = raw as Record<string, unknown>;
  const out: BookWeatherDisplay = {};
  let any = false;
  for (const k of WEATHER_DISPLAY_KEYS) {
    if (k in o && typeof o[k] === "boolean") {
      (out as Record<string, boolean>)[k] = o[k] as boolean;
      any = true;
    }
  }
  return any ? out : undefined;
}

export const BOOK_NEWS_CATEGORIES = [
  "business",
  "entertainment",
  "general",
  "health",
  "science",
  "sports",
  "technology",
] as const;

function parseBookNewsCountry(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().toLowerCase().slice(0, 2);
  if (s.length === 2 && /^[a-z]{2}$/i.test(s)) return s.toLowerCase();
  return undefined;
}

function parseBookNewsCategory(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const c = raw.trim().toLowerCase();
  return (BOOK_NEWS_CATEGORIES as readonly string[]).includes(c)
    ? c
    : undefined;
}

function parseBookNewsPageSize(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 10) return undefined;
  return n;
}

function parseBookNewsDisplayMode(
  raw: unknown,
): BookNewsDisplayMode | undefined {
  if (raw === "list" || raw === "carousel") return raw;
  return undefined;
}

function parseBookNewsCarouselIntervalSec(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 3 || n > 120) return undefined;
  return n;
}

function parseBookNewsTitleFontSize(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 10 || n > 32) return undefined;
  return n;
}

function parseBookNewsMetaFontSize(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 8 || n > 22) return undefined;
  return n;
}

function parseBookNewsSectionTitle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/[<>]/g, "").trim().slice(0, 36);
  return t.length > 0 ? t : undefined;
}

function parseBookNewsTitleLineClamp(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 6) return undefined;
  return n;
}

function parseBookNewsContentPaddingPx(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 4 || n > 40) return undefined;
  return n;
}

function parseBookNewsVisibilityFlag(raw: unknown): boolean | undefined {
  if (raw === true) return true;
  if (raw === false) return false;
  return undefined;
}

function parseMediaPlaylistItems(raw: unknown): BookMediaPlaylistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BookMediaPlaylistItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length > 80) continue;
    if (r.kind === "image") {
      if (typeof r.src !== "string") continue;
      const objectFit = parseBookMediaObjectFit(r.objectFit);
      const ds = Number(r.durationSec);
      const durationSec =
        Number.isInteger(ds) && ds >= 1 && ds <= 600 ? ds : undefined;
      out.push({
        id: r.id,
        kind: "image",
        src: r.src,
        ...(durationSec !== undefined ? { durationSec } : {}),
        ...(objectFit ? { objectFit } : {}),
      });
    } else if (r.kind === "video") {
      if (typeof r.src !== "string") continue;
      const posterSrc =
        typeof r.posterSrc === "string" && r.posterSrc.length > 0
          ? r.posterSrc
          : null;
      const objectFit = parseBookMediaObjectFit(r.objectFit);
      out.push({
        id: r.id,
        kind: "video",
        src: r.src,
        posterSrc,
        ...(objectFit ? { objectFit } : {}),
      });
    }
    if (out.length >= MEDIA_PLAYLIST_MAX_ITEMS) break;
  }
  return out;
}

function presentationHoldFromRaw(o: Record<string, unknown>): {
  presentationHoldSec?: number;
} {
  const ph = o.presentationHoldSec;
  if (typeof ph !== "number" || !Number.isInteger(ph) || ph < 1 || ph > 3600) {
    return {};
  }
  return { presentationHoldSec: ph };
}

export function normalizeBookElements(raw: unknown[]): BookCanvasElement[] {
  const out: BookCanvasElement[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.type !== "string") continue;
    const opacity = parseElementOpacity(o.opacity);
    const rotation = parseElementRotation(o.rotation);
    const chrome = widgetChromePatch(o);
    if (o.type === "text") {
      const width = typeof o.width === "number" ? o.width : undefined;
      const height = typeof o.height === "number" ? o.height : undefined;
      out.push({
        id: o.id,
        type: "text",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        text: typeof o.text === "string" ? o.text : "",
        ...(typeof o.richHtml === "string" && o.richHtml.length > 0
          ? { richHtml: o.richHtml }
          : {}),
        fontSize: typeof o.fontSize === "number" ? o.fontSize : 24,
        fill: typeof o.fill === "string" ? o.fill : "#111827",
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(typeof o.verticalAlign === "string" &&
        (o.verticalAlign === "top" ||
          o.verticalAlign === "middle" ||
          o.verticalAlign === "bottom")
          ? { verticalAlign: o.verticalAlign }
          : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "image") {
      const objectFit = parseBookMediaObjectFit(o.objectFit);
      out.push({
        id: o.id,
        type: "image",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || 320,
        height: Number(o.height) || 180,
        src: typeof o.src === "string" ? o.src : "",
        ...(objectFit ? { objectFit } : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "video") {
      const objectFit = parseBookMediaObjectFit(o.objectFit);
      out.push({
        id: o.id,
        type: "video",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || 480,
        height: Number(o.height) || 270,
        src: typeof o.src === "string" ? o.src : "",
        posterSrc:
          typeof o.posterSrc === "string" && o.posterSrc.length > 0
            ? o.posterSrc
            : null,
        ...(objectFit ? { objectFit } : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "weather") {
      const cityQuery =
        typeof o.cityQuery === "string" && o.cityQuery.trim().length > 0
          ? o.cityQuery.trim().slice(0, 120)
          : undefined;
      const wd = parseBookWeatherDisplay(o.weatherDisplay);
      const wb = parseBookWeatherBackground(o.weatherBackground);
      const wtc = parseBookWidgetTextColor(o.weatherTextColor);
      out.push({
        id: o.id,
        type: "weather",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
        height: Number(o.height) || DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
        ...(cityQuery !== undefined ? { cityQuery } : {}),
        ...(wd !== undefined ? { weatherDisplay: wd } : {}),
        ...(wb !== undefined ? { weatherBackground: wb } : {}),
        ...(wtc !== undefined ? { weatherTextColor: wtc } : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "digitalClock") {
      const cd = parseBookDigitalClockDisplay(o.clockDisplay);
      const cb = parseBookClockBackground(o.clockBackground);
      const ctc = parseBookWidgetTextColor(o.clockTextColor);
      out.push({
        id: o.id,
        type: "digitalClock",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
        height: Number(o.height) || DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
        ...(cd !== undefined ? { clockDisplay: cd } : {}),
        ...(cb !== undefined ? { clockBackground: cb } : {}),
        ...(ctc !== undefined ? { clockTextColor: ctc } : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "news") {
      const country = parseBookNewsCountry(o.newsCountry);
      const nCat = parseBookNewsCategory(o.newsCategory);
      const nPage = parseBookNewsPageSize(o.newsPageSize);
      const nMode = parseBookNewsDisplayMode(o.newsDisplayMode);
      const nIv = parseBookNewsCarouselIntervalSec(o.newsCarouselIntervalSec);
      const nb = parseBookWeatherBackground(o.newsBackground);
      const ntc = parseBookWidgetTextColor(o.newsTextColor);
      const nmc = parseBookWidgetTextColor(o.newsMetaColor);
      const ntfs = parseBookNewsTitleFontSize(o.newsTitleFontSize);
      const nmfs = parseBookNewsMetaFontSize(o.newsMetaFontSize);
      const nst = parseBookNewsSectionTitle(o.newsSectionTitle);
      const nlc = parseBookNewsTitleLineClamp(o.newsTitleLineClamp);
      const ncp = parseBookNewsContentPaddingPx(o.newsContentPaddingPx);
      const nsh = parseBookNewsVisibilityFlag(o.newsShowHeader);
      const nss = parseBookNewsVisibilityFlag(o.newsShowSource);
      const nle = parseBookNewsVisibilityFlag(o.newsLinksEnabled);
      out.push({
        id: o.id,
        type: "news",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || DEFAULT_BOOK_NEWS_WIDGET_WIDTH,
        height: Number(o.height) || DEFAULT_BOOK_NEWS_WIDGET_HEIGHT,
        ...(country !== undefined ? { newsCountry: country } : {}),
        ...(nCat !== undefined ? { newsCategory: nCat } : {}),
        ...(nPage !== undefined ? { newsPageSize: nPage } : {}),
        ...(nMode !== undefined ? { newsDisplayMode: nMode } : {}),
        ...(nIv !== undefined ? { newsCarouselIntervalSec: nIv } : {}),
        ...(nb !== undefined ? { newsBackground: nb } : {}),
        ...(ntc !== undefined ? { newsTextColor: ntc } : {}),
        ...(nmc !== undefined ? { newsMetaColor: nmc } : {}),
        ...(ntfs !== undefined ? { newsTitleFontSize: ntfs } : {}),
        ...(nmfs !== undefined ? { newsMetaFontSize: nmfs } : {}),
        ...(nst !== undefined ? { newsSectionTitle: nst } : {}),
        ...(nlc !== undefined ? { newsTitleLineClamp: nlc } : {}),
        ...(ncp !== undefined ? { newsContentPaddingPx: ncp } : {}),
        ...(nsh !== undefined ? { newsShowHeader: nsh } : {}),
        ...(nss !== undefined ? { newsShowSource: nss } : {}),
        ...(nle !== undefined ? { newsLinksEnabled: nle } : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "mediaPlaylist") {
      const items = parseMediaPlaylistItems(o.mediaPlaylistItems);
      const loop = o.mediaPlaylistLoop === false ? false : undefined;
      const showCtl = o.mediaPlaylistShowControls === false ? false : undefined;
      out.push({
        id: o.id,
        type: "mediaPlaylist",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || DEFAULT_BOOK_MEDIA_PLAYLIST_WIDTH,
        height: Number(o.height) || DEFAULT_BOOK_MEDIA_PLAYLIST_HEIGHT,
        mediaPlaylistItems: items,
        ...(loop === false ? { mediaPlaylistLoop: false as const } : {}),
        ...(showCtl === false
          ? { mediaPlaylistShowControls: false as const }
          : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "shape") {
      const sk = o.shapeKind;
      const shapeKind =
        typeof sk === "string" &&
        (BOOK_SHAPE_KINDS as readonly string[]).includes(sk)
          ? (sk as BookShapeKind)
          : "rect";
      const w = Number(o.width);
      const h = Number(o.height);
      const width = Number.isFinite(w)
        ? Math.min(4000, Math.max(10, w))
        : DEFAULT_BOOK_SHAPE_WIDTH;
      const height = Number.isFinite(h)
        ? Math.min(4000, Math.max(10, h))
        : DEFAULT_BOOK_SHAPE_HEIGHT;
      const fillRaw =
        typeof o.fill === "string" ? o.fill.trim().slice(0, 40) : "";
      const strokeRaw =
        typeof o.stroke === "string" ? o.stroke.trim().slice(0, 40) : "";
      const sw = Number(o.strokeWidth);
      const strokeW = Number.isFinite(sw)
        ? Math.min(32, Math.max(0, Math.round(sw)))
        : 3;
      const crRaw = o.cornerRadius;
      const cornerRadius =
        (shapeKind === "rect" || shapeKind === "roundRect") &&
        typeof crRaw === "number" &&
        Number.isFinite(crRaw)
          ? Math.min(200, Math.max(0, crRaw))
          : undefined;
      out.push({
        id: o.id,
        type: "shape",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width,
        height,
        shapeKind,
        fill: fillRaw || "rgba(59,130,246,0.28)",
        stroke: strokeRaw || "#1e40af",
        strokeWidth: strokeW,
        ...(cornerRadius !== undefined ? { cornerRadius } : {}),
        ...chrome,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(o.visible === false ? { visible: false as const } : {}),
        ...(o.locked === true ? { locked: true as const } : {}),
        ...presentationHoldFromRaw(o),
      });
    } else if (o.type === "drawing") {
      const rawPts = o.points;
      const points: number[] = [];
      if (Array.isArray(rawPts)) {
        for (const v of rawPts) {
          const n = Number(v);
          if (Number.isFinite(n)) points.push(n);
          if (points.length >= 4096) break;
        }
      }
      if (points.length >= 4 && points.length % 2 === 0) {
        const sw = Number(o.strokeWidth);
        const strokeW = Number.isFinite(sw) ? Math.min(32, Math.max(1, sw)) : 4;
        const stroke =
          typeof o.stroke === "string" && o.stroke.trim()
            ? o.stroke.trim().slice(0, 40)
            : "#1e293b";
        out.push({
          id: o.id,
          type: "drawing",
          x: Number(o.x) || 0,
          y: Number(o.y) || 0,
          width: Number(o.width) || 32,
          height: Number(o.height) || 32,
          points,
          stroke,
          strokeWidth: strokeW,
          ...chrome,
          ...(opacity !== undefined ? { opacity } : {}),
          ...(rotation !== undefined ? { rotation } : {}),
          ...(o.visible === false ? { visible: false as const } : {}),
          ...(o.locked === true ? { locked: true as const } : {}),
          ...presentationHoldFromRaw(o),
        });
      }
    }
  }
  return out;
}

const BOOK_DRAWING_POINTS_CAP = 2048;

function simplifyDrawingAbsPoints(
  pts: { x: number; y: number }[],
  minDist: number,
): { x: number; y: number }[] {
  if (pts.length === 0) return [];
  const out: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) >= minDist) out.push(b);
  }
  const last = pts[pts.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** 자유 곡선을 `drawing` 요소로 만듭니다. 점이 너무 적으면 null */
export function buildBookDrawingElement(
  absPtsRaw: { x: number; y: number }[],
  stroke: string,
  strokeWidth: number,
): BookCanvasElement | null {
  const absPts = simplifyDrawingAbsPoints(absPtsRaw, 1.5).slice(
    0,
    BOOK_DRAWING_POINTS_CAP,
  );
  if (absPts.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of absPts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = Math.max(strokeWidth, 4);
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  let w = maxX - minX;
  let h = maxY - minY;
  if (w < 8) w = 8;
  if (h < 8) h = 8;
  const points: number[] = [];
  for (const p of absPts) {
    points.push(p.x - minX, p.y - minY);
  }
  const strokeSafe =
    typeof stroke === "string" && stroke.trim()
      ? stroke.trim().slice(0, 40)
      : "#1e293b";
  const sw = Math.min(24, Math.max(1, strokeWidth));
  return {
    id: crypto.randomUUID(),
    type: "drawing",
    /** 다른 위젯과 동일: 박스 좌상단(논리 좌표) */
    x: minX,
    y: minY,
    width: w,
    height: h,
    points,
    stroke: strokeSafe,
    strokeWidth: sw,
  };
}
