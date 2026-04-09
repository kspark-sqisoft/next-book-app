import {
  ImageIcon,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Video,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";
import { publicAssetUrl } from "@/lib/api";
import {
  type BookCanvasElement,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  formatBookMediaClock,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveBookMediaObjectFit,
  resolveMediaPlaylistImageDurationSec,
  resolveMediaPlaylistLoop,
  resolveMediaPlaylistShowControls,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

export type BookMediaPlaylistPlaybackUiSnapshot = {
  index: number;
  paused: boolean;
  progress: number;
  currentSec: number;
  totalSec: number;
};

export type BookMediaPlaylistRemoteCommand = {
  targetId: string;
  kind: "prev" | "next" | "togglePause";
  seq: number;
};

type Props = {
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
  /** `진행 바·다음 버튼 표시`일 때만 사용 — 비디오 위젯과 같이 호버 시 표시 */
  barVisible?: boolean;
  onBarPointerEnter?: () => void;
  onBarPointerLeave?: () => void;
  /** 재생 중인 항목 인덱스(속성 패널 하이라이트) */
  onPlaybackIndexChange?: (elementId: string, index: number) => void;
  /** 선택된 위젯만 — 속성 패널 미니 컨트롤 동기화 */
  onPlaybackUiReport?: (payload: BookMediaPlaylistPlaybackUiSnapshot) => void;
  mediaPlaylistRemoteCommand?: BookMediaPlaylistRemoteCommand | null;
  onPlaylistRemoteCommandConsumed?: () => void;
};

function objectFitStyle(
  fit: ReturnType<typeof resolveBookMediaObjectFit>,
): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: fit,
  };
}

