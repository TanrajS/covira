/* Demo data for Covira. Run with `npm run db:seed` (or `npx prisma db seed`). */
import "dotenv/config";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
const STORAGE = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const DAY = 86_400_000;
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const days = (n: number) => new Date(today.getTime() + n * DAY);
const termFor = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCFullYear() + 1}`;
const nextTerm = (t: string) => `${+t.slice(0, 4) + 1}-${+t.slice(0, 4) + 2}`;
const prevTerm = (t: string) => `${+t.slice(0, 4) - 1}-${+t.slice(0, 4)}`;

export const DEMO_PASSWORD = "Covira!2026";

// ─── Tiny PDF / CSV generators so the vault has real, openable files ───────

function pdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const text = [
    "BT /F1 18 Tf 56 760 Td (" + esc(title) + ") Tj ET",
    ...lines.map((l, i) => `BT /F1 11 Tf 56 ${724 - i * 18} Td (${esc(l)}) Tj ET`),
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

function sovCsv(client: string, city: string, locations: number, tiv: number): Buffer {
  const rows = ["Location #,Address,City,Occupancy,Construction,Year Built,Sq Ft,Building Value,Contents Value,BI Value,Total Insured Value"];
  for (let i = 1; i <= locations; i++) {
    const share = tiv / locations;
    rows.push(
      [i, `${100 + i * 17} Industrial Way`, city, i === 1 ? "Head office / warehouse" : "Operations", i % 2 ? "Masonry non-combustible" : "Joisted masonry", 1985 + i * 4, 20000 + i * 7500,
        Math.round(share * 0.6), Math.round(share * 0.25), Math.round(share * 0.15), Math.round(share)].join(","),
    );
  }
  return Buffer.from(`# Statement of Values — ${client}\n${rows.join("\n")}\n`);
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

type Split = [carrier: string, share: number, lead?: boolean];
type PolicySpec = { line: string; prefix: string; premium: number; limit: number; deductible?: number; splits: Split[]; master?: boolean; description?: string };
type ClientSpec = {
  name: string; legalName?: string; industry: string; naics: string; revenue: number; employees: number; founded: number; website: string;
  city: string; region: string; status?: string; critical: string[]; ae: string; broker: string;
  expiresIn?: number; stage?: string; sov?: boolean; locations?: number; target?: number; policies: PolicySpec[];
  updates?: [category: string, author: "ae" | "broker", daysAgo: number, body: string, pinned?: boolean][];
};

