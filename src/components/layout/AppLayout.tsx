"use client";

// 사이트 공통 레이아웃: 네비·푸터·테마·채팅 독, 북 워크스페이스/홈에 맞춘 main 폭·패딩·헤더 접힘.
import { ChevronDown, ChevronUp, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { ChatDock } from "@/components/chat/ChatDock";
import { DeviceAlertBell } from "@/components/creta/DeviceAlertBell";
import { CretaSidebar } from "@/components/layout/CretaSidebar";
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

/**
 * `"1"`=접힘, `"0"`=펼침, 저장값 없음 → null(라우트 기본: 북 상세만 접힘).
 * SSR과 첫 클라이언트 렌더를 맞추기 위해 마운트 후 효과에서만 호출한다.
 */
function readBookChromeCollapsed(key: string): boolean | null {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
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
    /* 좁은 화면에서 한글이 글자 단위로 세로 줄바꿈되지 않게 고정 폭 유지 */
    "shrink-0 whitespace-nowrap rounded-md px-1.5 py-1 transition-colors",
    isActive
      ? "font-semibold text-primary"
      : "text-muted-foreground hover:text-foreground",
  );
}

function cretaSubNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    /* 컨테이너가 가로 스크롤을 담당 — 항목은 줄어들거나 줄바꿈되지 않게 */
    "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors sm:text-sm",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
  /** 크레타 하위 섹션(플레이리스트·스케줄·디바이스) — 대시보드형 화면이라 넓은 컬럼 사용 */
  const cretaDashboardRoute =
    location.pathname.startsWith("/community") ||
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/playlists") ||
    location.pathname.startsWith("/schedules") ||
    location.pathname.startsWith("/devices") ||
    location.pathname.startsWith("/walls") ||
    location.pathname.startsWith("/ads") ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/account");
  /** 크레타 서브내비 노출: 북 목록 + 하위 섹션(북 편집 워크스페이스는 제외) */
  const cretaSubNavRoute =
    location.pathname === "/books" || cretaDashboardRoute;
  /** 상단 “크레타” 메뉴 활성: 북·플레이리스트·스케줄·디바이스 전부 */
  const cretaMenuActive =
    location.pathname === "/books" ||
    location.pathname.startsWith("/books/") ||
    cretaDashboardRoute;
  /**
   * 본문 컬럼 폭 — 헤더·하위 내비·본문·푸터가 같은 값을 써야 세로 정렬선이 맞는다.
   *
   * 넓은 컬럼(1152px)은 그리드·대시보드용, 좁은 컬럼(768px)은 글 읽는 폭이다
   * (한 줄 45~75자 규칙). 큰 화면에서 더 넓혀 봤지만 카드가 잘게 쪼개져 보여 되돌렸다.
   */
  const WIDE_COLUMN = "max-w-6xl";
  const NARROW_COLUMN = "max-w-3xl";

  /** 크레타 영역(북 목록·워크스페이스·플레이리스트·스케줄·디바이스)은 넓은 컬럼(그리드·대시보드형) */
  const wideMain =
    location.pathname === "/books" ||
    location.pathname === "/books/new" ||
    /^\/books\/\d+/.test(location.pathname) ||
    cretaDashboardRoute;
  /** `BookWorkspaceShell` 사용 라우트 — 사이트 헤더 아래에 맞추려 main 패딩 제거·flex 높이 체인 */
  const bookShellRoute =
    location.pathname === "/books/new" ||
    /^\/books\/\d+$/.test(location.pathname);
  /** 북 **상세**(`/books/:숫자`) — 워크스페이스 전용 레이아웃 판별 */
  const bookDetailChromeRoute = /^\/books\/\d+$/.test(location.pathname);
  /** 크레타 하위 전체(스튜디오 목록·대시보드·북 상세)에서 사이트 헤더·푸터 접기/펼치기 — `/books/new`·그 외 라우트는 항상 표시 */
  const chromeCollapsibleRoute = bookDetailChromeRoute || cretaSubNavRoute;
  /** 북 슬라이드쇼 미리보기 — 전체 화면에 가깝게 쓰므로 플로팅 채팅 숨김 */
  const bookPresentationPreviewRoute = /^\/books\/\d+\/preview$/.test(
    location.pathname,
  );
  /** 홈: 3D 씬이 헤더~푸터 사이를 꽉 채우도록 뷰포트 높이·main flex 체인 */
  const homeRoute = location.pathname === "/";
  const fullViewportShell = bookShellRoute || homeRoute;

  /**
   * 저장된 접힘 선호(null = 저장값 없음 → 라우트 기본).
   * SSR엔 localStorage가 없어 초기값은 항상 null — 마운트 후 효과에서 복원해야
   * 하이드레이션이 어긋나지 않는다.
   */
  const [storedHeaderCollapsed, setBookSiteHeaderCollapsed] = useState<
    boolean | null
  >(null);
  const [storedFooterCollapsed, setBookSiteFooterCollapsed] = useState<
    boolean | null
  >(null);
  /** 실제 접힘 — 저장값이 없으면 북 상세만 접힌 상태가 기본, 그 외 크레타 페이지는 펼침 */
  const bookSiteHeaderCollapsed =
    storedHeaderCollapsed ?? bookDetailChromeRoute;
  const bookSiteFooterCollapsed =
    storedFooterCollapsed ?? bookDetailChromeRoute;
  const bookDetailChromeEnteredRef = useRef(false);

  // 메뉴 첫 클릭이 RSC 페치 대기로 “안 먹는 것처럼” 느껴지는 것 완화 — 주요 탭은 백그라운드 프리패치
  useEffect(() => {
    const paths = [
      "/",
      "/posts",
      "/books",
      "/community",
      "/playlists",
      "/schedules",
      "/devices",
      "/account",
      "/cats",
      "/login",
      "/signup",
    ] as const;
    for (const p of paths) {
      void router.prefetch(p);
    }
  }, [router]);

  useEffect(() => {
    if (user) void router.prefetch("/me");
  }, [user, router]);

  useEffect(() => {
    if (!chromeCollapsibleRoute) {
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
  }, [chromeCollapsibleRoute]);

  useEffect(() => {
    // 사용자가 명시적으로 토글했을 때만 저장(null = 아직 선호 없음)
    if (!chromeCollapsibleRoute || storedHeaderCollapsed == null) return;
    writeBookChromeCollapsed(
      BOOK_WORKSPACE_CHROME_HEADER_KEY,
      storedHeaderCollapsed,
    );
  }, [chromeCollapsibleRoute, storedHeaderCollapsed]);

  useEffect(() => {
    if (!chromeCollapsibleRoute || storedFooterCollapsed == null) return;
    writeBookChromeCollapsed(
      BOOK_WORKSPACE_CHROME_FOOTER_KEY,
      storedFooterCollapsed,
    );
  }, [chromeCollapsibleRoute, storedFooterCollapsed]);

  const showBookSiteHeader =
    !chromeCollapsibleRoute || !bookSiteHeaderCollapsed;
  const showBookSiteFooter =
    !chromeCollapsibleRoute || !bookSiteFooterCollapsed;

  /** 본문 — 크레타 영역에서는 사이드바 옆에, 그 외에는 단독으로 배치 */
  const mainEl = (
    <main
      id={SITE_APP_MAIN_SCROLL_ID}
      className={cn(
        "w-full min-h-0 flex-1",
        fullViewportShell
          ? "flex max-w-none flex-col overflow-hidden p-0"
          : "overflow-y-auto overscroll-contain",
      )}
    >
      {fullViewportShell ? (
        children
      ) : (
        /* 스크롤바는 브라우저 오른쪽 끝(main 가장자리)에 두고, 콘텐츠 컬럼만 가운데 정렬 */
        <div
          className={cn(
            "mx-auto w-full px-4 py-8",
            wideMain ? WIDE_COLUMN : NARROW_COLUMN,
          )}
        >
          {children}
        </div>
      )}
    </main>
  );

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
              /* 모바일: 크레타 알림 벨까지 들어가면 한 줄이 빠듯해 여백을 줄인다 */
              "mx-auto flex h-12 w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4",
              /* 북 풀블리드여도 내비는 홈·글·북 목록과 동일 `max-w-3xl` 컬럼에 맞춤 */
              bookShellRoute
                ? NARROW_COLUMN
                : wideMain
                  ? WIDE_COLUMN
                  : NARROW_COLUMN,
            )}
          >
            <nav className="flex items-center gap-1.5 text-sm font-medium sm:gap-3">
              <NavLink href="/" end prefetch className={headerNavClass}>
                홈
              </NavLink>
              <NavLink href="/posts" prefetch className={headerNavClass}>
                글
              </NavLink>
              {/* 크레타: 커뮤니티·북·플레이리스트·스케줄·디바이스 묶음 — 기본 진입은 커뮤니티 */}
              <Link
                href="/community"
                prefetch
                className={headerNavClass({ isActive: cretaMenuActive })}
              >
                크레타
              </Link>
              <NavLink href="/cats" prefetch className={headerNavClass}>
                Cats
              </NavLink>
            </nav>
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              {/* 크레타 영역 — 실시간 이상 단말 알림 벨(우상단, 웹 알림 관례) */}
              {cretaMenuActive ? <DeviceAlertBell /> : null}
              <ThemeToggle />
              {user ? (
                <>
                  <Link
                    href="/me"
                    prefetch
                    aria-label="내 정보"
                    /* 모바일은 아바타만 표시(shrink-0로 원형 유지), sm+에서 이름 노출·말줄임 */
                    className="flex min-w-0 max-w-[min(12rem,calc(100vw-7rem))] shrink-0 items-center gap-2 rounded-md py-1 pl-0.5 pr-1 text-left outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:shrink"
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
                    <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">
                      {user.name || user.email}
                    </span>
                  </Link>
                  {/* 모바일은 아이콘 버튼으로 폭 절약, sm+는 기존 텍스트 버튼 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="sm:hidden"
                    aria-label="로그아웃"
                    title="로그아웃"
                    onClick={() => void signOut()}
                  >
                    <LogOut className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden sm:inline-flex"
                    onClick={() => void signOut()}
                  >
                    로그아웃
                  </Button>
                  {chromeCollapsibleRoute ? (
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
                  {chromeCollapsibleRoute ? (
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
      {chromeCollapsibleRoute && bookSiteHeaderCollapsed ? (
        <div className={floatingDockBookSiteHeaderCollapsedStripClass}>
          <div
            className={cn(
              floatingDockBookSiteHeaderCollapsedStripInnerClass,
              /* 크레타 목록·대시보드는 넓은 컬럼이라 펼침 버튼도 같은 정렬선에 */
              !bookShellRoute && WIDE_COLUMN,
            )}
          >
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
      {cretaSubNavRoute ? (
        /* 모바일 전용 가로 메뉴 — sm 이상은 왼쪽 사이드바(CretaSidebar) */
        <div className="shrink-0 border-b border-border bg-card/20 sm:hidden">
          <nav
            aria-label="크레타 하위 메뉴"
            className={cn(
              "mx-auto flex w-full items-center gap-1 overflow-x-auto px-4 py-1.5",
              wideMain ? WIDE_COLUMN : NARROW_COLUMN,
            )}
          >
            {/* 사이드바(CretaSidebar)와 같은 섹션 구성 — 좁은 화면은 가로 스크롤 */}
            <NavLink href="/community" prefetch className={cretaSubNavClass}>
              커뮤니티
            </NavLink>
            <NavLink href="/books" end prefetch className={cretaSubNavClass}>
              스튜디오
            </NavLink>
            <NavLink href="/dashboard" prefetch className={cretaSubNavClass}>
              대시보드
            </NavLink>
            <NavLink href="/playlists" prefetch className={cretaSubNavClass}>
              플레이리스트
            </NavLink>
            <NavLink href="/schedules" prefetch className={cretaSubNavClass}>
              스케줄
            </NavLink>
            <NavLink href="/devices" prefetch className={cretaSubNavClass}>
              디바이스
            </NavLink>
            <NavLink href="/walls" prefetch className={cretaSubNavClass}>
              비디오월
            </NavLink>
            <NavLink href="/ads" prefetch className={cretaSubNavClass}>
              광고
            </NavLink>
            <NavLink href="/reports" prefetch className={cretaSubNavClass}>
              재생 리포트
            </NavLink>
            <NavLink href="/account" prefetch className={cretaSubNavClass}>
              마이페이지
            </NavLink>
          </nav>
        </div>
      ) : null}
      {cretaSubNavRoute ? (
        /* 크레타 영역: 왼쪽 사이드바 + 본문(본문만 스크롤) */
        <div className="flex min-h-0 w-full flex-1 overflow-hidden">
          <CretaSidebar />
          {mainEl}
        </div>
      ) : (
        mainEl
      )}
      {showBookSiteFooter ? (
        <footer className="relative z-280 shrink-0 border-t border-border bg-card/40 backdrop-blur-sm">
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5",
              bookShellRoute
                ? NARROW_COLUMN
                : wideMain
                  ? WIDE_COLUMN
                  : NARROW_COLUMN,
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
              <Link
                href="/books"
                prefetch
                className={footerNavClass({ isActive: cretaMenuActive })}
              >
                크레타
              </Link>
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
              {chromeCollapsibleRoute ? (
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
      {chromeCollapsibleRoute && bookSiteFooterCollapsed ? (
        <div className={floatingDockBookSiteFooterCollapsedStripClass}>
          <div
            className={cn(
              floatingDockBookSiteFooterCollapsedStripInnerClass,
              !bookShellRoute && WIDE_COLUMN,
            )}
          >
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
