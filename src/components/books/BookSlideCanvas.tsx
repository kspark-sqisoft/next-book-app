// Konva 기반 슬라이드: 요소 렌더·히트·위젯별 오버레이; 드래그/스냅 상수·타입도 이 파일에서 re-export
import type Konva from "konva";
import { FolderOpen, Library, Pause, Play, Square } from "lucide-react";
import {
  type CSSProperties,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Arc,
  Arrow,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  RegularPolygon,
  Ring,
  Stage,
  Star,
  Transformer,
} from "react-konva";

import { BookDigitalClockWidgetOverlay } from "@/components/books/BookDigitalClockWidgetOverlay";
import {
  type BookMediaPlaylistPlaybackUiSnapshot,
  type BookMediaPlaylistRemoteCommand,
  BookMediaPlaylistWidgetOverlay,
} from "@/components/books/BookMediaPlaylistWidgetOverlay";
import { BookNewsWidgetOverlay } from "@/components/books/BookNewsWidgetOverlay";
import {
  BookTextWidgetInlineEditor,
  type BookTextWidgetInlineEditorHandle,
} from "@/components/books/BookTextWidgetInlineEditor";
import {
  type BookTextOverlayLiveFrame,
  BookTextWidgetOverlay,
} from "@/components/books/BookTextWidgetOverlay";
import { BookWeatherWidgetOverlay } from "@/components/books/BookWeatherWidgetOverlay";
import {
  ContextMenuFloatingItem,
  ContextMenuFloatingPanel,
} from "@/components/ui/context-menu";
import { publicAssetUrl } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import {
  BOOK_CANVAS_DRAG_GRID_PX,
  BOOK_SHAPE_KINDS,
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  type BookShapeKind,
  buildBookDrawingElement,
  canvasRoundRectPath,
  type ElementZOrderOp,
  isBookElementLocked,
  isBookElementVisible,
  KONVA_BOOK_WIDGET_HIT_RECT_NAME,
  konvaBookTopLeftFromCommitNode,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveMediaPlaylistShowControls,
  snapKonvaBookNodePositionToGrid,
} from "@/lib/book-canvas";
import { getBookImageIfReady, loadBookImage } from "@/lib/book-image-cache";
import { computeKonvaFittedImageLayout } from "@/lib/book-media-layout";
import {
  getTextWidgetDisplayHtml,
  nextTextWidgetHeightGrowOnly,
  textWidgetHitHeight,
} from "@/lib/book-text-widget";
import { cn } from "@/lib/utils";

function useBookImage(src: string) {
  const url = publicAssetUrl(src) ?? src;
  const cached = url ? getBookImageIfReady(src) : null;
  const [asyncForSrc, setAsyncForSrc] = useState<{
    src: string;
    img: HTMLImageElement | null;
  } | null>(null);

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => setAsyncForSrc(null));
      return;
    }
    if (getBookImageIfReady(src)) {
      queueMicrotask(() => setAsyncForSrc(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setAsyncForSrc({ src, img: null }));
    void loadBookImage(src).then((im) => {
      if (!cancelled) {
        setAsyncForSrc((cur) => (cur?.src === src ? { src, img: im } : cur));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, url]);

  if (cached) return cached;
  if (asyncForSrc?.src === src) return asyncForSrc.img;
  return null;
}

/** 위젯 팔레트 HTML5 DnD와 동일한 값 */
export const BOOK_WIDGET_DRAG_TYPE = "application/x-book-widget";

/** 미디어 라이브러리에서 슬라이드로 드래그할 때 사용 */
export const BOOK_LIBRARY_DRAG_TYPE = "application/x-book-library-media";

/** Elements 패널 도형 → 슬라이드 드롭 */
export const BOOK_SHAPE_DRAG_TYPE = "application/x-book-shape";

export type BookLibraryDragPayload = {
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
};

/** 이미지·동영상 위젯 우클릭 → 로컬 파일로 `src` 교체 요청 */
export type BookReplaceMediaFromFileRequest = {
  elementId: string;
  kind: "image" | "video";
};

export function parseLibraryDropPayload(
  e: DragEvent<HTMLElement>,
): BookLibraryDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(BOOK_LIBRARY_DRAG_TYPE);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (r.kind !== "image" && r.kind !== "video") return null;
    if (typeof r.src !== "string" || r.src.length === 0) return null;
    const posterSrc =
      r.posterSrc === null || typeof r.posterSrc === "string"
        ? r.posterSrc
        : null;
    return { kind: r.kind, src: r.src, posterSrc };
  } catch {
    return null;
  }
}

export function setShapeDragData(
  e: DragEvent<HTMLElement>,
  shapeKind: BookShapeKind,
): void {
  e.dataTransfer.setData(BOOK_SHAPE_DRAG_TYPE, JSON.stringify({ shapeKind }));
  e.dataTransfer.setData("text/plain", `book-shape:${shapeKind}`);
  e.dataTransfer.effectAllowed = "copy";
}

export function parseShapeDropPayload(
  e: DragEvent<HTMLElement>,
): BookShapeKind | null {
  try {
    const raw = e.dataTransfer.getData(BOOK_SHAPE_DRAG_TYPE);
    if (raw) {
      const o = JSON.parse(raw) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) {
        const sk = (o as Record<string, unknown>).shapeKind;
        if (
          typeof sk === "string" &&
          (BOOK_SHAPE_KINDS as readonly string[]).includes(sk)
        ) {
          return sk as BookShapeKind;
        }
      }
    }
  } catch {
    /* ignore */
  }
  const plain = e.dataTransfer.getData("text/plain").trim();
  const m = /^book-shape:([a-zA-Z][a-zA-Z0-9]*)$/.exec(plain);
  if (m && (BOOK_SHAPE_KINDS as readonly string[]).includes(m[1]!)) {
    return m[1] as BookShapeKind;
  }
  return null;
}

/** 위젯 **중심**이 슬라이드 가로·세로 가운데에서 이 거리(논리 px) 안이면 기준선 표시 */
export const DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX = 10;

export type BookDropWidgetKind =
  | "text"
  | "image"
  | "video"
  | "weather"
  | "digitalClock"
  | "news"
  | "mediaPlaylist";

/** `id: null` = 선택 해제. `shiftKey` = 기존 선택에 토글 추가 */
export type BookCanvasSelectDetail = { id: string | null; shiftKey?: boolean };

type BookSlideCanvasProps = {
  pageWidth: number;
  pageHeight: number;
  /** 슬라이드 배경(CSS 색) */
  pageBackgroundColor: string;
  /** 논리 좌표(페이지 크기) 기준 표시 배율 */
  scale: number;
  elements: BookCanvasElement[];
  mode: "edit" | "view";
  selectedIds: readonly string[];
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  /** 편집 모드에서 팔레트 위젯을 캔버스로 드롭 */
  onDropWidget?: (
    point: { x: number; y: number },
    kind: BookDropWidgetKind,
  ) => void;
  /** 편집 모드에서 Elements 도형을 캔버스로 드롭 */
  onDropShape?: (
    point: { x: number; y: number },
    shapeKind: BookShapeKind,
  ) => void;
  /** 편집 모드: 미디어 라이브러리에서 업로드된 URL을 슬라이드에 배치 */
  onDropLibraryMedia?: (
    point: { x: number; y: number },
    payload: BookLibraryDragPayload,
  ) => void;
  /** 편집 모드: 요소 배열 순서(앞=아래, 뒤=위) 조정 — 저장됨 */
  onReorderZ?: (elementId: string, op: ElementZOrderOp) => void;
  /** 편집 모드: 요소 우클릭 메뉴에서 삭제 */
  onDeleteElement?: (elementId: string) => void;
  /** 드래그 중 가운데 기준선이 뜨는 거리(논리 px). 미지정 시 `DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX` */
  centerGuideThresholdPx?: number;
  /** 드래그 스냅 그리드 간격(논리 px). 미지정 시 `BOOK_CANVAS_DRAG_GRID_PX` */
  dragGridPx?: number;
  /** `draw`: 슬라이드에서 자유 곡선(그 외는 선택·드래그) */
  editInteractionTool?: "default" | "draw";
  drawingStrokeColor?: string;
  drawingStrokeWidth?: number;
  /** 새 요소 추가(자유 그리기 확정 시) */
  onAppendElement?: (el: BookCanvasElement) => void;
  /** 이미지·동영상: 우클릭 → 탐색기로 파일 선택 후 업로드·교체 */
  onRequestReplaceMediaFromFile?: (
    req: BookReplaceMediaFromFileRequest,
  ) => void;
  /** 이미지·동영상: 우클릭 → 미디어 라이브러리에서 선택해 교체 */
  onRequestPickLibraryMediaForReplace?: (req: { elementId: string }) => void;
  /** 미디어 플레이리스트: 우클릭 → 파일 선택 후 목록 끝에 추가 */
  onRequestPlaylistAppendFromFile?: (elementId: string) => void;
  /** 미디어 플레이리스트: 우클릭 → 라이브러리에서 선택해 목록 끝에 추가 */
  onRequestPlaylistAppendFromLibrary?: (elementId: string) => void;
  /** `false`면 라이브러리 교체 메뉴 숨김(예: `/books/new`) */
  mediaLibraryReplaceEnabled?: boolean;
  /** 미디어 플레이리스트 재생 중 항목 인덱스(속성 패널 하이라이트) */
  onMediaPlaylistPlaybackIndexChange?: (
    elementId: string,
    index: number,
  ) => void;
  /** 선택된 플레이리스트 위젯 재생 UI(속성 패널 미니 컨트롤) */
  onMediaPlaylistPlaybackUiReport?: (
    elementId: string,
    payload: BookMediaPlaylistPlaybackUiSnapshot,
  ) => void;
  mediaPlaylistRemoteCommand?: BookMediaPlaylistRemoteCommand | null;
  onMediaPlaylistRemoteCommandConsumed?: () => void;
  /** 동영상 위젯 메타데이터 로드 후 재생 길이(초) — 속성 패널 표시용 */
  onVideoDurationKnown?: (elementId: string, durationSec: number) => void;
  /**
   * 보기 모드 전용: `true`이면 비디오·미디어 플레이리스트 하단 컨트롤 바를 표시하지 않음
   * (예: 전체 화면에서 커서 유휴 시 오버레이와 같이 숨김).
   */
  viewModeHideMediaChrome?: boolean;
};

