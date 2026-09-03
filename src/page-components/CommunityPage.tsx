"use client";

// 크레타 > 커뮤니티: 모든 사용자의 북·플레이리스트 갤러리. 항목을 고르면 상단 재생 + 댓글 상세로 이동.
import { useQuery } from "@tanstack/react-query";
import {
  BookMarked,
  ListVideo,
  MessageSquare,
  Search,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import { CretaLikeButton } from "@/components/creta/CretaLikeButton";
import {
  CretaEmptyStateIcon,
  CretaSectionIcon,
} from "@/components/creta/CretaSectionIcon";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchPublicCretaPlaylists,
  sharedWithSummary,
} from "@/features/creta/creta-api";
import { fetchCretaCommentCounts } from "@/features/creta/creta-comments-api";
import { fetchCretaLikes } from "@/features/creta/creta-likes-api";
import { type BookListCoverPreview, fetchBooksPage } from "@/lib/api";
import { CARD_GRID_COLUMNS, GRID_CARD_HOVER } from "@/lib/card-hover";
import {
  type DateLike,
  formatDateMediumShort,
  toTimestamp,
} from "@/lib/format-date";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

type Filter = "all" | "book" | "playlist";

type GalleryItem = {
  kind: "book" | "playlist";
  id: number;
  title: string;
  subtitle: string;
  author: { id: number; name: string; imageUrl: string | null } | null;
  cover: BookListCoverPreview | null;
  /** 서버 액션은 Date를, JSON 경로는 문자열을 준다 — 한쪽으로 단정하지 않는다 */
  updatedAt: DateLike;
  /** 공유받은 사용자(이름) — 카드 "○○에게 공유됨" 표시용 */
  sharedWith: { id: number; name: string }[];
  /** 모든 사용자에게 공유 여부 */
  sharedToAll: boolean;
};

/** 라우트의 서버 프리페치와 같은 값이어야 한다 — 다르면 시드가 조용히 무시된다 */
export const COMMUNITY_BOOKS_TAKE = 60;

