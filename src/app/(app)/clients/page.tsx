import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { listClients } from "@/lib/queries";
import { coverageLabel, stageLabel } from "@/lib/domain";
import { daysBetween, moneyCompact } from "@/lib/format";
import { Avatar, Badge, ButtonLink, Card, Empty, PageHeader, inputStyles } from "@/components/ui";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const clients = await listClients(user, query);
  const now = new Date();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} account${clients.length === 1 ? "" : "s"} in your book`}
        actions={<ButtonLink href="/clients/new" variant="primary"><Plus className="size-4" /> New client</ButtonLink>}
      />
      <Card>
        <form className="flex items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={query} placeholder="Filter by client name…" className={`${inputStyles} pl-8`} />
          </div>
        </form>
        {clients.length === 0 ? <Empty>No clients match.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs font-medium text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-3 py-2.5 font-medium">AE / Broker</th>
                  <th className="px-3 py-2.5 font-medium">Lines in force</th>
                  <th className="px-3 py-2.5 text-right font-medium">Premium</th>
                  <th className="px-5 py-2.5 font-medium">Next renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-brand-600">{c.name}</Link>
                      <div className="text-xs text-slate-500">{c.industry}{c.hqCity ? ` · ${c.hqCity}, ${c.hqRegion}` : ""}</div>
                    </td>
                    <td className="px-3 py-3">
                      {c.aeId && c.aeId === c.brokerId ? (
                        <span className="flex items-center gap-1.5"><Avatar name={c.ae!.name} /><span>{c.ae!.name}</span><Badge tone="violet">Hybrid</Badge></span>
                      ) : (
                        <div className="space-y-0.5 text-xs">
                          <div><span className="text-slate-400">AE</span> {c.ae?.name ?? "—"}</div>
                          <div><span className="text-slate-400">BR</span> {c.broker?.name ?? "—"}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.status === "PROSPECT" && <Badge tone="blue">Prospect</Badge>}
                        {c.lines.map((l) => <Badge key={l}>{coverageLabel(l)}</Badge>)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.activePremium ? moneyCompact(c.activePremium) : "—"}</td>
                    <td className="px-5 py-3 text-xs">
                      {c.openRenewal ? (
                        <>
                          <div className="font-medium text-slate-700">{stageLabel(c.openRenewal.stage)}</div>
                          <div className="text-slate-500">{daysBetween(now, c.openRenewal.expiryDate)} days to expiry</div>
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
