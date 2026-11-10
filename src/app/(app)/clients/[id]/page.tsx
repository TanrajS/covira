import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, FileText, FolderOpen, Globe, Lock, Pencil, Plus, Star } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { getClientDetail, getQuickPull } from "@/lib/queries";
import { db } from "@/lib/db";
import { COVERAGE_LINES, EXPIRY_WATCH_DAYS, coverageLabel, matrixStatus, stageLabel } from "@/lib/domain";
import { date, dateTime, daysBetween, money, moneyCompact } from "@/lib/format";
import { can } from "@/lib/permissions";
import { SubscriptionSplit } from "@/components/subscription-split";
import { StatusPill } from "@/components/coverage-cell";
import { UpdatesFeed } from "@/components/updates-feed";
import { StartRenewalButton } from "@/components/start-renewal-button";
import { Avatar, Badge, ButtonLink, Card, CardHeader, Empty, PageHeader, cx } from "@/components/ui";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getClientDetail(user, id);
  if (!detail) notFound();
  const { client, roles } = detail;
  const now = new Date();

  const quick = await getQuickPull(client.id);
  const openRenewal = client.renewals.find((r) => r.stage !== "BOUND") ?? null;
  const renewalSov = openRenewal
    ? await db.document.count({ where: { clientId: client.id, termYear: openRenewal.termYear, category: "SOV" } })
    : 0;

  const active = client.policies.filter((p) => p.status === "ACTIVE" && p.expiryDate > now);
  const other = client.policies.filter((p) => !active.includes(p));
  const critical = new Set(client.criticalLines.split(","));
  const canManage = can(user, client, { type: "placement.manage" });
  const canEdit = can(user, client, { type: "client.edit" });
  const roleLabel = roles.hybrid ? "AE + Broker (hybrid)" : roles.ae ? "Client Executive" : roles.broker ? "Broker" : roles.oversight ? "Oversight (Team Lead)" : "Viewer";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={<Link href="/clients" className="hover:text-slate-700">Clients</Link>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.name}
            {client.status !== "ACTIVE" && <Badge tone={client.status === "PROSPECT" ? "blue" : "slate"}>{client.status.toLowerCase()}</Badge>}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{client.industry}</span>
            <span className="flex items-center gap-1.5 text-xs"><span className="text-slate-400">AE</span>{client.ae ? <><Avatar name={client.ae.name} />{client.ae.name}</> : "—"}</span>
            <span className="flex items-center gap-1.5 text-xs"><span className="text-slate-400">Broker</span>{client.broker ? <><Avatar name={client.broker.name} />{client.broker.name}</> : "—"}</span>
            <Badge tone={roles.hybrid ? "violet" : "blue"}>You: {roleLabel}</Badge>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/clients/${client.id}/vault`}><FolderOpen className="size-4" /> Document vault</ButtonLink>
            {canEdit && <ButtonLink href={`/clients/${client.id}/edit`}><Pencil className="size-4" /> Edit profile</ButtonLink>}
            {canManage && <ButtonLink variant="primary" href={`/clients/${client.id}/policies/new`}><Plus className="size-4" /> Add policy</ButtonLink>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Coverage snapshot */}
          <Card>
            <CardHeader title="Coverage snapshot" subtitle="Red = critical line missing · Amber = whitespace or expiring soon" action={<Link href="/cross-sell" className="text-xs font-medium text-brand-600 hover:underline">Cross-sell matrix</Link>} />
            <div className="flex flex-wrap gap-2 p-4">
              {COVERAGE_LINES.map((l) => {
                const pols = active.filter((p) => p.coverageLine === l.key);
                const soonest = pols.sort((a, b) => +a.expiryDate - +b.expiryDate)[0];
                const s = matrixStatus({
                  hasActive: pols.length > 0, isCritical: critical.has(l.key),
                  daysToExpiry: soonest ? daysBetween(now, soonest.expiryDate) : null, renewalStage: openRenewal?.stage ?? null,
                });
                return <StatusPill key={l.key} status={s.status} kind={s.kind} label={l.label} title={s.reason} />;
              })}
            </div>
          </Card>

          {/* Policies & market participation */}
          <Card>
            <CardHeader id="policies" title="Active policies & market participation" subtitle={`${active.length} in force · ${money(active.reduce((s, p) => s + p.premium, 0))} annual premium`} />
            {active.length === 0 ? <Empty>No policies in force.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {active.map((p) => {
                  const lead = p.participations.find((x) => x.isLead);
                  const days = daysBetween(now, p.expiryDate);
                  return (
                    <li key={p.id} className="px-5 py-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{coverageLabel(p.coverageLine)}</span>
                            <span className="font-mono text-xs text-slate-500">{p.policyNumber}</span>
                            {p.isMaster && <Badge tone="blue"><Star className="size-3" /> Master</Badge>}
                            {p.participations.length > 1 && <Badge tone="violet">Syndicated · {p.participations.length} markets</Badge>}
                          </div>
                          {p.description && <div className="mt-0.5 text-xs text-slate-500">{p.description}</div>}
                        </div>
                        <div className="flex items-center gap-4 text-right text-xs">
                          <div><div className="text-slate-400">Premium</div><div className="font-semibold tabular-nums text-slate-900">{money(p.premium)}</div></div>
                          <div><div className="text-slate-400">Limit</div><div className="font-semibold tabular-nums text-slate-900">{moneyCompact(p.limit)}</div></div>
                          <div>
                            <div className="text-slate-400">Term</div>
                            <div className="font-medium text-slate-700">{date(p.effectiveDate)} – {date(p.expiryDate)}</div>
                            <div className={cx("tabular-nums", days <= EXPIRY_WATCH_DAYS ? "font-semibold text-amber-700" : "text-slate-400")}>{days} days left</div>
                          </div>
                          {canManage && <Link href={`/clients/${client.id}/policies/${p.id}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit placement"><Pencil className="size-4" /></Link>}
                        </div>
                      </div>
                      <SubscriptionSplit participations={p.participations} premium={p.premium} />
                      {lead && p.participations.length > 1 && (
                        <p className="mt-2 text-xs text-slate-500">
                          <b className="text-slate-700">{lead.carrier.name}</b> leads at {lead.sharePercent}% and sets terms; {p.participations.filter((x) => !x.isLead).map((x) => `${x.carrier.name} (${x.sharePercent}%)`).join(", ")} follow on a quota-share basis.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {other.length > 0 && (
              <details className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                <summary className="cursor-pointer">{other.length} expired / quoted / cancelled</summary>
                <ul className="mt-2 space-y-1">
                  {other.map((p) => <li key={p.id}>{coverageLabel(p.coverageLine)} · {p.policyNumber} · {p.status.toLowerCase()} · expired {date(p.expiryDate)}</li>)}
                </ul>
              </details>
            )}
          </Card>

          <Card>
            <CardHeader id="updates" title="Client news & operational updates" subtitle="Context to carry into the next underwriting submission. Pinned items surface first." />
            <UpdatesFeed
              clientId={client.id}
              updates={client.updates.map((u) => ({ ...u, when: dateTime(u.createdAt) }))}
              canPost={can(user, client, { type: "update.post" })}
              canPin={can(user, client, { type: "update.pin" })}
              canModerate={roles.oversight}
              currentUserId={user.id}
            />
          </Card>
        </div>

        <aside className="space-y-6">
          {/* Instant pull */}
          <Card>
            <CardHeader title="Current master policy" subtitle={`Term ${quick.term}`} action={<Link href={`/clients/${client.id}/vault?term=${quick.term}`} className="text-xs font-medium text-brand-600 hover:underline">Vault</Link>} />
            <div className="space-y-2 p-4">
              {quick.master ? (
                <a href={`/api/documents/${quick.master.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 hover:border-brand-500">
                  <FileText className="size-4 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1 truncate font-medium">{quick.master.fileName}</span>
                </a>
              ) : <p className="text-xs text-slate-500">No master policy wording filed for {quick.term}.</p>}
              {quick.schedules.map((d) => (
                <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:border-brand-500">
                  {d.category === "SOV" ? <FileSpreadsheet className="size-4 shrink-0 text-slate-400" /> : <FileText className="size-4 shrink-0 text-slate-400" />}
                  <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
                  <span className="text-slate-400">{d.category === "SOV" ? "SOV" : "Schedule"}</span>
                </a>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Renewal" />
            <div className="p-4">
              {openRenewal ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{openRenewal.termYear}</div>
                      <div className="text-xs text-slate-500">Expires {date(openRenewal.expiryDate)} · {daysBetween(now, openRenewal.expiryDate)} days</div>
                    </div>
                    <Badge tone="blue">{stageLabel(openRenewal.stage)}</Badge>
                  </div>
                  {renewalSov ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="size-4" /> SOV on file for {openRenewal.termYear}</div>
                  ) : (
                    <Link href={`/clients/${client.id}/vault?term=${openRenewal.termYear}&upload=SOV`} className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      <span><b>Workflow locked.</b> Upload the {openRenewal.termYear} SOV to move this renewal past 120 Days Out.</span>
                    </Link>
                  )}
                  <ButtonLink href="/renewals" className="w-full">Open pipeline</ButtonLink>
                </div>
              ) : active.length ? (
                <div className="space-y-2 text-xs text-slate-500">
                  <p>No renewal in the pipeline.</p>
                  {can(user, client, { type: "renewal.move", to: "D120" }) && <StartRenewalButton clientId={client.id} />}
                </div>
              ) : <p className="text-xs text-slate-500">Bind a first policy to start tracking renewals.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Firmographics" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-xs">
              <div><dt className="text-slate-400">Revenue</dt><dd className="font-medium text-slate-800">{moneyCompact(client.annualRevenue)}</dd></div>
              <div><dt className="text-slate-400">Employees</dt><dd className="font-medium text-slate-800">{client.employeeCount?.toLocaleString() ?? "—"}</dd></div>
              <div><dt className="text-slate-400">Established</dt><dd className="font-medium text-slate-800">{client.yearEstablished ?? "—"}</dd></div>
              <div><dt className="text-slate-400">NAICS</dt><dd className="font-medium text-slate-800">{client.naicsCode ?? "—"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-400">Headquarters</dt><dd className="font-medium text-slate-800">{[client.hqCity, client.hqRegion, client.hqCountry].filter(Boolean).join(", ")}</dd></div>
              {client.website && <div className="col-span-2"><dt className="text-slate-400">Website</dt><dd className="flex items-center gap-1 font-medium text-slate-800"><Globe className="size-3.5" />{client.website}</dd></div>}
              <div className="col-span-2"><dt className="text-slate-400">Team</dt><dd className="font-medium text-slate-800">{client.team?.name ?? "—"}</dd></div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
