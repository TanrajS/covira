import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { savePolicy } from "@/lib/actions";
import { listCarriers } from "@/lib/queries";
import { can, permissionHint } from "@/lib/permissions";
import { PolicyForm } from "@/components/policy-form";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Add policy" };

export default async function NewPolicyPage({ params }: PageProps<"/clients/[id]/policies/new">) {
  const user = await requireUser();
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client || !can(user, client, { type: "client.view" })) notFound();
  if (!can(user, client, { type: "placement.manage" })) return <div className="mx-auto max-w-xl py-10"><Notice>{permissionHint({ type: "placement.manage" })}</Notice></div>;
  const carriers = (await listCarriers()).map((c) => c.name);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={client.name} title="Add policy" />
      <PolicyForm action={savePolicy.bind(null, client.id, null)} participations={[]} carriers={carriers} submitLabel="Create policy" />
    </div>
  );
}
