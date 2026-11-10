"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions";
import { CLIENT_STATUSES, COVERAGE_LINES } from "@/lib/domain";
import { Button, Card, Field, Notice, inputStyles } from "@/components/ui";

type Defaults = Partial<{
  name: string; legalName: string | null; industry: string; naicsCode: string | null; annualRevenue: number | null;
  employeeCount: number | null; yearEstablished: number | null; website: string | null; hqCity: string | null;
  hqRegion: string | null; status: string; criticalLines: string; aeId: string | null; brokerId: string | null;
}>;
type Person = { id: string; name: string };

export function ClientForm({
  action, defaults = {}, assignees, submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults?: Defaults;
  assignees?: { aes: Person[]; brokers: Person[] };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const critical = new Set((defaults.criticalLines ?? "P_C").split(","));
  const v = (x: unknown) => (x == null ? "" : String(x));

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Firmographics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name *"><input name="name" required defaultValue={v(defaults.name)} className={inputStyles} /></Field>
          <Field label="Legal name"><input name="legalName" defaultValue={v(defaults.legalName)} className={inputStyles} /></Field>
          <Field label="Industry *"><input name="industry" required defaultValue={v(defaults.industry)} className={inputStyles} placeholder="e.g. Food Manufacturing" /></Field>
          <Field label="NAICS code"><input name="naicsCode" defaultValue={v(defaults.naicsCode)} className={inputStyles} /></Field>
          <Field label="Annual revenue (CAD)"><input name="annualRevenue" type="number" min={0} step="1" defaultValue={v(defaults.annualRevenue)} className={inputStyles} /></Field>
          <Field label="Employees"><input name="employeeCount" type="number" min={0} defaultValue={v(defaults.employeeCount)} className={inputStyles} /></Field>
          <Field label="Year established"><input name="yearEstablished" type="number" min={1800} max={2100} defaultValue={v(defaults.yearEstablished)} className={inputStyles} /></Field>
          <Field label="Website"><input name="website" defaultValue={v(defaults.website)} className={inputStyles} /></Field>
          <Field label="HQ city"><input name="hqCity" defaultValue={v(defaults.hqCity)} className={inputStyles} /></Field>
          <Field label="Province / state"><input name="hqRegion" defaultValue={v(defaults.hqRegion)} className={inputStyles} /></Field>
          <Field label="Status">
            <select name="status" defaultValue={defaults.status ?? "ACTIVE"} className={inputStyles}>
              {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Critical coverages</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">Lines this client must carry. A missing critical line shows <b className="text-rose-600">red</b> on the cross-sell matrix; other gaps show as amber whitespace.</p>
        <div className="flex flex-wrap gap-2">
          {COVERAGE_LINES.map((l) => (
            <label key={l.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 has-checked:border-brand-500 has-checked:bg-brand-50">
              <input type="checkbox" name="criticalLines" value={l.key} defaultChecked={critical.has(l.key)} className="accent-brand-600" />
              {l.label}
            </label>
          ))}
        </div>
      </Card>

      {assignees && (
        <Card className="p-5">
          <h2 className="font-semibold">Account team</h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">Assign the same person to both seats for a hybrid Broker/AE account.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client Executive (AE)">
              <select name="aeId" defaultValue={defaults.aeId ?? ""} className={inputStyles}>
                <option value="">— Unassigned —</option>
                {assignees.aes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Commercial Risk Broker">
              <select name="brokerId" defaultValue={defaults.brokerId ?? ""} className={inputStyles}>
                <option value="">— Unassigned —</option>
                {assignees.brokers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
        </Card>
      )}

      {state && !state.ok && <Notice tone="red">{state.error}</Notice>}
      {state?.ok && state.message && <Notice tone="blue">{state.message}</Notice>}
      <Button variant="primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
