import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/actions";
import { assignableUsers } from "@/lib/queries";
import { isHybrid, isLeadOrAdmin } from "@/lib/permissions";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requireUser();
  const lead = isLeadOrAdmin(user);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New client"
        subtitle={lead ? "Assign the account team below." : isHybrid(user) ? "You'll be assigned as both AE and Broker." : "You'll be assigned to this account automatically."}
      />
      <ClientForm action={createClient} assignees={lead ? await assignableUsers() : undefined} submitLabel="Create client" />
    </div>
  );
}
