import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentTermForClient, getVault } from "@/lib/queries";
import { DOC_CATEGORY_KEYS, STAGE_DOCUMENT_GATES, docCategoryLabel, isTermYear, shiftTermYear, stageLabel, type DocCategory } from "@/lib/domain";
import { accountRoles, can } from "@/lib/permissions";
import { UploadPanel } from "@/components/vault/upload-panel";
import { DocList } from "@/components/vault/doc-list";
import { Badge, Card, CardHeader, PageHeader, cx } from "@/components/ui";

export const metadata = { title: "Document vault" };

export default async function VaultPage({ params, searchParams }: PageProps<"/clients/[id]/vault">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const client = await db.client.findUnique({
    where: { id },
    include: { policies: { where: { status: "ACTIVE" }, select: { id: true, policyNumber: true, coverageLine: true } } },
  });
  if (!client || !can(user, client, { type: "client.view" })) notFound();

  const term = typeof sp.term === "string" && isTermYear(sp.term) ? sp.term : await currentTermForClient(client.id);
  const vault = await getVault(client.id, term);
  const { docs, terms } = vault;
  const uploadTerms = [...new Set([shiftTermYear(vault.current, 1), ...terms])].sort((a, b) => b.localeCompare(a));
  const renewal = await db.renewal.findFirst({ where: { clientId: client.id, termYear: term } });

  const allowed = Object.fromEntries(DOC_CATEGORY_KEYS.map((c) => [c, can(user, client, { type: "doc.upload", category: c })])) as Record<DocCategory, boolean>;
  const gateCats = [...new Set(Object.values(STAGE_DOCUMENT_GATES).flat())];
  const initialCategory = typeof sp.upload === "string" && (DOC_CATEGORY_KEYS as string[]).includes(sp.upload) ? (sp.upload as DocCategory) : undefined;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={<Link href={`/clients/${client.id}`} className="hover:text-slate-700">{client.name}</Link>}
        title="Document vault"
        subtitle="Filed by policy term. Active Policies · SOVs · Submissions · Proposals."
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {terms.map((t) => (
          <Link
            key={t}
            href={`/clients/${client.id}/vault?term=${t}`}
            className={cx("rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset", t === term ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}
          >
            {t}
            {t === vault.current && <span className={cx("ml-1.5 text-[10px] uppercase", t === term ? "text-slate-300" : "text-emerald-600")}>current</span>}
          </Link>
        ))}
      </div>

      {renewal && renewal.stage !== "BOUND" && (
        <Card className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="text-sm"><b>{term} renewal</b> <span className="text-slate-500">· {stageLabel(renewal.stage)}</span></div>
          {gateCats.map((cat) => {
            const has = docs.some((d) => d.category === cat);
            return has ? (
              <span key={cat} className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="size-4" /> {docCategoryLabel(cat)} on file — pipeline unlocked</span>
            ) : (
              <span key={cat} className="flex items-center gap-1.5 text-xs font-medium text-amber-800"><Lock className="size-4" /> {docCategoryLabel(cat)} required before this renewal can leave 120 Days Out</span>
            );
          })}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DocList docs={docs} term={term} currentUserId={user.id} oversight={accountRoles(user, client).oversight} />
        <aside>
          <Card className="sticky top-20">
            <CardHeader title="Upload" subtitle={<>Filing into <Badge>{term}</Badge> by default</>} />
            <div className="p-4">
              <UploadPanel clientId={client.id} term={term} terms={uploadTerms} allowed={allowed} initialCategory={initialCategory} policies={client.policies} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