function BookFreehandDrawLayer({
  scale,
  pageWidth,
  pageHeight,
  strokeColor,
  strokeWidth,
  onCommit,
}: {
  scale: number;
  pageWidth: number;
  pageHeight: number;
  strokeColor: string;
  strokeWidth: number;
  onCommit: (pts: { x: number; y: number }[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<{
    pointerId: number;
    pts: { x: number; y: number }[];
  } | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number }[] | null>(
    null,
  );

  const toLogical = (clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / scale;
    const y = (clientY - r.top) / scale;
    return {
      x: Math.max(0, Math.min(pageWidth, x)),
      y: Math.max(0, Math.min(pageHeight, y)),
    };
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[8] touch-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const p0 = toLogical(e.clientX, e.clientY);
        activeRef.current = { pointerId: e.pointerId, pts: [p0] };
        setPreview([p0]);
      }}
      onPointerMove={(e) => {
        const a = activeRef.current;
        if (!a || e.pointerId !== a.pointerId) return;
        a.pts.push(toLogical(e.clientX, e.clientY));
        setPreview([...a.pts]);
      }}
      onPointerUp={(e) => {
        const a = activeRef.current;
        if (!a || e.pointerId !== a.pointerId) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        activeRef.current = null;
        setPreview(null);
        if (a.pts.length >= 2) onCommit(a.pts);
      }}
      onPointerCancel={(e) => {
        const a = activeRef.current;
        if (a && e.pointerId === a.pointerId) {
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          activeRef.current = null;
          setPreview(null);
        }
      }}
    >
      {preview && preview.length > 1 ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={pageWidth * scale}
          height={pageHeight * scale}
          aria-hidden
        >
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={preview
              .map((p) => `${p.x * scale},${p.y * scale}`)
              .join(" ")}
          />
        </svg>
      ) : null}
    </div>
  );
}

/**
 * 변형 프리뷰 크기. 반드시 **현재 노드의 width/height × scale** 로 계산합니다.
 * (초기 `el.width`에 scale을 곱하면, 프레임마다 베이크된 뒤에도 같은 기준을 써서
 * 스케일이 이중 적용되어 조금만 움직여도 크기가 폭증합니다.)
 */
function transformLiveFrameSize(node: Konva.Node, sx: number, sy: number) {
  let w = node.width();
  let h = node.height();
  if (node.getClassName() === "Group") {
    const inner = (node as Konva.Group).findOne(
      `.${KONVA_BOOK_WIDGET_HIT_RECT_NAME}`,
    ) as Konva.Rect | undefined;
    if (inner) {
      w = inner.width();
      h = inner.height();
    }
  }
  return {
    width: Math.max(1, Math.abs(w * sx)),
    height: Math.max(1, Math.abs(h * sy)),
  };
}

/**
 * [Scale Image to Fit](https://konvajs.org/docs/sandbox/Scale_Image_To_Fit.html) 예제와 같이
 * `transform`마다 `Group`의 `scaleX/Y`를 1로 되돌리고, 박스 크기는 안쪽 `bookWidgetHitRect`의
 * `width`/`height`에 베이크합니다. Transformer가 scale을 쌓는 동안 React props와 어긋나
 * 한쪽 핸들만 잡아도 양쪽이 움직이는 현상을 줄입니다.
 */
function bakeKonvaBookWidgetGroupDuringTransform(g: Konva.Group): void {
  const r = g.findOne(
    `.${KONVA_BOOK_WIDGET_HIT_RECT_NAME}`,
  ) as Konva.Rect | null;
  if (!r) return;
  const sx = Math.abs(g.scaleX());
  const sy = Math.abs(g.scaleY());
  const nw = Math.max(1, r.width() * sx);
  const nh = Math.max(1, r.height() * sy);
  g.scaleX(1);
  g.scaleY(1);
  r.width(nw);
  r.height(nh);
  r.x(-nw / 2);
  r.y(-nh / 2);
}

/** 드래그/변형 중 react-konva가 이전 props로 노드를 덮어쓰면(리렌더 시) 튀는 현상 방지 */
type BookDragLive = { id: string; cx: number; cy: number };
type BookTransformLive = {
  id: string;
  cx: number;
  cy: number;
  rotation: number;
  width: number;
  height: number;
};

type BookShapeLiveSync = {
  dragLive: BookDragLive | null;
  transformLive: BookTransformLive | null;
  /** 드래그 스냅·드래그 중 격자 오버레이에 쓰는 논리 px 간격 */
  dragGridPx: number;
  onDragLiveStart: (elementId: string, node: Konva.Node) => void;
  onDragLiveMove: (elementId: string, node: Konva.Node) => void;
  /** 드래그 중 논리 좌표 그리드 스냅 후 `dragLive` 갱신 */
  onDragMoveSnapGrid: (
    elementId: string,
    node: Konva.Node,
    logicalW: number,
    logicalH: number,
  ) => void;
  clearDragLive: () => void;
  /** 드래그 종료: 다중 선택 시 함께 이동, 아니면 해당 요소만 */
  commitDragEndPosition: (
    elementId: string,
    node: Konva.Node,
    logicalW: number,
    logicalH: number,
  ) => void;
  onTransformLiveStart: (elementId: string, node: Konva.Node) => void;
  onTransformLiveMove: (elementId: string, node: Konva.Node) => void;
  clearTransformLive: () => void;
};

function commitBookWidgetHitShellTransformEnd(
  e: { target: Konva.Node },
  elementId: string,
  minW: number,
  minH: number,
  liveSync: BookShapeLiveSync,
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void,
) {
  liveSync.clearTransformLive();
  const g = e.target as Konva.Group;
  const r = g.findOne(
    `.${KONVA_BOOK_WIDGET_HIT_RECT_NAME}`,
  ) as Konva.Rect | null;
  if (!r) return;
  const sx = Math.abs(g.scaleX());
  const sy = Math.abs(g.scaleY());
  g.scaleX(1);
  g.scaleY(1);
  const nw = Math.max(minW, r.width() * sx);
  const nh = Math.max(minH, r.height() * sy);
  r.width(nw);
  r.height(nh);
  r.x(-nw / 2);
  r.y(-nh / 2);
  const tl = konvaBookTopLeftFromCommitNode(g, nw, nh);
  onElementChange(elementId, {
    x: tl.x,
    y: tl.y,
    width: nw,
    height: nh,
    rotation: g.rotation(),
  });
}

/** HTML 오버레이(텍스트·비디오)를 Konva dragLive/transformLive와 동기화 */
function overlayLiveFrame(
  elementId: string,
  dragLive: BookDragLive | null,
  transformLive: BookTransformLive | null,
  frame: { w: number; h: number; rotation: number },
): BookTextOverlayLiveFrame | null {
  const tf = transformLive?.id === elementId ? transformLive : null;
  if (tf) {
    return {
      x: tf.cx - tf.width / 2,
      y: tf.cy - tf.height / 2,
      width: tf.width,
      height: tf.height,
      rotation: tf.rotation,
    };
  }
  const dg = dragLive?.id === elementId ? dragLive : null;
  if (dg) {
    return {
      x: dg.cx - frame.w / 2,
      y: dg.cy - frame.h / 2,
      width: frame.w,
      height: frame.h,
      rotation: frame.rotation,
    };
  }
  return null;
}

function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VIDEO_BAR_HIDE_DELAY_MS = 2000;

/**
 * 화면 픽셀은 Konva.Image(HTMLVideoElement)로 그림 — Stage 아래 HTML video는 일부 브라우저에서
 * 캔버스에 가려져 보이지 않는 경우가 있어, 재생용 `<video>`는 화면 밖에 두고 ref만 공유합니다.
 */
