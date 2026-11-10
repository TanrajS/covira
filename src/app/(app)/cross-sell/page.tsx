import { requireUser } from "@/lib/dal";
import { getMatrix } from "@/lib/queries";
import { CrossSellMatrix } from "@/components/cross-sell-matrix";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Cross-sell matrix" };

export default async function CrossSellPage() {
  const user = await requireUser();
  const rows = await getMatrix(user);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Cross-sell matrix"
        subtitle="Every client against every coverage line. Spot whitespace and missing critical cover before the next client meeting. Critical lines are set per client on the profile."
      />
      <CrossSellMatrix rows={rows} />
    </div>
  );
}
