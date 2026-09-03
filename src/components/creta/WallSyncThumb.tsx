"use client";

// 비디오월 동기 재생 미니 썸네일 — 목록 카드용.
// 상세의 동기 미리보기와 같은 공통 클록(Date.now/slideSec)을 쓰므로
// 목록·상세·다른 창이 모두 같은 박자로 페이지가 넘어간다(컨트롤 없음).
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
} from "@/features/book/book-canvas";
import { useBookPageThumbnails } from "@/features/book/use-book-page-thumbnails";
import { type CretaVideoWall } from "@/features/creta/creta-walls-api";
import { type BookDetail, fetchBook } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";

export function WallSyncThumb({ wall }: { wall: CretaVideoWall }) {
  const bookIds = useMemo(() => {
    if (wall.mode === "multi") {
      return [
        ...new Set(
          wall.members
            .map((m) => m.bookId)
            .filter((n): n is number => n != null),
        ),
      ];
    }
    return wall.bookId != null ? [wall.bookId] : [];
  }, [wall]);
  const bookQueries = useQueries({
    queries: bookIds.map((id) => ({
      queryKey: bookKeys.detail(id),
      queryFn: () => fetchBook(id),
      staleTime: 30_000,
    })),
  });
  const booksById = useMemo(() => {
    const map = new Map<number, BookDetail>();
    bookIds.forEach((id, i) => {
      const data = bookQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- data 배열만 의존
  }, [bookIds, ...bookQueries.map((q) => q.data)]);

  const thumbSources = useMemo(() => {
    const out: {
      clientKey: string;
      backgroundColor: string;
      elements: BookDetail["pages"][number]["elements"];
      slideWidth?: number;
      slideHeight?: number;
    }[] = [];
    for (const [id, book] of booksById) {
      const pages = [...(book.pages ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      for (const p of pages) {
        out.push({
          clientKey: `wall-${id}-${p.id}`,
          backgroundColor:
            typeof p.backgroundColor === "string" && p.backgroundColor.trim()
              ? p.backgroundColor.trim()
              : DEFAULT_PAGE_BACKGROUND,
          elements: p.elements,
          slideWidth: book.slideWidth,
          slideHeight: book.slideHeight,
        });
      }
    }
    return out;
  }, [booksById]);
  const thumbs = useBookPageThumbnails(
    thumbSources,
    DEFAULT_SLIDE_WIDTH,
    DEFAULT_SLIDE_HEIGHT,
  );

  // 공통 클록 — 상세 미리보기와 같은 계산이라 같은 페이지가 보인다
  const slideMs = Math.max(3, wall.slideSec) * 1000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const index = Math.floor(now / slideMs);

  const pageThumbFor = (bookId: number | null): string | null => {
    if (bookId == null) return null;
    const book = booksById.get(bookId);
    const pages = book
      ? [...(book.pages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    if (pages.length === 0) return null;
    const i = ((index % pages.length) + pages.length) % pages.length;
    return thumbs[`wall-${bookId}-${pages[i].id}`] ?? null;
  };

  const gridCols =
    wall.mode === "tile"
      ? wall.cols
      : Math.min(
          3,
          Math.max(1, Math.ceil(Math.sqrt(wall.members.length || 1))),
        );
  const slots =
    wall.mode === "tile"
      ? Array.from({ length: wall.rows * wall.cols }, (_, i) => ({
          member: wall.members[i] ?? null,
          tile: { row: Math.floor(i / wall.cols), col: i % wall.cols },
        }))
      : wall.members.map((m) => ({ member: m, tile: null }));

  const empty =
    wall.members.length === 0 || (wall.mode !== "multi" && wall.bookId == null);

  return (
    <div
      className="grid gap-1 rounded-md bg-zinc-950 p-1.5"
      style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      data-testid="wall-card-preview"
    >
      {empty ? (
        <div className="col-span-full flex aspect-video items-center justify-center rounded-sm text-xs text-zinc-600">
          {wall.members.length === 0 ? "멤버 미지정" : "콘텐츠 미지정"}
        </div>
      ) : (
        slots.map((slot, i) => {
          const m = slot.member;
          const bookId =
            wall.mode === "multi" ? (m?.bookId ?? null) : wall.bookId;
          const url = pageThumbFor(bookId);
          return (
            <div
              key={m ? m.deviceId : `empty-${i}`}
              className="relative aspect-video overflow-hidden rounded-sm border border-zinc-700/80 bg-black"
            >
              {!m || !m.online || url == null ? (
                <span className="absolute inset-0 bg-zinc-900" aria-hidden />
              ) : slot.tile ? (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${url})`,
                    backgroundSize: `${wall.cols * 100}% ${wall.rows * 100}%`,
                    backgroundPosition: `${
                      wall.cols > 1
                        ? (slot.tile.col / (wall.cols - 1)) * 100
                        : 0
                    }% ${
                      wall.rows > 1
                        ? (slot.tile.row / (wall.rows - 1)) * 100
                        : 0
                    }%`,
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- 데이터 URL 썸네일
                <img
                  src={url}
                  alt=""
                  className="absolute inset-0 size-full object-fill"
                  draggable={false}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
