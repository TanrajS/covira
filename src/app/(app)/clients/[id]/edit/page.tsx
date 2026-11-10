import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { updateClient } from "@/lib/actions";
import { assignableUsers } from "@/lib/queries";
import { can, permissionHint } from "@/lib/permissions";
import { ClientForm } from "@/components/client-form";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client || !can(user, client, { type: "client.view" })) notFound();
  if (!can(user, client, { type: "client.edit" })) {
    return <div className="mx-auto max-w-xl py-10"><Notice>{permissionHint({ type: "client.edit" })}</Notice></div>;
  }
  const reassign = can(user, client, { type: "client.reassign" });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={client.name} title="Edit profile" />
      <ClientForm
        action={updateClient.bind(null, client.id)}
        defaults={client}
        assignees={reassign ? await assignableUsers() : undefined}
        submitLabel="Save changes"
      />
    </div>
  );
}
