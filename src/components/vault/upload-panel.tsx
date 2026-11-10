"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X } from "lucide-react";
import { DOC_CATEGORIES, DOC_TYPES, coverageLabel, type DocCategory } from "@/lib/domain";
import { bytes } from "@/lib/format";
import { Button, Field, Notice, cx, inputStyles } from "@/components/ui";

const ACCEPT = ".pdf,.xlsx,.xls,.csv,.docx,.doc,.msg,.png,.jpg,.jpeg";

export function UploadPanel({
  clientId, term, terms, allowed, initialCategory, policies, maxBytes,
}: {
  clientId: string;
  term: string;
  terms: string[];
  allowed: Record<DocCategory, boolean>;
  initialCategory?: DocCategory;
  policies: { id: string; policyNumber: string; coverageLine: string }[];
  maxBytes: number;
}) {
  const router = useRouter();
  const firstAllowed = (Object.keys(allowed) as DocCategory[]).find((k) => allowed[k]);
  const [category, setCategory] = useState<DocCategory | undefined>(initialCategory && allowed[initialCategory] ? initialCategory : firstAllowed);
  const [termYear, setTermYear] = useState(term);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!firstAllowed) return <Notice tone="blue">You have read-only access to this vault.</Notice>;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!files.length || !category) return;
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) return setStatus({ ok: false, text: `${tooBig.name} is larger than the ${bytes(maxBytes)} upload limit.` });
    const fd = new FormData(e.currentTarget);
    fd.delete("file");
    files.forEach((f) => fd.append("file", f));
    setPending(true);
    setStatus(null);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({ ok: false, error: "Upload failed" }));
    setPending(false);
    if (!data.ok) return setStatus({ ok: false, text: data.error });
    setStatus({ ok: true, text: `${data.documents.length} file${data.documents.length > 1 ? "s" : ""} filed to ${termYear}.` });
    setFiles([]);
    if (termYear !== term) router.push(`/clients/${clientId}/vault?term=${termYear}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Policy term">
        <select name="termYear" value={termYear} onChange={(e) => setTermYear(e.target.value)} className={inputStyles}>
          {terms.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
        <div className="grid grid-cols-2 gap-1.5">
          {DOC_CATEGORIES.map((c) => (
            <label
              key={c.key}
              title={allowed[c.key] ? undefined : "Only the Broker on this account can upload this category"}
              className={cx(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                !allowed[c.key] ? "cursor-not-allowed border-slate-100 text-slate-300" : category === c.key ? "cursor-pointer border-brand-500 bg-brand-50 font-medium text-brand-700" : "cursor-pointer border-slate-200 hover:bg-slate-50",
              )}
            >
              <input type="radio" name="category" value={c.key} disabled={!allowed[c.key]} checked={category === c.key} onChange={() => setCategory(c.key)} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
      </div>
      {category === "ACTIVE_POLICY" && (
        <Field label="Document type">
          <select name="docType" defaultValue="MASTER_POLICY" className={inputStyles}>
            {DOC_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
      )}
      {policies.length > 0 && (
        <Field label="Related policy (optional)">
          <select name="policyId" defaultValue="" className={inputStyles}>
            <option value="">—</option>
            {policies.map((p) => <option key={p.id} value={p.id}>{coverageLabel(p.coverageLine)} · {p.policyNumber}</option>)}
          </select>
        </Field>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]); }}
        onClick={() => inputRef.current?.click()}
        className={cx("cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition", drag ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-slate-400")}
      >
        <UploadCloud className="mx-auto mb-1.5 size-6 text-slate-400" />
        <div className="text-xs text-slate-600">Drop files or <span className="font-medium text-brand-600">browse</span></div>
        <div className="mt-0.5 text-[11px] text-slate-400">PDF, Excel, CSV, Word, Outlook, images · {bytes(maxBytes)} max</div>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-slate-400">{bytes(f.size)}</span>
              <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Notes (optional)"><input name="notes" className={inputStyles} placeholder="e.g. Updated after Location 3 sprinkler retrofit" /></Field>
      {status && <Notice tone={status.ok ? "blue" : "red"}>{status.text}</Notice>}
      <Button variant="primary" className="w-full" disabled={pending || !files.length || !category}>{pending ? "Uploading…" : "Upload to vault"}</Button>
    </form>
  );
}
