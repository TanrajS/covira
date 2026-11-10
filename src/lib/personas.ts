// Demo access mode
// ────────────────
// By default (AUTH_MODE unset or "demo") there is no sign-in: visitors pick a
// role and act as the seeded demo user who holds it. Permissions are unchanged —
// they still come from capabilities + account assignments (see permissions.ts).
//
// Set AUTH_MODE="password" to restore real accounts via Better Auth (email /
// password, optional Microsoft SSO) when the project moves beyond the demo.
//
// No `server-only` here: proxy.ts and client components import this too.

export const PERSONA_COOKIE = "covira_persona";

export const isDemoMode = () => (process.env.AUTH_MODE ?? "demo") !== "password";

export type PersonaKey = "hybrid" | "ae" | "broker" | "lead";

export const PERSONAS: {
  key: PersonaKey;
  email: string;
  name: string;
  role: string;
  roles: string[];
  blurb: string;
  tryThis: string;
}[] = [
  {
    key: "ae",
    email: "marcus@covira.test",
    name: "Marcus Chen",
    role: "Client Executive",
    roles: ["Client Executive"],
    blurb: "Owns the client relationship and gathers exposure data — SOVs, firmographics, operational updates.",
    tryThis: "Post a client update, upload an SOV, then try dragging a renewal into Binding (reserved for Brokers).",
  },
  {
    key: "broker",
    email: "sofia@covira.test",
    name: "Sofia Alvarez",
    role: "Commercial Risk Broker",
    roles: ["Broker"],
    blurb: "Retrieves the gathered data, approaches markets, negotiates placements and binds.",
    tryThis: "Edit the Maple Ridge P&C subscription split, then move a renewal to Binding.",
  },
  {
    key: "hybrid",
    email: "dan@covira.test",
    name: "Dan Kowalski",
    role: "Hybrid Broker / AE",
    roles: ["Client Executive", "Broker"],
    blurb: "Holds both roles on the same accounts and runs the entire renewal lifecycle alone.",
    tryThis: "Lakeshore Precision is locked at 120 Days Out — upload its SOV to unlock it, then drag it through to Bound.",
  },
  {
    key: "lead",
    email: "priya@covira.test",
    name: "Priya Natarajan",
    role: "Team Lead",
    roles: ["Team Lead"],
    blurb: "Oversees every account on the team, pipeline velocity and revenue roll-ups.",
    tryThis: "Open Team Roll-up, then compare the full-team renewal board with the cross-sell matrix.",
  },
];

export const personaByKey = (key: string | undefined) => PERSONAS.find((p) => p.key === key);
export const personaByEmail = (email: string) => PERSONAS.find((p) => p.email === email);
