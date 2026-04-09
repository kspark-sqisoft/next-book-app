"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  end,
  className,
  children,
}: {
  href: string;
  end?: boolean;
  className: (opts: { isActive: boolean }) => string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = end
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={className({ isActive })}>
      {children}
    </Link>
  );
}
