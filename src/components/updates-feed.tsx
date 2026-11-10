"use client";

import { useActionState, useRef, useTransition } from "react";
import { Pin, Trash2 } from "lucide-react";
import { deleteUpdate, postUpdate, toggleUpdatePin, type ActionResult } from "@/lib/actions";
import { UPDATE_CATEGORIES, updateCategoryLabel } from "@/lib/domain";
import { Avatar, Badge, Button, Notice, cx, inputStyles } from "@/components/ui";

/** `when` is formatted on the server so SSR and hydration agree. */
type Update = { id: string; body: string; category: string; pinned: boolean; when: string; author: { id: string; name: string } };

const TONE: Record<string, "slate" | "blue" | "green" | "amber" | "red" | "violet"> = {
  EXPANSION: "green", EXPOSURE_CHANGE: "amber", CLAIMS: "red", MARKET: "blue", LEADERSHIP: "violet", GENERAL: "slate",
};

export function UpdatesFeed({
  clientId, updates, canPost, canPin, canModerate, currentUserId,
}: { clientId: string; updates: Update[]; canPost: boolean; canPin: boolean; canModerate: boolean; currentUserId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const res = await postUpdate(clientId, prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, null);
  const [busy, startTransition] = useTransition();

  return (
    <div>
      {canPost && (
        <form ref={formRef} action={formAction} className="border-b border-slate-100 p-4">
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Share operational context for the next submission — e.g. “Client expanding into manufacturing, requires EBI insurance exceptions.”"
            className={cx(inputStyles, "resize-y")}
          />
          <div className="mt-2 flex items-center gap-2">
            <select name="category" className={cx(inputStyles, "w-auto")} defaultValue="GENERAL">
              {UPDATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            {state && !state.ok && <span className="text-xs text-rose-600">{state.error}</span>}
            <Button variant="primary" className="ml-auto" disabled={pending}>{pending ? "Posting…" : "Post update"}</Button>
          </div>
        </form>
      )}
      {updates.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-500">No updates yet. Post context your broker will need before going to market.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {updates.map((u) => (
            <li key={u.id} className={cx("group flex gap-3 px-5 py-3.5", u.pinned && "bg-amber-50/40")}>
              <Avatar name={u.author.name} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-slate-800">{u.author.name}</span>
                  <Badge tone={TONE[u.category] ?? "slate"}>{updateCategoryLabel(u.category)}</Badge>
                  {u.pinned && <Badge tone="amber"><Pin className="size-3" /> Pinned for submission</Badge>}
                  <span className="text-slate-400">{u.when}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{u.body}</p>
              </div>
              <div className="flex shrink-0 items-start gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                {canPin && (
                  <button disabled={busy} title={u.pinned ? "Unpin" : "Pin for submission"} onClick={() => startTransition(async () => { await toggleUpdatePin(u.id); })} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pin className="size-4" />
                  </button>
                )}
                {(canModerate || u.author.id === currentUserId) && (
                  <button disabled={busy} title="Delete" onClick={() => { if (confirm("Delete this update?")) startTransition(async () => { await deleteUpdate(u.id); }); }} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!canPost && <div className="p-3"><Notice tone="blue">You can read updates on this account; only the assigned team can post.</Notice></div>}
    </div>
  );
}
