"use client";

import Link from "next/link";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, Clock, GripVertical, Lock, Upload } from "lucide-react";
import { moveRenewal } from "@/lib/actions";
import { RENEWAL_STAGES, coverageLabel, docCategoryLabel, stageLabel, type RenewalStage } from "@/lib/domain";
import { moneyCompact } from "@/lib/format";
import type { KanbanCard } from "@/lib/queries";
import { Avatar, Badge, cx } from "@/components/ui";

export function KanbanBoard({ initialCards }: { initialCards: KanbanCard[] }) {
  // Server state is the source of truth; drags apply optimistically and revert
  // automatically if the server rejects the move (e.g. workflow lock).
  const [cards, applyMove] = useOptimistic(initialCards, (state, move: { id: string; to: RenewalStage }) =>
    state.map((c) => (c.id === move.id ? { ...c, stage: move.to, daysInStage: 0, behindSchedule: false, allowedTargets: [] } : c)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const active = cards.find((c) => c.id === activeId) ?? null;
  const byStage = useMemo(() => {
    const m = new Map<RenewalStage, KanbanCard[]>(RENEWAL_STAGES.map((s) => [s.key, []]));
    cards.forEach((c) => m.get(c.stage)?.push(c));
    return m;
  }, [cards]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as RenewalStage | undefined;
    if (!card || !to || to === card.stage) return;

    if (!card.allowedTargets.includes(to)) {
      setToast({
        tone: "error",
        text: card.missingDocs.length
          ? `${card.clientName} is locked — upload the ${card.missingDocs.map(docCategoryLabel).join(", ")} to the ${card.termYear} vault first.`
          : `You can't move ${card.clientName} to ${stageLabel(to)} — binding is reserved for the account's Broker.`,
      });
      return;
    }

    startTransition(async () => {
      applyMove({ id: card.id, to });
      const res = await moveRenewal(card.id, to);
      if (!res.ok) {
        setToast({ tone: "error", text: res.error });
      } else {
        setToast({ tone: "ok", text: `${card.clientName} moved to ${stageLabel(to)}.` });
      }
    });
  }

  return (
    <DndContext id="renewal-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid auto-cols-[minmax(215px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
        {RENEWAL_STAGES.map((stage) => (
          <Column key={stage.key} stage={stage.key} label={stage.label} cards={byStage.get(stage.key) ?? []} dragging={active} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active && <CardBody card={active} overlay />}</DragOverlay>
      {toast && (
        <div role="status" className={cx("fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ring-1", toast.tone === "error" ? "bg-rose-50 text-rose-900 ring-rose-200" : "bg-slate-900 text-white ring-slate-900")}>
          {toast.text}
        </div>
      )}
    </DndContext>
  );
}

function Column({ stage, label, cards, dragging }: { stage: RenewalStage; label: string; cards: KanbanCard[]; dragging: KanbanCard | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const allowed = dragging ? dragging.stage === stage || dragging.allowedTargets.includes(stage) : true;
  const premium = cards.reduce((s, c) => s + (c.targetPremium ?? c.expiringPremium), 0);

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex min-h-[60vh] flex-col rounded-xl border bg-slate-100/70 transition",
        isOver && allowed && "border-brand-500 bg-brand-50/70",
        isOver && !allowed && "border-rose-300 bg-rose-50/60",
        !isOver && "border-transparent",
        dragging && !allowed && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{label}</span>
          <span className="rounded-full bg-white px-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">{cards.length}</span>
        </div>
        <span className="text-xs tabular-nums text-slate-500">{moneyCompact(premium)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        {cards.map((c) => <DraggableCard key={c.id} card={c} />)}
        {cards.length === 0 && <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">Drop here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ card }: { card: KanbanCard }) {
  const locked = card.stage === "D120" && card.missingDocs.length > 0;
  const noRights = card.allowedTargets.length === 0 && !locked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: locked || noRights });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cx(isDragging && "opacity-30", !locked && !noRights && "cursor-grab active:cursor-grabbing")}>
      <CardBody card={card} locked={locked} noRights={noRights} />
    </div>
  );
}

function CardBody({ card, locked, noRights, overlay }: { card: KanbanCard; locked?: boolean; noRights?: boolean; overlay?: boolean }) {
  const hybrid = card.ae && card.ae === card.broker;
  const urgency = card.daysToExpiry <= 0 ? "text-slate-500" : card.daysToExpiry <= 30 ? "text-rose-600" : card.daysToExpiry <= 90 ? "text-amber-700" : "text-slate-600";
  return (
    <div className={cx("rounded-lg border bg-white p-3 shadow-xs", locked ? "border-amber-300" : "border-slate-200", overlay && "rotate-1 shadow-xl ring-2 ring-brand-500")}>
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <Link href={`/clients/${card.clientId}`} className="block truncate font-semibold text-slate-900 hover:text-brand-600" onPointerDown={(e) => e.stopPropagation()}>
            {card.clientName}
          </Link>
          <div className="text-[11px] text-slate-500">{card.termYear} renewal</div>
        </div>
        {locked ? <Lock className="size-4 shrink-0 text-amber-600" aria-label="Locked" /> : !noRights && <GripVertical className="size-4 shrink-0 text-slate-300" />}
      </div>

      <div className="mt-2 flex items-baseline justify-between text-xs">
        <span className={cx("font-semibold tabular-nums", urgency)}>{card.stage === "BOUND" ? "Bound" : card.daysToExpiry > 0 ? `${card.daysToExpiry} days to expiry` : "Expired"}</span>
        <span className="tabular-nums text-slate-600">{moneyCompact(card.expiringPremium)}{card.targetPremium ? <> → <b>{moneyCompact(card.targetPremium)}</b></> : null}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {card.lines.map((l) => <Badge key={l}>{coverageLabel(l)}</Badge>)}
      </div>

      {locked && (
        <Link
          href={`/clients/${card.clientId}/vault?term=${card.termYear}&upload=SOV`}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-2.5 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          <Upload className="size-3.5" /> Upload {card.termYear} SOV to unlock
        </Link>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          {hybrid ? (
            <><Avatar name={card.ae!} className="size-5" /><Badge tone="violet">Hybrid</Badge></>
          ) : (
            <>{card.ae && <Avatar name={card.ae} className="size-5" />}{card.broker && <Avatar name={card.broker} className="size-5" />}</>
          )}
        </span>
        <span className="flex items-center gap-2">
          {card.behindSchedule && <span className="flex items-center gap-0.5 font-medium text-rose-600"><AlertTriangle className="size-3" /> Behind</span>}
          <span className="flex items-center gap-0.5" title="Days in this stage"><Clock className="size-3" />{card.daysInStage}d</span>
        </span>
      </div>
      {noRights && <div className="mt-1.5 text-[10px] text-slate-400">View only — not on this account team</div>}
    </div>
  );
}
