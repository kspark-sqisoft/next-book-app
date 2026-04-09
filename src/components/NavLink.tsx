"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

type LinkPrefetch = ComponentProps<typeof Link>["prefetch"];

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
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} prefetch={prefetch} className={className({ isActive })}>
      {children}
    </Link>
  );
}
