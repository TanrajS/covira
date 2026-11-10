import Link from "next/link";
import { FileText, Lock, Newspaper } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { getDashboard } from "@/lib/queries";
import { docCategoryLabel, stageLabel, updateCategoryLabel } from "@/lib/domain";
import { dateTime, moneyCompact } from "@/lib/format";
import { isHybrid } from "@/lib/permissions";
import { Badge, ButtonLink, Card, CardHeader, Empty, PageHeader, Stat, cx } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboard(user);
  const locked = d.renewals.filter((r) => r.sovMissing);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        subtitle={isHybrid(user) ? "You're working your accounts end-to-end as Broker and AE." : "Here's what needs your attention across your book."}
        actions={<ButtonLink href="/renewals" variant="primary">Open renewal pipeline</ButtonLink>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="My accounts" value={d.clientCount} />
        <Stat label="Book premium (in force)" value={moneyCompact(d.bookPremium)} />
        <Stat label="Open renewals" value={d.renewals.length} sub="Next 8 by expiry shown below" />
        <Stat label="Locked at 120 days" value={locked.length} sub="Waiting on an SOV upload" tone={locked.length ? "warn" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="My upcoming renewals" subtitle="Accounts where you're the AE or Broker" />
          {d.renewals.length === 0 ? (
            <Empty>No open renewals on your accounts.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.renewals.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/clients/${r.client.id}`} className="font-medium text-slate-900 hover:text-brand-600">{r.client.name}</Link>
                    <div className="text-xs text-slate-500">{r.termYear} renewal · {stageLabel(r.stage)}</div>
                  </div>
                  {r.sovMissing && (
                    <Link href={`/clients/${r.client.id}/vault?term=${r.termYear}&upload=SOV`}>
                      <Badge tone="amber"><Lock className="size-3" /> SOV needed</Badge>
                    </Link>
                  )}
                  <span className={cx("w-20 text-right text-xs font-semibold tabular-nums", r.daysToExpiry <= 30 ? "text-rose-600" : r.daysToExpiry <= 90 ? "text-amber-700" : "text-slate-600")}>
                    {r.daysToExpiry >= 0 ? `${r.daysToExpiry} days` : `${-r.daysToExpiry}d past`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Latest client updates" />
            {d.updates.length === 0 ? <Empty>No updates yet.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {d.updates.map((u) => (
                  <li key={u.id} className="px-5 py-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <Newspaper className="size-3.5" />
                      <Link href={`/clients/${u.client.id}#updates`} className="font-medium text-slate-700 hover:text-brand-600">{u.client.name}</Link>
                      <Badge>{updateCategoryLabel(u.category)}</Badge>
                    </div>
                    <p className="line-clamp-2 text-slate-700">{u.body}</p>
                    <div className="mt-1 text-[11px] text-slate-400">{u.author.name} · {dateTime(u.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent uploads" />
            <ul className="divide-y divide-slate-100">
              {d.recentDocs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2.5 px-5 py-2.5">
                  <FileText className="size-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium text-slate-800 hover:text-brand-600">{doc.fileName}</a>
                    <div className="text-xs text-slate-500">{doc.client.name} · {docCategoryLabel(doc.category)} · {doc.termYear}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
