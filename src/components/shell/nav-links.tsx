"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Grid3x3, KanbanSquare, LayoutDashboard, TrendingUp } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = { dashboard: LayoutDashboard, clients: Building2, renewals: KanbanSquare, matrix: Grid3x3, team: TrendingUp };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium transition",
              active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Hook-free variant used as the Suspense fallback (prerenders into the static shell). */
export function NavLinksStatic({ items }: { items: NavItem[] }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-400 hover:bg-white/5 hover:text-slate-100">
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
