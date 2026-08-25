/**
 * 북 슬라이드 캔버스(Konva)와 API `elementsJson`에 맞춘 요소 타입.
 */

import type Konva from "konva";
import type { CSSProperties } from "react";

import {
  type BookPresentationTransitionId,
  clampBookPresentationTransitionMs,
  DEFAULT_BOOK_PRESENTATION_TRANSITION_MS,
  normalizeBookPresentationTransition,
} from "@/lib/book-presentation-transition";
import type { BookTextAnimationId } from "@/lib/book-text-animation";

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

/** 차트 위젯 종류 */
export type BookChartType = "line" | "bar" | "pie";

/** 차트 위젯 데이터 항목 */
export type BookChartDatum = { label: string; value: number };

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

export type BookCanvasElement = (
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
      /**
       * 텍스트 효과(`book-text-animation.ts` 식별자) — 편집 캔버스·보기·프레젠테이션 모두 재생.
       * 생략·none = 정적. 썸네일(Konva 스냅샷)은 정적.
       */
      textAnimation?: BookTextAnimationId;
      /** 효과 시간(초, 0.2~120). 1회 효과 = 완료까지, 반복 효과 = 한 사이클. 생략 시 효과별 기본값 */
      textAnimationDurationSec?: number;
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
      /** 끝까지 재생하면 처음부터 다시 반복 */
      videoLoop?: boolean;
      /** AI 자막(시뮬레이션) 표시 — 추후 실제 STT·번역으로 대체 예정 */
      subtitlesEnabled?: boolean;
      /** 자막 언어: auto(원어)·ko·en·ja·zh */
      subtitleLang?: string;
      /** 자막 크기: sm(작게, 기본)·md(보통)·lg(크게) */
      subtitleSize?: string;
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
      /**
       * 배치: auto(생략) = 켠 항목에 따라 자동, columns = 좌우 2열(날씨 | 시계·위치·대기),
       * single = 세로 1열. 시계만·대기만·기온만 켠 전용 카드에는 영향 없음.
       */
      weatherLayout?: BookWeatherLayout;
      /**
       * 좌우 2열(columns)일 때 오른쪽 열에 둘 블록. 나머지는 왼쪽.
       * 생략 = 기본(날씨 왼쪽, 시계·위치·대기질·부가 정보 오른쪽).
       */
      weatherRightBlocks?: BookWeatherBlockKey[];
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
      type: "webview";
      x: number;
      y: number;
      width: number;
      height: number;
      /** 위젯 안에 임베드할 페이지 주소(http/https). 비우면 안내 문구 표시 */
      webviewUrl?: string;
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
      type: "map";
      x: number;
      y: number;
      width: number;
      height: number;
      /** 지오코딩 대상 주소·지역. 비우면 안내 문구 표시 */
      mapQuery?: string;
      /** 마커 위도(있으면 표시) */
      mapLat?: number;
      /** 마커 경도(있으면 표시) */
      mapLon?: number;
      /** OSM embed bbox `[west, south, east, north]`. 없으면 지도 미표시 */
      mapBbox?: [number, number, number, number];
      /** 확대 배율(%) — 100=bbox 그대로, 200=2배 확대. 50~400 */
      mapZoomPct?: number;
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
      type: "calendar";
      x: number;
      y: number;
      width: number;
      height: number;
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
      type: "qr";
      x: number;
      y: number;
      width: number;
      height: number;
      /** QR로 인코딩할 텍스트·URL(최대 2048자). 비우면 안내 문구 표시 */
      qrValue?: string;
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
      type: "chart";
      x: number;
      y: number;
      width: number;
      height: number;
      /** 차트 종류. 생략 시 bar */
      chartType?: BookChartType;
      /** 데이터 항목(최대 24개). 생략 시 기본 예시 */
      chartData?: BookChartDatum[];
      /** 강조 색(CSS). 생략 시 기본 accent */
      chartColor?: string;
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
      type: "ticker";
      x: number;
      y: number;
      width: number;
      height: number;
      /** 흐르는 안내 문구(최대 1000자). 비우면 안내 표시 */
      tickerText?: string;
      /** 초당 이동 논리 px 20~400, 생략 시 80 */
      tickerSpeedPxPerSec?: number;
      /** 생략·left = 오른쪽→왼쪽 */
      tickerDirection?: "left" | "right";
      /** 글자 크기(논리 px) 10~200, 생략 시 높이 비례 */
      tickerFontSize?: number;
      /** CSS 배경색. 없으면 기본 어두운 띠 */
      tickerBackground?: string;
      tickerTextColor?: string;
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
      type: "youtube";
      x: number;
      y: number;
      width: number;
      height: number;
      /** watch·youtu.be·shorts·embed 주소 또는 11자 동영상 id */
      youtubeUrl?: string;
      /** 생략 시 true */
      youtubeAutoplay?: boolean;
      /** 생략 시 true(자동재생은 음소거가 필요) */
      youtubeMute?: boolean;
      /** 생략 시 true */
      youtubeLoop?: boolean;
      /** 생략 시 false — 재생 컨트롤 표시 */
      youtubeControls?: boolean;
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
      /** AI 자막(시뮬레이션) — 현재 항목이 동영상일 때 표시. 추후 실제 STT·번역으로 대체 예정 */
      subtitlesEnabled?: boolean;
      /** 자막 언어: auto(원어)·ko·en·ja·zh */
      subtitleLang?: string;
      /** 자막 크기: sm(작게, 기본)·md(보통)·lg(크게) */
      subtitleSize?: string;
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
    }
) & {
  /**
   * 공통(오버라이드) 위젯 — 원본 페이지 외에 함께 표시할 페이지.
   * "all" = 모든 페이지, 배열 = 0-based 페이지 순번(sortOrder) 목록.
   * 프레젠테이션에서는 지속 레이어로 렌더되어 페이지가 바뀌어도 상태(뉴스 목록 등)가 유지된다.
   */
  overlayPages?: "all" | number[];
  /**
   * 가독성 처리(글자 위젯용) — 페이지 배경이 밝든 어둡든 글자가 보이게.
   * auto: 페이지 배경 밝기에 따라 글자색 자동(흑↔백) · outline: 외곽선 ·
   * shadow: 그림자 · plate: 반투명 배경판. 없으면 원래 스타일 그대로.
   */
  readability?: string;
};

