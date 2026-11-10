import Link from "next/link";
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";
import { initials } from "@/lib/format";

/** clsx + tailwind-merge, so later utilities (e.g. `w-auto`) override earlier ones (`w-full`). */
export const cx = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-xl border border-slate-200 bg-white shadow-xs", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, id }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div id={id} className="flex scroll-mt-20 items-start justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium text-slate-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const badgeTones = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "slate", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", badgeTones[tone], className)}
      {...props}
    />
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50";
export const buttonStyles = {
  primary: cx(buttonBase, "bg-brand-600 text-white shadow-xs hover:bg-brand-700"),
  secondary: cx(buttonBase, "border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50"),
  ghost: cx(buttonBase, "text-slate-600 hover:bg-slate-100 hover:text-slate-900"),
  danger: cx(buttonBase, "text-rose-600 hover:bg-rose-50"),
};

export function ButtonLink({ variant = "secondary", className, ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cx(buttonStyles[variant], className)} {...props} />;
}

export function Button({ variant = "secondary", className, ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return <button className={cx(buttonStyles[variant], className)} {...props} />;
}

export const inputStyles =
  "block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={cx("inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700", className)}
    >
      {initials(name)}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "warn" }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone === "warn" ? "text-amber-700" : "text-slate-900")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "red" | "blue"; children: ReactNode }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    blue: "border-brand-100 bg-brand-50 text-brand-700",
  };
  return <div className={cx("rounded-lg border px-3.5 py-2.5 text-sm", tones[tone])}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-slate-200/70", className)} />;
}
