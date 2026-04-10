"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

type LinkPrefetch = ComponentProps<typeof Link>["prefetch"];

// 현재 경로와 비교해 활성 스타일을 주는 래퍼(헤더·푸터 내비)
export function NavLink({
  href,
  end,
  className,
  prefetch,
  children,
}: {
  href: string;
  end?: boolean;
  className: (opts: { isActive: boolean }) => string;
  /** Next.js `Link` — 비우면 프레임워크 기본(`auto` 등) */
  prefetch?: LinkPrefetch;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = end
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`); // 하위 경로도 활성 처리
  return (
    <Link href={href} prefetch={prefetch} className={className({ isActive })}>
      {children}
    </Link>
  );
}
