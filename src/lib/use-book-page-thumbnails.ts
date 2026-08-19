import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  type BookSlideSnapshotPage,
  captureBookSlideToDataURL,
  pageSnapshotSignature,
} from "@/lib/book-slide-snapshot";
import {
  bookSlideThumbnailCacheKey,
  getBookSlideThumbnailCached,
  setBookSlideThumbnailCache,
} from "@/lib/book-slide-thumbnail-cache";

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
  // pages는 immer produce마다 새 참조 — effect 의존성에 넣으면 captureKey(내용 서명)가 무력화됨
  const pagesRef = useRef(pages);
  useLayoutEffect(() => {
    pagesRef.current = pages;
  });

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

  // 세션 캐시에 이미 있는 썸네일은 디바운스를 기다리지 않고 첫 렌더부터 보여준다 —
  // 목록 재진입 시 빈 카드가 잠깐 보였다가 채워지는 깜빡임 방지
  const cachedNow = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of pages) {
      const w = p.slideWidth ?? defaultSlideWidth;
      const h = p.slideHeight ?? defaultSlideHeight;
      const v = getBookSlideThumbnailCached(
        bookSlideThumbnailCacheKey(p, w, h),
      );
      if (v !== undefined) out[p.clientKey] = v;
    }
    return out;
  }, [pages, defaultSlideWidth, defaultSlideHeight]);

  useEffect(() => {
    let cancelled = false;
    const pagesNow = pagesRef.current;
    const validKeys = new Set(pagesNow.map((p) => p.clientKey));

    const id = window.setTimeout(() => {
      void (async () => {
        const updates: Record<string, string> = {};

        for (const p of pagesNow) {
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
  }, [captureKey, defaultSlideWidth, defaultSlideHeight]);

  // 비동기 캡처 결과(state)가 캐시 스냅샷보다 최신이므로 우선한다
  return useMemo(
    () => ({ ...cachedNow, ...thumbnails }),
    [cachedNow, thumbnails],
  );
}
