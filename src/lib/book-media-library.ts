/**
 * (레거시) 북별 미디어 라이브러리 — 예전에는 업로드 URL 목록을 브라우저
 * localStorage에만 보관했다. 지금은 서버(book_media_item)에 저장하며,
 * 이 모듈은 남아 있는 로컬 목록을 서버로 1회 이관할 때만 쓰인다.
 */

export type BookMediaLibraryItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
  addedAt: number;
};

const PREFIX = "book-media-lib:v1:";

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
        o.posterSrc === null || typeof o.posterSrc === "string"
          ? o.posterSrc
          : null;
      const addedAt = typeof o.addedAt === "number" ? o.addedAt : 0;
      out.push({ id: o.id, kind: o.kind, src: o.src, posterSrc, addedAt });
    }
    return out.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

/** 서버 이관 완료 후 로컬 목록 제거 */
export function clearBookMediaLibrary(bookId: number): void {
  try {
    localStorage.removeItem(key(bookId));
  } catch {
    /* ignore */
  }
}
