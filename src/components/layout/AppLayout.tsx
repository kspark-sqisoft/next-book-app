"use client";

// 사이트 공통 레이아웃: 네비·푸터·테마·채팅 독, 북 워크스페이스/홈에 맞춘 main 폭·패딩·헤더 접힘.
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { ChatDock } from "@/components/chat/ChatDock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Toaster } from "@/components/ui/sonner";
import { SITE_APP_MAIN_SCROLL_ID } from "@/lib/app-layout-scroll";
import {
  floatingDockBookSiteChromeToggleClass,
  floatingDockBookSiteFooterCollapsedStripClass,
  floatingDockBookSiteFooterCollapsedStripInnerClass,
  floatingDockBookSiteHeaderCollapsedStripClass,
  floatingDockBookSiteHeaderCollapsedStripInnerClass,
} from "@/lib/floating-dock-chrome";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const BOOK_WORKSPACE_CHROME_HEADER_KEY =
  "book-workspace-chrome-header-collapsed";
const BOOK_WORKSPACE_CHROME_FOOTER_KEY =
  "book-workspace-chrome-footer-collapsed";

/** `true` = 접힘. 저장값 없음 → 북 상세 첫 진입은 접힌 상태가 기본 */
function readBookChromeCollapsed(key: string): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "0") return false;
    return true;
  } catch {
    return true;
  }
}

function writeBookChromeCollapsed(key: string, collapsed: boolean) {
  try {
    localStorage.setItem(key, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function headerNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-1.5 py-1 transition-colors",
    isActive
      ? "font-semibold text-primary"
      : "text-muted-foreground hover:text-foreground",
  );
}

function footerNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    "transition-colors",
    isActive
      ? "font-semibold text-primary"
      : "text-muted-foreground hover:text-foreground",
  );
}

