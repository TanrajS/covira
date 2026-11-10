import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { savePolicy } from "@/lib/actions";
import { listCarriers } from "@/lib/queries";
import { can, permissionHint } from "@/lib/permissions";
import { PolicyForm } from "@/components/policy-form";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Edit placement" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function EditPolicyPage({ params }: PageProps<"/clients/[id]/policies/[policyId]">) {
  const user = await requireUser();
  const { id, policyId } = await params;
  const policy = await db.policy.findFirst({
    where: { id: policyId, clientId: id },
    include: { client: true, participations: { include: { carrier: true } } },
  });
  if (!policy || !can(user, policy.client, { type: "client.view" })) notFound();
  if (!can(user, policy.client, { type: "placement.manage" })) return <div className="mx-auto max-w-xl py-10"><Notice>{permissionHint({ type: "placement.manage" })}</Notice></div>;
  const carriers = (await listCarriers()).map((c) => c.name);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={policy.client.name} title={`Edit placement · ${policy.policyNumber}`} />
      <PolicyForm
        action={savePolicy.bind(null, id, policy.id)}
        defaults={{ ...policy, effectiveDate: iso(policy.effectiveDate), expiryDate: iso(policy.expiryDate) }}
        participations={policy.participations
          .sort((a, b) => Number(b.isLead) - Number(a.isLead) || b.sharePercent - a.sharePercent)
          .map((p) => ({ carrierName: p.carrier.name, sharePercent: p.sharePercent, isLead: p.isLead }))}
        carriers={carriers}
        submitLabel="Save placement"
      />
    </div>
  );
}
