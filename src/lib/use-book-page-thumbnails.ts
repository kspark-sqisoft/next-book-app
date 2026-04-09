import { useEffect, useMemo, useRef, useState } from "react";
import {
  bookSlideThumbnailCacheKey,
  getBookSlideThumbnailCached,
  setBookSlideThumbnailCache,
} from "@/lib/book-slide-thumbnail-cache";
import {
  captureBookSlideToDataURL,
  pageSnapshotSignature,
  type BookSlideSnapshotPage,
} from "@/lib/book-slide-snapshot";

const DEBOUNCE_MS = 320;

type ThumbnailPageInput = BookSlideSnapshotPage & {
  clientKey: string;
  /** 생략 시 아래 `defaultSlideWidth`·`defaultSlideHeight` 사용(북마다 슬라이드 크기가 다를 때) */
  slideWidth?: number;
  slideHeight?: number;
};

/**
 * 각 슬라이드의 시각적 내용이 바뀌면(디바운스 후) PNG 데이터 URL 썸네일을 다시 만듭니다.
 * `clientKey`로 `Record` 키를 맞춥니다.
 */
export function useBookPageThumbnails(
  pages: ThumbnailPageInput[],
  defaultSlideWidth: number,
  defaultSlideHeight: number,
): Record<string, string> {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const sigRef = useRef<Record<string, string>>({});

  const captureKey = useMemo(
    () =>
      pages
        .map((p) => {
          const w = p.slideWidth ?? defaultSlideWidth;
          const h = p.slideHeight ?? defaultSlideHeight;
          return `${p.clientKey}:${w}x${h}:${pageSnapshotSignature(p)}`;
        })
        .join("\n"),
    [pages, defaultSlideWidth, defaultSlideHeight],
  );

  useEffect(() => {
    let cancelled = false;
    const validKeys = new Set(pages.map((p) => p.clientKey));

    const id = window.setTimeout(() => {
      void (async () => {
        const updates: Record<string, string> = {};

        for (const p of pages) {
          if (cancelled) return;
          const w = p.slideWidth ?? defaultSlideWidth;
          const h = p.slideHeight ?? defaultSlideHeight;
          const fullSig = `${w}x${h}:${pageSnapshotSignature(p)}`;
          if (sigRef.current[p.clientKey] === fullSig) continue;

          const cacheKey = bookSlideThumbnailCacheKey(p, w, h);
          const fromCache = getBookSlideThumbnailCached(cacheKey);
          if (fromCache) {
            sigRef.current[p.clientKey] = fullSig;
            updates[p.clientKey] = fromCache;
            continue;
          }

          let url: string | null = null;
          try {
            url = await captureBookSlideToDataURL(p, w, h);
          } catch {
            url = null;
          }
          if (cancelled || !url) continue;
          setBookSlideThumbnailCache(cacheKey, url);
          sigRef.current[p.clientKey] = fullSig;
          updates[p.clientKey] = url;
        }

        if (cancelled) return;

        setThumbnails((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (!validKeys.has(k)) delete next[k];
          }
          Object.assign(next, updates);
          return next;
        });
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [captureKey, pages, defaultSlideWidth, defaultSlideHeight]);

  return thumbnails;
}
