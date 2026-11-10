import { test } from "node:test";
import assert from "node:assert/strict";
import { matrixStatus, requiredDocsForStage, termYearFor, shiftTermYear, isTermYear } from "../src/lib/domain";
import { can, clientScope, type SessionUser } from "../src/lib/permissions";

const user = (id: string, caps: SessionUser["capabilities"], teamId: string | null = "t1"): SessionUser => ({
  id, name: id, email: `${id}@x.test`, title: null, teamId, capabilities: caps,
});
const ae = user("ae", ["AE"]);
const broker = user("broker", ["BROKER"]);
const hybrid = user("hybrid", ["AE", "BROKER"]);
const lead = user("lead", ["TEAM_LEAD"]);
const outsider = user("outsider", ["AE", "BROKER"]);

const split = { aeId: "ae", brokerId: "broker", teamId: "t1" };
const hybridAccount = { aeId: "hybrid", brokerId: "hybrid", teamId: "t1" };

test("workflow lock: SOV required to leave 120 Days Out, cumulatively", () => {
  assert.deepEqual(requiredDocsForStage("D120"), []);
  for (const s of ["D90", "D30", "BINDING", "BOUND"] as const) assert.deepEqual(requiredDocsForStage(s), ["SOV"]);
});

test("AE/Broker split account: binding is broker-only", () => {
  assert.equal(can(ae, split, { type: "renewal.move", to: "D90" }), true);
  assert.equal(can(ae, split, { type: "renewal.move", to: "BINDING" }), false);
  assert.equal(can(ae, split, { type: "renewal.move", to: "BOUND" }), false);
  assert.equal(can(broker, split, { type: "renewal.move", to: "BOUND" }), true);
});

test("uploads: AEs file SOVs; submissions & proposals are broker-only", () => {
  assert.equal(can(ae, split, { type: "doc.upload", category: "SOV" }), true);
  assert.equal(can(ae, split, { type: "doc.upload", category: "SUBMISSION" }), false);
  assert.equal(can(ae, split, { type: "doc.upload", category: "PROPOSAL" }), false);
  assert.equal(can(broker, split, { type: "doc.upload", category: "PROPOSAL" }), true);
  assert.equal(can(ae, split, { type: "placement.manage" }), false);
  assert.equal(can(broker, split, { type: "placement.manage" }), true);
});

test("hybrid Broker/AE holds every account permission on their own accounts", () => {
  for (const to of ["D90", "D30", "BINDING", "BOUND"] as const) assert.equal(can(hybrid, hybridAccount, { type: "renewal.move", to }), true);
  for (const category of ["SOV", "ACTIVE_POLICY", "SUBMISSION", "PROPOSAL"] as const)
    assert.equal(can(hybrid, hybridAccount, { type: "doc.upload", category }), true);
  assert.equal(can(hybrid, hybridAccount, { type: "client.edit" }), true);
  assert.equal(can(hybrid, hybridAccount, { type: "placement.manage" }), true);
});

test("capabilities alone grant nothing on someone else's account", () => {
  assert.equal(can(outsider, split, { type: "client.view" }), false);
  assert.equal(can(outsider, split, { type: "renewal.move", to: "D90" }), false);
});

test("team leads have oversight within their team only", () => {
  assert.equal(can(lead, split, { type: "renewal.move", to: "BOUND" }), true);
  assert.equal(can(lead, split, { type: "client.reassign" }), true);
  assert.equal(can(lead, { ...split, teamId: "other" }, { type: "client.view" }), false);
  assert.deepEqual(clientScope(lead), { OR: [{ aeId: "lead" }, { brokerId: "lead" }, { teamId: "t1" }] });
});

test("cross-sell matrix colours", () => {
  assert.equal(matrixStatus({ hasActive: true, isCritical: true, daysToExpiry: 200, renewalStage: null }).status, "GREEN");
  assert.equal(matrixStatus({ hasActive: true, isCritical: true, daysToExpiry: 20, renewalStage: "D30" }).kind, "EXPIRING");
  assert.equal(matrixStatus({ hasActive: true, isCritical: true, daysToExpiry: 20, renewalStage: "BINDING" }).status, "GREEN");
  assert.equal(matrixStatus({ hasActive: false, isCritical: true, daysToExpiry: null, renewalStage: null }).status, "RED");
  assert.equal(matrixStatus({ hasActive: false, isCritical: false, daysToExpiry: null, renewalStage: null }).kind, "WHITESPACE");
});

test("term years", () => {
  assert.equal(termYearFor(new Date("2025-07-01T00:00:00Z")), "2025-2026");
  assert.equal(shiftTermYear("2025-2026", 1), "2026-2027");
  assert.equal(isTermYear("2025-2026"), true);
  assert.equal(isTermYear("2025-2027"), false);
});
