/**
 * 북별 미디어 라이브러리 — 업로드된 URL 목록을 브라우저에만 보관(재배치용).
 * 실제 파일은 서버 `/books/:id/upload`와 동일합니다.
 */

export type BookMediaLibraryItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
  addedAt: number;
};

const PREFIX = "book-media-lib:v1:";
const MAX_ITEMS = 80;

export const BOOK_MEDIA_LIBRARY_CHANGED = "book-media-library-changed";

function key(bookId: number): string {
  return `${PREFIX}${bookId}`;
}

export function loadBookMediaLibrary(bookId: number): BookMediaLibraryItem[] {
  try {
    const raw = localStorage.getItem(key(bookId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: BookMediaLibraryItem[] = [];
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (o.kind !== "image" && o.kind !== "video") continue;
      if (typeof o.src !== "string" || o.src.length === 0) continue;
      if (typeof o.id !== "string") continue;
      const posterSrc =
        o.posterSrc === null || typeof o.posterSrc === "string" ? o.posterSrc : null;
      const addedAt = typeof o.addedAt === "number" ? o.addedAt : 0;
      out.push({ id: o.id, kind: o.kind, src: o.src, posterSrc, addedAt });
    }
    return out.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

function saveBookMediaLibrary(bookId: number, items: BookMediaLibraryItem[]): void {
  try {
    localStorage.setItem(key(bookId), JSON.stringify(items));
  } catch {
    /* quota */
  }
  window.dispatchEvent(
    new CustomEvent(BOOK_MEDIA_LIBRARY_CHANGED, { detail: { bookId } }),
  );
}

/** 목록 앞에 추가(최대 개수 유지) */
export function appendBookMediaLibraryItem(
  bookId: number,
  meta: { kind: "image" | "video"; src: string; posterUrl: string | null },
): void {
  const items = loadBookMediaLibrary(bookId);
  const item: BookMediaLibraryItem = {
    id: crypto.randomUUID(),
    kind: meta.kind,
    src: meta.src,
    posterSrc: meta.posterUrl,
    addedAt: Date.now(),
  };
  const dedup = items.filter((x) => x.src !== item.src);
  const next = [item, ...dedup].slice(0, MAX_ITEMS);
  saveBookMediaLibrary(bookId, next);
}

export function removeBookMediaLibraryItem(bookId: number, itemId: string): void {
  const items = loadBookMediaLibrary(bookId).filter((x) => x.id !== itemId);
  saveBookMediaLibrary(bookId, items);
}
