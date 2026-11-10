"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, Search } from "lucide-react";
import { COVERAGE_LINES, type CoverageLine, type MatrixStatus } from "@/lib/domain";
import { date, moneyCompact } from "@/lib/format";
import type { MatrixRow } from "@/lib/queries";
import { Clock } from "lucide-react";
import { KIND_LABEL, STATUS_STYLES } from "@/components/coverage-cell";
import { Card, Stat, cx, inputStyles } from "@/components/ui";

const RANK: Record<MatrixStatus, number> = { RED: 0, YELLOW: 1, GREEN: 2 };

export function CrossSellMatrix({ rows }: { rows: MatrixRow[] }) {
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [sortLine, setSortLine] = useState<CoverageLine | null>(null);

  const owners = useMemo(() => [...new Set(rows.flatMap((r) => [r.ae, r.broker]).filter(Boolean) as string[])].sort(), [rows]);

  const visible = useMemo(() => {
    let out = rows.filter(
      (r) => (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.industry.toLowerCase().includes(q.toLowerCase())) && (!owner || r.ae === owner || r.broker === owner) && (!gapsOnly || r.gaps > 0),
    );
    if (sortLine) out = [...out].sort((a, b) => RANK[a.cells[sortLine].status] - RANK[b.cells[sortLine].status] || a.name.localeCompare(b.name));
    return out;
  }, [rows, q, owner, gapsOnly, sortLine]);

  const all = visible.flatMap((r) => Object.values(r.cells));
  const red = all.filter((c) => c.status === "RED").length;
  const yellow = all.filter((c) => c.status === "YELLOW").length;
  const full = visible.filter((r) => r.gaps === 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Clients" value={visible.length} />
        <Stat label="Critical gaps" value={<span className="text-rose-600">{red}</span>} sub="Required line not in force" />
        <Stat label="Opportunities / watch" value={<span className="text-amber-700">{yellow}</span>} sub="Whitespace or expiring cover" />
        <Stat label="Fully covered" value={<span className="text-emerald-700">{full}</span>} sub="All five lines in force" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client or industry…" className={cx(inputStyles, "pl-8")} />
          </div>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={cx(inputStyles, "w-auto")}>
            <option value="">All AEs & Brokers</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} className="accent-brand-600" /> Gaps only
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {(["GREEN", "YELLOW", "RED"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className={cx("size-2.5 rounded-sm", STATUS_STYLES[s].dot)} />{STATUS_STYLES[s].label}</span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-4 py-2.5 font-medium">Client</th>
                {COVERAGE_LINES.map((l) => (
                  <th key={l.key} className="border-b border-slate-200 px-2 py-2.5 text-center font-medium">
                    <button onClick={() => setSortLine(sortLine === l.key ? null : l.key)} title={`Sort by ${l.long} gaps`} className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100", sortLine === l.key && "bg-slate-100 text-slate-900")}>
                      {l.label}
                      {sortLine === l.key && <ArrowDownWideNarrow className="size-3.5" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="group">
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 group-hover:bg-slate-50">
                    <Link href={`/clients/${r.id}`} className="font-medium text-slate-900 hover:text-brand-600">{r.name}</Link>
                    <div className="text-[11px] text-slate-500">{r.industry} · {r.ae === r.broker ? `${r.ae} (hybrid)` : [r.ae, r.broker].filter(Boolean).join(" / ")}</div>
                  </td>
                  {COVERAGE_LINES.map((l) => {
                    const c = r.cells[l.key];
                    const s = STATUS_STYLES[c.status];
                    return (
                      <td key={l.key} className="border-b border-slate-100 p-1.5 group-hover:bg-slate-50">
                        <Link
                          href={`/clients/${r.id}`}
                          title={`${l.long}: ${c.reason}${c.expiry ? ` · expires ${date(c.expiry)}` : ""}`}
                          className={cx("flex h-11 flex-col items-center justify-center rounded-md text-[11px] font-medium ring-1 ring-inset transition hover:brightness-95", s.cell)}
                        >
                          <span className="flex items-center gap-1">{c.kind === "EXPIRING" ? <Clock className="size-3.5" /> : <s.Icon className="size-3.5" />}{KIND_LABEL[c.kind]}</span>
                          {c.premium > 0 && <span className="tabular-nums opacity-75">{moneyCompact(c.premium)}</span>}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-xs text-slate-500">
                <td className="sticky left-0 bg-white px-4 py-2.5 font-medium">Penetration</td>
                {COVERAGE_LINES.map((l) => {
                  const green = visible.filter((r) => r.cells[l.key].premium > 0).length;
                  return <td key={l.key} className="px-2 py-2.5 text-center tabular-nums">{visible.length ? Math.round((green / visible.length) * 100) : 0}%</td>;
                })}
              </tr>
            </tfoot>
          </table>
          {visible.length === 0 && <div className="py-10 text-center text-slate-500">No clients match these filters.</div>}
        </div>
      </Card>
    </div>
  );
}
