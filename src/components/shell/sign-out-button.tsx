"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      title="Sign out"
      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
    </button>
  );
}
