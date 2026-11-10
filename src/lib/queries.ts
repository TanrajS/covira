import "server-only";
import { db } from "./db";
import {
  COVERAGE_LINE_KEYS,
  RENEWAL_STAGES,
  RENEWAL_STAGE_KEYS,
  matrixStatus,
  requiredDocsForStage,
  termYearFor,
  type CoverageLine,
  type DocCategory,
  type MatrixKind,
  type MatrixStatus,
  type RenewalStage,
} from "./domain";
import { DAY_MS, daysBetween } from "./format";
import { accountRoles, can, clientScope, type SessionUser } from "./permissions";

const userBrief = { select: { id: true, name: true } } as const;

// ─── Clients ───────────────────────────────────────────────────────────────

export async function listClients(user: SessionUser, q?: string) {
  const clients = await db.client.findMany({
    where: { AND: [clientScope(user), q ? { name: { contains: q } } : {}] },
    include: {
      ae: userBrief,
      broker: userBrief,
      policies: { where: { status: "ACTIVE" }, select: { premium: true, coverageLine: true } },
      renewals: { where: { stage: { not: "BOUND" } }, select: { stage: true, expiryDate: true } },
    },
    orderBy: { name: "asc" },
  });
  return clients.map((c) => ({
    ...c,
    activePremium: c.policies.reduce((s, p) => s + p.premium, 0),
    lines: [...new Set(c.policies.map((p) => p.coverageLine))],
    openRenewal: c.renewals.sort((a, b) => +a.expiryDate - +b.expiryDate)[0] ?? null,
  }));
}

export async function getClientDetail(user: SessionUser, id: string) {
  const client = await db.client.findUnique({
    where: { id },
    include: {
      ae: userBrief,
      broker: userBrief,
      team: true,
      policies: {
        include: { participations: { include: { carrier: true }, orderBy: [{ isLead: "desc" }, { sharePercent: "desc" }] } },
        orderBy: [{ isMaster: "desc" }, { expiryDate: "asc" }],
      },
      renewals: { orderBy: { expiryDate: "desc" }, take: 3 },
      updates: { include: { author: userBrief }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 50 },
    },
  });
  if (!client || !can(user, client, { type: "client.view" })) return null;
  return { client, roles: accountRoles(user, client) };
}

export async function currentTermForClient(clientId: string, now = new Date()): Promise<string> {
  const anchor =
    (await db.policy.findFirst({
      where: { clientId, status: "ACTIVE", isMaster: true },
      orderBy: { effectiveDate: "desc" },
    })) ??
    (await db.policy.findFirst({
      where: { clientId, status: "ACTIVE", expiryDate: { gt: now } },
      orderBy: { effectiveDate: "desc" },
    }));
  return termYearFor(anchor?.effectiveDate ?? now);
}

