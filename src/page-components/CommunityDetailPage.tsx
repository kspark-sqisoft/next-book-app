"use client";

// 커뮤니티 상세: 상단에 슬라이드쇼(유튜브 플레이어처럼 iframe), 아래에 정보 + 2단 댓글.
// 플레이리스트는 오른쪽 목록에서 북을 골라 재생.
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  ListVideo,
  MonitorPlay,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CretaCommentsSection } from "@/components/creta/CretaCommentsSection";
import {
  CretaCoverThumb,
  useCretaCoverThumbs,
} from "@/components/creta/CretaCoverThumb";
import { CretaLikeButton } from "@/components/creta/CretaLikeButton";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { fetchBook } from "@/lib/api";
import { fetchPublicCretaPlaylist, sharedWithSummary } from "@/lib/creta-api";
import { fetchCretaLikes } from "@/lib/creta-likes-api";
import { formatDateMediumShort } from "@/lib/format-date";
import { goBackOrPush } from "@/lib/navigate-back";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

function PreviewFrame({ bookId, title }: { bookId: number; title: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-border">
      <iframe
        key={bookId}
        src={`/books/${bookId}/preview?embed=1`}
        title={`${title} 슬라이드쇼`}
        className="absolute inset-0 size-full border-0"
        allow="autoplay; fullscreen"
        allowFullScreen
        data-testid="community-player"
      />
    </div>
  );
}

export function CommunityDetailPage() {
  const params = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const kind = params.kind === "playlist" ? "playlist" : "book";
  const id = Number(params.id);
  const valid = Number.isFinite(id) && id > 0;

  const bookQuery = useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
    enabled: valid && kind === "book",
  });
  const playlistQuery = useQuery({
    queryKey: cretaKeys.publicPlaylist(id),
    queryFn: () => fetchPublicCretaPlaylist(id),
    enabled: valid && kind === "playlist",
  });
  const { user } = useAuth();
  const likeIds = useMemo(() => [id], [id]);
  const likeQuery = useQuery({
    queryKey: cretaKeys.likes(kind, likeIds, user?.sub ?? "anon"),
    queryFn: () => fetchCretaLikes(kind, likeIds),
    enabled: valid,
  });

  const playlistItems = useMemo(
    () => playlistQuery.data?.items ?? [],
    [playlistQuery.data],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  // 대상이 바뀌면 첫 항목부터 — 렌더 중 상태 조정(React 권장 패턴)
  const targetKey = `${kind}:${id}`;
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevTargetKey !== targetKey) {
    setPrevTargetKey(targetKey);
    setCurrentIndex(0);
  }
  const thumbEntries = useMemo(
    () =>
      playlistItems.map((it) => ({
        key: `community-pl-item-${it.itemId}`,
        cover: it.cover,
      })),
    [playlistItems],
  );
  const thumbs = useCretaCoverThumbs(thumbEntries);

  const loading =
    kind === "book" ? bookQuery.isLoading : playlistQuery.isLoading;
  const notFound =
    !valid ||
    (kind === "book"
      ? bookQuery.isError || (!loading && !bookQuery.data)
      : false) ||
    (kind === "playlist"
      ? playlistQuery.isError || (!loading && !playlistQuery.data)
      : false);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          콘텐츠를 찾을 수 없습니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/community">
            <ArrowLeft className="size-4" aria-hidden />
            커뮤니티로
          </Link>
        </Button>
      </div>
    );
  }

  const book = bookQuery.data;
  const playlist = playlistQuery.data;
  const current =
    playlistItems[Math.min(currentIndex, playlistItems.length - 1)];
  const title = kind === "book" ? (book?.title ?? "") : (playlist?.name ?? "");
  const playingBookId = kind === "book" ? id : (current?.bookId ?? null);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => goBackOrPush(router, "/community")}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        커뮤니티
      </button>

      <div
        className={cn(
          "grid gap-4",
          kind === "playlist" && "lg:grid-cols-[minmax(0,1fr)_300px]",
        )}
      >
        <div className="min-w-0 space-y-4">
          {playingBookId ? (
            <PreviewFrame bookId={playingBookId} title={title} />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              재생할 북이 없습니다.
            </div>
          )}

          <Card>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {kind === "book" ? "북" : "플레이리스트"}
                    </Badge>
                    <h1 className="font-heading text-xl font-bold">{title}</h1>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    {kind === "book" && book ? (
                      <>
                        <AuthorAvatarInline author={book.author} size="xs" />
                        <span>
                          · 페이지 {book.pages.length} ·{" "}
                          {formatDateMediumShort(book.updatedAt)}
                        </span>
                        {book.sharedToAll ? (
                          <span className="text-primary">
                            · 모든 사용자에게 공유됨
                          </span>
                        ) : (book.sharedUserIds?.length ?? 0) > 0 ? (
                          <span className="text-primary">
                            · 회원 {book.sharedUserIds?.length}명에게 공유됨
                          </span>
                        ) : null}
                      </>
                    ) : playlist ? (
                      <>
                        {playlist.owner ? (
                          <AuthorAvatarInline
                            author={playlist.owner}
                            size="xs"
                          />
                        ) : (
                          <span>공용</span>
                        )}
                        <span>
                          · 크레타북 {playlist.items.length}개
                          {playlist.description
                            ? ` · ${playlist.description}`
                            : ""}
                        </span>
                        {playlist.sharedToAll ? (
                          <span className="text-primary">
                            · 모든 사용자에게 공유됨
                          </span>
                        ) : playlist.sharedWith.length > 0 ? (
                          <span className="text-primary">
                            · {sharedWithSummary(playlist.sharedWith)}에게
                            공유됨
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CretaLikeButton
                    kind={kind}
                    targetId={id}
                    state={likeQuery.data?.[id]}
                    size="md"
                  />
                  {playingBookId ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/books/${playingBookId}/preview`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MonitorPlay className="size-4" aria-hidden />
                        미리보기
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={
                        kind === "book" ? `/books/${id}` : `/playlists/${id}`
                      }
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      {kind === "book" ? "북으로 이동" : "플레이리스트로 이동"}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <CretaCommentsSection kind={kind} targetId={id} />
            </CardContent>
          </Card>
        </div>

        {kind === "playlist" ? (
          <Card className="h-fit">
            <CardContent className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <ListVideo className="size-4" aria-hidden />
                재생 목록 {playlistItems.length}
              </p>
              {playlistItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  아직 담긴 북이 없습니다.
                </p>
              ) : (
                <ol className="space-y-1">
                  {playlistItems.map((it, i) => {
                    const active = i === currentIndex;
                    return (
                      <li key={it.itemId}>
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          onClick={() => setCurrentIndex(i)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors",
                            active
                              ? "bg-primary/10 ring-1 ring-primary/40"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                            {active ? (
                              <Play className="size-3" aria-hidden />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <CretaCoverThumb
                            dataUrl={thumbs[`community-pl-item-${it.itemId}`]}
                            title={it.title}
                            className="h-9 w-14 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {it.title}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              페이지 {it.pageCount}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
