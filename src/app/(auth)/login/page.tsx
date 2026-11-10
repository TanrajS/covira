import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { ssoProviders } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const DEMO = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "1";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500"><ShieldCheck className="size-5" /></span>
          <span className="text-xl font-semibold tracking-tight">Covira</span>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mb-5 mt-1 text-slate-500">Commercial risk broking CRM</p>
          <Suspense>
            <LoginForm microsoft={ssoProviders.microsoft} demo={DEMO} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
