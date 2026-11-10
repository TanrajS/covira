"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "./db";
import { requireUser } from "./dal";
import { storage } from "./storage";
import {
  CLIENT_STATUSES,
  COVERAGE_LINE_KEYS,
  POLICY_STATUSES,
  RENEWAL_STAGE_KEYS,
  UPDATE_CATEGORY_KEYS,
  requiredDocsForStage,
  docCategoryLabel,
  shiftTermYear,
  stageLabel,
  termYearFor,
  type RenewalStage,
} from "./domain";
import { can, hasCapability, permissionHint, type Action, type SessionUser } from "./permissions";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

type Loaded =
  | { error: string; client?: undefined }
  | { error?: undefined; client: { id: string; aeId: string | null; brokerId: string | null; teamId: string | null } };

async function loadClientFor(user: SessionUser, clientId: string, action: Action): Promise<Loaded> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, aeId: true, brokerId: true, teamId: true },
  });
  if (!client || !can(user, client, { type: "client.view" })) return { error: "Client not found." };
  if (!can(user, client, action)) return { error: permissionHint(action) };
  return { client };
}

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const optionalNumber = z
  .union([z.literal(""), z.coerce.number().nonnegative()])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

function firstIssue(err: z.ZodError) {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "Input"}: ${i.message}` : "Invalid input";
}

// ─── Clients ───────────────────────────────────────────────────────────────

const clientFields = z.object({
  name: z.string().trim().min(2, "Name is required"),
  legalName: optionalText,
  industry: z.string().trim().min(2, "Industry is required"),
  naicsCode: optionalText,
  annualRevenue: optionalNumber,
  employeeCount: optionalNumber,
  yearEstablished: optionalNumber,
  website: optionalText,
  hqCity: optionalText,
  hqRegion: optionalText,
  status: z.enum(CLIENT_STATUSES).default("ACTIVE"),
});

function readClientForm(fd: FormData) {
  const obj = Object.fromEntries(
    ["name", "legalName", "industry", "naicsCode", "annualRevenue", "employeeCount", "yearEstablished", "website", "hqCity", "hqRegion", "status"].map(
      (k) => [k, fd.get(k) ?? undefined],
    ),
  );
  return clientFields.safeParse(obj);
}

const criticalLinesFrom = (fd: FormData) =>
  fd.getAll("criticalLines").map(String).filter((l) => (COVERAGE_LINE_KEYS as string[]).includes(l)).join(",");

async function validAssignee(id: string | null, capability: "AE" | "BROKER") {
  if (!id) return true;
  const u = await db.user.findUnique({ where: { id }, select: { roles: true } });
  return !!u && u.roles.split(",").includes(capability);
}

export async function createClient(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = readClientForm(fd);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  // Default assignment: the creator takes whichever seats they're licensed for
  // (a hybrid takes both). Leads/admins may assign anyone.
  const lead = hasCapability(user, "TEAM_LEAD") || hasCapability(user, "ADMIN");
  let aeId = hasCapability(user, "AE") ? user.id : null;
  let brokerId = hasCapability(user, "BROKER") ? user.id : null;
  if (lead) {
    aeId = (fd.get("aeId") as string) || aeId;
    brokerId = (fd.get("brokerId") as string) || brokerId;
  }
  if (!(await validAssignee(aeId, "AE")) || !(await validAssignee(brokerId, "BROKER"))) {
    return fail("Assigned users must hold the AE / Broker capability.");
  }

  const client = await db.client.create({
    data: {
      ...parsed.data,
      annualRevenue: parsed.data.annualRevenue ?? null,
      employeeCount: parsed.data.employeeCount ?? null,
      yearEstablished: parsed.data.yearEstablished ?? null,
      criticalLines: criticalLinesFrom(fd) || "P_C",
      aeId,
      brokerId,
      teamId: user.teamId,
    },
  });
  redirect(`/clients/${client.id}`);
}

export async function updateClient(clientId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const found = await loadClientFor(user, clientId, { type: "client.edit" });
  if (found.error !== undefined) return fail(found.error);
  const parsed = readClientForm(fd);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const data: Record<string, unknown> = { ...parsed.data, criticalLines: criticalLinesFrom(fd) };
  if (can(user, found.client, { type: "client.reassign" }) && fd.has("aeId")) {
    const aeId = (fd.get("aeId") as string) || null;
    const brokerId = (fd.get("brokerId") as string) || null;
    if (!(await validAssignee(aeId, "AE")) || !(await validAssignee(brokerId, "BROKER"))) {
      return fail("Assigned users must hold the AE / Broker capability.");
    }
    Object.assign(data, { aeId, brokerId });
  }
  await db.client.update({ where: { id: clientId }, data });
  refresh();
  return { ok: true, message: "Profile saved" };
}

// ─── Client news & updates ─────────────────────────────────────────────────

export async function postUpdate(clientId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const found = await loadClientFor(user, clientId, { type: "update.post" });
  if (found.error !== undefined) return fail(found.error);
  const parsed = z
    .object({ body: z.string().trim().min(3, "Write a short update").max(4000), category: z.enum(UPDATE_CATEGORY_KEYS) })
    .safeParse({ body: fd.get("body"), category: fd.get("category") ?? "GENERAL" });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await db.clientUpdate.create({ data: { ...parsed.data, clientId, authorId: user.id } });
  refresh();
  return { ok: true };
}

export async function toggleUpdatePin(updateId: string): Promise<ActionResult> {
  const user = await requireUser();
  const update = await db.clientUpdate.findUnique({ where: { id: updateId } });
  if (!update) return fail("Update not found.");
  const found = await loadClientFor(user, update.clientId, { type: "update.pin" });
  if (found.error !== undefined) return fail(found.error);
  await db.clientUpdate.update({ where: { id: updateId }, data: { pinned: !update.pinned } });
  refresh();
  return { ok: true };
}

export async function deleteUpdate(updateId: string): Promise<ActionResult> {
  const user = await requireUser();
  const update = await db.clientUpdate.findUnique({ where: { id: updateId } });
  if (!update) return fail("Update not found.");
  const found = await loadClientFor(user, update.clientId, { type: "update.post" });
  if (found.error !== undefined) return fail(found.error);
  const oversight = can(user, found.client, { type: "client.reassign" });
  if (update.authorId !== user.id && !oversight) return fail("Only the author can delete this update.");
  await db.clientUpdate.delete({ where: { id: updateId } });
  refresh();
  return { ok: true };
}

// ─── Policies & subscription splits ────────────────────────────────────────

const participationSchema = z
  .array(z.object({ carrierName: z.string().trim().min(1), sharePercent: z.coerce.number().gt(0).max(100), isLead: z.boolean() }))
  .min(1, "Add at least one participating insurer")
  .superRefine((rows, ctx) => {
    const total = rows.reduce((s, r) => s + r.sharePercent, 0);
    if (Math.abs(total - 100) > 0.01) ctx.addIssue({ code: "custom", message: `Shares must total 100% (currently ${total}%)` });
    if (rows.filter((r) => r.isLead).length !== 1) ctx.addIssue({ code: "custom", message: "Exactly one insurer must be the lead market" });
    const names = rows.map((r) => r.carrierName.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Each insurer can only appear once" });
  });

const policySchema = z.object({
  coverageLine: z.enum(COVERAGE_LINE_KEYS),
  policyNumber: z.string().trim().min(2, "Policy number is required"),
  description: optionalText,
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  premium: z.coerce.number().nonnegative(),
  limit: optionalNumber,
  deductible: optionalNumber,
  status: z.enum(POLICY_STATUSES),
  isMaster: z.boolean(),
});

function readPolicyForm(fd: FormData) {
  let participations: unknown = [];
  try {
    participations = JSON.parse(String(fd.get("participations") ?? "[]"));
  } catch {
    /* validated below */
  }
  const policy = policySchema.safeParse({
    coverageLine: fd.get("coverageLine"),
    policyNumber: fd.get("policyNumber"),
    description: fd.get("description") ?? undefined,
    effectiveDate: fd.get("effectiveDate"),
    expiryDate: fd.get("expiryDate"),
    premium: fd.get("premium"),
    limit: fd.get("limit") ?? undefined,
    deductible: fd.get("deductible") ?? undefined,
    status: fd.get("status") ?? "ACTIVE",
    isMaster: fd.get("isMaster") === "on",
  });
  if (!policy.success) return { error: firstIssue(policy.error) } as const;
  if (policy.data.expiryDate <= policy.data.effectiveDate) return { error: "Expiry must be after the effective date" } as const;
  const parts = participationSchema.safeParse(participations);
  if (!parts.success) return { error: parts.error.issues[0]?.message ?? "Invalid market participation" } as const;
  return { policy: policy.data, participations: parts.data } as const;
}

async function writeParticipations(policyId: string, rows: z.infer<typeof participationSchema>) {
  await db.policyParticipation.deleteMany({ where: { policyId } });
  for (const r of rows) {
    const carrier = await db.carrier.upsert({ where: { name: r.carrierName }, update: {}, create: { name: r.carrierName } });
    await db.policyParticipation.create({
      data: { policyId, carrierId: carrier.id, sharePercent: r.sharePercent, isLead: r.isLead },
    });
  }
}

export async function savePolicy(
  clientId: string,
  policyId: string | null,
  _: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const found = await loadClientFor(user, clientId, { type: "placement.manage" });
  if (found.error !== undefined) return fail(found.error);
  const parsed = readPolicyForm(fd);
  if ("error" in parsed) return fail(parsed.error!);

  if (policyId) {
    const existing = await db.policy.findFirst({ where: { id: policyId, clientId } });
    if (!existing) return fail("Policy not found.");
  }
  const saved = await db.$transaction(async (tx) => {
    if (parsed.policy.isMaster) {
      await tx.policy.updateMany({ where: { clientId, isMaster: true }, data: { isMaster: false } });
    }
    return policyId
      ? tx.policy.update({ where: { id: policyId }, data: parsed.policy })
      : tx.policy.create({ data: { ...parsed.policy, clientId } });
  });
  await writeParticipations(saved.id, parsed.participations);
  redirect(`/clients/${clientId}#policies`);
}

