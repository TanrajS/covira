"use client";

import { useState, useTransition } from "react";
import { Download, Eye, FileSpreadsheet, FileText, Search, Star, Trash2 } from "lucide-react";
import { deleteDocument } from "@/lib/actions";
import { DOC_CATEGORIES, coverageLabel, docTypeLabel } from "@/lib/domain";
import { bytes, date } from "@/lib/format";
import { Badge, Card, cx, inputStyles } from "@/components/ui";

type Doc = {
  id: string; fileName: string; category: string; docType: string; sizeBytes: number; createdAt: Date; notes: string | null; mimeType: string;
  uploadedBy: { id: string; name: string }; policy: { policyNumber: string; coverageLine: string } | null;
};

export function DocList({ docs, currentUserId, oversight, term }: { docs: Doc[]; currentUserId: string; oversight: boolean; term: string }) {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const filtered = q ? docs.filter((d) => d.fileName.toLowerCase().includes(q.toLowerCase()) || d.notes?.toLowerCase().includes(q.toLowerCase())) : docs;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${term} files…`} className={cx(inputStyles, "pl-8")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {DOC_CATEGORIES.map((cat) => {
          const items = filtered.filter((d) => d.category === cat.key).sort((a, b) => Number(b.docType === "MASTER_POLICY") - Number(a.docType === "MASTER_POLICY"));
          return (
            <Card key={cat.key} id={cat.key}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <h3 className="font-semibold">{cat.label}</h3>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Nothing filed for {term}.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((d) => {
                    const Icon = /\.(csv|xlsx?)$/i.test(d.fileName) ? FileSpreadsheet : FileText;
                    const canDelete = oversight || d.uploadedBy.id === currentUserId;
                    const viewable = /^(application\/pdf|image\/|text\/)/.test(d.mimeType);
                    return (
                      <li key={d.id} className="group flex items-start gap-2.5 px-4 py-2.5">
                        <Icon className={cx("mt-0.5 size-4 shrink-0", d.docType === "MASTER_POLICY" ? "text-brand-600" : "text-slate-400")} />
                        <div className="min-w-0 flex-1">
                          <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium text-slate-800 hover:text-brand-600">{d.fileName}</a>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                            {cat.key === "ACTIVE_POLICY" && <Badge tone={d.docType === "MASTER_POLICY" ? "blue" : "slate"}>{d.docType === "MASTER_POLICY" && <Star className="size-3" />}{docTypeLabel(d.docType)}</Badge>}
                            {d.policy && <span>{coverageLabel(d.policy.coverageLine)} · {d.policy.policyNumber}</span>}
                            <span>{d.uploadedBy.name}</span>
                            <span>{date(d.createdAt)}</span>
                            <span>{bytes(d.sizeBytes)}</span>
                          </div>
                          {d.notes && <div className="mt-0.5 text-xs text-slate-500">{d.notes}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
                          {viewable && <a title="View" href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Eye className="size-4" /></a>}
                          <a title="Download" href={`/api/documents/${d.id}?download=1`} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Download className="size-4" /></a>
                          {canDelete && (
                            <button title="Delete" disabled={pending} onClick={() => { if (confirm(`Delete ${d.fileName}?`)) start(async () => { await deleteDocument(d.id); }); }} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