function BookSlideVideoOverlay({
  el,
  scale,
  barVisible,
  liveFrame,
  onBarPointerEnter,
  onBarPointerLeave,
  onHtmlVideoRef,
  onDurationKnown,
  mode,
}: {
  el: Extract<BookCanvasElement, { type: "video" }>;
  scale: number;
  barVisible: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
  onBarPointerEnter: () => void;
  onBarPointerLeave: () => void;
  onHtmlVideoRef?: (elementId: string, node: HTMLVideoElement | null) => void;
  onDurationKnown?: (elementId: string, durationSec: number) => void;
  mode: "edit" | "view";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const src = publicAssetUrl(el.src) ?? el.src;
  const poster =
    el.posterSrc != null
      ? (publicAssetUrl(el.posterSrc) ?? el.posterSrc)
      : undefined;

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      onHtmlVideoRef?.(el.id, node);
      if (node) {
        queueMicrotask(() => void node.play().catch(() => undefined));
      }
    },
    [el.id, onHtmlVideoRef],
  );

  const syncFromVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setPlaying(!v.paused);
    setCurrentTime(v.currentTime);
    setDuration(Number.isFinite(v.duration) ? v.duration : 0);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => syncFromVideo();
    const onPause = () => syncFromVideo();
    const onTime = () => syncFromVideo();
    const onMeta = () => syncFromVideo();
    const onEnded = () => syncFromVideo();
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    syncFromVideo();
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnded);
    };
  }, [src, syncFromVideo]);

  useEffect(() => {
    if (duration > 0 && Number.isFinite(duration)) {
      onDurationKnown?.(el.id, duration);
    }
  }, [el.id, duration, onDurationKnown]);

  /** 포스터가 없을 때: 메타만 로드하면 캔버스에 그릴 디코딩 프레임이 없어 하얗게 보이는 경우가 있어, 짧게 seek 해 첫 화면을 받도록 함 */
  useEffect(() => {
    if (poster) return;
    const v = videoRef.current;
    if (!v) return;
    const prime = () => {
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (!Number.isFinite(v.duration) || v.duration <= 0) return;
      const t = Math.min(0.08, Math.max(0.001, v.duration * 0.002));
      try {
        v.currentTime = t;
      } catch {
        /* ignore */
      }
    };
    v.addEventListener("loadedmetadata", prime);
    if (v.readyState >= HTMLMediaElement.HAVE_METADATA) queueMicrotask(prime);
    return () => v.removeEventListener("loadedmetadata", prime);
  }, [src, poster]);

  /** 편집·보기: 마운트 후 재생 시도(브라우저 정책으로 막히면 무시) */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => void v.play().catch(() => undefined);
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) tryPlay();
    v.addEventListener("canplay", tryPlay, { once: true });
    return () => v.removeEventListener("canplay", tryPlay);
  }, [src, poster]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
    setCurrentTime(0);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const seekFromClientX = useCallback(
    (track: HTMLDivElement, clientX: number) => {
      const v = videoRef.current;
      if (!v || duration <= 0) return;
      const r = track.getBoundingClientRect();
      const w = r.width || 1;
      v.currentTime =
        (Math.min(Math.max(0, clientX - r.left), w) / w) * duration;
      syncFromVideo();
    },
    [duration, syncFromVideo],
  );

  const vOpacity = resolveBookElementOpacity(el.opacity);
  const vRot = resolveBookElementRotation(el.rotation);
  const vPivot = bookElementPivotKonva(el);
  const vOrigin = bookElementOverlayTopLeftFromPivot(
    vPivot,
    el.width,
    el.height,
  );
  const vx = liveFrame?.x ?? vOrigin.x;
  const vy = liveFrame?.y ?? vOrigin.y;
  const vw = liveFrame?.width ?? el.width;
  const vh = liveFrame?.height ?? el.height;
  const vDeg = liveFrame != null ? liveFrame.rotation : vRot;

  const vidBr = resolveBookElementBorderRadius(el);
  const vidOw = resolveBookElementOutlineWidth(el);
  const vidOc = resolveBookElementOutlineColor(el);
  const vidOutlineShadow =
    mode === "edit" && vidOw > 0
      ? `0 0 0 ${Math.max(0.5, vidOw * scale)}px ${vidOc}`
      : undefined;

  const boxStyle: CSSProperties = {
    left: vx * scale,
    top: vy * scale,
    width: vw * scale,
    height: vh * scale,
    opacity: vOpacity,
    transform: vDeg !== 0 ? `rotate(${vDeg}deg)` : undefined,
    transformOrigin: "center center" as const,
    borderRadius: Math.max(0, vidBr * scale),
  };

  return (
    <>
      <video
        ref={setVideoRef}
        className="pointer-events-none fixed -left-[9999px] top-0 size-px max-h-px max-w-px overflow-hidden opacity-0"
        aria-hidden
        data-book-slide-mode={mode}
        src={src}
        poster={poster || undefined}
        muted
        playsInline
        preload="auto"
        controls={false}
        onError={(e) => {
          appLog("bookSlideVideo", "<video> 로드/디코드 실패", {
            elementId: el.id,
            srcPrefix: src.length > 100 ? `${src.slice(0, 100)}…` : src,
            mediaErrorCode: e.currentTarget.error?.code,
          });
        }}
      />
      {/* Konva보다 위: 하단 바만 클릭 가능. 나머지 영역은 pointer-events-none으로 Konva로 통과 */}
      <div
        className="absolute z-2 overflow-hidden pointer-events-none"
        style={{
          ...boxStyle,
          ...(vidOutlineShadow ? { boxShadow: vidOutlineShadow } : {}),
        }}
      >
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-10 flex h-9 min-h-9 items-center gap-1 border-t border-white/15 bg-black/75 px-1 py-0.5 transition-opacity duration-200",
            barVisible
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerEnter={onBarPointerEnter}
          onPointerLeave={onBarPointerLeave}
        >
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15"
            onClick={togglePlay}
            aria-label={playing ? "일시정지" : "재생"}
          >
            {playing ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5 pl-0.5" />
            )}
          </button>
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15"
            onClick={stop}
            aria-label="정지"
          >
            <Square className="size-3 fill-current" />
          </button>
          {/* 미디어 플레이리스트와 동일: 네이티브 range 대신 div 막대 — OS별 슬라이더 스타일 차이 제거 */}
          <div
            className={cn(
              "relative min-w-0 flex-1 rounded-full bg-white/15",
              duration > 0 ? "cursor-pointer" : "cursor-default opacity-40",
            )}
            style={{ height: Math.max(3, Math.min(7, 36 * 0.22)) }}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="재생 위치"
            aria-disabled={duration <= 0}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (duration <= 0) return;
              const track = e.currentTarget;
              track.setPointerCapture(e.pointerId);
              seekFromClientX(track, e.clientX);
              const onMove = (ev: PointerEvent) =>
                seekFromClientX(track, ev.clientX);
              const cleanup = (ev: PointerEvent) => {
                if (track.hasPointerCapture(ev.pointerId)) {
                  track.releasePointerCapture(ev.pointerId);
                }
                track.removeEventListener("pointermove", onMove);
                track.removeEventListener("pointerup", cleanup);
                track.removeEventListener("pointercancel", cleanup);
              };
              track.addEventListener("pointermove", onMove);
              track.addEventListener("pointerup", cleanup);
              track.addEventListener("pointercancel", cleanup);
            }}
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-sky-400/90"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-right font-mono text-[10px] tabular-nums leading-none text-white/90">
            {formatMediaClock(currentTime)} / {formatMediaClock(duration)}
          </span>
        </div>
      </div>
    </>
  );
}

