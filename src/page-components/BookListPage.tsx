"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth-store";
import {
  BOOK_PAGE_DEFAULT,
  createBook,
  fetchBooksPage,
  type BookListItem as BookListItemModel,
} from "@/lib/api";
import { SITE_APP_MAIN_SCROLL_ID } from "@/lib/app-layout-scroll";
import { appLog } from "@/lib/app-log";
import {
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
} from "@/lib/book-canvas";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { bookKeys } from "@/lib/query-keys";
import { BookListItem } from "@/components/books/BookListItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";

/** 뷰포트 하단에서 이 픽셀 안이면 “다음 페이지”로 간주 */
const NEAR_BOTTOM_PX = 280;

/** 하단 도달 후 실제 요청까지 대기(연속 스크롤 시 타이머 리셋) */
const LOAD_MORE_DEBOUNCE_MS = 400;

/** 검색어 입력 후 API 호출까지 대기 */
const SEARCH_DEBOUNCE_MS = 400;

/**
 * 북 목록 + 제목 검색(디바운스) + 무한 스크롤(글 목록과 동일 패턴).
 */
export function BookListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

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

  const [loadMoreScheduled, setLoadMoreScheduled] = useState(false);
  const [searchInput, setSearchInput] = useState(urlSearchRaw);
  const [searchQuery, setSearchQuery] = useState(urlSearchRaw.trim());

  const listQueryKey = bookKeys.list(searchQuery);

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
      const res = await fetchBooksPage({
        skip: pageParam,
        take: BOOK_PAGE_DEFAULT,
        search: q,
      });
      appLog("books", pageParam === 0 ? "목록 초기 로드" : "목록 추가 로드", {
        received: res.items.length,
        total: res.total,
        skip: pageParam,
        search: q ?? "",
      });
      return res;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const items: BookListItemModel[] = useMemo(
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

  const skipUrlToStateSyncRef = useRef(false);

  const itemsRef = useRef<BookListItemModel[]>([]);
  const totalRef = useRef<number | null>(null);
  const initialLoadingRef = useRef(false);
  const scrollArmedRef = useRef(false);

  const loadMoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMore = Boolean(hasNextPage);

  const clearLoadMoreDebounce = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
      loadMoreDebounceRef.current = null;
    }
    setLoadMoreScheduled(false);
  }, []);

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
  }, [searchQuery, clearLoadMoreDebounce]);

  const runFetchNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const scheduleAppendItems = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
    }
    setLoadMoreScheduled(true);
    loadMoreDebounceRef.current = setTimeout(() => {
      loadMoreDebounceRef.current = null;
      runFetchNextPage();
    }, LOAD_MORE_DEBOUNCE_MS);
  }, [runFetchNextPage]);

  const scheduleAppendItemsRef = useRef(scheduleAppendItems);

  useLayoutEffect(() => {
    itemsRef.current = items;
    totalRef.current = total;
    initialLoadingRef.current = isPending;
    scheduleAppendItemsRef.current = scheduleAppendItems;
  }, [items, total, isPending, scheduleAppendItems]);

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

      const t = totalRef.current;
      if (t === null) return;
      if (itemsRef.current.length >= t) return;

      const { scrollHeight: fullHeight, scrollTop, clientHeight } = scrollMetrics();
      const viewBottom = scrollTop + clientHeight;
      const shortPage = fullHeight <= clientHeight + NEAR_BOTTOM_PX;
      const nearBottom = viewBottom >= fullHeight - NEAR_BOTTOM_PX;
      if (!shortPage && !nearBottom) return;

      scheduleAppendItemsRef.current();
    };

    const onUserScrollIntent = () => {
      scrollArmedRef.current = true;
      queueMicrotask(checkLoadMore);
    };

    const main = scrollRoot();
    const scrollTarget: EventTarget = main ?? window;
    scrollTarget.addEventListener("scroll", onUserScrollIntent, { passive: true });
    window.addEventListener("wheel", onUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", onUserScrollIntent, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", onUserScrollIntent);
      window.removeEventListener("wheel", onUserScrollIntent);
      window.removeEventListener("touchmove", onUserScrollIntent);
    };
  }, [isFetchingNextPage]);

  const createDefaultBook = useMutation({
    mutationFn: () =>
      createBook({
        title: "제목 없음",
        slideWidth: DEFAULT_SLIDE_WIDTH,
        slideHeight: DEFAULT_SLIDE_HEIGHT,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      void queryClient.setQueryData(bookKeys.detail(res.id), res);
      router.replace(`/books/${res.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listThumbPages = useMemo(
    () =>
      items
        .filter((b) => b.coverPreview)
        .map((b) => {
          const c = b.coverPreview!;
          return {
            clientKey: `book-list-${b.id}`,
            backgroundColor: c.backgroundColor,
            elements: c.elements,
            slideWidth: c.slideWidth,
            slideHeight: c.slideHeight,
          };
        }),
    [items],
  );

  const listCoverThumbnails = useBookPageThumbnails(
    listThumbPages,
    DEFAULT_SLIDE_WIDTH,
    DEFAULT_SLIDE_HEIGHT,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">북</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              제목으로 검색할 수 있습니다. 처음 {BOOK_PAGE_DEFAULT}개만 불러오며, 더 보기·스크롤로 이어서
              불러옵니다. 슬라이드 페이지에 텍스트·이미지·동영상 등을 배치합니다.
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
              placeholder="북 제목 검색…"
              className="h-9 pr-9 pl-9"
              autoComplete="off"
              aria-label="북 검색"
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
          {searchQuery && !isPending && total !== null ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              검색 결과{" "}
              <span className="font-semibold tabular-nums text-foreground">{total}</span>
              건
              {items.length < total ? (
                <>
                  {" "}
                  · 표시{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {items.length}
                  </span>
                  건
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {user ? (
          <Button
            type="button"
            disabled={createDefaultBook.isPending}
            onClick={() => createDefaultBook.mutate()}
          >
            {createDefaultBook.isPending ? (
              <Spinner className="mr-1.5 size-4" aria-hidden />
            ) : (
              <Plus className="mr-1.5 size-4" aria-hidden />
            )}
            새 북
          </Button>
        ) : null}
      </div>

      <FormErrorAlert message={error} />

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && items.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">
          {searchQuery
            ? `「${searchQuery}」에 맞는 북이 없습니다.`
            : "아직 북이 없습니다."}
        </p>
      ) : null}

      <ul className="space-y-3">
        {items.map((b) => (
          <BookListItem
            key={b.id}
            book={b}
            coverThumbDataUrl={listCoverThumbnails[`book-list-${b.id}`]}
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
                  ? "다음 북을 불러오는 중…"
                  : "곧 다음 북을 불러옵니다…"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              스크롤하면 다음 {BOOK_PAGE_DEFAULT}개를 불러옵니다…
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
              <span className="tabular-nums text-foreground">{total}</span>건 · 표시{" "}
              <span className="tabular-nums text-foreground">{items.length}</span>건
            </>
          ) : (
            <>
              총 <span className="tabular-nums text-foreground">{total}</span>건 · 표시{" "}
              <span className="tabular-nums text-foreground">{items.length}</span>건
            </>
          )}
          {!hasMore && total > 0 ? " (전부 불러옴)" : ""}
        </p>
      ) : null}
    </div>
  );
}
