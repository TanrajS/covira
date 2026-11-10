import { CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { cx } from "@/components/ui";
import type { MatrixKind, MatrixStatus } from "@/lib/domain";

export const STATUS_STYLES: Record<MatrixStatus, { cell: string; dot: string; label: string; Icon: typeof CheckCircle2 }> = {
  GREEN: { cell: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", label: "Covered", Icon: CheckCircle2 },
  YELLOW: { cell: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400", label: "Opportunity / watch", Icon: AlertTriangle },
  RED: { cell: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", label: "Critical gap", Icon: XCircle },
};

export const KIND_LABEL: Record<MatrixKind, string> = { COVERED: "In force", EXPIRING: "Expiring", WHITESPACE: "Whitespace", CRITICAL: "Critical gap" };

export function StatusPill({ status, kind, label, title }: { status: MatrixStatus; kind?: MatrixKind; label: string; title?: string }) {
  const s = STATUS_STYLES[status];
  const Icon = kind === "EXPIRING" ? Clock : s.Icon;
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", s.cell)}>
      <Icon className="size-3.5" />
      {label}
      {kind && kind !== "COVERED" && <span className="font-normal opacity-75">· {KIND_LABEL[kind].toLowerCase()}</span>}
    </span>
  );
}
