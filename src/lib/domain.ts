// Domain vocabulary shared by server and client code. Enumerations are stored
// as strings in the database; this file is the single source of truth.

export const COVERAGE_LINES = [
  { key: "P_C", label: "P&C", long: "Property & Casualty" },
  { key: "CYBER", label: "Cyber", long: "Cyber Liability" },
  { key: "D_AND_O", label: "D&O", long: "Directors & Officers" },
  { key: "E_AND_O", label: "E&O", long: "Errors & Omissions" },
  { key: "FINANCIAL_LINES", label: "Financial Lines", long: "Financial Lines (Crime, Fiduciary, K&R)" },
] as const;
export type CoverageLine = (typeof COVERAGE_LINES)[number]["key"];
export const COVERAGE_LINE_KEYS = COVERAGE_LINES.map((l) => l.key) as CoverageLine[];
export const coverageLabel = (key: string) =>
  COVERAGE_LINES.find((l) => l.key === key)?.label ?? key;

export const DOC_CATEGORIES = [
  { key: "ACTIVE_POLICY", label: "Active Policies", short: "Policy" },
  { key: "SOV", label: "SOVs", short: "SOV" },
  { key: "SUBMISSION", label: "Submissions", short: "Submission" },
  { key: "PROPOSAL", label: "Proposals", short: "Proposal" },
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number]["key"];
export const DOC_CATEGORY_KEYS = DOC_CATEGORIES.map((c) => c.key) as DocCategory[];
export const docCategoryLabel = (key: string) =>
  DOC_CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const DOC_TYPES = [
  { key: "MASTER_POLICY", label: "Master policy" },
  { key: "SCHEDULE", label: "Schedule" },
  { key: "ENDORSEMENT", label: "Endorsement" },
  { key: "OTHER", label: "Other" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["key"];
export const DOC_TYPE_KEYS = DOC_TYPES.map((t) => t.key) as DocType[];
export const docTypeLabel = (key: string) => DOC_TYPES.find((t) => t.key === key)?.label ?? key;

export const RENEWAL_STAGES = [
  { key: "D120", label: "120 Days Out", targetDays: 120 },
  { key: "D90", label: "90 Days Out", targetDays: 90 },
  { key: "D30", label: "30 Days Out", targetDays: 30 },
  { key: "BINDING", label: "Binding", targetDays: 7 },
  { key: "BOUND", label: "Bound", targetDays: 0 },
] as const;
export type RenewalStage = (typeof RENEWAL_STAGES)[number]["key"];
export const RENEWAL_STAGE_KEYS = RENEWAL_STAGES.map((s) => s.key) as RenewalStage[];
export const stageLabel = (key: string) => RENEWAL_STAGES.find((s) => s.key === key)?.label ?? key;
export const stageIndex = (key: string) => RENEWAL_STAGE_KEYS.indexOf(key as RenewalStage);

/**
 * Workflow gates: documents that must exist in the renewal's term-year vault
 * before a card may sit in (or beyond) a stage. Gates are cumulative — a card
 * cannot leave "120 Days Out" for ANY later stage until an SOV is on file.
 * Add entries here to tighten the workflow (e.g. BINDING: ["SUBMISSION"]).
 */
export const STAGE_DOCUMENT_GATES: Partial<Record<RenewalStage, DocCategory[]>> = {
  D90: ["SOV"],
};

export function requiredDocsForStage(stage: RenewalStage): DocCategory[] {
  const idx = stageIndex(stage);
  const req = new Set<DocCategory>();
  RENEWAL_STAGE_KEYS.forEach((s, i) => {
    if (i <= idx) STAGE_DOCUMENT_GATES[s]?.forEach((c) => req.add(c));
  });
  return [...req];
}

export const UPDATE_CATEGORIES = [
  { key: "GENERAL", label: "General" },
  { key: "EXPANSION", label: "Expansion / New ops" },
  { key: "EXPOSURE_CHANGE", label: "Exposure change" },
  { key: "CLAIMS", label: "Claims" },
  { key: "MARKET", label: "Market intel" },
  { key: "LEADERSHIP", label: "Leadership / M&A" },
] as const;
export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number]["key"];
export const UPDATE_CATEGORY_KEYS = UPDATE_CATEGORIES.map((c) => c.key) as UpdateCategory[];
export const updateCategoryLabel = (key: string) =>
  UPDATE_CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const POLICY_STATUSES = ["ACTIVE", "QUOTED", "EXPIRED", "CANCELLED"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const CLIENT_STATUSES = ["PROSPECT", "ACTIVE", "LAPSED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CAPABILITIES = ["AE", "BROKER", "TEAM_LEAD", "ADMIN"] as const;
export type Capability = (typeof CAPABILITIES)[number];
export const capabilityLabel: Record<Capability, string> = {
  AE: "Client Executive",
  BROKER: "Broker",
  TEAM_LEAD: "Team Lead",
  ADMIN: "Admin",
};

// ─── Term years ────────────────────────────────────────────────────────────

/** "2025-2026" for a policy effective any time in 2025. */
export function termYearFor(effective: Date): string {
  const y = effective.getUTCFullYear();
  return `${y}-${y + 1}`;
}

export function shiftTermYear(term: string, by: number): string {
  const start = Number(term.slice(0, 4)) + by;
  return `${start}-${start + 1}`;
}

export function isTermYear(value: string): boolean {
  return /^\d{4}-\d{4}$/.test(value) && Number(value.slice(5)) === Number(value.slice(0, 4)) + 1;
}

// ─── Cross-sell matrix ─────────────────────────────────────────────────────

export type MatrixStatus = "GREEN" | "YELLOW" | "RED";
export type MatrixKind = "COVERED" | "EXPIRING" | "WHITESPACE" | "CRITICAL";

/** Days before expiry at which in-force cover without a near-final renewal turns amber. */
export const EXPIRY_WATCH_DAYS = 45;

export function matrixStatus(opts: {
  hasActive: boolean;
  isCritical: boolean;
  daysToExpiry: number | null;
  renewalStage: string | null;
}): { status: MatrixStatus; kind: MatrixKind; reason: string } {
  const { hasActive, isCritical, daysToExpiry, renewalStage } = opts;
  if (hasActive) {
    const renewalSafe = renewalStage === "BINDING" || renewalStage === "BOUND";
    if (daysToExpiry !== null && daysToExpiry <= EXPIRY_WATCH_DAYS && !renewalSafe) {
      return { status: "YELLOW", kind: "EXPIRING", reason: `In force, expires in ${daysToExpiry}d — renewal not yet binding` };
    }
    return { status: "GREEN", kind: "COVERED", reason: "In force" };
  }
  if (isCritical) return { status: "RED", kind: "CRITICAL", reason: "Critical coverage missing" };
  return { status: "YELLOW", kind: "WHITESPACE", reason: "Whitespace — cross-sell opportunity" };
}
