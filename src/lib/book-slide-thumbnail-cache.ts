import {
  type BookSlideSnapshotPage,
  pageSnapshotSignature,
} from "@/lib/book-slide-snapshot";

/** PNG data URL은 커서 항목 수를 제한합니다. */
const MAX_ENTRIES = 96;

const lru = new Map<string, string>();

/**
 * 북 슬라이드 썸네일(data URL) 세션 캐시.
 * 같은 해상도·같은 시각 서명이면 목록 재진입·무한 스크롤에서 Konva 캡처를 다시 하지 않습니다.
 */
export function bookSlideThumbnailCacheKey(
  page: BookSlideSnapshotPage,
  slideWidth: number,
  slideHeight: number,
): string {
  return `v1:${slideWidth}x${slideHeight}:${pageSnapshotSignature(page)}`;
}

export function getBookSlideThumbnailCached(key: string): string | undefined {
  const v = lru.get(key);
  if (v === undefined) return undefined;
  lru.delete(key);
  lru.set(key, v);
  return v;
}

export function setBookSlideThumbnailCache(key: string, dataUrl: string): void {
  if (lru.has(key)) lru.delete(key);
  lru.set(key, dataUrl);
  while (lru.size > MAX_ENTRIES) {
    const oldest = lru.keys().next().value;
    if (oldest === undefined) break;
    lru.delete(oldest);
  }
}
