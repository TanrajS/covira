"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Field, Notice, inputStyles } from "@/components/ui";

const DEMO_USERS = [
  { email: "dan@covira.test", label: "Dan — Hybrid Broker/AE" },
  { email: "marcus@covira.test", label: "Marcus — Client Executive" },
  { email: "sofia@covira.test", label: "Sofia — Broker" },
  { email: "priya@covira.test", label: "Priya — Team Lead" },
];

export function LoginForm({ microsoft, demo }: { microsoft: boolean; demo: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function signIn(e?: React.FormEvent, creds = { email, password }) {
    e?.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email(creds);
    setPending(false);
    if (error) return setError(error.message ?? "Sign-in failed");
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={signIn} className="space-y-3">
        <Field label="Work email">
          <input className={inputStyles} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputStyles} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Notice tone="red">{error}</Notice>}
        <Button variant="primary" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>

      {microsoft && (
        <Button className="w-full" onClick={() => authClient.signIn.social({ provider: "microsoft", callbackURL: destination })}>
          Sign in with Microsoft
        </Button>
      )}

      {demo && (
        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 text-xs font-medium text-slate-500">Demo accounts (password <code>Covira!2026</code>)</div>
          <div className="grid gap-1.5">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                disabled={pending}
                onClick={() => signIn(undefined, { email: u.email, password: "Covira!2026" })}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-left text-xs hover:border-brand-500 hover:bg-brand-50"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
