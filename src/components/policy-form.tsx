"use client";

import { useActionState, useState } from "react";
import { Crown, Plus, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { COVERAGE_LINES, POLICY_STATUSES } from "@/lib/domain";
import { money } from "@/lib/format";
import { SubscriptionSplit } from "@/components/subscription-split";
import { Button, Card, Field, Notice, cx, inputStyles } from "@/components/ui";

type Row = { carrierName: string; sharePercent: number; isLead: boolean };
type Defaults = Partial<{
  coverageLine: string; policyNumber: string; description: string | null; effectiveDate: string; expiryDate: string;
  premium: number; limit: number | null; deductible: number | null; status: string; isMaster: boolean;
}>;

export function PolicyForm({
  action, defaults = {}, participations, carriers, submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults?: Defaults;
  participations: Row[];
  carriers: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [rows, setRows] = useState<Row[]>(participations.length ? participations : [{ carrierName: "", sharePercent: 100, isLead: true }]);
  const [premium, setPremium] = useState<number>(defaults.premium ?? 0);
  const total = rows.reduce((s, r) => s + (Number(r.sharePercent) || 0), 0);
  const leadCount = rows.filter((r) => r.isLead).length;
  const valid = Math.abs(total - 100) < 0.01 && leadCount === 1 && rows.every((r) => r.carrierName.trim());

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : patch.isLead ? { ...r, isLead: false } : r)));
  const v = (x: unknown) => (x == null ? "" : String(x));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="participations" value={JSON.stringify(rows)} />
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Policy</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coverage line *">
            <select name="coverageLine" defaultValue={defaults.coverageLine ?? "P_C"} className={inputStyles}>
              {COVERAGE_LINES.map((l) => <option key={l.key} value={l.key}>{l.long}</option>)}
            </select>
          </Field>
          <Field label="Policy number *"><input name="policyNumber" required defaultValue={v(defaults.policyNumber)} className={inputStyles} /></Field>
          <Field label="Description" className="sm:col-span-2"><input name="description" defaultValue={v(defaults.description)} className={inputStyles} /></Field>
          <Field label="Effective date *"><input name="effectiveDate" type="date" required defaultValue={v(defaults.effectiveDate)} className={inputStyles} /></Field>
          <Field label="Expiry date *"><input name="expiryDate" type="date" required defaultValue={v(defaults.expiryDate)} className={inputStyles} /></Field>
          <Field label="Annual premium (CAD) *"><input name="premium" type="number" min={0} step="1" required value={premium || ""} onChange={(e) => setPremium(Number(e.target.value))} className={inputStyles} /></Field>
          <Field label="Limit (CAD)"><input name="limit" type="number" min={0} step="1" defaultValue={v(defaults.limit)} className={inputStyles} /></Field>
          <Field label="Deductible (CAD)"><input name="deductible" type="number" min={0} step="1" defaultValue={v(defaults.deductible)} className={inputStyles} /></Field>
          <Field label="Status">
            <select name="status" defaultValue={defaults.status ?? "ACTIVE"} className={inputStyles}>
              {POLICY_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="isMaster" defaultChecked={defaults.isMaster} className="accent-brand-600" />
            <span>Master policy — surfaced first by global search & quick pull</span>
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Market participation (subscription split)</h2>
          <span className={cx("text-xs font-semibold tabular-nums", Math.abs(total - 100) < 0.01 ? "text-emerald-700" : "text-rose-600")}>{total}% placed</span>
        </div>
        <p className="mb-4 text-xs text-slate-500">One lead market sets terms; followers subscribe on a quota-share basis. Shares must total 100%.</p>

        <div className="mb-4"><SubscriptionSplit premium={premium} participations={rows.filter((r) => r.carrierName).map((r, i) => ({ id: String(i), sharePercent: Number(r.sharePercent) || 0, isLead: r.isLead, carrier: { name: r.carrierName } }))} /></div>

        <datalist id="carriers">{carriers.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_auto_auto] items-center gap-2">
              <input list="carriers" placeholder="Insurer" value={r.carrierName} onChange={(e) => update(i, { carrierName: e.target.value })} className={inputStyles} />
              <div className="relative">
                <input type="number" min={0} max={100} step="0.5" value={r.sharePercent} onChange={(e) => update(i, { sharePercent: Number(e.target.value) })} className={cx(inputStyles, "pr-6 text-right")} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
              <button type="button" onClick={() => update(i, { isLead: true })} className={cx("flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ring-1", r.isLead ? "bg-brand-600 text-white ring-brand-600" : "text-slate-500 ring-slate-300 hover:bg-slate-50")}>
                <Crown className="size-3.5" /> Lead
              </button>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows((rs) => { const next = rs.filter((_, j) => j !== i); if (!next.some((x) => x.isLead) && next[0]) next[0] = { ...next[0], isLead: true }; return next; })} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
                <Trash2 className="size-4" />
              </button>
              <div className="col-span-4 -mt-1 hidden text-right text-[11px] text-slate-400 sm:block">{premium ? money((premium * (Number(r.sharePercent) || 0)) / 100) : ""}</div>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" className="mt-2" onClick={() => setRows((rs) => [...rs, { carrierName: "", sharePercent: Math.max(0, 100 - total), isLead: false }])}>
          <Plus className="size-4" /> Add market
        </Button>
      </Card>

      {state && !state.ok && <Notice tone="red">{state.error}</Notice>}
      <Button variant="primary" disabled={pending || !valid}>{pending ? "Saving…" : submitLabel}</Button>
      {!valid && <span className="ml-3 text-xs text-slate-500">Shares must total 100% with exactly one lead.</span>}
    </form>
  );
}