/** 가독성 모드 */
export const BOOK_READABILITY_MODES = [
  { value: "auto", label: "자동 대비(배경 밝기에 따라 흑↔백)" },
  { value: "outline", label: "외곽선" },
  { value: "shadow", label: "그림자" },
  { value: "plate", label: "반투명 배경판" },
] as const;

export type BookReadabilityMode =
  (typeof BOOK_READABILITY_MODES)[number]["value"];

export function resolveBookElementReadability(el: {
  readability?: string;
}): BookReadabilityMode | null {
  const v = el.readability;
  return BOOK_READABILITY_MODES.some((m) => m.value === v)
    ? (v as BookReadabilityMode)
    : null;
}

/**
 * 배경색 밝기 판정(자동 대비용) — hex(#rgb/#rrggbb)·rgb()/rgba()만 해석,
 * 그 외(그라디언트 등)는 흰색으로 간주해 어두운 글자를 쓴다.
 */
export function isLightBackgroundColor(bg: string | undefined | null): boolean {
  const s = (bg ?? "").trim().toLowerCase();
  if (!s || s === "transparent") return true;
  let r = 255;
  let g = 255;
  let b = 255;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
  } else if (rgb) {
    r = Number(rgb[1]);
    g = Number(rgb[2]);
    b = Number(rgb[3]);
  }
  // 상대 휘도 근사(sRGB 가중 평균)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 >= 0.55;
}

/**
 * 가독성 모드별 컨테이너 스타일(DOM 위젯 공용).
 * auto는 CSS 변수 `--book-readability-color`(오버레이 레이어에서 페이지 배경으로 계산)를
 * 쓰며, index.css의 `[data-book-readability="auto"]` 규칙이 글자색을 덮어쓴다.
 */
export function bookReadabilityContainerStyle(
  mode: BookReadabilityMode | null,
): CSSProperties {
  if (mode === "outline") {
    return {
      textShadow:
        "0 0 1px rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.85), -1px 1px 0 rgba(0,0,0,0.85), 1px -1px 0 rgba(0,0,0,0.85), -1px -1px 0 rgba(0,0,0,0.85)",
    };
  }
  if (mode === "shadow") {
    return {
      textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.45)",
    };
  }
  if (mode === "plate") {
    return { backgroundColor: "rgba(0,0,0,0.55)" };
  }
  return {};
}

/** 공통 위젯 대상 페이지 정규화 — 값이 없거나 잘못되면 null(일반 요소) */
export function resolveBookElementOverlayPages(el: {
  overlayPages?: "all" | number[];
}): "all" | number[] | null {
  const v = el.overlayPages;
  if (v === "all") return "all";
  if (Array.isArray(v)) {
    const list = [
      ...new Set(
        v.filter((n) => typeof n === "number" && Number.isInteger(n) && n >= 0),
      ),
    ].sort((a, b) => a - b);
    return list.length > 0 ? list : null;
  }
  return null;
}

