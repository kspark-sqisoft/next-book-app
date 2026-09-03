"use client";

// 크레타 왼쪽 사이드바 — 콘텐츠(스튜디오·커뮤니티) / 재생 관리(플레이리스트·스케줄·디바이스) / 마이페이지·관리자.
// 아이콘만 보이게 축소 가능(localStorage에 유지).
import { useQuery } from "@tanstack/react-query";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import {
  cretaDeviceStatus,
  fetchCretaDevices,
} from "@/features/creta/creta-api";
import {
  CRETA_SECTIONS,
  type CretaSection,
} from "@/features/creta/creta-sections";
import { useDeviceOfflineNotifier } from "@/features/creta/use-device-offline-notifier";
import { fetchBooksPage } from "@/lib/api";
import { isAdminUser } from "@/lib/authz";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const COLLAPSED_KEY = "creta.sidebar.collapsed";

/**
 * 사이드바 항목 = 섹션 정의(아이콘·포인트 컬러) + 사이드바 전용 표시 옵션.
 *
 * 글자에는 색을 입히지 않는다 — 색은 "어떤 메뉴인지", 글자·배경은 "지금 어디인지"로
 * 역할을 나눠야 활성 표시가 묻히지 않는다.
 */
type Item = CretaSection & {
  /** 정확히 일치해야 활성(북 목록은 /books만) */
  exact?: boolean;
  badge?: { text: string; tone: "muted" | "online" | "super" } | null;
};

const COLLAPSED_EVENT = "creta-sidebar-collapsed-change";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* 저장 실패는 무시 */
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function SidebarItem({
  item,
  active,
  collapsed,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-4 shrink-0", item.iconClass)} aria-hidden />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      ) : null}
      {item.badge ? (
        collapsed ? (
          item.badge.tone === "online" ? (
            <span
              className="absolute right-2 top-1.5 size-1.5 rounded-full bg-emerald-500"
              aria-label={item.badge.text}
            />
          ) : null
        ) : (
          <span
            className={cn(
              "shrink-0 text-[11px] tabular-nums",
              item.badge.tone === "online" &&
                "inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400",
              item.badge.tone === "muted" && "text-muted-foreground",
              item.badge.tone === "super" &&
                "rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
            )}
          >
            {item.badge.tone === "online" ? (
              <span
                className="size-1.5 rounded-full bg-emerald-500"
                aria-hidden
              />
            ) : null}
            {item.badge.text}
          </span>
        )
      ) : null}
    </Link>
  );
}

function Group({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {collapsed ? (
        <div className="mx-2 my-1 border-t border-border/70" aria-hidden />
      ) : (
        <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-muted-foreground/80">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export function CretaSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  // localStorage를 외부 스토어로 구독 — 서버 스냅샷은 항상 펼침(SSR 불일치 방지)
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );
  const toggle = () => writeCollapsed(!collapsed);

  const booksQuery = useQuery({
    queryKey: [...bookKeys.lists(), "sidebar-count"],
    queryFn: () => fetchBooksPage({ take: 1 }),
    staleTime: 60_000,
  });
  const devicesQuery = useQuery({
    queryKey: cretaKeys.devices(),
    queryFn: fetchCretaDevices,
    staleTime: 10_000,
    // 오프라인 전환 알림을 위해 크레타 화면 어디서든 주기적으로 갱신
    refetchInterval: 15_000,
    // 디바이스 목록은 로그인 필요 — 비로그인 방문자가 15초마다 실패하지 않게
    enabled: !!user,
  });
  const onlineCount = (devicesQuery.data ?? []).filter(
    (d) => cretaDeviceStatus(d) === "online",
  ).length;
  useDeviceOfflineNotifier(devicesQuery.data);

  const isActive = (item: Item) =>
    item.exact
      ? pathname === item.href || pathname === `${item.href}/new`
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const content: Item[] = [
    CRETA_SECTIONS.community,
    {
      ...CRETA_SECTIONS.studio,
      exact: true,
      badge:
        booksQuery.data != null
          ? { text: String(booksQuery.data.total), tone: "muted" }
          : null,
    },
  ];
  const playback: Item[] = [
    CRETA_SECTIONS.dashboard,
    CRETA_SECTIONS.playlists,
    CRETA_SECTIONS.schedules,
    {
      ...CRETA_SECTIONS.devices,
      badge:
        devicesQuery.data != null
          ? { text: String(onlineCount), tone: "online" }
          : null,
    },
    CRETA_SECTIONS.walls,
    CRETA_SECTIONS.ads,
    CRETA_SECTIONS.reports,
  ];
  const account: Item[] = [
    CRETA_SECTIONS.account,
    ...(isAdminUser(user)
      ? [
          {
            ...CRETA_SECTIONS.admin,
            badge: { text: "SUPER", tone: "super" as const },
          },
        ]
      : []),
  ];

  return (
    <aside
      aria-label="크레타 메뉴"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-card/40 transition-[width] duration-200 sm:flex",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div
        className={cn(
          /* 여백을 아래 메뉴와 같은 구조로 — nav의 p-2 + 항목의 px-2.5 를 그대로 따라가야
             "Creta" 글자 왼쪽 끝이 아이콘 왼쪽 끝과 한 줄에 선다 */
          "flex h-12 items-center border-b border-border/70 px-2",
          collapsed && "justify-center px-0",
        )}
      >
        {/* 접히면 글자가 숨으므로 머리글자만 남긴다 — 헤더가 비지 않게 */}
        <Link
          href="/community"
          className={cn(
            "font-heading text-base font-bold",
            !collapsed && "px-2.5",
          )}
          title="Creta"
        >
          {collapsed ? "C" : "Creta"}
        </Link>
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto p-2">
        <Group title="콘텐츠" collapsed={collapsed}>
          {content.map((it) => (
            <SidebarItem
              key={it.href}
              item={it}
              active={isActive(it)}
              collapsed={collapsed}
            />
          ))}
        </Group>
        <Group title="재생 관리" collapsed={collapsed}>
          {playback.map((it) => (
            <SidebarItem
              key={it.href}
              item={it}
              active={isActive(it)}
              collapsed={collapsed}
            />
          ))}
        </Group>
        <Group title="내 계정" collapsed={collapsed}>
          {account.map((it) => (
            <SidebarItem
              key={it.href}
              item={it}
              active={isActive(it)}
              collapsed={collapsed}
            />
          ))}
        </Group>
      </nav>
      <div className="border-t border-border/70 p-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" aria-hidden />
          ) : (
            <>
              <ChevronsLeft className="size-4" aria-hidden />
              접기
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
