"use client";

import { useState, useTransition } from "react";
import { startRenewal } from "@/lib/actions";
import { Button } from "@/components/ui";

export function StartRenewalButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div>
      <Button
        disabled={pending}
        onClick={() => start(async () => {
          const r = await startRenewal(clientId);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Added" } : { ok: false, text: r.error });
        })}
      >
        {pending ? "Adding…" : "Add renewal to pipeline"}
      </Button>
      {msg && <p className={msg.ok ? "mt-1.5 text-xs text-emerald-700" : "mt-1.5 text-xs text-rose-600"}>{msg.text}</p>}
    </div>
  );
}
