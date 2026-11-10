import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { getTeamRollup } from "@/lib/queries";
import { COVERAGE_LINES, stageLabel } from "@/lib/domain";
import { money, moneyCompact } from "@/lib/format";
import { isLeadOrAdmin, parseCapabilities } from "@/lib/permissions";
import { Badge, Card, CardHeader, Empty, Notice, PageHeader, Stat, cx } from "@/components/ui";

export const metadata = { title: "Team roll-up" };

const STAGE_BAR = ["bg-slate-400", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500"];

export default async function TeamPage() {
  const user = await requireUser();
  if (!isLeadOrAdmin(user)) {
    return <div className="mx-auto max-w-xl py-10"><Notice>Team roll-ups are available to Team Leads.</Notice></div>;
  }
  const t = await getTeamRollup(user);
  const maxStage = Math.max(...t.byStage.map((s) => s.premium), 1);
  const maxLine = Math.max(...t.lineMix.map((l) => l.premium), 1);
  const maxVelocity = Math.max(...t.velocity.map((v) => v.avgDays ?? 0), 1);
  const producers = t.producers.filter((p) => p.bookPremium || p.pipelineCount).sort((a, b) => b.bookPremium - a.bookPremium);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Team roll-up" subtitle="Pipeline velocity and revenue across the team's book." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Book premium in force" value={moneyCompact(t.totals.book)} />
        <Stat label="Open renewal pipeline" value={moneyCompact(t.totals.pipeline)} sub="Target premium where set, else expiring" />
        <Stat label="Bound YTD" value={moneyCompact(t.totals.boundYtd)} />
        <Stat label="Renewal rate change YTD" value={t.totals.retention ? `${t.totals.retention >= 1 ? "+" : ""}${((t.totals.retention - 1) * 100).toFixed(1)}%` : "—"} sub="Bound vs. expiring premium" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pipeline by stage" subtitle="Premium value at each milestone (Bound = year to date)" />
          <div className="space-y-3 p-5">
            {t.byStage.map((s, i) => (
              <div key={s.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{s.label} <span className="text-slate-400">· {s.count}</span></span>
                  <span className="tabular-nums text-slate-600">{money(s.premium)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div className={cx("h-full rounded-full", STAGE_BAR[i])} style={{ width: `${(s.premium / maxStage) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pipeline velocity" subtitle="Average days spent in each stage, from the stage-move log" />
          <div className="space-y-3 p-5">
            {t.velocity.map((v) => (
              <div key={v.key} className="grid grid-cols-[110px_minmax(0,1fr)_70px] items-center gap-3 text-xs">
                <span className="font-medium text-slate-700">{v.label}</span>
                <div className="h-2.5 rounded-full bg-slate-100">
                  {v.avgDays != null && <div className="h-full rounded-full bg-brand-500" style={{ width: `${(v.avgDays / maxVelocity) * 100}%` }} />}
                </div>
                <span className="text-right tabular-nums text-slate-600">{v.avgDays != null ? `${v.avgDays.toFixed(0)} days` : "—"}</span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-slate-400">Based on {t.velocity.reduce((s, v) => s + v.samples, 0)} completed stage transitions.</p>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Producer roll-up" subtitle="Hybrid Broker/AEs are credited once per account in Book, and in both AE and Broker columns" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Producer</th>
                <th className="px-3 py-2.5 text-right font-medium">As AE</th>
                <th className="px-3 py-2.5 text-right font-medium">As Broker</th>
                <th className="px-3 py-2.5 text-right font-medium">Book</th>
                <th className="px-3 py-2.5 text-right font-medium">Open renewals</th>
                <th className="px-3 py-2.5 text-right font-medium">Pipeline</th>
                <th className="px-5 py-2.5 text-right font-medium">Bound YTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {producers.map((p) => {
                const caps = parseCapabilities(p.roles);
                const hybrid = caps.includes("AE") && caps.includes("BROKER");
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">{p.title}{hybrid && <Badge tone="violet">Hybrid</Badge>}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.aePremium ? moneyCompact(p.aePremium) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.brokerPremium ? moneyCompact(p.brokerPremium) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{moneyCompact(p.bookPremium)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.pipelineCount}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{moneyCompact(p.pipelinePremium)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{moneyCompact(p.boundYtd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Behind schedule" subtitle="Clock has passed the next milestone but the card hasn't moved" />
          {t.atRisk.length === 0 ? <Empty>Every renewal is on pace.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {t.atRisk.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <Link href={`/clients/${r.clientId}`} className="font-medium hover:text-brand-600">{r.client.name}</Link>
                    <div className="text-xs text-slate-500">Still in {stageLabel(r.stage)}</div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-rose-600">{r.daysToExpiry} days left</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Premium by coverage line" />
          <div className="space-y-3 p-5">
            {t.lineMix.map((l) => (
              <div key={l.line} className="grid grid-cols-[110px_minmax(0,1fr)_70px] items-center gap-3 text-xs">
                <span className="font-medium text-slate-700">{COVERAGE_LINES.find((x) => x.key === l.line)?.label}</span>
                <div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${(l.premium / maxLine) * 100}%` }} /></div>
                <span className="text-right tabular-nums text-slate-600">{moneyCompact(l.premium)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
