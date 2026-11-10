"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileSpreadsheet, FileText, FolderOpen, Search, X } from "lucide-react";
import { cx } from "@/components/ui";
import { coverageLabel } from "@/lib/domain";
import { date } from "@/lib/format";

type Doc = { id: string; fileName: string; category: string; docType: string; createdAt: string };
type Result = {
  id: string;
  name: string;
  industry: string;
  hqCity: string | null;
  quick: {
    term: string;
    master: Doc | null;
    schedules: Doc[];
    masterPolicy: { policyNumber: string; expiryDate: string; coverageLine: string } | null;
  };
};

/**
 * Global client search (⌘K / Ctrl+K). Selecting a client instantly shows the
 * current-term master policy and schedules — open them in one click without
 * navigating the vault.
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const selected = results[active];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-slate-500 hover:border-slate-300 hover:bg-white"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate">Find a client — pull master policy & schedules…</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-500 sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
          <div
            className="flex max-h-[70vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4">
              <Search className="size-4 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && selected) {
                    setOpen(false);
                    if (selected.quick.master && !e.shiftKey) window.open(`/api/documents/${selected.quick.master.id}`, "_blank");
                    else router.push(`/clients/${selected.id}`);
                  }
                }}
                placeholder="Type a client name…"
                className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
              />
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <ul className="min-h-0 overflow-y-auto border-slate-100 py-2 sm:border-r">
                {results.length === 0 && (
                  <li className="px-4 py-6 text-center text-slate-500">{loading ? "Searching…" : "No clients in your book match."}</li>
                )}
                {results.map((r, i) => (
                  <li key={r.id}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => { setOpen(false); router.push(`/clients/${r.id}`); }}
                      className={cx("block w-full px-4 py-2 text-left", i === active ? "bg-brand-50" : "hover:bg-slate-50")}
                    >
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.industry}{r.hqCity ? ` · ${r.hqCity}` : ""}</div>
                    </button>
                  </li>
                ))}
              </ul>

              {selected && (
                <div className="hidden min-h-0 overflow-y-auto p-4 sm:block">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Current term · {selected.quick.term}</div>
                      <div className="font-semibold text-slate-900">{selected.name}</div>
                    </div>
                    <Link onClick={() => setOpen(false)} href={`/clients/${selected.id}/vault?term=${selected.quick.term}`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                      <FolderOpen className="size-3.5" /> Vault
                    </Link>
                  </div>

                  <div className="mb-1.5 text-xs font-semibold text-slate-500">Active master policy</div>
                  {selected.quick.master ? (
                    <DocLink doc={selected.quick.master} primary onOpen={() => setOpen(false)} />
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500">No master policy filed for {selected.quick.term}.</div>
                  )}
                  {selected.quick.masterPolicy && (
                    <div className="mt-1.5 text-xs text-slate-500">
                      {coverageLabel(selected.quick.masterPolicy.coverageLine)} · {selected.quick.masterPolicy.policyNumber} · expires {date(selected.quick.masterPolicy.expiryDate)}
                    </div>
                  )}

                  <div className="mb-1.5 mt-4 text-xs font-semibold text-slate-500">Schedules & SOVs</div>
                  <div className="space-y-1.5">
                    {selected.quick.schedules.length === 0 && <div className="text-xs text-slate-500">None filed for this term.</div>}
                    {selected.quick.schedules.map((d) => <DocLink key={d.id} doc={d} onOpen={() => setOpen(false)} />)}
                  </div>

                  <Link onClick={() => setOpen(false)} href={`/clients/${selected.id}`} className="mt-4 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                    Open client profile <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
              <b>↵</b> open master policy · <b>⇧↵</b> open profile · <b>↑↓</b> move · <b>esc</b> close
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocLink({ doc, primary, onOpen }: { doc: Doc; primary?: boolean; onOpen: () => void }) {
  const Icon = doc.fileName.match(/\.(csv|xlsx?)$/i) ? FileSpreadsheet : FileText;
  return (
    <a
      href={`/api/documents/${doc.id}`}
      target="_blank"
      rel="noreferrer"
      onClick={onOpen}
      className={cx(
        "flex items-center gap-2 rounded-lg border px-3 py-2 hover:border-brand-500",
        primary ? "border-brand-100 bg-brand-50/60" : "border-slate-200",
      )}
    >
      <Icon className={cx("size-4 shrink-0", primary ? "text-brand-600" : "text-slate-400")} />
      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{doc.fileName}</span>
      <span className="shrink-0 text-[11px] text-slate-400">{doc.category === "SOV" ? "SOV" : doc.docType === "MASTER_POLICY" ? "Master" : "Schedule"}</span>
    </a>
  );
}
