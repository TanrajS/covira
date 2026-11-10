import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { isLeadOrAdmin } from "@/lib/permissions";
import { NavLinks, NavLinksStatic, type NavItem } from "./nav-links";

const BASE: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/clients", label: "Clients", icon: "clients" },
  { href: "/renewals", label: "Renewal Pipeline", icon: "renewals" },
  { href: "/cross-sell", label: "Cross-Sell Matrix", icon: "matrix" },
];

async function Nav() {
  const user = await getCurrentUser();
  const items = user && isLeadOrAdmin(user) ? [...BASE, { href: "/team", label: "Team Roll-up", icon: "team" } as NavItem] : BASE;
  return <NavLinks items={items} />;
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-900 px-3 py-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-500 text-white">
          <ShieldCheck className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">Covira</span>
      </div>
      <Suspense fallback={<NavLinksStatic items={BASE} />}>
        <Nav />
      </Suspense>
      <div className="mt-auto px-2.5 text-[11px] leading-relaxed text-slate-500">Commercial Risk Broking</div>
    </aside>
  );
}