export function BookMediaPlaylistWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  liveFrame,
  barVisible = false,
  onBarPointerEnter,
  onBarPointerLeave,
  onPlaybackIndexChange,
  onPlaybackUiReport,
  mediaPlaylistRemoteCommand,
  onPlaylistRemoteCommandConsumed,
}: Props) {
  const items = el.mediaPlaylistItems ?? [];
  const loop = resolveMediaPlaylistLoop(el);
  const showControls = resolveMediaPlaylistShowControls(el);

  const reportRef = useRef(onPlaybackUiReport);
  const isSelectedRef = useRef(isSelected);
  const consumedRef = useRef(onPlaylistRemoteCommandConsumed);
  useLayoutEffect(() => {
    reportRef.current = onPlaybackUiReport;
  }, [onPlaybackUiReport]);
  useLayoutEffect(() => {
    isSelectedRef.current = isSelected;
  }, [isSelected]);
  useLayoutEffect(() => {
    consumedRef.current = onPlaylistRemoteCommandConsumed;
  }, [onPlaylistRemoteCommandConsumed]);
  const lastAppliedRemoteSeqRef = useRef(0);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timeUi, setTimeUi] = useState({ current: 0, total: 0 });

  const slideStartMsRef = useRef(0);
  const imageRemainingMsRef = useRef<number | null>(null);
  /** 이미지 슬라이드 일시정지 시점의 경과(ms) — 진행 표시 고정 */
  const imageElapsedMsAtPauseRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const clampedIndex = items.length > 0 ? Math.min(index, items.length - 1) : 0;
  const current = items.length > 0 ? items[clampedIndex] : null;

  const setPlaylistVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (!node || current?.kind !== "video") return;
      if (mode === "view" || !paused) {
        queueMicrotask(() => void node.play().catch(() => undefined));
      }
    },
    [current?.kind, mode, paused],
  );

  useEffect(() => {
    lastAppliedRemoteSeqRef.current = 0;
  }, [el.id]);

  const imageSlideDurationSec =
    current?.kind === "image"
      ? resolveMediaPlaylistImageDurationSec(current)
      : 0;

  useEffect(() => {
    onPlaybackIndexChange?.(el.id, clampedIndex);
  }, [el.id, clampedIndex, onPlaybackIndexChange]);

  /** 슬라이드(항목) 바뀔 때 이미지 타이머·진행 기준 초기화 */
  useEffect(() => {
    imageRemainingMsRef.current = null;
    imageElapsedMsAtPauseRef.current = 0;
    slideStartMsRef.current = Date.now();
    queueMicrotask(() => {
      setProgress(0);
    });
  }, [clampedIndex, current?.id]);

  /** 이미지 슬라이드 자동 넘김 */
  useEffect(() => {
    if (!current || current.kind !== "image" || paused) return;
    const totalMs = Math.max(1, imageSlideDurationSec * 1000);
    const ms = imageRemainingMsRef.current ?? totalMs;
    imageRemainingMsRef.current = null;
    slideStartMsRef.current = Date.now() - (totalMs - ms);

    const t = window.setTimeout(() => {
      setIndex((i) => {
        const len = items.length;
        if (len === 0) return 0;
        const base = Math.min(i, len - 1);
        const next = base + 1;
        if (next < len) return next;
        if (loop) return 0;
        return base;
      });
    }, ms);
    return () => window.clearTimeout(t);
  }, [
    current,
    current?.id,
    current?.kind,
    imageSlideDurationSec,
    items.length,
    loop,
    paused,
  ]);

  /** 동영상 일시정지/재생 */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || current?.kind !== "video") return;
    if (paused) {
      v.pause();
    } else {
      void v.play().catch(() => undefined);
    }
  }, [paused, current?.kind, current?.id]);

  /** 항목 전환 직후 ref/canplay 타이밍 보강(편집·보기 공통, 일시정지 중이면 생략) */
  useEffect(() => {
    if (current?.kind !== "video" || paused) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => void v.play().catch(() => undefined);
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
      queueMicrotask(tryPlay);
    else v.addEventListener("canplay", tryPlay, { once: true });
    return () => v.removeEventListener("canplay", tryPlay);
  }, [current?.id, current?.kind, paused]);

  /** 진행률·시간 표시 + 선택 시 속성 패널 동기화 */
  useEffect(() => {
    if (items.length === 0 || !current) return;
    const id = window.setInterval(() => {
      let p = 0;
      let curS = 0;
      let totS = 0;
      if (current.kind === "image") {
        const d = resolveMediaPlaylistImageDurationSec(current) * 1000;
        if (d <= 0) {
          if (isSelectedRef.current && reportRef.current) {
            reportRef.current({
              index: clampedIndex,
              paused,
              progress: 0,
              currentSec: 0,
              totalSec: 0,
            });
          }
          return;
        }
        if (paused) {
          const elapsed = imageElapsedMsAtPauseRef.current;
          p = Math.min(1, elapsed / d);
          curS = (p * d) / 1000;
          totS = d / 1000;
        } else {
          p = Math.min(1, (Date.now() - slideStartMsRef.current) / d);
          curS = (p * d) / 1000;
          totS = d / 1000;
        }
        setProgress(p);
        setTimeUi({ current: curS, total: totS });
      } else {
        const v = videoRef.current;
        if (v && Number.isFinite(v.duration) && v.duration > 0) {
          p = Math.min(1, v.currentTime / v.duration);
          curS = v.currentTime;
          totS = v.duration;
          setProgress(p);
          setTimeUi({ current: curS, total: totS });
        }
      }
      if (isSelectedRef.current && reportRef.current) {
        reportRef.current({
          index: clampedIndex,
          paused,
          progress: p,
          currentSec: curS,
          totalSec: totS,
        });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [current, current?.id, current?.kind, items.length, paused, clampedIndex]);

  const bumpSlideStart = useCallback(() => {
    slideStartMsRef.current = Date.now();
    imageRemainingMsRef.current = null;
    setProgress(0);
  }, []);

  const goNext = useCallback(() => {
    const len = items.length;
    setIndex((i) => {
      if (len === 0) return 0;
      const base = Math.min(i, len - 1);
      const next = base + 1;
      if (next < len) return next;
      if (loop) return 0;
      return base;
    });
    bumpSlideStart();
    setPaused(false);
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [bumpSlideStart, items.length, loop]);

  const goPrev = useCallback(() => {
    const len = items.length;
    setIndex((i) => {
      if (len === 0) return 0;
      const base = Math.min(i, len - 1);
      const prev = base - 1;
      if (prev >= 0) return prev;
      if (loop) return len - 1;
      return base;
    });
    bumpSlideStart();
    setPaused(false);
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [bumpSlideStart, items.length, loop]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (!p && current?.kind === "image") {
        const totalMs = resolveMediaPlaylistImageDurationSec(current) * 1000;
        const elapsed = Date.now() - slideStartMsRef.current;
        const clamped = Math.min(totalMs, Math.max(0, elapsed));
        imageRemainingMsRef.current = Math.max(0, totalMs - clamped);
        imageElapsedMsAtPauseRef.current = clamped;
      }
      return !p;
    });
  }, [current]);

  useEffect(() => {
    const cmd = mediaPlaylistRemoteCommand;
    if (!cmd || cmd.targetId !== el.id) return;
    if (cmd.seq <= lastAppliedRemoteSeqRef.current) return;
    lastAppliedRemoteSeqRef.current = cmd.seq;
    queueMicrotask(() => {
      if (cmd.kind === "prev") goPrev();
      else if (cmd.kind === "next") goNext();
      else if (cmd.kind === "togglePause") togglePause();
      consumedRef.current?.();
    });
  }, [mediaPlaylistRemoteCommand, el.id, goPrev, goNext, togglePause]);

  const w = el.width;
  const h = el.height;
  const o = resolveBookElementOpacity(el.opacity);
  const rot = resolveBookElementRotation(el.rotation);
  const pivot = bookElementPivotKonva({
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    rotation: el.rotation,
  });
  const layoutOrigin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? layoutOrigin.x;
  const fy = liveFrame?.y ?? layoutOrigin.y;
  const fw = liveFrame?.width ?? w;
  const fh = liveFrame?.height ?? h;
  const fRot = liveFrame != null ? liveFrame.rotation : rot;

  const brPx = Math.max(0, resolveBookElementBorderRadius(el) * scale);
  const ow = resolveBookElementOutlineWidth(el);
  const oc = resolveBookElementOutlineColor(el);
  const outlineRing =
    mode === "edit" && ow > 0
      ? `0 0 0 ${Math.max(0.5, ow * scale)}px ${oc}`
      : "";

  const fit = current
    ? resolveBookMediaObjectFit(
        current.kind === "image" ? current.objectFit : current.objectFit,
      )
    : resolveBookMediaObjectFit(undefined);

  const imgSrc =
    current?.kind === "image"
      ? (publicAssetUrl(current.src) ?? current.src)
      : "";

  const videoSrc =
    current?.kind === "video"
      ? (publicAssetUrl(current.src) ?? current.src)
      : "";
  const videoPoster =
    current?.kind === "video" && current.posterSrc
      ? (publicAssetUrl(current.posterSrc) ?? current.posterSrc)
      : undefined;

  /** 빈 상태 힌트만 위젯 크기에 맞춤 — 컨트롤 바는 단일 비디오 위젯(BookSlideVideoOverlay)과 동일한 고정 높이·버튼 크기 */
  const emptyHintPx = Math.max(10 * scale, fh * scale * 0.032);
  const emptyIconPx = Math.max(14 * scale, fh * scale * 0.055);
  const videoBarProgressH = Math.max(3, Math.min(7, 36 * 0.22));
  const atFirst = items.length === 0 || (!loop && clampedIndex <= 0);
  const atLast =
    items.length === 0 || (!loop && clampedIndex >= items.length - 1);

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden bg-zinc-900",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: fx * scale,
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: brPx,
        boxShadow: outlineRing || "0 12px 32px -8px rgba(0,0,0,0.35)",
      }}
    >
      <div className="relative size-full">
        {items.length === 0 ? (
          <div
            className="flex size-full flex-col items-center justify-center px-3 text-center text-zinc-400"
            style={{ gap: Math.max(8, scale * 6), fontSize: emptyHintPx }}
          >
            <div className="flex items-center gap-2 opacity-80">
              <ImageIcon
                aria-hidden
                style={{ width: emptyIconPx, height: emptyIconPx }}
              />
              <Video
                aria-hidden
                style={{ width: emptyIconPx, height: emptyIconPx }}
              />
            </div>
            <p>
              우클릭·속성 패널에서 파일 또는 라이브러리로 미디어를 추가하세요.
            </p>
          </div>
        ) : current?.kind === "image" ? (
          <img
            alt=""
            src={imgSrc}
            draggable={false}
            className="absolute inset-0 size-full select-none"
            style={objectFitStyle(fit)}
          />
        ) : current?.kind === "video" ? (
          <video
            ref={setPlaylistVideoRef}
            key={current.id}
            className="absolute inset-0 size-full"
            style={objectFitStyle(fit)}
            src={videoSrc}
            poster={videoPoster}
            muted
            playsInline
            autoPlay
            preload="auto"
            controls={false}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (v && Number.isFinite(v.duration) && v.duration > 0) {
                setProgress(Math.min(1, v.currentTime / v.duration));
                setTimeUi({ current: v.currentTime, total: v.duration });
              }
            }}
            onEnded={() => {
              const len = items.length;
              setIndex((i) => {
                if (len === 0) return 0;
                const base = Math.min(i, len - 1);
                const next = base + 1;
                if (next < len) return next;
                if (loop) return 0;
                return base;
              });
            }}
          />
        ) : null}

        {showControls && items.length > 0 ? (
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
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15 disabled:opacity-35"
              aria-label="이전"
              disabled={atFirst}
              onClick={goPrev}
            >
              <SkipBack className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15"
              aria-label={paused ? "재생" : "일시정지"}
              onClick={togglePause}
            >
              {paused ? (
                <Play className="size-3.5 pl-0.5" aria-hidden />
              ) : (
                <Pause className="size-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15 disabled:opacity-35"
              aria-label="다음"
              disabled={atLast}
              onClick={goNext}
            >
              <SkipForward className="size-3.5" aria-hidden />
            </button>
            <div
              className="relative min-w-0 flex-1 rounded-full bg-white/15"
              style={{ height: videoBarProgressH }}
            >
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-sky-400/90"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-center font-mono text-[10px] tabular-nums leading-none text-white/80">
              {clampedIndex + 1}/{items.length}
            </span>
            <span className="shrink-0 text-right font-mono text-[10px] tabular-nums leading-none text-white/90">
              {formatBookMediaClock(timeUi.current)} /{" "}
              {formatBookMediaClock(timeUi.total)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
