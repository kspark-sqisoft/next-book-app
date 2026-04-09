import type { BookCanvasElement, BookEditorPageState } from "@/lib/book-canvas";
import {
  resolveEffectivePresentationTimingElementId,
  resolveMediaPlaylistImageDurationSec,
} from "@/lib/book-canvas";

/** 미디어(플레이리스트) 위젯 제외 위젯·페이지 기본 체류 초(표시 시간 미지정 시) */
export const DEFAULT_WIDGET_PRESENTATION_SEC = 10;

/** 미리보기: 시간 기준 레이어가 없을 때 페이지 전체 기본 초 */
export const DEFAULT_PRESENTATION_SLIDE_SEC = DEFAULT_WIDGET_PRESENTATION_SEC;

/** 플레이리스트 내 동영상 항목 — 메타 없을 때 합산용 추정 초 */
export const DEFAULT_PRESENTATION_PLAYLIST_VIDEO_ESTIMATE_SEC = 10;

export function computeMediaPlaylistPresentationDurationSec(
  el: Extract<BookCanvasElement, { type: "mediaPlaylist" }>,
): number {
  const items = el.mediaPlaylistItems ?? [];
  let total = 0;
  for (const it of items) {
    if (it.kind === "image") {
      total += resolveMediaPlaylistImageDurationSec(it);
    } else {
      total += DEFAULT_PRESENTATION_PLAYLIST_VIDEO_ESTIMATE_SEC;
    }
  }
  return Math.max(1, total);
}

/** 플레이리스트 제외 위젯: 저장된 표시 초 또는 기본 10초 */
export function resolveNonPlaylistPresentationHoldSec(
  el: Exclude<BookCanvasElement, { type: "mediaPlaylist" }>,
): number {
  const h = el.presentationHoldSec;
  if (typeof h === "number" && h >= 1 && h <= 3600) return h;
  return DEFAULT_WIDGET_PRESENTATION_SEC;
}

/** 레이어 목록·툴팁용: 이 레이어가 시간 기준일 때 쓰이는 초(대략) */
export function displayLayerPresentationSec(
  el: BookCanvasElement,
  opts?: { videoDurationSecById?: Record<string, number> },
): number {
  if (el.type === "mediaPlaylist") {
    return computeMediaPlaylistPresentationDurationSec(el);
  }
  if (el.type === "video") {
    const d = opts?.videoDurationSecById?.[el.id];
    if (typeof d === "number" && Number.isFinite(d) && d > 0) {
      return Math.max(1, Math.min(3600, Math.ceil(d)));
    }
  }
  return resolveNonPlaylistPresentationHoldSec(
    el as Exclude<BookCanvasElement, { type: "mediaPlaylist" }>,
  );
}

export type ComputeSlidePresentationDurationOpts = {
  /** 단일 동영상 위젯이 시간 기준일 때, 메타로 알려진 길이(초) */
  videoDurationSecById?: Record<string, number>;
};

/**
 * 한 페이지가 미리보기에서 머무는 시간(초).
 * 시간 기준 레이어가 미디어 플레이리스트면 항목 시간 합, 아니면 `presentationHoldSec` 또는 기본값.
 */
export function computeSlidePresentationDurationSec(
  page: Pick<BookEditorPageState, "elements" | "presentationTimingElementId">,
  opts?: ComputeSlidePresentationDurationOpts,
): number {
  const id = resolveEffectivePresentationTimingElementId(
    page.elements,
    page.presentationTimingElementId,
  );
  if (!id) return DEFAULT_PRESENTATION_SLIDE_SEC;
  const el = page.elements.find((e) => e.id === id);
  if (!el) return DEFAULT_PRESENTATION_SLIDE_SEC;
  if (el.type === "mediaPlaylist") {
    return computeMediaPlaylistPresentationDurationSec(el);
  }
  if (el.type === "video") {
    const d = opts?.videoDurationSecById?.[el.id];
    if (typeof d === "number" && Number.isFinite(d) && d > 0) {
      return Math.max(1, Math.min(3600, Math.ceil(d)));
    }
  }
  const hold = el.presentationHoldSec;
  if (typeof hold === "number" && hold >= 1 && hold <= 3600) return hold;
  return DEFAULT_WIDGET_PRESENTATION_SEC;
}
