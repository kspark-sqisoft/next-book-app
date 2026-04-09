import { publicAssetUrl } from "@/lib/api";
import type { BookCanvasElement } from "@/lib/book-canvas";

/** Konva용 이미지 URL (에셋 베이스 적용) */
export function resolveBookImageUrl(src: string): string {
  return publicAssetUrl(src) ?? src;
}

const cache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement | null>>();

/** 디코드까지 끝난 캐시 항목만 반환 */
export function getBookImageIfReady(src: string): HTMLImageElement | null {
  const url = resolveBookImageUrl(src);
  if (!url) return null;
  const im = cache.get(url);
  if (im && im.complete && im.naturalWidth > 0) return im;
  return null;
}

/**
 * 슬라이드 캔버스용 이미지 로드. 동일 URL은 메모리 캐시·진행 중 요청을 공유합니다.
 */
export function loadBookImage(src: string): Promise<HTMLImageElement | null> {
  const url = resolveBookImageUrl(src);
  if (!url) return Promise.resolve(null);

  const hit = cache.get(url);
  if (hit && hit.complete && hit.naturalWidth > 0) {
    return Promise.resolve(hit);
  }

  const pending = inflight.get(url);
  if (pending) return pending;

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      cache.set(url, im);
      inflight.delete(url);
      resolve(im);
    };
    im.onerror = () => {
      inflight.delete(url);
      resolve(null);
    };
    im.src = url;
  });
  inflight.set(url, p);
  return p;
}

function collectImageSrcs(elements: BookCanvasElement[]): string[] {
  const out: string[] = [];
  for (const el of elements) {
    if (el.type === "image") out.push(el.src);
  }
  return out;
}

/**
 * 현재 슬라이드와 이전·다음 슬라이드의 이미지 위젯을 미리 로드해 페이지 전환 시 플래시를 줄입니다.
 */
export function warmBookCanvasImagesForNeighborPages(
  pages: Array<{ elements: BookCanvasElement[] }>,
  centerIndex: number,
): void {
  const n = pages.length;
  if (n === 0) return;
  const lo = Math.max(0, centerIndex - 1);
  const hi = Math.min(n - 1, centerIndex + 1);
  const seen = new Set<string>();
  for (let i = lo; i <= hi; i++) {
    for (const src of collectImageSrcs(pages[i]!.elements)) {
      if (seen.has(src)) continue;
      seen.add(src);
      void loadBookImage(src);
    }
  }
}
