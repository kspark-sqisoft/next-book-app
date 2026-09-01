// 크레타 메뉴(섹션) 한 곳 정의 — 아이콘과 포인트 컬러를 여기서만 정한다.
//
// 사이드바·페이지 제목·빈 상태가 같은 아이콘과 같은 색을 쓰면, 사이드바에서 고른 메뉴와
// 지금 보고 있는 화면이 색으로 이어져 "여기가 맞다"는 확인이 된다.
//
// 색을 쓰는 자리는 셋으로 제한한다 — 사이드바 아이콘(좁은 화면의 모바일 하위 메뉴 포함),
// 페이지 제목 아이콘, 빈 상태 아이콘.
// 목록 행·버튼·본문 글자에는 넣지 않는다. 포인트 컬러는 드물어야 눈에 걸린다.
// 이웃한 메뉴끼리 색상환에서 멀도록 배치했고, 다크 모드는 한 단계 밝은 -400 을 쓴다.
import {
  BadgeDollarSign,
  CalendarDays,
  ChartColumn,
  Grid2x2,
  LayoutDashboard,
  LayoutGrid,
  ListVideo,
  type LucideIcon,
  MonitorSmartphone,
  PanelsTopLeft,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export type CretaSectionKey =
  | "community"
  | "studio"
  | "dashboard"
  | "playlists"
  | "schedules"
  | "devices"
  | "walls"
  | "ads"
  | "reports"
  | "account"
  | "admin";

export type CretaSection = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 포인트 컬러(Tailwind text-*) — 라이트/다크 한 쌍 */
  iconClass: string;
};

export const CRETA_SECTIONS: Record<CretaSectionKey, CretaSection> = {
  community: {
    href: "/community",
    label: "커뮤니티",
    icon: LayoutGrid,
    iconClass: "text-sky-500 dark:text-sky-400",
  },
  studio: {
    href: "/books",
    label: "스튜디오",
    icon: PanelsTopLeft,
    iconClass: "text-violet-500 dark:text-violet-400",
  },
  dashboard: {
    href: "/dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    iconClass: "text-amber-500 dark:text-amber-400",
  },
  playlists: {
    href: "/playlists",
    label: "플레이리스트",
    icon: ListVideo,
    iconClass: "text-rose-500 dark:text-rose-400",
  },
  schedules: {
    href: "/schedules",
    label: "스케줄",
    icon: CalendarDays,
    iconClass: "text-indigo-500 dark:text-indigo-400",
  },
  devices: {
    href: "/devices",
    label: "디바이스",
    icon: MonitorSmartphone,
    // 온라인 상태 점과 같은 계열 — "디바이스=초록" 연상이 이미 화면에 있다
    iconClass: "text-emerald-500 dark:text-emerald-400",
  },
  walls: {
    href: "/walls",
    label: "비디오월",
    icon: Grid2x2,
    iconClass: "text-fuchsia-500 dark:text-fuchsia-400",
  },
  ads: {
    href: "/ads",
    label: "광고",
    icon: BadgeDollarSign,
    iconClass: "text-orange-500 dark:text-orange-400",
  },
  reports: {
    href: "/reports",
    label: "재생 리포트",
    icon: ChartColumn,
    iconClass: "text-cyan-500 dark:text-cyan-400",
  },
  account: {
    href: "/account",
    label: "마이페이지",
    icon: UserRound,
    iconClass: "text-blue-500 dark:text-blue-400",
  },
  admin: {
    href: "/me",
    label: "관리자",
    icon: ShieldCheck,
    iconClass: "text-red-500 dark:text-red-400",
  },
};
