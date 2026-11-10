// Permission model
// ─────────────────
// Two layers:
//   1. Capabilities (global, on the user): AE, BROKER, TEAM_LEAD, ADMIN. They
//      decide who may be *assigned* as an account's AE or Broker, and who has
//      oversight (team leads over their team, admins over everything).
//   2. Account roles (per client): derived from the assignment on the client
//      record — client.aeId and client.brokerId. A hybrid Broker/AE is simply
//      assigned to both slots on the same account and receives the union of
//      both roles' permissions, so they can run the whole lifecycle.
//
// Pure functions — safe to import from client components for UI hints. The
// server re-checks every mutation with the same functions.

import type { Capability, DocCategory, RenewalStage } from "./domain";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  teamId: string | null;
  capabilities: Capability[];
};

export type AccountAssignment = {
  aeId: string | null;
  brokerId: string | null;
  teamId: string | null;
};

export function parseCapabilities(roles: string): Capability[] {
  return roles
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r): r is Capability => ["AE", "BROKER", "TEAM_LEAD", "ADMIN"].includes(r));
}

export const hasCapability = (u: SessionUser, c: Capability) => u.capabilities.includes(c);
export const isHybrid = (u: SessionUser) => hasCapability(u, "AE") && hasCapability(u, "BROKER");
export const isLeadOrAdmin = (u: SessionUser) =>
  hasCapability(u, "TEAM_LEAD") || hasCapability(u, "ADMIN");

export function accountRoles(user: SessionUser, client: AccountAssignment) {
  const ae = client.aeId === user.id;
  const broker = client.brokerId === user.id;
  const oversight =
    hasCapability(user, "ADMIN") ||
    (hasCapability(user, "TEAM_LEAD") && !!user.teamId && user.teamId === client.teamId);
  return { ae, broker, oversight, hybrid: ae && broker };
}

export type Action =
  | { type: "client.view" }
  | { type: "client.edit" }
  | { type: "client.reassign" }
  | { type: "update.post" }
  | { type: "update.pin" }
  | { type: "doc.upload"; category: DocCategory }
  | { type: "doc.delete"; uploadedById: string }
  | { type: "placement.manage" }
  | { type: "renewal.move"; to: RenewalStage };

/** Which account roles may upload each vault category. */
const UPLOAD_ROLES: Record<DocCategory, ("ae" | "broker")[]> = {
  SOV: ["ae", "broker"], // AEs gather exposure data from the client
  ACTIVE_POLICY: ["ae", "broker"],
  SUBMISSION: ["broker"], // brokers package and send to market
  PROPOSAL: ["broker"],
};

export function can(user: SessionUser, client: AccountAssignment, action: Action): boolean {
  const r = accountRoles(user, client);
  if (r.oversight) return true;
  const onAccount = r.ae || r.broker;

  switch (action.type) {
    case "client.view":
    case "update.post":
      return onAccount;
    case "client.edit":
    case "update.pin":
      return r.ae;
    case "client.reassign":
      return false; // oversight only
    case "doc.upload":
      return UPLOAD_ROLES[action.category].some((role) => r[role]);
    case "doc.delete":
      return onAccount && action.uploadedById === user.id;
    case "placement.manage":
      return r.broker;
    case "renewal.move":
      // Data-gathering milestones belong to either side; binding is a market
      // action reserved for the broker on the account.
      return action.to === "BINDING" || action.to === "BOUND" ? r.broker : onAccount;
  }
}

export function permissionHint(action: Action): string {
  switch (action.type) {
    case "doc.upload":
      return UPLOAD_ROLES[action.category].includes("ae")
        ? "Only the AE or Broker on this account can upload here."
        : "Only the Broker on this account can upload submissions and proposals.";
    case "renewal.move":
      return action.to === "BINDING" || action.to === "BOUND"
        ? "Only the Broker on this account can move a renewal into Binding or Bound."
        : "Only the AE or Broker on this account can move this renewal.";
    case "placement.manage":
      return "Only the Broker on this account can manage placements.";
    case "client.edit":
      return "Only the AE on this account can edit the profile.";
    default:
      return "You don't have permission to do that on this account.";
  }
}

/** Prisma `where` fragment limiting clients to the user's book. */
export function clientScope(user: SessionUser) {
  if (hasCapability(user, "ADMIN")) return {};
  const own = [{ aeId: user.id }, { brokerId: user.id }];
  if (hasCapability(user, "TEAM_LEAD") && user.teamId) {
    return { OR: [...own, { teamId: user.teamId }] };
  }
  return { OR: own };
}
