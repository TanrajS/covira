import { redirect } from "next/navigation";
import { ArrowRight, Briefcase, Handshake, Layers, ShieldCheck, TrendingUp } from "lucide-react";
import { PERSONAS, isDemoMode, type PersonaKey } from "@/lib/personas";
import { choosePersona } from "@/lib/persona-actions";

export const metadata = { title: "Choose your role" };

const ICONS: Record<PersonaKey, typeof Briefcase> = { ae: Handshake, broker: Briefcase, hybrid: Layers, lead: TrendingUp };

export default function WelcomePage() {
  if (!isDemoMode()) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-center gap-2 text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500"><ShieldCheck className="size-5" /></span>
          <span className="text-xl font-semibold tracking-tight">Covira</span>
        </div>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">Choose a role to explore</h1>
        <p className="mx-auto mt-2 max-w-2xl text-center text-slate-400">
          A commercial risk broking CRM for the insurance renewal lifecycle. No sign-in needed. Each role sees and can do different things, and you can switch roles at any time from the top bar.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PERSONAS.map((p) => {
            const Icon = ICONS[p.key];
            return (
              <form key={p.key} action={choosePersona.bind(null, p.key)} className="flex">
                <button className="group flex w-full flex-col rounded-2xl bg-white p-5 text-left shadow-lg ring-2 ring-transparent transition hover:ring-brand-500 focus-visible:outline-none focus-visible:ring-brand-500">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-slate-900">{p.role}</div>
                      <div className="text-xs text-slate-500">as {p.name}</div>
                    </div>
                    <ArrowRight className="size-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{p.blurb}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.roles.map((r) => (
                      <span key={r} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{r}</span>
                    ))}
                  </div>
                  <p className="mt-auto pt-4 text-xs text-slate-500"><span className="font-semibold text-slate-700">Try this:</span> {p.tryThis}</p>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
