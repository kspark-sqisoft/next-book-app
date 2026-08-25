"use client";

// 북 목록: 검색 디바운스·무한 스크롤·새 북 생성
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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

import { BookListItem } from "@/components/books/BookListItem";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  BOOK_PAGE_DEFAULT,
  type BookListItem as BookListItemModel,
  createBook,
  deleteBook,
  fetchBooksPage,
} from "@/lib/api";
import { SITE_APP_MAIN_SCROLL_ID } from "@/lib/app-layout-scroll";
import { appLog } from "@/lib/app-log";
import { canEditAsOwnerOrAdmin } from "@/lib/authz";
import { DEFAULT_SLIDE_HEIGHT, DEFAULT_SLIDE_WIDTH } from "@/lib/book-canvas";
import { CARD_GRID_COLUMNS } from "@/lib/card-hover";
import { bookKeys } from "@/lib/query-keys";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { useAuth } from "@/stores/auth-store";

/** 뷰포트 하단에서 이 픽셀 안이면 “다음 페이지”로 간주 */
const NEAR_BOTTOM_PX = 280;

/** 하단 도달 후 실제 요청까지 대기(연속 스크롤 시 타이머 리셋) */
const LOAD_MORE_DEBOUNCE_MS = 400;

/** 검색어 입력 후 API 호출까지 대기 */
const SEARCH_DEBOUNCE_MS = 400;

export function BookListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  /** 글 목록과 동일: `useSearchParams` 대신 location 기반(커스텀 서버·Suspense 이슈 회피) */
  const [queryString, setQueryString] = useState("");
  useEffect(() => {
    const read = () =>
      setQueryString(window.location.search.replace(/^\?/, ""));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [pathname]);

  const urlSearchRaw = useMemo(() => {
    return new URLSearchParams(queryString).get("search") ?? "";
  }, [queryString]);

  const commitSearchParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(queryString);
      mutate(p);
      const q = p.toString();
      setQueryString(q);
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [queryString, router, pathname],
  );

  const [loadMoreScheduled, setLoadMoreScheduled] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
  }, []);

  // 입력만 디바운스 — URL 동기화는 아래 effect에서 “실제로 달라질 때만” replace (불필요한 GET /books 방지)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const sp = new URLSearchParams(queryString);
    const current = (sp.get("search") ?? "").trim();
    if (searchQuery === current) return;
    skipUrlToStateSyncRef.current = true;
    const p = new URLSearchParams(queryString);
    if (searchQuery) p.set("search", searchQuery);
    else p.delete("search");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    queueMicrotask(() => setQueryString(q));
  }, [searchQuery, pathname, router, queryString]);

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

      const {
        scrollHeight: fullHeight,
        scrollTop,
        clientHeight,
      } = scrollMetrics();
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

  /** 새 북 — 플레이리스트처럼 제목을 먼저 받는 다이얼로그 → 생성 후 편집 화면으로 push(뒤로가기 = 이 목록) */
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const createBookMutation = useMutation({
    mutationFn: (title: string) =>
      createBook({
        title,
        slideWidth: DEFAULT_SLIDE_WIDTH,
        slideHeight: DEFAULT_SLIDE_HEIGHT,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      void queryClient.setQueryData(bookKeys.detail(res.id), res);
      setCreateOpen(false);
      setCreateTitle("");
      // replace가 아니라 push — 목록 항목을 히스토리에 남겨 상세의 "뒤로"가 북 목록으로 돌아오게
      router.push(`/books/${res.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitCreateBook = () => {
    const title = createTitle.trim();
    if (!title || createBookMutation.isPending) return;
    createBookMutation.mutate(title);
  };

  /** 목록에서 바로 삭제 — 작성자·관리자만 버튼이 보이고, 확인 다이얼로그를 거친다 */
  const [pendingDelete, setPendingDelete] = useState<BookListItemModel | null>(
    null,
  );
  const deleteBookMutation = useMutation({
    mutationFn: (id: number) => deleteBook(id),
    onSuccess: (_res, id) => {
      toast.success("북을 삭제했습니다.");
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      queryClient.removeQueries({ queryKey: bookKeys.detail(id) });
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
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              스튜디오
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              제목으로 검색할 수 있습니다. 처음 {BOOK_PAGE_DEFAULT}개만
              불러오며, 더 보기·스크롤로 이어서 불러옵니다. 슬라이드 페이지에
              텍스트·이미지·동영상 등을 배치합니다.
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
              <span className="font-semibold tabular-nums text-foreground">
                {total}
              </span>
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
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" aria-hidden />새 북
          </Button>
        ) : null}
      </div>

      <FormErrorAlert message={error} />

      {/* 새 북 다이얼로그 — 제목 입력 후 만들기(Enter 가능) */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (createBookMutation.isPending) return;
          setCreateOpen(open);
          if (!open) setCreateTitle("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>새 북</DialogTitle>
            <DialogDescription>
              만든 뒤 편집 화면에서 슬라이드와 위젯을 구성합니다.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitCreateBook();
            }}
          >
            <Label htmlFor="book-create-title">제목</Label>
            <Input
              id="book-create-title"
              autoFocus
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="예: 매장 안내 보드"
              maxLength={200}
            />
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createBookMutation.isPending}
              onClick={() => {
                setCreateOpen(false);
                setCreateTitle("");
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!createTitle.trim() || createBookMutation.isPending}
              onClick={submitCreateBook}
            >
              {createBookMutation.isPending ? (
                <>
                  <Spinner className="mr-1.5 size-4" aria-hidden />
                  만드는 중…
                </>
              ) : (
                "만들기"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <ul className={CARD_GRID_COLUMNS}>
        {items.map((b) => (
          <BookListItem
            key={b.id}
            book={b}
            coverThumbDataUrl={listCoverThumbnails[`book-list-${b.id}`]}
            onDelete={
              canEditAsOwnerOrAdmin(user, b.author.id)
                ? () => setPendingDelete(b)
                : undefined
            }
          />
        ))}
      </ul>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>북을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” 북과 포함된 모든 페이지가 삭제됩니다. 이
              작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBookMutation.isPending}
              onClick={() => {
                if (pendingDelete) deleteBookMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <span className="tabular-nums text-foreground">{total}</span>건 ·
              표시{" "}
              <span className="tabular-nums text-foreground">
                {items.length}
              </span>
              건
            </>
          ) : (
            <>
              총 <span className="tabular-nums text-foreground">{total}</span>건
              · 표시{" "}
              <span className="tabular-nums text-foreground">
                {items.length}
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