/**
 * 다른 페이지의 공통 위젯 중 `targetSortOrder` 페이지에 겹쳐 보일 요소들.
 * 원본 페이지의 요소는 페이지 자체 렌더에 이미 포함되므로 제외한다.
 */
export function collectBookOverlayElements(
  pages: { sortOrder: number; elements: BookCanvasElement[] }[],
  targetSortOrder: number,
): BookCanvasElement[] {
  const out: BookCanvasElement[] = [];
  for (const p of pages) {
    if (p.sortOrder === targetSortOrder) continue;
    for (const el of p.elements) {
      if (!isBookElementVisible(el)) continue;
      const scope = resolveBookElementOverlayPages(el);
      if (!scope) continue;
      if (scope === "all" || scope.includes(targetSortOrder)) out.push(el);
    }
  }
  return out;
}

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

export const BOOK_WEATHER_LAYOUT_VALUES = [
  "auto",
  "columns",
  "single",
] as const;
export type BookWeatherLayout = (typeof BOOK_WEATHER_LAYOUT_VALUES)[number];

export const BOOK_WEATHER_LAYOUT_OPTIONS: {
  id: BookWeatherLayout;
  label: string;
}[] = [
  { id: "auto", label: "자동 (켠 항목에 따라)" },
  { id: "columns", label: "좌우 2열" },
  { id: "single", label: "세로 1열" },
];

/** 알 수 없는 값·생략은 auto */
export function resolveBookWeatherLayout(raw: unknown): BookWeatherLayout {
  return raw === "columns" || raw === "single" ? raw : "auto";
}

/** 좌우 2열에서 좌/우를 고를 수 있는 블록(표시 항목 묶음) */
export const BOOK_WEATHER_BLOCK_KEYS = [
  "main",
  "time",
  "location",
  "air",
  "secondary",
] as const;
export type BookWeatherBlockKey = (typeof BOOK_WEATHER_BLOCK_KEYS)[number];

export const BOOK_WEATHER_BLOCK_OPTIONS: {
  id: BookWeatherBlockKey;
  label: string;
}[] = [
  { id: "main", label: "날씨 (아이콘·상태·기온)" },
  { id: "time", label: "시계·날짜" },
  { id: "location", label: "위치" },
  { id: "air", label: "대기질 (PM·지수)" },
  { id: "secondary", label: "부가 정보 (체감·습도·바람)" },
];

/** 좌우 2열 기본 배치: 날씨는 왼쪽, 나머지는 오른쪽 */
export const DEFAULT_BOOK_WEATHER_RIGHT_BLOCKS: BookWeatherBlockKey[] = [
  "time",
  "location",
  "air",
  "secondary",
];

export function isBookWeatherBlockKey(s: unknown): s is BookWeatherBlockKey {
  return (
    typeof s === "string" &&
    (BOOK_WEATHER_BLOCK_KEYS as readonly string[]).includes(s)
  );
}

