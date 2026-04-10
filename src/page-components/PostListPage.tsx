"use client";

// 글 목록: 카테고리·검색·무한 스크롤, 좋아요 낙관적 캐시 키
import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { PostListItem } from "@/components/posts/PostListItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchPostsPage,
  type Post,
  POST_PAGE_DEFAULT,
  type PostLikeState,
  type PostsPageResponse,
} from "@/lib/api";
import { SITE_APP_MAIN_SCROLL_ID } from "@/lib/app-layout-scroll";
import { appLog } from "@/lib/app-log";
import {
  isPostCategoryId,
  POST_CATEGORY_LABELS,
  POST_CATEGORY_VALUES,
} from "@/lib/post-categories";
import { postKeys } from "@/lib/query-keys";
import { useAuth } from "@/stores/auth-store";

/** 뷰포트 하단에서 이 픽셀 안이면 “다음 페이지”로 간주 */
const NEAR_BOTTOM_PX = 280;

/** 하단 도달 후 실제 요청까지 대기(연속 스크롤 시 타이머 리셋) */
const LOAD_MORE_DEBOUNCE_MS = 400;

/** 검색어 입력 후 API 호출까지 대기 */
const SEARCH_DEBOUNCE_MS = 400;

export function PostListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const commitSearchParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mutate(p);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );
  const urlSearchRaw = searchParams.get("search") ?? "";
  const urlCategoryRaw =
    searchParams.get("category")?.trim().toLowerCase() ?? "";
  const categoryFilterParam = isPostCategoryId(urlCategoryRaw)
    ? urlCategoryRaw
    : "";

  const [loadMoreScheduled, setLoadMoreScheduled] = useState(false);
  const [likeActionError, setLikeActionError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(urlSearchRaw);
  const [searchQuery, setSearchQuery] = useState(urlSearchRaw.trim());

  const listQueryKey = postKeys.list(searchQuery, categoryFilterParam);

  const {
    data,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
  } = useInfiniteQuery({
    queryKey: listQueryKey,
    queryFn: async ({ pageParam }) => {
      const q = searchQuery || undefined;
      const res = await fetchPostsPage({
        cursor: pageParam,
        take: POST_PAGE_DEFAULT,
        search: q,
        ...(categoryFilterParam ? { category: categoryFilterParam } : {}),
      });
      appLog(
        "posts",
        pageParam == null ? "목록 초기 로드" : "목록 추가 로드(커서)",
        {
          received: res.items.length,
          hasMore: res.hasMore,
          total: res.total,
          search: q ?? "",
        },
      );
      return res;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
  });

  const posts: Post[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );
  const total = useMemo(() => data?.pages[0]?.total ?? null, [data]);
  const error =
    isError && queryError instanceof Error
      ? queryError.message
      : isError
        ? "목록을 불러오지 못했습니다."
        : null;

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  /** 직전에 디바운스로 URL을 바꾼 경우, URL→입력 동기화 effect를 한 번 건너뜀 */
  const skipUrlToStateSyncRef = useRef(false);

  const postsRef = useRef<Post[]>([]);
  const hasNextPageRef = useRef(false);
  const initialLoadingRef = useRef(false);
  /** 스크롤/휠/터치 전에는 추가 로드하지 않음 (첫 화면에서 감시 요소가 보여도 자동 연속 요청 방지) */
  const scrollArmedRef = useRef(false);

  const loadMoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const hasMore = Boolean(hasNextPage);

  const clearLoadMoreDebounce = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
      loadMoreDebounceRef.current = null;
    }
    setLoadMoreScheduled(false);
  }, [setLoadMoreScheduled]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQuery(trimmed);
      skipUrlToStateSyncRef.current = true;
      commitSearchParams((p) => {
        if (trimmed) p.set("search", trimmed);
        else p.delete("search");
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput, commitSearchParams]);

  /** 브라우저 뒤로가기 등으로 URL만 바뀐 때 입력·쿼리 복원 */
  useEffect(() => {
    if (skipUrlToStateSyncRef.current) {
      skipUrlToStateSyncRef.current = false;
      return;
    }
    startTransition(() => {
      setSearchQuery(urlSearchRaw.trim());
      setSearchInput(urlSearchRaw);
    });
  }, [urlSearchRaw]);

  useEffect(() => {
    startTransition(() => {
      clearLoadMoreDebounce();
    });
    scrollArmedRef.current = false;
  }, [searchQuery, categoryFilterParam, clearLoadMoreDebounce]);

  const runFetchNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const scheduleAppendPosts = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
    }
    setLoadMoreScheduled(true);
    loadMoreDebounceRef.current = setTimeout(() => {
      loadMoreDebounceRef.current = null;
      runFetchNextPage();
    }, LOAD_MORE_DEBOUNCE_MS);
  }, [runFetchNextPage, setLoadMoreScheduled]);

  const scheduleAppendPostsRef = useRef(scheduleAppendPosts);

  useLayoutEffect(() => {
    postsRef.current = posts;
    hasNextPageRef.current = Boolean(hasNextPage);
    initialLoadingRef.current = isPending;
    scheduleAppendPostsRef.current = scheduleAppendPosts;
  }, [posts, hasNextPage, isPending, scheduleAppendPosts]);

  useEffect(() => {
    return () => {
      if (loadMoreDebounceRef.current) {
        clearTimeout(loadMoreDebounceRef.current);
        loadMoreDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFetchingNextPage) {
      startTransition(() => setLoadMoreScheduled(false));
    }
  }, [isFetchingNextPage]);

  const onLikeApplied = useCallback(
    (postId: number, state: PostLikeState) => {
      queryClient.setQueryData<InfiniteData<PostsPageResponse>>(
        listQueryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      likeCount: state.likeCount,
                      likedByMe: state.likedByMe,
                    }
                  : p,
              ),
            })),
          };
        },
      );
    },
    [queryClient, listQueryKey],
  );

  useEffect(() => {
    const scrollRoot = () => document.getElementById(SITE_APP_MAIN_SCROLL_ID);

    const scrollMetrics = () => {
      const el = scrollRoot();
      if (el) {
        return {
          scrollHeight: el.scrollHeight,
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
        } as const;
      }
      return {
        scrollHeight: Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        ),
        scrollTop: window.scrollY,
        clientHeight: window.innerHeight,
      } as const;
    };

    const checkLoadMore = () => {
      if (!scrollArmedRef.current) return;
      if (initialLoadingRef.current || isFetchingNextPage) return;

      if (!hasNextPageRef.current) return;

      const {
        scrollHeight: fullHeight,
        scrollTop,
        clientHeight,
      } = scrollMetrics();
      const viewBottom = scrollTop + clientHeight;
      /** 스크롤이 거의 없는 짧은 페이지: 휠/터치 한 번이면 다음 페이지 허용 */
      const shortPage = fullHeight <= clientHeight + NEAR_BOTTOM_PX;
      const nearBottom = viewBottom >= fullHeight - NEAR_BOTTOM_PX;
      if (!shortPage && !nearBottom) return;

      scheduleAppendPostsRef.current();
    };

    const onUserScrollIntent = () => {
      scrollArmedRef.current = true;
      queueMicrotask(checkLoadMore);
    };

    const main = scrollRoot();
    const scrollTarget: EventTarget = main ?? window;
    scrollTarget.addEventListener("scroll", onUserScrollIntent, {
      passive: true,
    });
    window.addEventListener("wheel", onUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", onUserScrollIntent, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", onUserScrollIntent);
      window.removeEventListener("wheel", onUserScrollIntent);
      window.removeEventListener("touchmove", onUserScrollIntent);
    };
  }, [isFetchingNextPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              글 목록
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              카테고리·제목·본문으로 좁힐 수 있습니다. 처음 {POST_PAGE_DEFAULT}
              개만 불러오며, 더 보기·스크롤로 이어서 불러옵니다.
            </p>
          </div>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목 또는 본문 검색…"
              className="h-9 pr-9 pl-9"
              autoComplete="off"
              aria-label="글 검색"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="검색어 지우기"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  skipUrlToStateSyncRef.current = true;
                  commitSearchParams((p) => {
                    p.delete("search");
                  });
                }}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="flex max-w-md flex-col gap-1.5">
            <Label
              htmlFor="post-list-category"
              className="text-muted-foreground"
            >
              카테고리
            </Label>
            <select
              id="post-list-category"
              value={categoryFilterParam}
              onChange={(e) => {
                const v = e.target.value;
                commitSearchParams((p) => {
                  if (v) p.set("category", v);
                  else p.delete("category");
                });
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="글 카테고리 필터"
            >
              <option value="">전체</option>
              {POST_CATEGORY_VALUES.map((id) => (
                <option key={id} value={id}>
                  {POST_CATEGORY_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          {searchQuery && !isPending && total !== null ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              검색 결과{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {total}
              </span>
              건
              {posts.length < total ? (
                <>
                  {" "}
                  · 표시{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {posts.length}
                  </span>
                  건
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {user ? (
          <Button asChild>
            <Link href="/posts/new">글 작성</Link>
          </Button>
        ) : null}
      </div>

      <FormErrorAlert message={error} />

      <FormErrorAlert message={likeActionError} title="좋아요" />

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && posts.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">
          {searchQuery
            ? `「${searchQuery}」에 맞는 글이 없습니다.`
            : categoryFilterParam
              ? `이 카테고리(「${POST_CATEGORY_LABELS[categoryFilterParam]}」)에 글이 없습니다.`
              : "아직 글이 없습니다."}
        </p>
      ) : null}

      <ul className="space-y-3">
        {posts.map((post) => (
          <PostListItem
            key={post.id}
            post={post}
            onLikeInteractionStart={() => setLikeActionError(null)}
            onLikeApplied={onLikeApplied}
            onLikeSyncError={(msg) => {
              setLikeActionError(msg);
              toast.error(msg);
            }}
          />
        ))}
      </ul>

      {hasMore ? (
        <div className="flex min-h-12 flex-col items-center justify-center gap-3 py-4">
          {loadMoreScheduled || isFetchingNextPage ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <Spinner className="size-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isFetchingNextPage
                  ? "다음 글을 불러오는 중…"
                  : "곧 다음 글을 불러옵니다…"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              스크롤하면 다음 {POST_PAGE_DEFAULT}개를 불러옵니다…
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage || loadMoreScheduled || isPending}
            onClick={() => {
              clearLoadMoreDebounce();
              void fetchNextPage();
            }}
          >
            더 불러오기
          </Button>
        </div>
      ) : null}

      {!isPending && total !== null ? (
        <p className="text-center text-xs text-muted-foreground">
          {searchQuery ? (
            <>
              &quot;{searchQuery}&quot; · 총{" "}
              <span className="tabular-nums text-foreground">{total}</span>건 ·
              표시{" "}
              <span className="tabular-nums text-foreground">
                {posts.length}
              </span>
              건
            </>
          ) : (
            <>
              총 <span className="tabular-nums text-foreground">{total}</span>건
              · 표시{" "}
              <span className="tabular-nums text-foreground">
                {posts.length}
              </span>
              건
            </>
          )}
          {!hasMore && total > 0 ? " (전부 불러옴)" : ""}
        </p>
      ) : null}
    </div>
  );
}