// ─── Renewals ──────────────────────────────────────────────────────────────

export async function startRenewal(clientId: string): Promise<ActionResult> {
  const user = await requireUser();
  const found = await loadClientFor(user, clientId, { type: "renewal.move", to: "D120" });
  if (found.error !== undefined) return fail(found.error);

  const policies = await db.policy.findMany({ where: { clientId, status: "ACTIVE" }, orderBy: { expiryDate: "asc" } });
  if (!policies.length) return fail("No active policies to renew.");
  const anchor = policies.find((p) => p.isMaster) ?? policies[0];
  const termYear = shiftTermYear(termYearFor(anchor.effectiveDate), 1);

  const exists = await db.renewal.findUnique({ where: { clientId_termYear: { clientId, termYear } } });
  if (exists) return fail(`A ${termYear} renewal is already in the pipeline.`);

  const renewal = await db.renewal.create({
    data: {
      clientId,
      termYear,
      expiryDate: anchor.expiryDate,
      expiringPremium: policies.filter((p) => +p.expiryDate === +anchor.expiryDate).reduce((s, p) => s + p.premium, 0),
      stage: "D120",
    },
  });
  await db.renewalStageEvent.create({ data: { renewalId: renewal.id, toStage: "D120", movedById: user.id } });
  refresh();
  return { ok: true, message: `${termYear} renewal added to the pipeline` };
}

