import Link from "next/link";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { getKanban } from "@/lib/queries";
import { isLeadOrAdmin } from "@/lib/permissions";
import { KanbanBoard } from "@/components/kanban-board";
import { PageHeader, cx } from "@/components/ui";

export const metadata = { title: "Renewal pipeline" };

export default async function RenewalsPage({ searchParams }: PageProps<"/renewals">) {
  const user = await requireUser();
  const { view } = await searchParams;
  const lead = isLeadOrAdmin(user);
  const mine = !lead || view === "mine";
  const cards = await getKanban(user, { mine });
  const locked = cards.filter((c) => c.stage === "D120" && c.missingDocs.length).length;

  return (
    <div>
      <PageHeader
        title="Renewal pipeline"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3">
            <span>Drag renewals through each milestone. Binding and Bound are Broker moves.</span>
            {locked > 0 && <span className="flex items-center gap-1 text-xs font-medium text-amber-700"><Lock className="size-3.5" /> {locked} locked pending SOV</span>}
          </span>
        }
        actions={lead && (
          <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-sm font-medium">
            {[["all", "Team"], ["mine", "My accounts"]].map(([key, label]) => (
              <Link key={key} href={key === "all" ? "/renewals" : "/renewals?view=mine"} className={cx("rounded-md px-3 py-1", (key === "mine") === mine ? "bg-white text-slate-900 shadow-xs" : "text-slate-600")}>
                {label}
              </Link>
            ))}
          </div>
        )}
      />
      <KanbanBoard initialCards={cards} />
    </div>
  );
}