/** 저장값 → 오른쪽 열 블록 집합(정규화). 생략·비정상은 기본값 */
export function resolveBookWeatherRightBlocks(
  raw: unknown,
): BookWeatherBlockKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_BOOK_WEATHER_RIGHT_BLOCKS];
  const out: BookWeatherBlockKey[] = [];
  for (const v of raw) {
    if (isBookWeatherBlockKey(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

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
    el.type === "mediaPlaylist" ||
    el.type === "webview" ||
    el.type === "map" ||
    el.type === "calendar" ||
    el.type === "qr" ||
    el.type === "chart" ||
    el.type === "ticker" ||
    el.type === "youtube"
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
  /** false면 미리보기 재생 목록에서 제외(사이드바에 흐리게 표시). 생략 = 보임 */
  presentationVisible?: boolean;
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
export const DEFAULT_BOOK_WEBVIEW_WIDTH = 480;
export const DEFAULT_BOOK_WEBVIEW_HEIGHT = 320;

/** 지도 위젯 기본 프레임(px) */
export const DEFAULT_BOOK_MAP_WIDTH = 480;
export const DEFAULT_BOOK_MAP_HEIGHT = 320;
/** 지도 위젯 기본 검색어 */
export const DEFAULT_BOOK_MAP_QUERY = "서울";
/**
 * 서울 기본 좌표·영역 — 드롭 즉시 지도가 렌더되도록(속성창에서 엔터 없이) 미리 넣는다.
 * Nominatim "서울" 결과 근사값. bbox = [west, south, east, north].
 */
export const DEFAULT_BOOK_MAP_LAT = 37.5665;
export const DEFAULT_BOOK_MAP_LON = 126.978;
export const DEFAULT_BOOK_MAP_BBOX: [number, number, number, number] = [
  126.7342, 37.4269, 127.2699, 37.7017,
];
/** 새 지도 위젯 기본 배율(%) — 검색 영역보다 2배 확대해 보여준다 */
export const DEFAULT_BOOK_MAP_ZOOM_PCT = 200;

/**
 * 지도 배율(%) — 100=지오코딩된 bbox 영역 그대로, 값이 클수록 중심을 기준으로 더 확대.
 * 50~400 클램프. 미지정(기존 저장분)은 100으로 하위 호환.
 */
export function resolveBookMapZoomPct(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 100;
  return Math.min(400, Math.max(50, Math.round(n)));
}

/** 캘린더 위젯 기본 프레임(px) */
export const DEFAULT_BOOK_CALENDAR_WIDTH = 320;
export const DEFAULT_BOOK_CALENDAR_HEIGHT = 300;

/** QR 위젯 기본 프레임(px) */
export const DEFAULT_BOOK_QR_WIDTH = 200;
export const DEFAULT_BOOK_QR_HEIGHT = 200;
/** QR 위젯 기본값 — 드롭 즉시 QR이 보이도록 샘플 URL을 넣는다(속성창에서 변경) */
export const DEFAULT_BOOK_QR_VALUE = "https://www.google.com";

/** 차트 위젯 기본 프레임(px) */
export const DEFAULT_BOOK_CHART_WIDTH = 360;
export const DEFAULT_BOOK_CHART_HEIGHT = 260;
/** 차트 위젯 기본 강조 색 */
export const DEFAULT_BOOK_CHART_COLOR = "#2563eb";
/** 차트 위젯 기본 종류 */
export const DEFAULT_BOOK_CHART_TYPE: BookChartType = "bar";
/** 차트 위젯 기본 데이터 */
export const DEFAULT_BOOK_CHART_DATA: BookChartDatum[] = [
  { label: "A", value: 30 },
  { label: "B", value: 50 },
  { label: "C", value: 20 },
];
/** 차트 데이터 최대 항목 수 */
export const BOOK_CHART_DATA_MAX = 24;

/** 지도 검색어: 앞뒤 공백 제거, 512자 제한. 빈 값이면 undefined */
export function parseBookMapQuery(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s || s.length > 512) return undefined;
  return s;
}

/** OSM 임베드 URL. `mapBbox`가 없으면 undefined(지도 미표시) */
export function buildBookOsmEmbedUrl(
  el: Extract<BookCanvasElement, { type: "map" }>,
): string | undefined {
  const bbox = el.mapBbox;
  if (
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    !bbox.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    return undefined;
  }
  const [bw, bs, be, bn] = bbox;
  // 배율 적용 — 중심을 유지한 채 영역 폭·높이를 100/배율 비율로 줄여 확대 효과
  const zoomPct = resolveBookMapZoomPct(el.mapZoomPct);
  const factor = 100 / zoomPct;
  const cx = (bw + be) / 2;
  const cy = (bs + bn) / 2;
  const hw = Math.max(1e-4, (Math.abs(be - bw) / 2) * factor);
  const hh = Math.max(1e-4, (Math.abs(bn - bs) / 2) * factor);
  const w = cx - hw;
  const e = cx + hw;
  const s = cy - hh;
  const n = cy + hh;
  let url = `https://www.openstreetmap.org/export/embed.html?bbox=${w}%2C${s}%2C${e}%2C${n}&layer=mapnik`;
  if (
    typeof el.mapLat === "number" &&
    Number.isFinite(el.mapLat) &&
    typeof el.mapLon === "number" &&
    Number.isFinite(el.mapLon)
  ) {
    url += `&marker=${el.mapLat}%2C${el.mapLon}`;
  }
  return url;
}

/** QR 값: 앞뒤 공백 제거, 2048자 제한. 빈 값·초과면 undefined */
export function parseBookQrValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s || s.length > 2048) return undefined;
  return s;
}

/** 차트 종류: line·bar·pie 중 하나. 그 외는 undefined */
export function parseBookChartType(raw: unknown): BookChartType | undefined {
  if (raw === "line" || raw === "bar" || raw === "pie") return raw;
  return undefined;
}

/** 차트 데이터: `{label(≤40), value(유한수)}` 배열로 정규화, 최대 24개 */
export function parseBookChartData(raw: unknown): BookChartDatum[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: BookChartDatum[] = [];
  for (const item of raw) {
    if (out.length >= BOOK_CHART_DATA_MAX) break;
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const label =
      typeof rec.label === "string" ? rec.label.slice(0, 40) : undefined;
    const value = Number(rec.value);
    if (label === undefined || !Number.isFinite(value)) continue;
    out.push({ label, value });
  }
  return out;
}