export async function moveRenewal(renewalId: string, to: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(RENEWAL_STAGE_KEYS as string[]).includes(to)) return fail("Unknown stage.");
  const target = to as RenewalStage;

  const renewal = await db.renewal.findUnique({ where: { id: renewalId } });
  if (!renewal) return fail("Renewal not found.");
  if (renewal.stage === target) return { ok: true };

  const found = await loadClientFor(user, renewal.clientId, { type: "renewal.move", to: target });
  if (found.error !== undefined) return fail(found.error);

  // Workflow lock — enforced here regardless of what the UI allowed.
  const required = requiredDocsForStage(target);
  if (required.length) {
    const present = await db.document.findMany({
      where: { clientId: renewal.clientId, termYear: renewal.termYear, category: { in: required } },
      select: { category: true },
      distinct: ["category"],
    });
    const missing = required.filter((c) => !present.some((p) => p.category === c));
    if (missing.length) {
      return fail(
        `Locked: upload the ${missing.map(docCategoryLabel).join(", ")} to the ${renewal.termYear} vault before moving to ${stageLabel(target)}.`,
      );
    }
  }

  const now = new Date();
  await db.$transaction([
    db.renewal.update({
      where: { id: renewalId },
      data: {
        stage: target,
        stageEnteredAt: now,
        boundAt: target === "BOUND" ? now : null,
        boundPremium: target === "BOUND" ? (renewal.boundPremium ?? renewal.targetPremium ?? renewal.expiringPremium) : renewal.boundPremium,
      },
    }),
    db.renewalStageEvent.create({ data: { renewalId, fromStage: renewal.stage, toStage: target, movedById: user.id } }),
  ]);
  refresh();
  return { ok: true };
}

export async function updateRenewalFigures(renewalId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const renewal = await db.renewal.findUnique({ where: { id: renewalId } });
  if (!renewal) return fail("Renewal not found.");
  const found = await loadClientFor(user, renewal.clientId, { type: "renewal.move", to: renewal.stage as RenewalStage });
  if (found.error !== undefined) return fail(found.error);
  const parsed = z
    .object({ targetPremium: optionalNumber, boundPremium: optionalNumber, notes: optionalText })
    .safeParse({ targetPremium: fd.get("targetPremium") ?? undefined, boundPremium: fd.get("boundPremium") ?? undefined, notes: fd.get("notes") ?? undefined });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await db.renewal.update({ where: { id: renewalId }, data: parsed.data });
  refresh();
  return { ok: true, message: "Saved" };
}

// ─── Documents ─────────────────────────────────────────────────────────────

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return fail("Document not found.");
  const found = await loadClientFor(user, doc.clientId, { type: "doc.delete", uploadedById: doc.uploadedById });
  if (found.error !== undefined) return fail("Only the uploader or a team lead can delete this file.");
  await db.document.delete({ where: { id: documentId } });
  await storage.remove(doc.storageKey);
  refresh();
  return { ok: true };
}