const CLIENTS: ClientSpec[] = [
  {
    name: "Northgate Logistics Ltd.", industry: "Transportation & Warehousing", naics: "493110", revenue: 185e6, employees: 640, founded: 1998,
    website: "northgatelogistics.example", city: "Calgary", region: "AB", critical: ["P_C", "CYBER", "D_AND_O"], ae: "marcus", broker: "sofia",
    expiresIn: 112, stage: "D120", sov: false, locations: 6, target: 512000,
    policies: [
      { line: "P_C", prefix: "NGL-PC", premium: 486000, limit: 120e6, deductible: 50000, master: true, description: "Commercial package — property, BI, CGL, auto fleet", splits: [["Intact Insurance", 50, true], ["Aviva Canada", 30], ["Lloyd's", 20]] },
      { line: "CYBER", prefix: "NGL-CY", premium: 38500, limit: 5e6, splits: [["Chubb", 100, true]] },
    ],
    updates: [
      ["EXPANSION", "ae", 3, "Client expanding into light manufacturing (pallet & crate fabrication) at the Balzac site from Q2 — requires EBI insurance exceptions and a contingent BI extension for the new production line.", true],
      ["EXPOSURE_CHANGE", "ae", 18, "Fleet grew from 142 to 171 power units after the Edmonton acquisition. Updated auto schedule requested from the client's fleet manager."],
      ["MARKET", "broker", 26, "Intact signalled appetite to hold their 50% lead line flat at renewal if the sprinkler upgrade at Location 3 is documented."],
    ],
  },
  {
    name: "Prairie Harvest Foods Inc.", industry: "Food Manufacturing", naics: "311422", revenue: 92e6, employees: 310, founded: 2006,
    website: "prairieharvest.example", city: "Saskatoon", region: "SK", critical: ["P_C", "CYBER", "D_AND_O"], ae: "marcus", broker: "sofia",
    expiresIn: 85, stage: "D90", sov: true, locations: 3, target: 268000,
    policies: [
      { line: "P_C", prefix: "PHF-PC", premium: 251000, limit: 64e6, deductible: 25000, master: true, description: "Property incl. spoilage & equipment breakdown, CGL, product recall sublimit", splits: [["Aviva Canada", 60, true], ["Northbridge Insurance", 40]] },
      { line: "D_AND_O", prefix: "PHF-DO", premium: 21400, limit: 5e6, splits: [["Chubb", 100, true]] },
    ],
    updates: [
      ["CLAIMS", "ae", 9, "Ammonia leak at the Saskatoon plant (no injuries). Adjuster appointed; reserve est. $180k. Expect property market questions at renewal."],
      ["GENERAL", "broker", 21, "Client asked for a cyber quote after a peer processor was hit with ransomware — prepare submission alongside the P&C renewal."],
    ],
  },
  {
    name: "Cascade Dental Group", industry: "Healthcare — Dental Clinics", naics: "621210", revenue: 38e6, employees: 210, founded: 2011,
    website: "cascadedental.example", city: "Vancouver", region: "BC", critical: ["P_C", "CYBER", "E_AND_O"], ae: "marcus", broker: "sofia",
    expiresIn: 140, stage: "D120", sov: true, locations: 9, target: 99000,
    policies: [
      { line: "P_C", prefix: "CDG-PC", premium: 64000, limit: 22e6, master: true, description: "Clinic package — 9 locations", splits: [["Intact Insurance", 100, true]] },
      { line: "E_AND_O", prefix: "CDG-EO", premium: 29500, limit: 5e6, description: "Professional liability (non-dentist staff)", splits: [["Lloyd's", 100, true]] },
    ],
    updates: [["LEADERSHIP", "ae", 12, "New CFO (Hannah Liu) starts next month. She's asked for a stewardship meeting before renewal — good moment to raise the cyber gap given patient records."]],
  },
  {
    name: "Maple Ridge Developments Corp.", industry: "Real Estate Development", naics: "236220", revenue: 260e6, employees: 145, founded: 1992,
    website: "mapleridgedev.example", city: "Toronto", region: "ON", critical: ["P_C", "D_AND_O", "FINANCIAL_LINES"], ae: "marcus", broker: "sofia",
    expiresIn: 28, stage: "D30", sov: true, locations: 12, target: 1180000,
    policies: [
      { line: "P_C", prefix: "MRD-PC", premium: 1120000, limit: 410e6, deductible: 100000, master: true, description: "Property portfolio & wrap-up CGL — syndicated", splits: [["Intact Insurance", 40, true], ["Zurich Canada", 25], ["Lloyd's", 20], ["Travelers Canada", 15]] },
      { line: "D_AND_O", prefix: "MRD-DO", premium: 74000, limit: 15e6, splits: [["AIG Insurance Canada", 100, true]] },
      { line: "FINANCIAL_LINES", prefix: "MRD-FL", premium: 18000, limit: 2e6, description: "Commercial crime", splits: [["Travelers Canada", 100, true]] },
    ],
    updates: [
      ["MARKET", "broker", 2, "Zurich reducing capacity from 25% to 15% at renewal. Approaching Liberty Mutual and Definity to fill the 10% gap."],
      ["EXPOSURE_CHANGE", "ae", 15, "Two new mid-rise projects (Mississauga, Oakville) breaking ground in spring — builder's risk to be placed separately."],
    ],
  },
  {
    name: "Aurora Software Solutions", industry: "Software & IT Services", naics: "541511", revenue: 54e6, employees: 280, founded: 2014,
    website: "aurorasoftware.example", city: "Waterloo", region: "ON", critical: ["CYBER", "E_AND_O", "D_AND_O"], ae: "dan", broker: "dan",
    expiresIn: 10, stage: "BINDING", sov: true, locations: 2, target: 196000,
    policies: [
      { line: "E_AND_O", prefix: "ASS-TE", premium: 112000, limit: 10e6, master: true, description: "Tech E&O", splits: [["Lloyd's", 70, true], ["Chubb", 30]] },
      { line: "CYBER", prefix: "ASS-CY", premium: 46000, limit: 10e6, splits: [["Lloyd's", 70, true], ["Chubb", 30]] },
      { line: "D_AND_O", prefix: "ASS-DO", premium: 24000, limit: 5e6, splits: [["Chubb", 100, true]] },
      { line: "P_C", prefix: "ASS-PC", premium: 9800, limit: 6e6, splits: [["Definity Insurance", 100, true]] },
    ],
    updates: [["LEADERSHIP", "ae", 6, "Series C closed ($40M). Board expanded to 7 — D&O limit adequacy review needed before binding."]],
  },
  {
    name: "Fraser Valley Cold Storage", industry: "Refrigerated Warehousing", naics: "493120", revenue: 47e6, employees: 120, founded: 2003,
    website: "fvcoldstorage.example", city: "Abbotsford", region: "BC", critical: ["P_C"], ae: "elena", broker: "sofia",
    expiresIn: -20, stage: "BOUND", sov: true, locations: 2, target: 214000,
    policies: [
      { line: "P_C", prefix: "FVC-PC", premium: 214000, limit: 58e6, master: true, description: "Property incl. stock spoilage, ammonia contamination", splits: [["Northbridge Insurance", 50, true], ["Intact Insurance", 30], ["Aviva Canada", 20]] },
    ],
    updates: [["GENERAL", "broker", 22, "Renewal bound at +4.2%. Northbridge retained lead; spoilage sublimit increased to $5M."]],
  },
  {
    name: "Lakeshore Precision Machining", industry: "Metal Fabrication", naics: "332710", revenue: 29e6, employees: 95, founded: 1987,
    website: "lakeshoreprecision.example", city: "Windsor", region: "ON", critical: ["P_C", "E_AND_O"], ae: "dan", broker: "dan",
    expiresIn: 118, stage: "D120", sov: false, locations: 1, target: 88000,
    policies: [
      { line: "P_C", prefix: "LPM-PC", premium: 81500, limit: 18e6, master: true, description: "Manufacturing package incl. products liability", splits: [["Travelers Canada", 100, true]] },
    ],
    updates: [["EXPANSION", "ae", 5, "Won an aerospace tier-2 supply contract — customer requires $5M products/completed ops and evidence of E&O for design work."]],
  },
  {
    name: "Summit Financial Advisors", industry: "Wealth Management", naics: "523930", revenue: 21e6, employees: 64, founded: 2009,
    website: "summitfa.example", city: "Edmonton", region: "AB", critical: ["E_AND_O", "CYBER", "FINANCIAL_LINES"], ae: "marcus", broker: "sofia",
    expiresIn: 26, stage: "D90", sov: true, locations: 2, target: 71000, // deliberately behind schedule
    policies: [
      { line: "E_AND_O", prefix: "SFA-EO", premium: 38000, limit: 5e6, master: true, splits: [["Lloyd's", 100, true]] },
      { line: "D_AND_O", prefix: "SFA-DO", premium: 12500, limit: 3e6, splits: [["AIG Insurance Canada", 100, true]] },
      { line: "FINANCIAL_LINES", prefix: "SFA-FI", premium: 9200, limit: 2e6, description: "Financial institution bond", splits: [["Chubb", 100, true]] },
      { line: "P_C", prefix: "SFA-PC", premium: 4100, limit: 2e6, splits: [["Intact Insurance", 100, true]] },
    ],
  },
  {
    name: "Bluewater Marine Services", industry: "Marine Services", naics: "488390", revenue: 66e6, employees: 175, founded: 1979,
    website: "bluewatermarine.example", city: "Halifax", region: "NS", critical: ["P_C"], ae: "elena", broker: "sofia",
    expiresIn: 205, locations: 4,
    policies: [
      { line: "P_C", prefix: "BMS-PC", premium: 342000, limit: 75e6, master: true, description: "Marine package — hull, P&I, shore property", splits: [["Lloyd's", 60, true], ["Intact Insurance", 40]] },
    ],
  },
  {
    name: "Kestrel Engineering Partners", industry: "Engineering Services", naics: "541330", revenue: 33e6, employees: 140, founded: 2001,
    website: "kestreleng.example", city: "Calgary", region: "AB", critical: ["E_AND_O", "P_C"], ae: "dan", broker: "dan",
    expiresIn: 60, stage: "D90", sov: true, locations: 2, target: 132000,
    policies: [
      { line: "E_AND_O", prefix: "KEP-PL", premium: 88000, limit: 10e6, master: true, description: "Professional liability — project specific excess available", splits: [["Liberty Mutual Canada", 100, true]] },
      { line: "P_C", prefix: "KEP-PC", premium: 23500, limit: 8e6, splits: [["Aviva Canada", 100, true]] },
      { line: "CYBER", prefix: "KEP-CY", premium: 11800, limit: 2e6, splits: [["Coalition", 100, true]] },
    ],
  },
  {
    name: "Ironwood Brewing Co.", industry: "Craft Brewery", naics: "312120", revenue: 12e6, employees: 48, founded: 2016,
    website: "ironwoodbrewing.example", city: "Kelowna", region: "BC", status: "PROSPECT", critical: ["P_C"], ae: "dan", broker: "dan",
    policies: [],
    updates: [["GENERAL", "ae", 1, "Intro meeting booked. Current broker renewal is in March; they're unhappy with liquor liability terms."]],
  },
];

