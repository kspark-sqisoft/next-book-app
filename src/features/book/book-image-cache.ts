import type { BookCanvasElement } from "@/features/book/book-canvas";
import { publicAssetUrl } from "@/lib/api";

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
 * 한 슬라이드의 이미지 위젯을 전부 디코드까지 마친 뒤 resolve — 첫 화면을 열 때 이미지가
 * 하나씩 튀어나오지 않게 "다 준비되면 한 번에" 보여 주기 위한 것.
 *
 * `timeoutMs` 를 넘기면 그냥 resolve 한다. 느린 이미지 하나 때문에 슬라이드쇼 전체가
 * 검은 화면으로 기다리는 것보다, 늦은 것만 뒤에 나타나는 편이 낫다.
 */
export function preloadBookCanvasImages(
  elements: BookCanvasElement[],
  timeoutMs = 1200,
): Promise<void> {
  const srcs = Array.from(new Set(collectImageSrcs(elements).filter(Boolean)));
  if (srcs.length === 0) return Promise.resolve();
  const all = Promise.all(srcs.map((s) => loadBookImage(s))).then(
    () => undefined,
  );
  const cap = new Promise<void>((r) => setTimeout(r, timeoutMs));
  return Promise.race([all, cap]);
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