export function CommunityPage() {
  const { user } = useAuth();
  const viewerKey = user?.sub ?? "anon";
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const booksQuery = useQuery({
    queryKey: [...bookKeys.lists(), "community"],
    // 승인 워크플로: 커뮤니티 갤러리에는 게시(published)된 북만
    queryFn: () =>
      fetchBooksPage({ take: COMMUNITY_BOOKS_TAKE, publishedOnly: true }),
  });
  const playlistsQuery = useQuery({
    queryKey: cretaKeys.publicPlaylists(),
    queryFn: fetchPublicCretaPlaylists,
  });

  const items: GalleryItem[] = useMemo(() => {
    const books: GalleryItem[] = (booksQuery.data?.items ?? []).map((b) => ({
      kind: "book",
      id: b.id,
      title: b.title,
      subtitle: `페이지 ${b.pageCount}`,
      author: b.author,
      cover: b.coverPreview,
      updatedAt: b.updatedAt,
      sharedWith: b.sharedWith ?? [],
      sharedToAll: b.sharedToAll === true,
    }));
    const playlists: GalleryItem[] = (playlistsQuery.data ?? []).map((p) => ({
      kind: "playlist",
      id: p.id,
      title: p.name,
      subtitle: `크레타북 ${p.itemCount}개${p.description ? ` · ${p.description}` : ""}`,
      author: p.owner,
      cover: p.cover,
      updatedAt: p.updatedAt,
      sharedWith: p.sharedWith,
      sharedToAll: p.sharedToAll,
    }));
    const q = search.trim().toLowerCase();
    return [...books, ...playlists]
      .filter((it) => filter === "all" || it.kind === filter)
      .filter(
        (it) =>
          !q ||
          it.title.toLowerCase().includes(q) ||
          (it.author?.name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt));
  }, [booksQuery.data, playlistsQuery.data, filter, search]);

  const bookIds = useMemo(
    () => (booksQuery.data?.items ?? []).map((b) => b.id),
    [booksQuery.data],
  );
  const playlistIds = useMemo(
    () => (playlistsQuery.data ?? []).map((p) => p.id),
    [playlistsQuery.data],
  );
  const bookCounts = useQuery({
    queryKey: cretaKeys.commentCounts("book", bookIds),
    queryFn: () => fetchCretaCommentCounts("book", bookIds),
    enabled: bookIds.length > 0,
  });
  const playlistCounts = useQuery({
    queryKey: cretaKeys.commentCounts("playlist", playlistIds),
    queryFn: () => fetchCretaCommentCounts("playlist", playlistIds),
    enabled: playlistIds.length > 0,
  });
  const bookLikes = useQuery({
    queryKey: cretaKeys.likes("book", bookIds, viewerKey),
    queryFn: () => fetchCretaLikes("book", bookIds),
    enabled: bookIds.length > 0,
  });
  const playlistLikes = useQuery({
    queryKey: cretaKeys.likes("playlist", playlistIds, viewerKey),
    queryFn: () => fetchCretaLikes("playlist", playlistIds),
    enabled: playlistIds.length > 0,
  });

  const thumbEntries = useMemo(
    () =>
      items.map((it) => ({
        key: `community-${it.kind}-${it.id}`,
        cover: it.cover,
      })),
    [items],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);
  const loading = booksQuery.isLoading || playlistsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <CretaSectionIcon section="community" className="size-6" />
            커뮤니티
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            모든 사용자가 만든 북·플레이리스트를 둘러보고 댓글로 의견을 나눠
            보세요.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="book">북</TabsTrigger>
            <TabsTrigger value="playlist">플레이리스트</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="text"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목·작성자 검색…"
            className="h-9 pl-9"
            aria-label="커뮤니티 검색"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{items.length}</span>개
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CretaEmptyStateIcon section="community" />
            표시할 콘텐츠가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <ul className={CARD_GRID_COLUMNS}>
          {items.map((it) => {
            const count =
              it.kind === "book"
                ? (bookCounts.data?.[it.id] ?? 0)
                : (playlistCounts.data?.[it.id] ?? 0);
            const like =
              it.kind === "book"
                ? bookLikes.data?.[it.id]
                : playlistLikes.data?.[it.id];
            return (
              <li key={`${it.kind}-${it.id}`}>
                <Card className={`group h-full gap-3 py-4 ${GRID_CARD_HOVER}`}>
                  <CardContent className="space-y-3 px-4">
                    <Link
                      href={`/community/${it.kind}/${it.id}`}
                      className="block space-y-3 outline-none"
                      data-testid="community-item"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-lg">
                        <CretaCoverThumb
                          dataUrl={thumbs[`community-${it.kind}-${it.id}`]}
                          title={it.title}
                          className="absolute inset-0 size-full rounded-lg"
                        />
                        <Badge
                          variant="secondary"
                          className="absolute left-1.5 top-1.5 gap-1 text-[11px]"
                        >
                          {it.kind === "book" ? (
                            <BookMarked className="size-3" aria-hidden />
                          ) : (
                            <ListVideo className="size-3" aria-hidden />
                          )}
                          {it.kind === "book" ? "북" : "플레이리스트"}
                        </Badge>
                        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                          <CretaLikeButton
                            kind={it.kind}
                            targetId={it.id}
                            state={like}
                            variant="overlay"
                          />
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white"
                            aria-label={`댓글 ${count}개`}
                          >
                            <MessageSquare className="size-3" aria-hidden />
                            {count}
                          </span>
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold group-hover:text-primary">
                          {it.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {it.subtitle}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                          {it.author ? (
                            <AuthorAvatarInline author={it.author} size="xs" />
                          ) : (
                            <span>공용</span>
                          )}
                          <span>· {formatDateMediumShort(it.updatedAt)}</span>
                        </p>
                        {it.sharedToAll ? (
                          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-primary">
                            <Share2 className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">
                              모든 사용자에게 공유됨
                            </span>
                          </p>
                        ) : it.sharedWith.length > 0 ? (
                          <p
                            className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-primary"
                            title={it.sharedWith.map((u) => u.name).join(", ")}
                          >
                            <Share2 className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">
                              {sharedWithSummary(it.sharedWith)}에게 공유됨
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
