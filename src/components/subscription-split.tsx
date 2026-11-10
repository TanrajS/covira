import { Crown } from "lucide-react";
import { cx } from "@/components/ui";
import { money, pct } from "@/lib/format";

type Participant = { id: string; sharePercent: number; isLead: boolean; carrier: { name: string } };

const FOLLOW_COLOURS = ["bg-teal-500", "bg-amber-400", "bg-violet-500", "bg-rose-400", "bg-sky-400", "bg-lime-500", "bg-slate-400"];

/**
 * Subscription split for a syndicated placement: who leads, who follows on a
 * quota-share basis, and each market's share of premium.
 */
export function SubscriptionSplit({ participations, premium, compact }: { participations: Participant[]; premium: number; compact?: boolean }) {
  const sorted = [...participations].sort((a, b) => Number(b.isLead) - Number(a.isLead) || b.sharePercent - a.sharePercent);
  const colourFor = (i: number, lead: boolean) => (lead ? "bg-brand-600" : FOLLOW_COLOURS[(i - 1 + FOLLOW_COLOURS.length) % FOLLOW_COLOURS.length]);
  const total = sorted.reduce((s, p) => s + p.sharePercent, 0);
  const syndicated = sorted.length > 1;

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-md ring-1 ring-slate-200" role="img" aria-label={sorted.map((p) => `${p.carrier.name} ${p.sharePercent}%${p.isLead ? " (lead)" : ""}`).join(", ")}>
        {sorted.map((p, i) => (
          <div
            key={p.id}
            title={`${p.carrier.name} — ${pct(p.sharePercent)}${p.isLead ? " (lead market)" : " (quota share)"}`}
            className={cx("flex items-center justify-center border-r border-white/70 text-[11px] font-semibold text-white last:border-r-0", colourFor(i, p.isLead))}
            style={{ width: `${(p.sharePercent / Math.max(total, 100)) * 100}%` }}
          >
            {p.sharePercent >= 12 && (
              <span className="flex items-center gap-1 truncate px-1">
                {p.isLead && <Crown className="size-3" />}
                {pct(p.sharePercent)}
              </span>
            )}
          </div>
        ))}
        {total < 100 && <div className="flex-1 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_4px,#e2e8f0_4px,#e2e8f0_8px)]" title="Unplaced" />}
      </div>

      {!compact && (
        <ul className="mt-2.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {sorted.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <span className={cx("size-2.5 shrink-0 rounded-sm", colourFor(i, p.isLead))} />
              <span className={cx("truncate", p.isLead ? "font-semibold text-slate-900" : "text-slate-700")}>{p.carrier.name}</span>
              <span className={cx("shrink-0 rounded px-1 text-[10px] font-medium uppercase tracking-wide", p.isLead ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>
                {p.isLead ? (syndicated ? "Lead" : "Sole") : "Quota share"}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-slate-500">
                {pct(p.sharePercent)} · {money((premium * p.sharePercent) / 100)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