/** The "instant pull": current master policy + schedules, no folder digging. */
export async function getQuickPull(clientId: string) {
  const term = await currentTermForClient(clientId);
  const docs = await db.document.findMany({
    where: { clientId, termYear: term, category: { in: ["ACTIVE_POLICY", "SOV"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, category: true, docType: true, createdAt: true, sizeBytes: true },
  });
  const master = docs.find((d) => d.category === "ACTIVE_POLICY" && d.docType === "MASTER_POLICY") ?? null;
  const schedules = docs.filter(
    (d) => (d.category === "ACTIVE_POLICY" && d.docType === "SCHEDULE") || d.category === "SOV",
  );
  const masterPolicy = await db.policy.findFirst({
    where: { clientId, status: "ACTIVE", isMaster: true },
    select: { policyNumber: true, expiryDate: true, coverageLine: true },
  });
  return { term, master, schedules, masterPolicy };
}

export async function searchClients(user: SessionUser, q: string) {
  const clients = await db.client.findMany({
    where: { AND: [clientScope(user), q ? { name: { contains: q } } : {}] },
    select: { id: true, name: true, industry: true, hqCity: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return Promise.all(clients.map(async (c) => ({ ...c, quick: await getQuickPull(c.id) })));
}

// ─── Vault ─────────────────────────────────────────────────────────────────

export async function getVault(clientId: string, term: string) {
  const [docs, termRows, current] = await Promise.all([
    db.document.findMany({
      where: { clientId, termYear: term },
      include: { uploadedBy: userBrief, policy: { select: { policyNumber: true, coverageLine: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({ where: { clientId }, distinct: ["termYear"], select: { termYear: true } }),
    currentTermForClient(clientId),
  ]);
  const renewalTerms = await db.renewal.findMany({ where: { clientId }, select: { termYear: true } });
  const terms = [
    ...new Set([...termRows.map((t) => t.termYear), ...renewalTerms.map((r) => r.termYear), current, term]),
  ].sort((a, b) => b.localeCompare(a));
  return { docs, terms, current };
}

// ─── Renewal Kanban ────────────────────────────────────────────────────────

export type KanbanCard = {
  id: string;
  clientId: string;
  clientName: string;
  termYear: string;
  stage: RenewalStage;
  expiryDate: string;
  daysToExpiry: number;
  daysInStage: number;
  behindSchedule: boolean;
  expiringPremium: number;
  targetPremium: number | null;
  lines: string[];
  ae: string | null;
  broker: string | null;
  missingDocs: DocCategory[];
  allowedTargets: RenewalStage[];
};

export async function getKanban(user: SessionUser, opts: { mine?: boolean } = {}) {
  const now = new Date();
  const renewals = await db.renewal.findMany({
    where: {
      client: opts.mine ? { OR: [{ aeId: user.id }, { brokerId: user.id }] } : clientScope(user),
      OR: [{ stage: { not: "BOUND" } }, { boundAt: { gte: new Date(now.getTime() - 60 * DAY_MS) } }],
    },
    include: {
      client: {
        select: {
          id: true, name: true, aeId: true, brokerId: true, teamId: true,
          ae: userBrief, broker: userBrief,
          policies: { where: { status: "ACTIVE" }, select: { coverageLine: true } },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  const docRows = await db.document.findMany({
    where: { OR: renewals.map((r) => ({ clientId: r.clientId, termYear: r.termYear })) },
    select: { clientId: true, termYear: true, category: true },
    distinct: ["clientId", "termYear", "category"],
  });
  const onFile = new Set(docRows.map((d) => `${d.clientId}|${d.termYear}|${d.category}`));

  const cards: KanbanCard[] = renewals.map((r) => {
    const stage = r.stage as RenewalStage;
    const daysToExpiry = daysBetween(now, r.expiryDate);
    const missingFor = (s: RenewalStage) =>
      requiredDocsForStage(s).filter((c) => !onFile.has(`${r.clientId}|${r.termYear}|${c}`));
    const allowedTargets = RENEWAL_STAGE_KEYS.filter(
      (s) => s !== stage && missingFor(s).length === 0 && can(user, r.client, { type: "renewal.move", to: s }),
    );
    const stageMeta = RENEWAL_STAGES.find((s) => s.key === stage)!;
    const nextMeta = RENEWAL_STAGES[RENEWAL_STAGE_KEYS.indexOf(stage) + 1];
    return {
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.name,
      termYear: r.termYear,
      stage,
      expiryDate: r.expiryDate.toISOString(),
      daysToExpiry,
      daysInStage: Math.max(0, Math.floor((now.getTime() - r.stageEnteredAt.getTime()) / DAY_MS)),
      // Behind if the clock has passed the next milestone but the card hasn't moved.
      behindSchedule: stage !== "BOUND" && !!nextMeta && daysToExpiry < nextMeta.targetDays && stageMeta.targetDays > nextMeta.targetDays,
      expiringPremium: r.expiringPremium,
      targetPremium: r.targetPremium,
      lines: [...new Set(r.client.policies.map((p) => p.coverageLine))],
      ae: r.client.ae?.name ?? null,
      broker: r.client.broker?.name ?? null,
      missingDocs: missingFor("D90"),
      allowedTargets,
    };
  });
  return cards;
}

// ─── Cross-sell matrix ─────────────────────────────────────────────────────

export type MatrixRow = {
  id: string;
  name: string;
  industry: string;
  ae: string | null;
  broker: string | null;
  cells: Record<CoverageLine, { status: MatrixStatus; kind: MatrixKind; reason: string; premium: number; expiry: string | null }>;
  gaps: number;
};

export async function getMatrix(user: SessionUser) {
  const now = new Date();
  const clients = await db.client.findMany({
    where: { AND: [clientScope(user), { status: { not: "LAPSED" } }] },
    include: {
      ae: userBrief,
      broker: userBrief,
      policies: { where: { status: "ACTIVE", expiryDate: { gt: now } } },
      renewals: { where: { stage: { not: "BOUND" } }, orderBy: { expiryDate: "asc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const rows: MatrixRow[] = clients.map((c) => {
    const critical = new Set(c.criticalLines.split(",").filter(Boolean));
    const renewalStage = c.renewals[0]?.stage ?? null;
    const cells = {} as MatrixRow["cells"];
    for (const line of COVERAGE_LINE_KEYS) {
      const pols = c.policies.filter((p) => p.coverageLine === line);
      const soonest = pols.sort((a, b) => +a.expiryDate - +b.expiryDate)[0];
      const { status, kind, reason } = matrixStatus({
        hasActive: pols.length > 0,
        isCritical: critical.has(line),
        daysToExpiry: soonest ? daysBetween(now, soonest.expiryDate) : null,
        renewalStage,
      });
      cells[line] = {
        status,
        kind,
        reason,
        premium: pols.reduce((s, p) => s + p.premium, 0),
        expiry: soonest?.expiryDate.toISOString() ?? null,
      };
    }
    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      ae: c.ae?.name ?? null,
      broker: c.broker?.name ?? null,
      cells,
      gaps: Object.values(cells).filter((x) => x.status !== "GREEN").length,
    };
  });
  return rows;
}

// ─── Team roll-up ──────────────────────────────────────────────────────────

export async function getTeamRollup(user: SessionUser) {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const scope = clientScope(user);

  const [renewals, policies, events, people] = await Promise.all([
    db.renewal.findMany({
      where: { client: scope },
      include: { client: { select: { name: true, aeId: true, brokerId: true } } },
    }),
    db.policy.findMany({
      where: { status: "ACTIVE", client: scope },
      select: { premium: true, coverageLine: true, client: { select: { aeId: true, brokerId: true } } },
    }),
    db.renewalStageEvent.findMany({
      where: { renewal: { client: scope } },
      orderBy: { createdAt: "asc" },
      select: { renewalId: true, fromStage: true, toStage: true, createdAt: true },
    }),
    db.user.findMany({
      where: user.capabilities.includes("ADMIN") ? {} : { teamId: user.teamId ?? "__none__" },
      select: { id: true, name: true, roles: true, title: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const value = (r: (typeof renewals)[number]) => r.boundPremium ?? r.targetPremium ?? r.expiringPremium;

  const byStage = RENEWAL_STAGES.map((s) => {
    const rs = renewals.filter((r) => r.stage === s.key && (s.key !== "BOUND" || (r.boundAt && r.boundAt >= yearStart)));
    return { key: s.key, label: s.label, count: rs.length, premium: rs.reduce((sum, r) => sum + value(r), 0) };
  });

  // Velocity: average days spent in each stage, from the stage-event log.
  const durations: Record<string, number[]> = {};
  const lastByRenewal = new Map<string, { stage: string; at: Date }>();
  for (const e of events) {
    const prev = lastByRenewal.get(e.renewalId);
    if (prev) (durations[prev.stage] ??= []).push((e.createdAt.getTime() - prev.at.getTime()) / DAY_MS);
    lastByRenewal.set(e.renewalId, { stage: e.toStage, at: e.createdAt });
  }
  const velocity = RENEWAL_STAGES.filter((s) => s.key !== "BOUND").map((s) => {
    const d = durations[s.key] ?? [];
    return { key: s.key, label: s.label, avgDays: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, samples: d.length };
  });

  const open = renewals.filter((r) => r.stage !== "BOUND");
  const atRisk = open
    .map((r) => ({ ...r, daysToExpiry: daysBetween(now, r.expiryDate) }))
    .filter((r) => {
      const next = RENEWAL_STAGES[RENEWAL_STAGE_KEYS.indexOf(r.stage as RenewalStage) + 1];
      return next && r.daysToExpiry < next.targetDays;
    })
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  const producers = people.map((p) => {
    const asAE = policies.filter((x) => x.client.aeId === p.id);
    const asBroker = policies.filter((x) => x.client.brokerId === p.id);
    const book = policies.filter((x) => x.client.aeId === p.id || x.client.brokerId === p.id);
    const theirRenewals = open.filter((r) => r.client.aeId === p.id || r.client.brokerId === p.id);
    const boundYtd = renewals.filter(
      (r) => r.stage === "BOUND" && r.boundAt && r.boundAt >= yearStart && (r.client.aeId === p.id || r.client.brokerId === p.id),
    );
    return {
      ...p,
      aePremium: asAE.reduce((s, x) => s + x.premium, 0),
      brokerPremium: asBroker.reduce((s, x) => s + x.premium, 0),
      bookPremium: book.reduce((s, x) => s + x.premium, 0),
      pipelineCount: theirRenewals.length,
      pipelinePremium: theirRenewals.reduce((s, r) => s + value(r), 0),
      boundYtd: boundYtd.reduce((s, r) => s + value(r), 0),
    };
  });

  const lineMix = COVERAGE_LINE_KEYS.map((line) => ({
    line,
    premium: policies.filter((p) => p.coverageLine === line).reduce((s, p) => s + p.premium, 0),
  }));

  const boundRenewals = renewals.filter((r) => r.stage === "BOUND" && r.boundPremium != null && r.boundAt && r.boundAt >= yearStart);
  const retention = boundRenewals.length
    ? boundRenewals.reduce((s, r) => s + r.boundPremium!, 0) / boundRenewals.reduce((s, r) => s + r.expiringPremium, 0)
    : null;

  return {
    byStage,
    velocity,
    atRisk,
    producers,
    lineMix,
    totals: {
      book: policies.reduce((s, p) => s + p.premium, 0),
      pipeline: open.reduce((s, r) => s + value(r), 0),
      boundYtd: byStage.find((s) => s.key === "BOUND")!.premium,
      retention,
    },
  };
}

// ─── Personal dashboard ────────────────────────────────────────────────────

export async function getDashboard(user: SessionUser) {
  const now = new Date();
  const mine = { OR: [{ aeId: user.id }, { brokerId: user.id }] };
  const [renewals, updates, recentDocs, clientCount, premium] = await Promise.all([
    db.renewal.findMany({
      where: { client: mine, stage: { not: "BOUND" } },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 8,
    }),
    db.clientUpdate.findMany({
      where: { client: clientScope(user) },
      include: { author: userBrief, client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.document.findMany({
      where: { client: clientScope(user) },
      include: { client: { select: { id: true, name: true } }, uploadedBy: userBrief },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.client.count({ where: mine }),
    db.policy.aggregate({ where: { status: "ACTIVE", client: mine }, _sum: { premium: true } }),
  ]);

  const sovRows = await db.document.findMany({
    where: { category: "SOV", OR: renewals.map((r) => ({ clientId: r.clientId, termYear: r.termYear })) },
    select: { clientId: true, termYear: true },
  });
  const hasSov = new Set(sovRows.map((d) => `${d.clientId}|${d.termYear}`));

  return {
    renewals: renewals.map((r) => ({
      ...r,
      daysToExpiry: daysBetween(now, r.expiryDate),
      sovMissing: r.stage === "D120" && !hasSov.has(`${r.clientId}|${r.termYear}`),
    })),
    updates,
    recentDocs,
    clientCount,
    bookPremium: premium._sum.premium ?? 0,
  };
}

export async function assignableUsers() {
  const users = await db.user.findMany({ select: { id: true, name: true, roles: true }, orderBy: { name: "asc" } });
  return {
    aes: users.filter((u) => u.roles.includes("AE")),
    brokers: users.filter((u) => u.roles.includes("BROKER")),
  };
}

export async function listCarriers() {
  return db.carrier.findMany({ orderBy: { name: "asc" } });
}