export const DEFAULT_BOOK_TICKER_WIDTH = 960;
export const DEFAULT_BOOK_TICKER_HEIGHT = 64;
export const BOOK_TICKER_DEFAULT_SPEED_PX_PER_SEC = 80;

/** 티커 속도(논리 px/초): 20~400 클램프, 기본 80 */
export function resolveBookTickerSpeedPxPerSec(
  el: Extract<BookCanvasElement, { type: "ticker" }>,
): number {
  const n = el.tickerSpeedPxPerSec;
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.min(400, Math.max(20, n));
  }
  return BOOK_TICKER_DEFAULT_SPEED_PX_PER_SEC;
}

export const DEFAULT_BOOK_YOUTUBE_WIDTH = 480;
export const DEFAULT_BOOK_YOUTUBE_HEIGHT = 270;

/** 유튜브 주소(watch·youtu.be·shorts·live·embed) 또는 11자 id → 동영상 id */
export function parseBookYoutubeVideoId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s || s.length > 512) return undefined;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(
      s,
    );
  return m?.[1];
}
/** 웹뷰 URL: http(s)만 허용, 과도한 길이 차단 */
export function parseBookWebviewUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s || s.length > 2048) return undefined;
  if (!/^https?:\/\//i.test(s)) return undefined;
  return s;
}

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
    if (el.type === "webview") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_WEBVIEW_WIDTH,
        DEFAULT_BOOK_WEBVIEW_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "map") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_MAP_WIDTH,
        DEFAULT_BOOK_MAP_HEIGHT,
      );
      return finalizeElementForApi({
        ...el,
        ...xy,
        ...wh,
        mapZoomPct: resolveBookMapZoomPct(el.mapZoomPct),
      });
    }
    if (el.type === "calendar") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_CALENDAR_WIDTH,
        DEFAULT_BOOK_CALENDAR_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "qr") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_QR_WIDTH,
        DEFAULT_BOOK_QR_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "chart") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_CHART_WIDTH,
        DEFAULT_BOOK_CHART_HEIGHT,
      );
      const chartType = parseBookChartType(el.chartType);
      const chartData = parseBookChartData(el.chartData);
      return finalizeElementForApi({
        ...el,
        ...xy,
        ...wh,
        ...(chartType ? { chartType } : {}),
        ...(chartData ? { chartData } : {}),
      });
    }
    if (el.type === "ticker") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_TICKER_WIDTH,
        DEFAULT_BOOK_TICKER_HEIGHT,
      );
      return finalizeElementForApi({ ...el, ...xy, ...wh });
    }
    if (el.type === "youtube") {
      const wh = finiteWH(
        el.width,
        el.height,
        DEFAULT_BOOK_YOUTUBE_WIDTH,
        DEFAULT_BOOK_YOUTUBE_HEIGHT,
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
    if (el.type === "text") {
      const fs = Number(el.fontSize);
      const fontSize = Number.isFinite(fs) && fs >= 8 && fs <= 200 ? fs : 24;
      const out: BookCanvasElement = { ...el, ...xy, type: "text", fontSize };
      const w = el.width != null ? Number(el.width) : undefined;
      const h = el.height != null ? Number(el.height) : undefined;
      if (w != null && Number.isFinite(w)) out.width = w;
      if (h != null && Number.isFinite(h)) out.height = h;
      return finalizeElementForApi(out);
    }
    // 여기 도달 = 위 분기에서 빠진 타입. 예전처럼 text로 강제 변환하면 조용한 데이터 손실 —
    // 컴파일 타임에 누락을 드러내고(never), 런타임에는 원본을 보존한다.
    assertUnhandledBookElement(el, "normalizeBookElementsForSave");
    return finalizeElementForApi({ ...(el as BookCanvasElement), ...xy });
  });
}

/** 판별 유니온에 새 타입이 추가됐는데 분기가 누락되면 컴파일 에러가 나게 하는 안전장치 */
function assertUnhandledBookElement(el: never, context: string): void {
  console.warn(
    `[book-canvas] ${context}: 처리되지 않은 요소 타입`,
    (el as { type?: unknown })?.type,
  );
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
    presentationVisible: p.presentationVisible !== false,
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

export const BOOK_NEWS_CATEGORIES = [
  "business",
  "entertainment",
  "general",
  "health",
  "science",
  "sports",
  "technology",
] as const;

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