/** 공통 헤더·푸터와 자식 페이지를 감쌉니다. */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const location = { pathname: usePathname() };
  /** 북 워크스페이스(상세·새 북 편집)만 넓게; `/books` 목록은 글 목록과 동일 `max-w-3xl` */
  const wideMain =
    location.pathname === "/books/new" ||
    /^\/books\/\d+/.test(location.pathname);
  /** `BookWorkspaceShell` 사용 라우트 — 사이트 헤더 아래에 맞추려 main 패딩 제거·flex 높이 체인 */
  const bookShellRoute =
    location.pathname === "/books/new" ||
    /^\/books\/\d+$/.test(location.pathname);
  /** 북 **상세**(`/books/:숫자`)만 사이트 헤더·푸터 접기/펼치기 — `/books/new`·그 외 라우트는 항상 헤더·푸터 표시 */
  const bookDetailChromeRoute = /^\/books\/\d+$/.test(location.pathname);
  /** 북 슬라이드쇼 미리보기 — 전체 화면에 가깝게 쓰므로 플로팅 채팅 숨김 */
  const bookPresentationPreviewRoute = /^\/books\/\d+\/preview$/.test(
    location.pathname,
  );
  /** 홈: 3D 씬이 헤더~푸터 사이를 꽉 채우도록 뷰포트 높이·main flex 체인 */
  const homeRoute = location.pathname === "/";
  const fullViewportShell = bookShellRoute || homeRoute;

  const [bookSiteHeaderCollapsed, setBookSiteHeaderCollapsed] = useState(() =>
    readBookChromeCollapsed(BOOK_WORKSPACE_CHROME_HEADER_KEY),
  );
  const [bookSiteFooterCollapsed, setBookSiteFooterCollapsed] = useState(() =>
    readBookChromeCollapsed(BOOK_WORKSPACE_CHROME_FOOTER_KEY),
  );
  const bookDetailChromeEnteredRef = useRef(false);

  // 메뉴 첫 클릭이 RSC 페치 대기로 “안 먹는 것처럼” 느껴지는 것 완화 — 주요 탭은 백그라운드 프리패치
  useEffect(() => {
    const paths = ["/", "/posts", "/books", "/cats", "/login", "/signup"] as const;
    for (const p of paths) {
      void router.prefetch(p);
    }
  }, [router]);

  useEffect(() => {
    if (user) void router.prefetch("/me");
  }, [user, router]);

  useEffect(() => {
    if (!bookDetailChromeRoute) {
      bookDetailChromeEnteredRef.current = false;
      return;
    }
    if (bookDetailChromeEnteredRef.current) return;
    bookDetailChromeEnteredRef.current = true;
    startTransition(() => {
      setBookSiteHeaderCollapsed(
        readBookChromeCollapsed(BOOK_WORKSPACE_CHROME_HEADER_KEY),
      );
      setBookSiteFooterCollapsed(
        readBookChromeCollapsed(BOOK_WORKSPACE_CHROME_FOOTER_KEY),
      );
    });
  }, [bookDetailChromeRoute]);

  useEffect(() => {
    if (!bookDetailChromeRoute) return;
    writeBookChromeCollapsed(
      BOOK_WORKSPACE_CHROME_HEADER_KEY,
      bookSiteHeaderCollapsed,
    );
  }, [bookDetailChromeRoute, bookSiteHeaderCollapsed]);

  useEffect(() => {
    if (!bookDetailChromeRoute) return;
    writeBookChromeCollapsed(
      BOOK_WORKSPACE_CHROME_FOOTER_KEY,
      bookSiteFooterCollapsed,
    );
  }, [bookDetailChromeRoute, bookSiteFooterCollapsed]);

  const showBookSiteHeader =
    !bookShellRoute || !bookDetailChromeRoute || !bookSiteHeaderCollapsed;
  const showBookSiteFooter =
    !bookShellRoute || !bookDetailChromeRoute || !bookSiteFooterCollapsed;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-background text-foreground",
        /* 헤더·푸터는 뷰포트에 고정, 본문은 `<main>` 안에서만 스크롤 */
        "h-dvh max-h-dvh",
      )}
    >
      {showBookSiteHeader ? (
        <header className="relative z-280 shrink-0 border-b border-border bg-card/40 backdrop-blur-sm">
          <div
            className={cn(
              "mx-auto flex h-12 w-full items-center justify-between gap-4 px-4",
              /* 북 풀블리드여도 내비는 홈·글·북 목록과 동일 `max-w-3xl` 컬럼에 맞춤 */
              bookShellRoute
                ? "max-w-3xl"
                : wideMain
                  ? "max-w-6xl"
                  : "max-w-3xl",
            )}
          >
            <nav className="flex items-center gap-2 text-sm font-medium sm:gap-3">
              <NavLink href="/" end prefetch className={headerNavClass}>
                홈
              </NavLink>
              <NavLink href="/posts" prefetch className={headerNavClass}>
                글
              </NavLink>
              <NavLink href="/books" prefetch className={headerNavClass}>
                북
              </NavLink>
              <NavLink href="/cats" prefetch className={headerNavClass}>
                Cats
              </NavLink>
            </nav>
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <ThemeToggle />
              {user ? (
                <>
                  <Link
                    href="/me"
                    prefetch
                    aria-label="내 정보"
                    className="flex min-w-0 max-w-[min(12rem,calc(100vw-7rem))] items-center gap-2 rounded-md py-1 pl-0.5 pr-1 text-left outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <SafeImage
                      src={user.imageUrl}
                      alt=""
                      className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border"
                      placeholderLabel="프로필 이미지"
                      fallback={
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold uppercase text-muted-foreground ring-1 ring-border"
                          aria-hidden
                        >
                          {(user.name || user.email).charAt(0)}
                        </span>
                      }
                    />
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {user.name || user.email}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void signOut()}
                  >
                    로그아웃
                  </Button>
                  {bookDetailChromeRoute ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className={floatingDockBookSiteChromeToggleClass}
                      aria-label="사이트 헤더 접기"
                      title="북 영역을 더 넓게"
                      onClick={() => setBookSiteHeaderCollapsed(true)}
                    >
                      <ChevronUp className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/login" prefetch>
                      로그인
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/signup" prefetch>
                      회원가입
                    </Link>
                  </Button>
                  {bookDetailChromeRoute ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className={floatingDockBookSiteChromeToggleClass}
                      aria-label="사이트 헤더 접기"
                      title="북 영역을 더 넓게"
                      onClick={() => setBookSiteHeaderCollapsed(true)}
                    >
                      <ChevronUp className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </header>
      ) : null}
      {bookDetailChromeRoute && bookSiteHeaderCollapsed ? (
        <div className={floatingDockBookSiteHeaderCollapsedStripClass}>
          <div className={floatingDockBookSiteHeaderCollapsedStripInnerClass}>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={floatingDockBookSiteChromeToggleClass}
              aria-label="사이트 헤더 펼치기"
              title="사이트 메뉴·계정"
              onClick={() => setBookSiteHeaderCollapsed(false)}
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
      <main
        id={SITE_APP_MAIN_SCROLL_ID}
        className={cn(
          "w-full min-h-0 flex-1",
          fullViewportShell
            ? "flex max-w-none flex-col overflow-hidden p-0"
            : cn(
                "overflow-y-auto overscroll-contain mx-auto px-4 py-8",
                wideMain ? "max-w-6xl" : "max-w-3xl",
              ),
        )}
      >
        {children}
      </main>
      {showBookSiteFooter ? (
        <footer className="relative z-280 shrink-0 border-t border-border bg-card/40 backdrop-blur-sm">
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5",
              bookShellRoute
                ? "max-w-3xl"
                : wideMain
                  ? "max-w-6xl"
                  : "max-w-3xl",
            )}
          >
            <div className="space-y-0.5">
              <p className="font-heading text-xs font-medium text-foreground sm:text-sm">
                react-interactive
              </p>
              <p className="max-w-md text-[11px] leading-snug text-muted-foreground sm:text-xs">
                NestJS와 React로 짠 풀스택 학습·실험 공간입니다. JWT 로그인,
                글·댓글·좋아요, 슬라이드형 북 편집기와 레이아웃 AI, 실시간 채팅,
                Cats CRUD까지 한 프로젝트에서 이어집니다.
              </p>
            </div>
            <nav
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground sm:text-xs"
              aria-label="푸터 내비게이션"
            >
              <NavLink href="/" end prefetch className={footerNavClass}>
                홈
              </NavLink>
              <NavLink href="/posts" prefetch className={footerNavClass}>
                글
              </NavLink>
              <NavLink href="/books" prefetch className={footerNavClass}>
                북
              </NavLink>
              <NavLink href="/cats" prefetch className={footerNavClass}>
                Cats
              </NavLink>
              {user ? (
                <NavLink href="/me" prefetch className={footerNavClass}>
                  내 정보
                </NavLink>
              ) : (
                <>
                  <NavLink href="/login" prefetch className={footerNavClass}>
                    로그인
                  </NavLink>
                  <NavLink href="/signup" prefetch className={footerNavClass}>
                    회원가입
                  </NavLink>
                </>
              )}
              {bookDetailChromeRoute ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={floatingDockBookSiteChromeToggleClass}
                  aria-label="사이트 푸터 접기"
                  title="북 영역을 더 넓게"
                  onClick={() => setBookSiteFooterCollapsed(true)}
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </nav>
          </div>
        </footer>
      ) : null}
      {bookDetailChromeRoute && bookSiteFooterCollapsed ? (
        <div className={floatingDockBookSiteFooterCollapsedStripClass}>
          <div className={floatingDockBookSiteFooterCollapsedStripInnerClass}>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={floatingDockBookSiteChromeToggleClass}
              aria-label="사이트 푸터 펼치기"
              title="푸터·내비"
              onClick={() => setBookSiteFooterCollapsed(false)}
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
      {user && !bookPresentationPreviewRoute ? <ChatDock /> : null}
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        duration={4000}
      />
    </div>
  );
}