const CARRIERS = ["Intact Insurance", "Aviva Canada", "Lloyd's", "Northbridge Insurance", "Travelers Canada", "Chubb", "AIG Insurance Canada", "Zurich Canada", "Definity Insurance", "Liberty Mutual Canada", "Coalition"];

const USERS = {
  priya: { name: "Priya Natarajan", email: "priya@covira.test", roles: "TEAM_LEAD,ADMIN", title: "Managing Director, Commercial" },
  marcus: { name: "Marcus Chen", email: "marcus@covira.test", roles: "AE", title: "Client Executive" },
  sofia: { name: "Sofia Alvarez", email: "sofia@covira.test", roles: "BROKER", title: "Commercial Risk Broker" },
  dan: { name: "Dan Kowalski", email: "dan@covira.test", roles: "AE,BROKER", title: "Broker / Account Executive" },
  elena: { name: "Elena Rossi", email: "elena@covira.test", roles: "AE", title: "Client Executive" },
} as const;

const STAGES = ["D120", "D90", "D30", "BINDING", "BOUND"];
const STAGE_DAYS_OUT: Record<string, number> = { D120: 120, D90: 90, D30: 30, BINDING: 7, BOUND: 0 };

async function main() {
  console.log("Resetting database and storage…");
  await rm(STORAGE, { recursive: true, force: true });
  await db.renewalStageEvent.deleteMany();
  await db.renewal.deleteMany();
  await db.document.deleteMany();
  await db.clientUpdate.deleteMany();
  await db.policyParticipation.deleteMany();
  await db.policy.deleteMany();
  await db.client.deleteMany();
  await db.carrier.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
  await db.team.deleteMany();

  const team = await db.team.create({ data: { name: "Western Canada Commercial" } });
  const password = await hashPassword(DEMO_PASSWORD);
  const uid: Record<string, string> = {};
  for (const [key, u] of Object.entries(USERS)) {
    const id = randomUUID();
    uid[key] = id;
    await db.user.create({ data: { id, ...u, emailVerified: true, teamId: team.id } });
    await db.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password } });
  }

  const carrierId: Record<string, string> = {};
  for (const name of CARRIERS) carrierId[name] = (await db.carrier.create({ data: { name } })).id;

  const saveDoc = async (o: { clientId: string; termYear: string; category: string; docType?: string; fileName: string; data: Buffer; mime: string; by: string; daysAgo: number; policyId?: string }) => {
    const key = `${o.clientId}/${o.termYear}/${o.category}/${randomUUID()}-${o.fileName}`;
    await mkdir(path.dirname(path.join(STORAGE, key)), { recursive: true });
    await writeFile(path.join(STORAGE, key), o.data);
    await db.document.create({
      data: {
        clientId: o.clientId, termYear: o.termYear, category: o.category, docType: o.docType ?? "OTHER", fileName: o.fileName,
        storageKey: key, mimeType: o.mime, sizeBytes: o.data.length, uploadedById: o.by, createdAt: days(-o.daysAgo), policyId: o.policyId,
      },
    });
  };

  for (const spec of CLIENTS) {
    const ae = uid[spec.ae];
    const broker = uid[spec.broker];
    const client = await db.client.create({
      data: {
        name: spec.name, legalName: spec.legalName, industry: spec.industry, naicsCode: spec.naics, annualRevenue: spec.revenue,
        employeeCount: spec.employees, yearEstablished: spec.founded, website: spec.website, hqCity: spec.city, hqRegion: spec.region,
        status: spec.status ?? "ACTIVE", criticalLines: spec.critical.join(","), aeId: ae, brokerId: broker, teamId: team.id,
        createdAt: days(-400),
      },
    });

    // For a bound renewal the "current" policies are the freshly bound term.
    const bound = spec.stage === "BOUND";
    const expiry = spec.expiresIn != null ? days(bound ? spec.expiresIn + 365 : spec.expiresIn) : null;
    const effective = expiry ? new Date(expiry.getTime() - 365 * DAY) : null;
    const currentTerm = effective ? termFor(effective) : termFor(today);
    const short = spec.name.split(/\s+/)[0];

    let masterPolicyId: string | undefined;
    for (const p of spec.policies) {
      const policy = await db.policy.create({
        data: {
          clientId: client.id, coverageLine: p.line, policyNumber: `${p.prefix}-${currentTerm.slice(2, 4)}${String(Math.floor(Math.random() * 9000) + 1000)}`,
          description: p.description, effectiveDate: effective!, expiryDate: expiry!, premium: p.premium, limit: p.limit, deductible: p.deductible,
          status: "ACTIVE", isMaster: !!p.master,
        },
      });
      if (p.master) masterPolicyId = policy.id;
      for (const [carrier, share, lead] of p.splits) {
        await db.policyParticipation.create({ data: { policyId: policy.id, carrierId: carrierId[carrier], sharePercent: share, isLead: !!lead } });
      }
    }

    // Vault: current-term master policy, schedules, SOV; prior-term archive.
    if (spec.policies.length) {
      const tiv = spec.policies.find((p) => p.line === "P_C")?.limit ?? 5e6;
      const leadMarket = spec.policies.find((p) => p.master)!.splits.find((s) => s[2])![0];
      for (const term of [currentTerm, prevTerm(currentTerm)]) {
        const ago = term === currentTerm ? 300 : 660;
        await saveDoc({
          clientId: client.id, termYear: term, category: "ACTIVE_POLICY", docType: "MASTER_POLICY", policyId: term === currentTerm ? masterPolicyId : undefined,
          fileName: `${short} Master Policy Wording ${term}.pdf`, mime: "application/pdf", by: broker, daysAgo: ago,
          data: pdf(`${spec.name} — Master Policy`, [`Policy term: ${term}`, `Lead market: ${leadMarket}`, `Named insured: ${spec.name}`, "Declarations, insuring agreements, conditions and exclusions."]),
        });
        await saveDoc({
          clientId: client.id, termYear: term, category: "ACTIVE_POLICY", docType: "SCHEDULE",
          fileName: `${short} Schedule of Coverages ${term}.pdf`, mime: "application/pdf", by: broker, daysAgo: ago - 1,
          data: pdf(`${spec.name} — Schedule of Coverages`, spec.policies.map((p) => `${p.line}: limit $${p.limit.toLocaleString()} · premium $${p.premium.toLocaleString()}`)),
        });
        await saveDoc({
          clientId: client.id, termYear: term, category: "SOV", fileName: `${short} SOV ${term}.csv`, mime: "text/csv", by: ae, daysAgo: ago + 30,
          data: sovCsv(spec.name, spec.city, spec.locations ?? 2, tiv),
        });
      }
    }

    // Prior renewal (bound into the current term) — gives velocity history + bound YTD.
    if (effective && spec.stage) {
      const prior = await db.renewal.create({
        data: {
          clientId: client.id, termYear: currentTerm, expiryDate: effective, stage: "BOUND",
          stageEnteredAt: days(-((today.getTime() - effective.getTime()) / DAY) - 8),
          expiringPremium: Math.round(spec.policies.reduce((s, p) => s + p.premium, 0) / 1.06),
          boundPremium: spec.policies.reduce((s, p) => s + p.premium, 0),
          boundAt: new Date(effective.getTime() - 8 * DAY),
        },
      });
      if (bound) {
        // This client's renewal just bound — the prior record IS the live one.
        await db.renewal.update({ where: { id: prior.id }, data: { stageEnteredAt: days(-20), boundAt: days(-20), targetPremium: spec.target } });
      }
      let at = new Date(effective.getTime() - 130 * DAY);
      for (const [i, stage] of STAGES.entries()) {
        await db.renewalStageEvent.create({
          data: { renewalId: prior.id, fromStage: i ? STAGES[i - 1] : null, toStage: stage, movedById: i >= 3 ? broker : ae, createdAt: at },
        });
        at = new Date(at.getTime() + (25 + ((i * 7 + spec.name.length) % 20)) * DAY);
      }
    }

    // The live renewal for the upcoming term.
    if (spec.stage && !bound && expiry) {
      const renewalTerm = nextTerm(currentTerm);
      const stageIdx = STAGES.indexOf(spec.stage);
      const renewal = await db.renewal.create({
        data: {
          clientId: client.id, termYear: renewalTerm, expiryDate: expiry, stage: spec.stage,
          stageEnteredAt: days(-Math.max(1, Math.min(20, STAGE_DAYS_OUT[spec.stage] - spec.expiresIn! + 25))),
          expiringPremium: spec.policies.reduce((s, p) => s + p.premium, 0), targetPremium: spec.target,
        },
      });
      for (let i = 0; i <= stageIdx; i++) {
        await db.renewalStageEvent.create({
          data: {
            renewalId: renewal.id, fromStage: i ? STAGES[i - 1] : null, toStage: STAGES[i], movedById: i >= 3 ? broker : ae,
            createdAt: days(-(spec.expiresIn! > 0 ? Math.max(1, (stageIdx - i) * 28 + 2) : 1)),
          },
        });
      }
      if (spec.sov) {
        await saveDoc({
          clientId: client.id, termYear: renewalTerm, category: "SOV", fileName: `${short} SOV ${renewalTerm} (updated).csv`, mime: "text/csv",
          by: ae, daysAgo: 20, data: sovCsv(spec.name, spec.city, (spec.locations ?? 2) + 1, (spec.policies.find((p) => p.line === "P_C")?.limit ?? 5e6) * 1.05),
        });
      }
      if (stageIdx >= 2) {
        await saveDoc({
          clientId: client.id, termYear: renewalTerm, category: "SUBMISSION", fileName: `${short} Underwriting Submission ${renewalTerm}.pdf`, mime: "application/pdf",
          by: broker, daysAgo: 14, data: pdf(`${spec.name} — Renewal Submission`, ["Operations overview", "Loss history (5 yrs)", "Updated SOV attached", `Target: renewal effective ${expiry.toISOString().slice(0, 10)}`]),
        });
      }
      if (stageIdx >= 3) {
        await saveDoc({
          clientId: client.id, termYear: renewalTerm, category: "PROPOSAL", fileName: `${short} Renewal Proposal ${renewalTerm}.pdf`, mime: "application/pdf",
          by: broker, daysAgo: 4, data: pdf(`${spec.name} — Renewal Proposal`, ["Market summary and recommendations", `Indicative premium: $${spec.target?.toLocaleString()}`]),
        });
      }
    }

    for (const [category, who, ago, body, pinned] of spec.updates ?? []) {
      await db.clientUpdate.create({
        data: { clientId: client.id, authorId: who === "ae" ? ae : broker, category, body, pinned: !!pinned, createdAt: days(-ago) },
      });
    }
  }

  console.log(`Seeded ${CLIENTS.length} clients. Sign in with any of:`);
  for (const u of Object.values(USERS)) console.log(`  ${u.email.padEnd(22)} ${u.roles.padEnd(16)} password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
