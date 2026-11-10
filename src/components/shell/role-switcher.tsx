"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Info } from "lucide-react";
import { PERSONAS, type PersonaKey } from "@/lib/personas";
import { switchPersona } from "@/lib/persona-actions";
import { cx } from "@/components/ui";

export function RoleSwitcher({ current }: { current: PersonaKey }) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5">
      <label className="hidden text-xs font-medium text-slate-500 sm:block" htmlFor="role-switcher">Viewing as</label>
      <select
        id="role-switcher"
        value={current}
        disabled={pending}
        onChange={(e) => start(() => switchPersona(e.target.value, pathname))}
        className={cx("rounded-lg border border-slate-300 bg-white py-1 pl-2 pr-7 text-sm font-medium text-slate-800 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20", pending && "opacity-60")}
      >
        {PERSONAS.map((p) => (
          <option key={p.key} value={p.key}>{p.role} — {p.name}</option>
        ))}
      </select>
      <Link href="/welcome" title="About the roles" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <Info className="size-4" />
      </Link>
    </div>
  );
}