export function BookSlideCanvas({
  pageWidth,
  pageHeight,
  pageBackgroundColor,
  scale,
  elements,
  mode,
  selectedIds,
  onSelect,
  onElementChange,
  onDropWidget,
  onDropShape,
  onDropLibraryMedia,
  onReorderZ,
  onDeleteElement,
  centerGuideThresholdPx = DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
  dragGridPx = BOOK_CANVAS_DRAG_GRID_PX,
  editInteractionTool = "default",
  drawingStrokeColor = "#0f172a",
  drawingStrokeWidth = 4,
  onAppendElement,
  onRequestReplaceMediaFromFile,
  onRequestPickLibraryMediaForReplace,
  onRequestPlaylistAppendFromFile,
  onRequestPlaylistAppendFromLibrary,
  mediaLibraryReplaceEnabled = false,
  onMediaPlaylistPlaybackIndexChange,
  onMediaPlaylistPlaybackUiReport,
  mediaPlaylistRemoteCommand,
  onMediaPlaylistRemoteCommandConsumed,
  onVideoDurationKnown,
  viewModeHideMediaChrome = false,
}: BookSlideCanvasProps) {
  const trRef = useRef<Konva.Transformer>(null);
  const konvaNodeByIdRef = useRef<Map<string, Konva.Node>>(new Map());
  const groupDragSnapRef = useRef<{
    leaderId: string;
    origins: Map<string, { x: number; y: number }>;
  } | null>(null);
  const videoBarHideTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const [videoHtmlById, setVideoHtmlById] = useState<
    Map<string, HTMLVideoElement>
  >(() => new Map());
  const onHtmlVideoRef = useCallback(
    (elementId: string, node: HTMLVideoElement | null) => {
      setVideoHtmlById((prev) => {
        const next = new Map(prev);
        if (node) next.set(elementId, node);
        else next.delete(elementId);
        return next;
      });
    },
    [],
  );
  const [videoBarVisible, setVideoBarVisible] = useState<
    Record<string, boolean>
  >({});
  const [zMenu, setZMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const zMenuRef = useRef<HTMLDivElement>(null);
  /** 텍스트 위젯 캔버스 인라인 편집(더블클릭) */
  const [inlineTextEdit, setInlineTextEdit] = useState<{
    id: string;
    initialHtml: string;
  } | null>(null);
  const inlineTextEditorRef = useRef<BookTextWidgetInlineEditorHandle>(null);
  /** 편집 모드에서 우클릭: 순서·삭제·슬라이드 전체 맞춤 등 */
  const elementContextMenuEnabled = mode === "edit";
  const hideViewMediaChrome =
    mode === "view" && Boolean(viewModeHideMediaChrome);

  const visibleElements = useMemo(
    () => elements.filter(isBookElementVisible),
    [elements],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const registerKonvaNode = useCallback(
    (elementId: string, node: Konva.Node | null) => {
      const m = konvaNodeByIdRef.current;
      if (node) m.set(elementId, node);
      else m.delete(elementId);
    },
    [],
  );

  const [dragLive, setDragLive] = useState<BookDragLive | null>(null);
  const [transformLive, setTransformLive] = useState<BookTransformLive | null>(
    null,
  );
  const dragLiveRafRef = useRef<number | null>(null);
  /** Konva Transformer는 `transform` 직후 `update()`로 앵커를 맞춤. 그 전에 React가 Rect를 덮어쓰면 한쪽 핸들만 당겨도 양쪽이 움직이는 것처럼 보임 → microtask로 그 이후에 동기화 */
  const transformLiveMovePendingRef = useRef<{
    id: string;
    node: Konva.Node;
  } | null>(null);
  const transformLiveMoveMicroScheduledRef = useRef(false);

  const clearDragLive = useCallback(() => {
    if (dragLiveRafRef.current != null) {
      cancelAnimationFrame(dragLiveRafRef.current);
      dragLiveRafRef.current = null;
    }
    setDragLive(null);
  }, []);

  const clearTransformLive = useCallback(() => {
    transformLiveMovePendingRef.current = null;
    transformLiveMoveMicroScheduledRef.current = false;
    setTransformLive(null);
  }, []);

  const onDragLiveStartBase = useCallback(
    (elementId: string, node: Konva.Node) => {
      if (dragLiveRafRef.current != null) {
        cancelAnimationFrame(dragLiveRafRef.current);
        dragLiveRafRef.current = null;
      }
      clearTransformLive();
      setDragLive({ id: elementId, cx: node.x(), cy: node.y() });
    },
    [clearTransformLive],
  );

  const onDragLiveStart = useCallback(
    (elementId: string, node: Konva.Node) => {
      onDragLiveStartBase(elementId, node);
      const movable = selectedIds.filter((id) => {
        const e = elements.find((x) => x.id === id);
        return e && isBookElementVisible(e) && !isBookElementLocked(e);
      });
      if (movable.length > 1 && movable.includes(elementId)) {
        const origins = new Map<string, { x: number; y: number }>();
        for (const id of movable) {
          const e = elements.find((x) => x.id === id);
          if (e) origins.set(id, { x: e.x, y: e.y });
        }
        groupDragSnapRef.current = { leaderId: elementId, origins };
      } else {
        groupDragSnapRef.current = null;
      }
    },
    [elements, onDragLiveStartBase, selectedIds],
  );

  const onDragLiveMove = useCallback((elementId: string, node: Konva.Node) => {
    if (dragLiveRafRef.current != null)
      cancelAnimationFrame(dragLiveRafRef.current);
    dragLiveRafRef.current = requestAnimationFrame(() => {
      dragLiveRafRef.current = null;
      setDragLive({ id: elementId, cx: node.x(), cy: node.y() });
    });
  }, []);

  const onTransformLiveStart = useCallback(
    (elementId: string, node: Konva.Node) => {
      if (dragLiveRafRef.current != null) {
        cancelAnimationFrame(dragLiveRafRef.current);
        dragLiveRafRef.current = null;
      }
      setDragLive(null);
      transformLiveMovePendingRef.current = null;
      transformLiveMoveMicroScheduledRef.current = false;
      const sx = node.scaleX();
      const sy = node.scaleY();
      const { width, height } = transformLiveFrameSize(node, sx, sy);
      setTransformLive({
        id: elementId,
        cx: node.x(),
        cy: node.y(),
        rotation: node.rotation(),
        width,
        height,
      });
    },
    [],
  );

  const onTransformLiveMove = useCallback(
    (elementId: string, node: Konva.Node) => {
      transformLiveMovePendingRef.current = { id: elementId, node };
      if (transformLiveMoveMicroScheduledRef.current) return;
      transformLiveMoveMicroScheduledRef.current = true;
      queueMicrotask(() => {
        transformLiveMoveMicroScheduledRef.current = false;
        const pending = transformLiveMovePendingRef.current;
        if (!pending) return;
        const n = konvaNodeByIdRef.current.get(pending.id) ?? pending.node;
        const sx = n.scaleX();
        const sy = n.scaleY();
        const { width, height } = transformLiveFrameSize(n, sx, sy);
        setTransformLive({
          id: pending.id,
          cx: n.x(),
          cy: n.y(),
          rotation: n.rotation(),
          width,
          height,
        });
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (dragLiveRafRef.current != null)
        cancelAnimationFrame(dragLiveRafRef.current);
    };
  }, []);

  const commitDragEndPosition = useCallback(
    (
      elementId: string,
      node: Konva.Node,
      logicalW: number,
      logicalH: number,
    ) => {
      snapKonvaBookNodePositionToGrid(
        node,
        {
          width: logicalW,
          height: logicalH,
          rotation: node.rotation(),
        },
        dragGridPx,
      );
      const tl = konvaBookTopLeftFromCommitNode(node, logicalW, logicalH);
      const g = groupDragSnapRef.current;
      if (g && g.leaderId === elementId && g.origins.size > 1) {
        const o0 = g.origins.get(elementId);
        if (o0) {
          const dx = tl.x - o0.x;
          const dy = tl.y - o0.y;
          for (const [id, pos] of g.origins) {
            if (id === elementId) {
              onElementChange(id, { x: tl.x, y: tl.y });
            } else {
              onElementChange(id, { x: pos.x + dx, y: pos.y + dy });
            }
          }
        }
        groupDragSnapRef.current = null;
      } else {
        onElementChange(elementId, { x: tl.x, y: tl.y });
        groupDragSnapRef.current = null;
      }
      clearDragLive();
    },
    [clearDragLive, dragGridPx, onElementChange],
  );

  const shapeLiveSync: BookShapeLiveSync = useMemo(
    () => ({
      dragLive,
      transformLive,
      dragGridPx,
      onDragLiveStart,
      onDragLiveMove,
      onDragMoveSnapGrid: (elementId, node, logicalW, logicalH) => {
        snapKonvaBookNodePositionToGrid(
          node,
          {
            width: logicalW,
            height: logicalH,
            rotation: node.rotation(),
          },
          dragGridPx,
        );
        onDragLiveMove(elementId, node);
      },
      clearDragLive,
      commitDragEndPosition,
      onTransformLiveStart,
      onTransformLiveMove,
      clearTransformLive,
    }),
    [
      dragLive,
      transformLive,
      dragGridPx,
      onDragLiveStart,
      onDragLiveMove,
      clearDragLive,
      commitDragEndPosition,
      onTransformLiveStart,
      onTransformLiveMove,
      clearTransformLive,
    ],
  );

  const showVideoBar = useCallback((id: string) => {
    const t = videoBarHideTimers.current.get(id);
    if (t) clearTimeout(t);
    videoBarHideTimers.current.delete(id);
    setVideoBarVisible((m) => (m[id] ? m : { ...m, [id]: true }));
  }, []);

  const scheduleHideVideoBar = useCallback((id: string) => {
    const prev = videoBarHideTimers.current.get(id);
    if (prev) clearTimeout(prev);
    videoBarHideTimers.current.set(
      id,
      setTimeout(() => {
        videoBarHideTimers.current.delete(id);
        setVideoBarVisible((m) => {
          if (!m[id]) return m;
          return { ...m, [id]: false };
        });
      }, VIDEO_BAR_HIDE_DELAY_MS),
    );
  }, []);

  useEffect(() => {
    const timers = videoBarHideTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const textHeightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  useEffect(() => {
    const m = textHeightTimers.current;
    return () => {
      m.forEach(clearTimeout);
      m.clear();
    };
  }, []);

  const scheduleTextBoxHeight = useCallback(
    (elementId: string, nextHeight: number) => {
      const t = textHeightTimers.current.get(elementId);
      if (t) clearTimeout(t);
      textHeightTimers.current.set(
        elementId,
        setTimeout(() => {
          textHeightTimers.current.delete(elementId);
          onElementChange(elementId, { height: nextHeight });
        }, 120),
      );
    },
    [onElementChange],
  );

  const beginInlineTextEdit = useCallback(
    (elementId: string) => {
      const tel = elements.find((e) => e.id === elementId);
      if (!tel || tel.type !== "text") return;
      if (isBookElementLocked(tel)) return;
      setInlineTextEdit({
        id: elementId,
        initialHtml: getTextWidgetDisplayHtml(tel),
      });
      onSelect({ id: elementId, shiftKey: false });
    },
    [elements, onSelect],
  );

  useEffect(() => {
    if (!inlineTextEdit) return;
    if (!selectedIdSet.has(inlineTextEdit.id)) {
      queueMicrotask(() => inlineTextEditorRef.current?.commit());
    }
  }, [inlineTextEdit, selectedIdSet]);

  useEffect(() => {
    if (!inlineTextEdit) return;
    const exists = elements.some(
      (e) => e.id === inlineTextEdit.id && e.type === "text",
    );
    if (!exists) queueMicrotask(() => setInlineTextEdit(null));
  }, [elements, inlineTextEdit]);

  useEffect(() => {
    if (mode !== "edit" && inlineTextEdit)
      queueMicrotask(() => setInlineTextEdit(null));
  }, [mode, inlineTextEdit]);

  useEffect(() => {
    if (editInteractionTool === "draw" && inlineTextEdit)
      queueMicrotask(() => setInlineTextEdit(null));
  }, [editInteractionTool, inlineTextEdit]);

  useEffect(() => {
    if (!zMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZMenu(null);
    };
    const onPointerDownCapture = (e: PointerEvent) => {
      if (zMenuRef.current?.contains(e.target as Node)) return;
      setZMenu(null);
    };
    const raf = window.requestAnimationFrame(() => {
      window.addEventListener("pointerdown", onPointerDownCapture, true);
    });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zMenu]);

  useEffect(() => {
    if (mode !== "edit" || selectedIds.length === 0 || zMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight"
      ) {
        return;
      }
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea, [contenteditable=true]")) return;
      if (
        t.closest(
          '[data-slot="select-content"], [data-slot="combobox-content"], [data-slot="combobox-list"]',
        )
      ) {
        return;
      }
      const movers = selectedIds
        .map((id) => elements.find((x) => x.id === id))
        .filter(
          (el): el is BookCanvasElement =>
            el != null && !isBookElementLocked(el) && isBookElementVisible(el),
        );
      if (movers.length === 0) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else dy = step;
      for (const el of movers) {
        onElementChange(el.id, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, selectedIds, zMenu, elements, onElementChange]);

  const openZMenu = useCallback(
    (elementId: string, clientX: number, clientY: number) => {
      if (mode !== "edit") return;
      onSelect({ id: elementId });
      setZMenu({ x: clientX, y: clientY, elementId });
    },
    [mode, onSelect],
  );

  const applyFitToStage = useCallback(() => {
    if (!zMenu) return;
    onElementChange(zMenu.elementId, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
    setZMenu(null);
  }, [zMenu, onElementChange, pageWidth, pageHeight]);

  const applyDelete = useCallback(() => {
    if (!zMenu || !onDeleteElement) return;
    onDeleteElement(zMenu.elementId);
    setZMenu(null);
  }, [zMenu, onDeleteElement]);

  const applyZ = useCallback(
    (op: ElementZOrderOp) => {
      if (!zMenu || !onReorderZ) return;
      onReorderZ(zMenu.elementId, op);
      setZMenu(null);
    },
    [zMenu, onReorderZ],
  );

  const isLiveInteracting = dragLive !== null || transformLive !== null;

  useEffect(() => {
    const tr = trRef.current;
    const nodes: Konva.Node[] = [];
    for (const id of selectedIds) {
      if (id == null) continue;
      const sel = elements.find((e) => e.id === id);
      if (
        sel == null ||
        sel.type === "drawing" ||
        !isBookElementVisible(sel) ||
        isBookElementLocked(sel)
      )
        continue;
      const node = konvaNodeByIdRef.current.get(id);
      if (node) nodes.push(node);
    }
    const selectedOnCanvas = nodes.length > 0;
    if (mode !== "edit" || !tr || !selectedOnCanvas) {
      tr?.nodes([]);
      tr?.getLayer()?.batchDraw();
      return;
    }
    /* 드래그·변형 중 tr.nodes 재호출 시 앵커/노드가 한 프레임 덮여 튐 */
    if (isLiveInteracting) return;
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [
    mode,
    selectedIds,
    elements,
    visibleElements,
    pageWidth,
    pageHeight,
    isLiveInteracting,
  ]);

  const sw = pageWidth * scale;
  const sh = pageHeight * scale;

  const slideCenterGuides = useMemo(() => {
    if (mode !== "edit" || dragLive === null) return null;
    const midX = pageWidth / 2;
    const midY = pageHeight / 2;
    const th = centerGuideThresholdPx;
    const showV = Math.abs(dragLive.cx - midX) <= th;
    const showH = Math.abs(dragLive.cy - midY) <= th;
    if (!showV && !showH) return null;
    return {
      showV,
      showH,
      midXpx: midX * scale,
      midYpx: midY * scale,
    };
  }, [mode, dragLive, pageWidth, pageHeight, scale, centerGuideThresholdPx]);

  const dropEnabled =
    mode === "edit" &&
    editInteractionTool === "default" &&
    (Boolean(onDropWidget) ||
      Boolean(onDropLibraryMedia) ||
      Boolean(onDropShape));

  const parseDropKind = (e: DragEvent): BookDropWidgetKind | null => {
    const raw =
      e.dataTransfer.getData(BOOK_WIDGET_DRAG_TYPE) ||
      e.dataTransfer.getData("text/plain");
    if (
      raw === "text" ||
      raw === "image" ||
      raw === "video" ||
      raw === "weather" ||
      raw === "digitalClock" ||
      raw === "news" ||
      raw === "mediaPlaylist"
    )
      return raw;
    return null;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!dropEnabled) return;
    const lib = onDropLibraryMedia ? parseLibraryDropPayload(e) : null;
    if (lib && onDropLibraryMedia) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const lx = (e.clientX - rect.left) / scale;
      const ly = (e.clientY - rect.top) / scale;
      const x = Math.max(0, Math.min(lx, pageWidth - 24));
      const y = Math.max(0, Math.min(ly, pageHeight - 24));
      onDropLibraryMedia({ x, y }, lib);
      return;
    }
    if (onDropShape) {
      const sk = parseShapeDropPayload(e);
      if (sk) {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const lx = (e.clientX - rect.left) / scale;
        const ly = (e.clientY - rect.top) / scale;
        const x = Math.max(0, Math.min(lx, pageWidth));
        const y = Math.max(0, Math.min(ly, pageHeight));
        onDropShape({ x, y }, sk);
        return;
      }
    }
    if (!onDropWidget) return;
    e.preventDefault();
    const kind = parseDropKind(e);
    if (!kind) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = (e.clientX - rect.left) / scale;
    const ly = (e.clientY - rect.top) / scale;
    const x = Math.max(0, Math.min(lx, pageWidth - 24));
    const y = Math.max(0, Math.min(ly, pageHeight - 24));
    onDropWidget({ x, y }, kind);
  };

  return (
    <div
      data-book-slide-root
      className={cn(
        "relative inline-block ring-1 ring-border shadow-sm",
        dropEnabled && "ring-primary/40",
        mode === "edit" &&
          editInteractionTool === "draw" &&
          "ring-2 ring-primary/45",
      )}
      onDragOver={
        dropEnabled
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          : undefined
      }
      onDrop={dropEnabled ? handleDrop : undefined}
    >
      {/* 슬라이드 배경은 HTML — 비디오 픽셀은 Konva.Image, 재생용 video는 화면 밖 + 하단 바만 z-2 */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundColor: pageBackgroundColor }}
        aria-hidden
      />
      {mode === "edit" && dragLive !== null ? (
        <div
          className="pointer-events-none absolute inset-0 z-[0.5]"
          style={{
            backgroundImage: `linear-gradient(to right, hsl(var(--foreground) / 0.07) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground) / 0.07) 1px, transparent 1px)`,
            backgroundSize: `${dragGridPx * scale}px ${dragGridPx * scale}px`,
          }}
          aria-hidden
        />
      ) : null}
      {slideCenterGuides ? (
        <div
          className="pointer-events-none absolute inset-0 z-[50]"
          aria-hidden
        >
          {slideCenterGuides.showV ? (
            <div
              className="absolute top-0 bottom-0 w-px bg-pink-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] dark:bg-fuchsia-400/85"
              style={{ left: slideCenterGuides.midXpx, marginLeft: -0.5 }}
            />
          ) : null}
          {slideCenterGuides.showH ? (
            <div
              className="absolute left-0 right-0 h-px bg-pink-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] dark:bg-fuchsia-400/85"
              style={{ top: slideCenterGuides.midYpx, marginTop: -0.5 }}
            />
          ) : null}
        </div>
      ) : null}
      {visibleElements
        .filter(
          (e): e is Extract<BookCanvasElement, { type: "video" }> =>
            e.type === "video",
        )
        .map((el) => (
          <BookSlideVideoOverlay
            key={el.id}
            el={el}
            scale={scale}
            mode={mode}
            barVisible={!hideViewMediaChrome && Boolean(videoBarVisible[el.id])}
            liveFrame={overlayLiveFrame(el.id, dragLive, transformLive, {
              w: el.width,
              h: el.height,
              rotation: resolveBookElementRotation(el.rotation),
            })}
            onBarPointerEnter={() => showVideoBar(el.id)}
            onBarPointerLeave={() => scheduleHideVideoBar(el.id)}
            onHtmlVideoRef={onHtmlVideoRef}
            onDurationKnown={onVideoDurationKnown}
          />
        ))}
      <div className="relative z-[1]">
        <Stage width={sw} height={sh} style={{ background: "transparent" }}>
          <Layer scaleX={scale} scaleY={scale}>
            <Rect
              width={pageWidth}
              height={pageHeight}
              fill="transparent"
              listening={mode === "edit"}
              onMouseDown={(e) => {
                if (mode !== "edit") return;
                e.cancelBubble = true;
                onSelect({ id: null });
              }}
            />
            {visibleElements.map((el) => {
              const isSelected = selectedIdSet.has(el.id);
              const locked = isBookElementLocked(el);
              if (el.type === "text") {
                return (
                  <BookTextHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                    inlineTextEditing={inlineTextEdit?.id === el.id}
                    onRequestInlineTextEdit={beginInlineTextEdit}
                  />
                );
              }
              if (el.type === "weather") {
                return (
                  <BookWeatherHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                  />
                );
              }
              if (el.type === "news") {
                return (
                  <BookNewsHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                  />
                );
              }
              if (el.type === "mediaPlaylist") {
                const mplBarOnHover = resolveMediaPlaylistShowControls(el);
                return (
                  <BookMediaPlaylistHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                    onMediaHoverEnter={
                      mplBarOnHover ? () => showVideoBar(el.id) : undefined
                    }
                    onMediaHoverLeave={
                      mplBarOnHover
                        ? () => scheduleHideVideoBar(el.id)
                        : undefined
                    }
                  />
                );
              }
              if (el.type === "digitalClock") {
                return (
                  <BookDigitalClockHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                  />
                );
              }
              if (el.type === "image") {
                return (
                  <BookImageShape
                    key={`${el.id}:${el.src}`}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                  />
                );
              }
              if (el.type === "shape") {
                return (
                  <BookShapeHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    onSelect={onSelect}
                    onElementChange={onElementChange}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                  />
                );
              }
              if (el.type === "drawing") {
                return (
                  <BookDrawingHitShape
                    key={el.id}
                    el={el}
                    locked={locked}
                    liveSync={shapeLiveSync}
                    registerKonvaNode={registerKonvaNode}
                    mode={mode}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    zMenuEnabled={elementContextMenuEnabled && !locked}
                    onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                  />
                );
              }
              return (
                <BookVideoBox
                  key={`${el.id}:${el.src}`}
                  el={el}
                  htmlVideoEl={videoHtmlById.get(el.id) ?? null}
                  locked={locked}
                  liveSync={shapeLiveSync}
                  registerKonvaNode={registerKonvaNode}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  onVideoHoverEnter={() => showVideoBar(el.id)}
                  onVideoHoverLeave={() => scheduleHideVideoBar(el.id)}
                  zMenuEnabled={elementContextMenuEnabled && !locked}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            })}
            {mode === "edit" &&
            selectedIds.length > 0 &&
            !(
              inlineTextEdit &&
              selectedIds.length === 1 &&
              selectedIds[0] === inlineTextEdit.id
            ) ? (
              <Transformer
                ref={trRef}
                rotateEnabled
                /** 기본 true면 비율 고정이라 한쪽 핸들만 잡아도 다른 축·반대쪽까지 같이 변하는 느낌이 남. Shift 누르면 비율 유지 */
                keepRatio={false}
                centeredScaling={false}
                /** 공식 데모(Scale Image to Fit)와 동일 — 뒤집기 시 앵커가 어색해질 수 있음 */
                flipEnabled={false}
                /** 히트 Rect의 stroke가 바운딩 박스에 섞이면 리사이즈 기준이 흔들릴 수 있음 */
                ignoreStroke
                borderStroke="#3b82f6"
                anchorFill="#fff"
                anchorStroke="#3b82f6"
                boundBoxFunc={(_oldBox, newBox) => {
                  if (newBox.width < 24 || newBox.height < 24) return _oldBox;
                  return newBox;
                }}
              />
            ) : null}
          </Layer>
        </Stage>
      </div>
      {mode === "edit" && editInteractionTool === "draw" && onAppendElement ? (
        <BookFreehandDrawLayer
          scale={scale}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          strokeColor={drawingStrokeColor}
          strokeWidth={drawingStrokeWidth}
          onCommit={(pts) => {
            const el = buildBookDrawingElement(
              pts,
              drawingStrokeColor,
              drawingStrokeWidth,
            );
            if (el) onAppendElement(el);
          }}
        />
      ) : null}
      {mode === "edit" &&
      elements.length === 0 &&
      editInteractionTool !== "draw" ? (
        <div
          className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center px-4"
          aria-hidden
        >
          <p className="max-w-[min(100%,22rem)] text-center text-base font-medium tracking-tight text-muted-foreground/75">
            위젯을 끌어다 이 슬라이드에 놓으면 시작할 수 있어요.
          </p>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
        {visibleElements
          .filter(
            (
              e,
            ): e is Extract<
              BookCanvasElement,
              {
                type:
                  | "text"
                  | "weather"
                  | "digitalClock"
                  | "news"
                  | "mediaPlaylist";
              }
            > =>
              e.type === "text" ||
              e.type === "weather" ||
              e.type === "digitalClock" ||
              e.type === "news" ||
              e.type === "mediaPlaylist",
          )
          .map((el) => {
            if (el.type === "text") {
              if (inlineTextEdit?.id === el.id) return null;
              const tw = el.width ?? 720;
              const th = textWidgetHitHeight(el);
              const textLive = overlayLiveFrame(
                el.id,
                dragLive,
                transformLive,
                {
                  w: tw,
                  h: th,
                  rotation: resolveBookElementRotation(el.rotation),
                },
              );
              return (
                <BookTextWidgetOverlay
                  key={el.id}
                  el={el}
                  scale={scale}
                  mode={mode}
                  isSelected={selectedIdSet.has(el.id)}
                  liveFrame={textLive}
                  onReportLogicalHeight={
                    mode === "edit"
                      ? (logical) => {
                          const next = nextTextWidgetHeightGrowOnly(
                            logical,
                            el.height,
                            el.fontSize,
                          );
                          if (next == null) return;
                          scheduleTextBoxHeight(el.id, next);
                        }
                      : undefined
                  }
                />
              );
            }
            const frameLive = overlayLiveFrame(el.id, dragLive, transformLive, {
              w: el.width,
              h: el.height,
              rotation: resolveBookElementRotation(el.rotation),
            });
            if (el.type === "weather") {
              return (
                <BookWeatherWidgetOverlay
                  key={el.id}
                  el={el}
                  scale={scale}
                  mode={mode}
                  isSelected={selectedIdSet.has(el.id)}
                  liveFrame={frameLive}
                />
              );
            }
            if (el.type === "news") {
              return (
                <BookNewsWidgetOverlay
                  key={el.id}
                  el={el}
                  scale={scale}
                  mode={mode}
                  isSelected={selectedIdSet.has(el.id)}
                  liveFrame={frameLive}
                />
              );
            }
            if (el.type === "mediaPlaylist") {
              const mplItems = el.mediaPlaylistItems ?? [];
              const mplSig = `${mplItems.length}:${mplItems.map((x) => x.id).join(",")}`;
              const mplBarOnHover = resolveMediaPlaylistShowControls(el);
              return (
                <BookMediaPlaylistWidgetOverlay
                  key={`${el.id}:${mplSig}`}
                  el={el}
                  scale={scale}
                  mode={mode}
                  isSelected={selectedIdSet.has(el.id)}
                  liveFrame={frameLive}
                  barVisible={
                    !hideViewMediaChrome &&
                    mplBarOnHover &&
                    Boolean(videoBarVisible[el.id])
                  }
                  onBarPointerEnter={
                    mplBarOnHover ? () => showVideoBar(el.id) : undefined
                  }
                  onBarPointerLeave={
                    mplBarOnHover
                      ? () => scheduleHideVideoBar(el.id)
                      : undefined
                  }
                  onPlaybackIndexChange={onMediaPlaylistPlaybackIndexChange}
                  onPlaybackUiReport={
                    selectedIdSet.has(el.id) && onMediaPlaylistPlaybackUiReport
                      ? (payload) =>
                          onMediaPlaylistPlaybackUiReport(el.id, payload)
                      : undefined
                  }
                  mediaPlaylistRemoteCommand={mediaPlaylistRemoteCommand}
                  onPlaylistRemoteCommandConsumed={
                    onMediaPlaylistRemoteCommandConsumed
                  }
                />
              );
            }
            return (
              <BookDigitalClockWidgetOverlay
                key={el.id}
                el={el}
                scale={scale}
                mode={mode}
                isSelected={selectedIdSet.has(el.id)}
                liveFrame={frameLive}
              />
            );
          })}
        {mode === "edit" && inlineTextEdit
          ? (() => {
              const tel = elements.find(
                (e): e is Extract<BookCanvasElement, { type: "text" }> =>
                  e.id === inlineTextEdit.id && e.type === "text",
              );
              if (!tel) return null;
              const tw = tel.width ?? 720;
              const th = textWidgetHitHeight(tel);
              const textLive = overlayLiveFrame(
                tel.id,
                dragLive,
                transformLive,
                {
                  w: tw,
                  h: th,
                  rotation: resolveBookElementRotation(tel.rotation),
                },
              );
              return (
                <BookTextWidgetInlineEditor
                  ref={inlineTextEditorRef}
                  key={`inline-${inlineTextEdit.id}`}
                  el={tel}
                  scale={scale}
                  liveFrame={textLive}
                  initialDisplayHtml={inlineTextEdit.initialHtml}
                  onCommit={(patch) => {
                    onElementChange(inlineTextEdit.id, patch);
                    setInlineTextEdit(null);
                  }}
                  onCancel={() => setInlineTextEdit(null)}
                  onReportLogicalHeight={(logical) => {
                    const next = nextTextWidgetHeightGrowOnly(
                      logical,
                      tel.height,
                      tel.fontSize,
                    );
                    if (next == null) return;
                    scheduleTextBoxHeight(tel.id, next);
                  }}
                />
              );
            })()
          : null}
      </div>
      {zMenu && mode === "edit"
        ? createPortal(
            <ContextMenuFloatingPanel
              ref={zMenuRef}
              className="z-[320] flex min-w-[11rem] flex-col gap-0.5"
              style={{
                position: "fixed",
                left: Math.min(
                  zMenu.x,
                  typeof window !== "undefined"
                    ? Math.max(8, window.innerWidth - 200)
                    : zMenu.x,
                ),
                top: Math.min(
                  zMenu.y,
                  typeof window !== "undefined"
                    ? Math.max(8, window.innerHeight - 400)
                    : zMenu.y,
                ),
              }}
            >
              <div
                className="flex flex-col gap-0.5"
                role="group"
                aria-label="크기"
              >
                <ContextMenuFloatingItem onClick={() => applyFitToStage()}>
                  슬라이드 전체(0,0)로 맞추기
                </ContextMenuFloatingItem>
              </div>
              {(() => {
                const zTarget = elements.find((e) => e.id === zMenu.elementId);
                const mk =
                  zTarget?.type === "image"
                    ? ("image" as const)
                    : zTarget?.type === "video"
                      ? ("video" as const)
                      : null;
                const showFile = mk && onRequestReplaceMediaFromFile;
                const showLib =
                  mk &&
                  mediaLibraryReplaceEnabled &&
                  onRequestPickLibraryMediaForReplace;
                if (!showFile && !showLib) return null;
                return (
                  <>
                    <div
                      className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                      role="separator"
                      aria-hidden="true"
                    />
                    <div
                      className="flex flex-col gap-0.5"
                      role="group"
                      aria-label="미디어 교체"
                    >
                      {showFile ? (
                        <ContextMenuFloatingItem
                          onClick={() => {
                            onRequestReplaceMediaFromFile?.({
                              elementId: zMenu.elementId,
                              kind: mk,
                            });
                            setZMenu(null);
                          }}
                        >
                          <FolderOpen className="opacity-70" aria-hidden />
                          파일에서 바꾸기…
                        </ContextMenuFloatingItem>
                      ) : null}
                      {showLib ? (
                        <ContextMenuFloatingItem
                          onClick={() => {
                            onRequestPickLibraryMediaForReplace?.({
                              elementId: zMenu.elementId,
                            });
                            setZMenu(null);
                          }}
                        >
                          <Library className="opacity-70" aria-hidden />
                          미디어 라이브러리에서 바꾸기…
                        </ContextMenuFloatingItem>
                      ) : null}
                    </div>
                  </>
                );
              })()}
              {(() => {
                const zPl = elements.find((e) => e.id === zMenu.elementId);
                if (zPl?.type !== "mediaPlaylist") return null;
                const showFile = onRequestPlaylistAppendFromFile;
                const showLib =
                  mediaLibraryReplaceEnabled &&
                  onRequestPlaylistAppendFromLibrary;
                if (!showFile && !showLib) return null;
                return (
                  <>
                    <div
                      className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                      role="separator"
                      aria-hidden="true"
                    />
                    <div
                      className="flex flex-col gap-0.5"
                      role="group"
                      aria-label="미디어 목록"
                    >
                      {showFile ? (
                        <ContextMenuFloatingItem
                          onClick={() => {
                            onRequestPlaylistAppendFromFile?.(zMenu.elementId);
                            setZMenu(null);
                          }}
                        >
                          <FolderOpen className="opacity-70" aria-hidden />
                          파일에서 미디어 추가…
                        </ContextMenuFloatingItem>
                      ) : null}
                      {showLib ? (
                        <ContextMenuFloatingItem
                          onClick={() => {
                            onRequestPlaylistAppendFromLibrary?.(
                              zMenu.elementId,
                            );
                            setZMenu(null);
                          }}
                        >
                          <Library className="opacity-70" aria-hidden />
                          라이브러리에서 미디어 추가…
                        </ContextMenuFloatingItem>
                      ) : null}
                    </div>
                  </>
                );
              })()}
              {onReorderZ || onDeleteElement ? (
                <div
                  className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                  role="separator"
                  aria-hidden="true"
                />
              ) : null}
              {onReorderZ
                ? (() => {
                    const zi = elements.findIndex(
                      (e) => e.id === zMenu.elementId,
                    );
                    const n = elements.length;
                    return (
                      <div
                        className="flex flex-col gap-0.5"
                        role="group"
                        aria-label="순서"
                      >
                        <ContextMenuFloatingItem
                          disabled={zi < 0 || zi >= n - 1}
                          onClick={() => applyZ("forward")}
                        >
                          한 칸 앞으로
                        </ContextMenuFloatingItem>
                        <ContextMenuFloatingItem
                          disabled={zi <= 0}
                          onClick={() => applyZ("backward")}
                        >
                          한 칸 뒤로
                        </ContextMenuFloatingItem>
                        <ContextMenuFloatingItem
                          disabled={zi < 0 || zi >= n - 1}
                          onClick={() => applyZ("front")}
                        >
                          맨 앞으로
                        </ContextMenuFloatingItem>
                        <ContextMenuFloatingItem
                          disabled={zi <= 0}
                          onClick={() => applyZ("back")}
                        >
                          맨 뒤로
                        </ContextMenuFloatingItem>
                      </div>
                    );
                  })()
                : null}
              {onReorderZ && onDeleteElement ? (
                <div
                  className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                  role="separator"
                  aria-hidden="true"
                />
              ) : null}
              {onDeleteElement ? (
                <div
                  className="flex flex-col gap-0.5"
                  role="group"
                  aria-label="편집"
                >
                  <ContextMenuFloatingItem
                    variant="destructive"
                    onClick={() => applyDelete()}
                  >
                    위젯 지우기
                  </ContextMenuFloatingItem>
                </div>
              ) : null}
            </ContextMenuFloatingPanel>,
            document.body,
          )
        : null}
    </div>
  );
}

function BookShapeHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "shape" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const basePivot = bookElementPivotKonva(el);
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = el.width;
  let fh = el.height;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const ox = -fw / 2;
  const oy = -fh / 2;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const chromeBr = resolveBookElementBorderRadius(el);
  const chromeOw = resolveBookElementOutlineWidth(el);
  const chromeOc = resolveBookElementOutlineColor(el);
  const showKonvaChromeOutline = mode === "edit" && chromeOw > 0;
  const innerCr =
    el.shapeKind === "rect" || el.shapeKind === "roundRect"
      ? Math.min(Math.max(0, el.cornerRadius ?? 0), fw / 2, fh / 2)
      : 0;
  const rawShapeSw = Number(el.strokeWidth);
  const strokeW = Number.isFinite(rawShapeSw)
    ? Math.min(32, Math.max(0, Math.round(rawShapeSw)))
    : 3;
  const fill =
    el.fill?.trim() && el.fill.trim() !== "transparent" ? el.fill : undefined;
  const stroke =
    strokeW > 0
      ? el.stroke?.trim()
        ? el.stroke.trim()
        : "#1e293b"
      : undefined;

  const shapeBody = (() => {
    if (
      (el.shapeKind === "line" ||
        el.shapeKind === "arrow" ||
        el.shapeKind === "cross") &&
      strokeW <= 0
    ) {
      return null;
    }
    switch (el.shapeKind) {
      case "rect":
      case "roundRect":
        return (
          <Rect
            x={ox}
            y={oy}
            width={fw}
            height={fh}
            cornerRadius={innerCr}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      case "ellipse":
        return (
          <Ellipse
            x={0}
            y={0}
            radiusX={fw / 2}
            radiusY={fh / 2}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      case "line":
        return (
          <Line
            points={[ox, 0, ox + fw, 0]}
            stroke={stroke}
            strokeWidth={strokeW}
            lineCap="round"
            listening={false}
          />
        );
      case "triangle":
        return (
          <Line
            points={[0, oy, ox + fw, oy + fh, ox, oy + fh]}
            closed
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            lineJoin="round"
            listening={false}
          />
        );
      case "rightTriangle":
        return (
          <Line
            points={[ox, -oy, -ox, -oy, ox, oy]}
            closed
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            lineJoin="round"
            listening={false}
          />
        );
      case "arrow": {
        const ptr = Math.min(18, Math.max(8, fw * 0.12));
        return (
          <Arrow
            points={[ox, 0, ox + fw, 0]}
            stroke={stroke}
            strokeWidth={strokeW}
            fill={stroke}
            pointerLength={ptr}
            pointerWidth={Math.min(16, ptr * 1.2)}
            lineCap="round"
            listening={false}
          />
        );
      }
      case "chevron": {
        const inset = fw * 0.38;
        return (
          <Line
            points={[ox, oy, ox + inset, oy, -ox, 0, ox + inset, -oy, ox, -oy]}
            closed
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            lineJoin="round"
            listening={false}
          />
        );
      }
      case "star": {
        const r = Math.min(fw, fh);
        return (
          <Star
            x={0}
            y={0}
            numPoints={5}
            innerRadius={r * 0.22}
            outerRadius={r * 0.48}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      }
      case "diamond":
        return (
          <Line
            points={[0, oy, -ox, 0, 0, -oy, ox, 0]}
            closed
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            lineJoin="round"
            listening={false}
          />
        );
      case "hexagon":
        return (
          <RegularPolygon
            x={0}
            y={0}
            sides={6}
            radius={Math.min(fw, fh) / 2}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      case "pentagon":
        return (
          <RegularPolygon
            x={0}
            y={0}
            sides={5}
            radius={Math.min(fw, fh) / 2}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      case "octagon":
        return (
          <RegularPolygon
            x={0}
            y={0}
            sides={8}
            radius={Math.min(fw, fh) / 2}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      case "trapezoid": {
        const inset = fw * 0.2;
        return (
          <Line
            points={[ox + inset, oy, -ox - inset, oy, -ox, -oy, ox, -oy]}
            closed
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            lineJoin="round"
            listening={false}
          />
        );
      }
      case "parallelogram": {
        const skew = fw * 0.28;
        return (
          <Line
            points={[ox + skew, oy, -ox + skew, oy, -ox, -oy, ox, -oy]}
            closed
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            lineJoin="round"
            listening={false}
          />
        );
      }
      case "ring": {
        const r = Math.min(fw, fh) / 2;
        return (
          <Ring
            x={0}
            y={0}
            innerRadius={Math.max(2, r * 0.5)}
            outerRadius={Math.max(4, r * 0.92)}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      }
      case "blockArc": {
        const r = Math.min(fw, fh) / 2;
        return (
          <Arc
            x={0}
            y={0}
            innerRadius={Math.max(3, r * 0.45)}
            outerRadius={Math.max(6, r * 0.96)}
            angle={250}
            rotation={-125}
            fill={fill ?? "transparent"}
            stroke={stroke}
            strokeWidth={strokeW}
            listening={false}
          />
        );
      }
      case "plus": {
        const t = Math.min(fw, fh) * 0.24;
        return (
          <>
            <Rect
              x={ox}
              y={-t / 2}
              width={fw}
              height={t}
              fill={fill ?? "transparent"}
              stroke={stroke}
              strokeWidth={strokeW}
              listening={false}
            />
            <Rect
              x={-t / 2}
              y={oy}
              width={t}
              height={fh}
              fill={fill ?? "transparent"}
              stroke={stroke}
              strokeWidth={strokeW}
              listening={false}
            />
          </>
        );
      }
      case "cross":
        return (
          <>
            <Line
              points={[ox, oy, -ox, -oy]}
              stroke={stroke}
              strokeWidth={strokeW}
              lineCap="round"
              listening={false}
            />
            <Line
              points={[-ox, oy, ox, -oy]}
              stroke={stroke}
              strokeWidth={strokeW}
              lineCap="round"
              listening={false}
            />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      clipFunc={(ctx) => {
        canvasRoundRectPath(ctx as never, ox, oy, fw, fh, chromeBr);
      }}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(
                el.id,
                e.target as Konva.Node,
                fw,
                fh,
              );
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                24,
                24,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      {shapeBody}
      {showKonvaChromeOutline ? (
        <Rect
          x={ox}
          y={oy}
          width={fw}
          height={fh}
          cornerRadius={chromeBr}
          fillEnabled={false}
          stroke={chromeOc}
          strokeWidth={chromeOw}
          listening={false}
        />
      ) : null}
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={ox}
        y={oy}
        width={fw}
        height={fh}
        cornerRadius={chromeBr}
        fill="rgba(0,0,0,0.01)"
      />
    </Group>
  );
}

function BookDrawingHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  isSelected,
  onSelect,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "drawing" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  isSelected: boolean;
  onSelect: (detail: BookCanvasSelectDetail) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const dOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva(el);
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let pivot = basePivot;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }

  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      rotation={pivot.rotation}
      opacity={dOpacity}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
    >
      <Rect
        width={fw}
        height={fh}
        fill="rgba(0,0,0,0.001)"
        stroke={isSelected && mode === "edit" ? "#3b82f6" : "transparent"}
        strokeWidth={2}
      />
      <Line
        points={el.points}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </Group>
  );
}

/** 리치 텍스트는 HTML 오버레이로 그리고, Konva Rect는 조작·히트만 담당합니다. */
function BookTextHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
  inlineTextEditing,
  onRequestInlineTextEdit,
}: {
  el: Extract<BookCanvasElement, { type: "text" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
  inlineTextEditing: boolean;
  onRequestInlineTextEdit: (elementId: string) => void;
}) {
  const w = el.width ?? 720;
  const h = textWidgetHitHeight(el);
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const tBr = resolveBookElementBorderRadius(el);
  const tOw = resolveBookElementOutlineWidth(el);
  const tOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && tOw > 0;
  const ox = -fw / 2;
  const oy = -fh / 2;
  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      draggable={mode === "edit" && !locked && !inlineTextEditing}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onDblClick={(e) => {
        if (mode !== "edit" || locked) return;
        e.cancelBubble = true;
        onRequestInlineTextEdit(el.id);
      }}
      onDblTap={(e) => {
        if (mode !== "edit" || locked) return;
        e.cancelBubble = true;
        onRequestInlineTextEdit(el.id);
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked || inlineTextEditing
          ? undefined
          : (e) => {
              liveSync.onDragLiveStart(el.id, e.target);
            }
      }
      onDragMove={
        locked
          ? undefined
          : (e) => {
              liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh);
            }
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                24,
                28,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={ox}
        y={oy}
        width={fw}
        height={fh}
        rotation={0}
        fill="transparent"
        cornerRadius={tBr}
        stroke={showKonvaOutline ? tOc : "transparent"}
        strokeWidth={showKonvaOutline ? tOw : 0}
      />
    </Group>
  );
}

const WEATHER_WIDGET_MIN_W = 160;
const WEATHER_WIDGET_MIN_H = 100;
const NEWS_WIDGET_MIN_W = 200;
const NEWS_WIDGET_MIN_H = 96;
const MEDIA_PLAYLIST_MIN_W = 160;
const MEDIA_PLAYLIST_MIN_H = 100;

const DIGITAL_CLOCK_MIN_W = 120;
const DIGITAL_CLOCK_MIN_H = 52;

function BookDigitalClockHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "digitalClock" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const dcBr = resolveBookElementBorderRadius(el);
  const dcOw = resolveBookElementOutlineWidth(el);
  const dcOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && dcOw > 0;
  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                DIGITAL_CLOCK_MIN_W,
                DIGITAL_CLOCK_MIN_H,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={-fw / 2}
        y={-fh / 2}
        width={fw}
        height={fh}
        rotation={0}
        fill="transparent"
        cornerRadius={dcBr}
        stroke={showKonvaOutline ? dcOc : "transparent"}
        strokeWidth={showKonvaOutline ? dcOw : 0}
      />
    </Group>
  );
}

function BookWeatherHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "weather" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const wBr = resolveBookElementBorderRadius(el);
  const wOw = resolveBookElementOutlineWidth(el);
  const wOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && wOw > 0;
  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                WEATHER_WIDGET_MIN_W,
                WEATHER_WIDGET_MIN_H,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={-fw / 2}
        y={-fh / 2}
        width={fw}
        height={fh}
        rotation={0}
        fill="transparent"
        cornerRadius={wBr}
        stroke={showKonvaOutline ? wOc : "transparent"}
        strokeWidth={showKonvaOutline ? wOw : 0}
      />
    </Group>
  );
}

function BookNewsHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "news" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const wBr = resolveBookElementBorderRadius(el);
  const wOw = resolveBookElementOutlineWidth(el);
  const wOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && wOw > 0;
  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                NEWS_WIDGET_MIN_W,
                NEWS_WIDGET_MIN_H,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={-fw / 2}
        y={-fh / 2}
        width={fw}
        height={fh}
        rotation={0}
        fill="transparent"
        cornerRadius={wBr}
        stroke={showKonvaOutline ? wOc : "transparent"}
        strokeWidth={showKonvaOutline ? wOw : 0}
      />
    </Group>
  );
}

function BookMediaPlaylistHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
  onMediaHoverEnter,
  onMediaHoverLeave,
}: {
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
  onMediaHoverEnter?: () => void;
  onMediaHoverLeave?: () => void;
}) {
  const w = el.width;
  const h = el.height;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const wBr = resolveBookElementBorderRadius(el);
  const wOw = resolveBookElementOutlineWidth(el);
  const wOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && wOw > 0;
  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      draggable={mode === "edit" && !locked}
      onMouseEnter={onMediaHoverEnter}
      onMouseLeave={onMediaHoverLeave}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                MEDIA_PLAYLIST_MIN_W,
                MEDIA_PLAYLIST_MIN_H,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={-fw / 2}
        y={-fh / 2}
        width={fw}
        height={fh}
        rotation={0}
        fill="transparent"
        cornerRadius={wBr}
        stroke={showKonvaOutline ? wOc : "transparent"}
        strokeWidth={showKonvaOutline ? wOw : 0}
      />
    </Group>
  );
}

function BookImageShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "image" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const img = useBookImage(el.src);
  const basePivot = bookElementPivotKonva(el);
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  const fw = tf ? tf.width : el.width;
  const fh = tf ? tf.height : el.height;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const ox = -fw / 2;
  const oy = -fh / 2;
  const layout = useMemo(
    () =>
      img
        ? computeKonvaFittedImageLayout(
            el.objectFit,
            fw,
            fh,
            img.naturalWidth,
            img.naturalHeight,
          )
        : null,
    [img, el.objectFit, fw, fh],
  );
  const imgOpacity = resolveBookElementOpacity(el.opacity);
  const imgBr = resolveBookElementBorderRadius(el);
  const imgOw = resolveBookElementOutlineWidth(el);
  const imgOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && imgOw > 0;

  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={imgOpacity}
      clipFunc={(ctx) => {
        canvasRoundRectPath(ctx as never, ox, oy, fw, fh, imgBr);
      }}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(
                el.id,
                e.target as Konva.Node,
                fw,
                fh,
              );
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                24,
                24,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      {img && layout ? (
        <KonvaImage
          image={img}
          x={ox + layout.x}
          y={oy + layout.y}
          width={layout.width}
          height={layout.height}
          {...(layout.crop ? { crop: layout.crop } : {})}
          listening={false}
        />
      ) : (
        <Rect
          x={ox}
          y={oy}
          width={fw}
          height={fh}
          cornerRadius={imgBr}
          fill="#e5e7eb"
          stroke={mode === "edit" ? "#94a3b8" : "transparent"}
          strokeWidth={mode === "edit" ? 1 : 0}
          listening={false}
        />
      )}
      {showKonvaOutline ? (
        <Rect
          x={ox}
          y={oy}
          width={fw}
          height={fh}
          cornerRadius={imgBr}
          fillEnabled={false}
          stroke={imgOc}
          strokeWidth={imgOw}
          listening={false}
        />
      ) : null}
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={ox}
        y={oy}
        width={fw}
        height={fh}
        cornerRadius={imgBr}
        fill="rgba(0,0,0,0.01)"
      />
    </Group>
  );
}

function BookVideoBox({
  el,
  htmlVideoEl,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  onVideoHoverEnter,
  onVideoHoverLeave,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "video" }>;
  htmlVideoEl: HTMLVideoElement | null;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onVideoHoverEnter: () => void;
  onVideoHoverLeave: () => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const [, setVideoDimGen] = useState(0);
  const [videoFrameReady, setVideoFrameReady] = useState(false);

  const posterSrcKey = el.posterSrc?.trim() ?? "";
  const posterImg = useBookImage(posterSrcKey);

  useEffect(() => {
    const v = htmlVideoEl;
    if (!v) return;
    const markReady = () => {
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setVideoFrameReady(true);
      }
    };
    const raf = requestAnimationFrame(() => {
      setVideoFrameReady(false);
      markReady();
    });
    v.addEventListener("loadeddata", markReady);
    v.addEventListener("canplay", markReady);
    v.addEventListener("seeked", markReady);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("loadeddata", markReady);
      v.removeEventListener("canplay", markReady);
      v.removeEventListener("seeked", markReady);
    };
  }, [htmlVideoEl, el.src]);

  useEffect(() => {
    const v = htmlVideoEl;
    if (!v) return;
    const poke = () => setVideoDimGen((n) => n + 1);
    v.addEventListener("loadedmetadata", poke);
    queueMicrotask(poke);
    return () => v.removeEventListener("loadedmetadata", poke);
  }, [htmlVideoEl]);

  useEffect(() => {
    const v = htmlVideoEl;
    if (!v) return;
    let raf = 0;
    const draw = () => {
      groupRef.current?.getLayer()?.batchDraw();
    };
    const loop = () => {
      draw();
      if (!v.paused) raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      cancelAnimationFrame(raf);
      loop();
    };
    const onPause = () => {
      cancelAnimationFrame(raf);
      draw();
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", draw);
    v.addEventListener("loadeddata", draw);
    if (!v.paused) loop();
    else draw();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", draw);
      v.removeEventListener("loadeddata", draw);
    };
  }, [htmlVideoEl]);

  const vidOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva(el);
  const tf =
    liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  const fw = tf ? tf.width : el.width;
  const fh = tf ? tf.height : el.height;
  let gcx = basePivot.cx;
  let gcy = basePivot.cy;
  let grot = basePivot.rotation;
  if (tf) {
    gcx = tf.cx;
    gcy = tf.cy;
    grot = tf.rotation;
  } else if (dg) {
    gcx = dg.cx;
    gcy = dg.cy;
  }
  const ox = -fw / 2;
  const oy = -fh / 2;
  const iw = htmlVideoEl?.videoWidth ?? 0;
  const ih = htmlVideoEl?.videoHeight ?? 0;
  const layout = useMemo(
    () =>
      htmlVideoEl && iw > 0 && ih > 0
        ? computeKonvaFittedImageLayout(el.objectFit, fw, fh, iw, ih)
        : null,
    [htmlVideoEl, iw, ih, el.objectFit, fw, fh],
  );

  const posterLayout = useMemo(() => {
    if (
      !posterImg?.complete ||
      posterImg.naturalWidth <= 0 ||
      posterImg.naturalHeight <= 0
    ) {
      return null;
    }
    return computeKonvaFittedImageLayout(
      el.objectFit,
      fw,
      fh,
      posterImg.naturalWidth,
      posterImg.naturalHeight,
    );
  }, [posterImg, el.objectFit, fw, fh]);

  const showPoster = Boolean(posterLayout && posterImg);
  const showVideoTexture = Boolean(layout && htmlVideoEl && videoFrameReady);

  const vBr = resolveBookElementBorderRadius(el);
  const vOw = resolveBookElementOutlineWidth(el);
  const vOc = resolveBookElementOutlineColor(el);
  const showKonvaOutline = mode === "edit" && vOw > 0;
  const videoEditGuide = mode === "edit" && vOw <= 0;

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        registerKonvaNode(el.id, node);
      }}
      x={gcx}
      y={gcy}
      rotation={grot}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={vidOpacity}
      clipFunc={(ctx) => {
        canvasRoundRectPath(ctx as never, ox, oy, fw, fh, vBr);
      }}
      draggable={mode === "edit" && !locked}
      onMouseEnter={onVideoHoverEnter}
      onMouseLeave={onVideoHoverLeave}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked
          ? undefined
          : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(
                el.id,
                e.target as Konva.Node,
                fw,
                fh,
              );
            }
      }
      onTransformStart={
        locked
          ? undefined
          : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked
          ? undefined
          : (e) => {
              bakeKonvaBookWidgetGroupDuringTransform(e.target as Konva.Group);
              liveSync.onTransformLiveMove(el.id, e.target);
            }
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              commitBookWidgetHitShellTransformEnd(
                e,
                el.id,
                24,
                24,
                liveSync,
                onElementChange,
              );
            }
      }
    >
      {showPoster ? (
        <KonvaImage
          image={posterImg!}
          x={ox + posterLayout!.x}
          y={oy + posterLayout!.y}
          width={posterLayout!.width}
          height={posterLayout!.height}
          {...(posterLayout!.crop ? { crop: posterLayout!.crop } : {})}
          listening={false}
        />
      ) : null}
      {showVideoTexture ? (
        <KonvaImage
          image={htmlVideoEl!}
          x={ox + layout!.x}
          y={oy + layout!.y}
          width={layout!.width}
          height={layout!.height}
          {...(layout!.crop ? { crop: layout!.crop } : {})}
          listening={false}
        />
      ) : !showPoster ? (
        <Rect
          x={ox}
          y={oy}
          width={fw}
          height={fh}
          cornerRadius={vBr}
          fill="#0f172a"
          stroke={mode === "edit" ? "#475569" : "transparent"}
          strokeWidth={mode === "edit" ? 1 : 0}
          listening={false}
        />
      ) : null}
      {showKonvaOutline ? (
        <Rect
          x={ox}
          y={oy}
          width={fw}
          height={fh}
          cornerRadius={vBr}
          fillEnabled={false}
          stroke={vOc}
          strokeWidth={vOw}
          listening={false}
        />
      ) : null}
      <Rect
        name={KONVA_BOOK_WIDGET_HIT_RECT_NAME}
        x={ox}
        y={oy}
        width={fw}
        height={fh}
        cornerRadius={vBr}
        fill="rgba(0,0,0,0.01)"
        stroke={
          showKonvaOutline
            ? "transparent"
            : videoEditGuide
              ? "#cbd5e1"
              : "transparent"
        }
        strokeWidth={showKonvaOutline ? 0 : videoEditGuide ? 1 : 0}
      />
    </Group>
  );
}
