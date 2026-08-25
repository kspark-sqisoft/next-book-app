"use client";

// 크레타 왼쪽 사이드바 — 콘텐츠(스튜디오·커뮤니티) / 재생 관리(플레이리스트·스케줄·디바이스) / 마이페이지·관리자.
// 아이콘만 보이게 축소 가능(localStorage에 유지).
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChartColumn,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LayoutGrid,
  ListVideo,
  type LucideIcon,
  MonitorSmartphone,
  PanelsTopLeft,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { fetchBooksPage } from "@/lib/api";
import { isAdminUser } from "@/lib/authz";
import { cretaDeviceStatus, fetchCretaDevices } from "@/lib/creta-api";
import { bookKeys, cretaKeys } from "@/lib/query-keys";
import { useDeviceOfflineNotifier } from "@/lib/use-device-offline-notifier";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

const COLLAPSED_KEY = "creta.sidebar.collapsed";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
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
      <Icon className="size-4 shrink-0" aria-hidden />
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
    { href: "/community", label: "커뮤니티", icon: LayoutGrid },
    {
      href: "/books",
      label: "스튜디오 (크레타북)",
      icon: PanelsTopLeft,
      exact: true,
      badge:
        booksQuery.data != null
          ? { text: String(booksQuery.data.total), tone: "muted" }
          : null,
    },
  ];
  const playback: Item[] = [
    { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    { href: "/playlists", label: "플레이리스트", icon: ListVideo },
    { href: "/schedules", label: "스케줄", icon: CalendarDays },
    {
      href: "/devices",
      label: "디바이스",
      icon: MonitorSmartphone,
      badge:
        devicesQuery.data != null
          ? { text: String(onlineCount), tone: "online" }
          : null,
    },
    { href: "/reports", label: "재생 리포트", icon: ChartColumn },
  ];
  const account: Item[] = [
    { href: "/account", label: "마이페이지", icon: UserRound },
    ...(isAdminUser(user)
      ? [
          {
            href: "/me",
            label: "관리자",
            icon: ShieldCheck,
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
          "flex h-12 items-center border-b border-border/70 px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/community"
          className="flex items-center gap-2 font-heading text-base font-bold"
          title="Creta"
        >
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          {!collapsed ? <span>Creta</span> : null}
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
