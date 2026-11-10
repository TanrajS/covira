# Covira — Commercial Risk Broking CRM

Covira manages the commercial insurance renewal lifecycle, from gathering client exposure data through to placing and binding with markets. It gives everyone one place to find client data, and it enforces a document workflow so no renewal goes to market without its Statement of Values (SOV).

## Quick start

```bash
npm install                     # also generates the Prisma client
npm run db:start                # local Postgres via `prisma dev` (no Docker); prints a TCP URL
cp .env.example .env            # paste that URL into DATABASE_URL
npm run setup                   # migrate + seed demo data
npm run dev                     # http://localhost:3000
```

### No sign-in: choose a role

Visitors don't log in. Opening the app shows a **Choose a role** screen, and the **Viewing as** menu in the top bar switches roles at any time. Each role acts as a seeded demo user, because permissions depend on which accounts a person is assigned to:

| Role | Demo user | What it shows |
|---|---|---|
| Client Executive | Marcus Chen | Gathers data and uploads SOVs. Can't bind or send submissions. |
| Commercial Risk Broker | Sofia Alvarez | Goes to market, manages placements and subscription splits, binds. |
| Hybrid Broker / AE | Dan Kowalski | Holds **both** roles on the same accounts and runs the whole lifecycle. |
| Team Lead | Priya Natarajan | Oversight of every team account, plus pipeline velocity and revenue roll-ups. |

The roles are defined in `src/lib/personas.ts`. The chosen role is stored in a cookie, and the server only accepts the four known role values.

**Turning real logins back on.** Set `AUTH_MODE=password` and `BETTER_AUTH_SECRET`. The role picker is then replaced by Better Auth email/password sign-in (optional Microsoft SSO) against the same users, with password `Covira!2026` for the seeded accounts. No other code changes are needed, because every page and action gets the current user from one place, `src/lib/dal.ts`.

Seed dates are relative to when you run the seed, so the pipeline always looks current. Run `npm run db:seed` to reset.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js 16** (App Router, Server Components, Server Actions, Cache Components) | UI and API ship as one deployable. Data access and permission checks run on the server next to the database, so no separate API tier is needed. |
| Language | **TypeScript** (strict) | Types are shared from the database to the UI. |
| Database | **Prisma 7** + **PostgreSQL** (`prisma dev` locally; Neon or Prisma Postgres on Vercel) | Local Postgres runs without Docker. Serverless hosts need a networked database, not a file. |
| Access | **Role picker** now (demo mode). **Better Auth** is ready behind `AUTH_MODE=password` (email/password, optional **Microsoft Entra ID** SSO). | The instructor can open and use the app without signing in. Real auth is a config switch, not a rewrite, when the project scales. |
| UI | **Tailwind CSS v4**, **lucide-react** icons, **dnd-kit** for drag-and-drop | dnd-kit is accessible (keyboard sensor included) and lets individual cards be disabled, which the workflow lock needs. |
| Validation | **zod** | Every Server Action and upload is validated on the server. |
| Files | **Vercel Blob** (private) when `BLOB_READ_WRITE_TOKEN` is set, otherwise local disk | Files are never public. Every download goes through a route that checks the user can see the account. The driver is in `src/lib/storage-driver.ts`. |

## Features

### Client profiles and market participation
- `/clients/[id]` shows firmographics, the current master policy and schedules, renewal status, a coverage snapshot (Red/Amber/Green), and active policies.
- **Subscription splits.** Each policy shows a stacked bar of participating insurers. The lead market is marked with a crown and labelled *Lead*; the others are labelled *Quota share*, with their percentage and premium share. Syndicated placements get a plain-language summary ("Intact leads at 40% and sets terms; Zurich (25%), Lloyd's (20%)… follow on a quota-share basis").
- Brokers edit placements in a split editor that checks shares total 100% with exactly one lead. The server checks this again.

### Term-year document vault
- `/clients/[id]/vault?term=2025-2026` has a tab for each policy term, with the four categories: **Active Policies, SOVs, Submissions, Proposals**. Active-policy files are tagged *Master policy / Schedule / Endorsement / Other*.
- Upload supports drag-and-drop and multiple files, with type and size checks (50 MB). Every download re-checks that the user can see that account.
- **Global search (⌘K / Ctrl+K)** in the header: type a client name and the panel shows that client's current-term master policy and schedules/SOVs. Press ↵ to open the master policy directly.

### Renewal Kanban with workflow lock
- `/renewals` has five columns: **120 Days Out → 90 Days Out → 30 Days Out → Binding → Bound**.
- **Lock.** A card cannot leave 120 Days Out until an SOV has been filed in that renewal's term-year vault. While locked, dragging is disabled and the card shows an amber *"Upload 2027-2028 SOV to unlock"* link that opens the vault with SOV preselected. The rule is also enforced in `moveRenewal`, so it holds even if someone calls the action directly. Gates are configured in `STAGE_DOCUMENT_GATES` in `src/lib/domain.ts`. Adding e.g. `BINDING: ["SUBMISSION", "PROPOSAL"]` tightens the workflow with no other code changes.
- While a card is being dragged, columns it can't enter are dimmed. Each card shows days to expiry, expiring premium → target premium, days in stage, and a *Behind* flag when the clock has passed the next milestone.

### Cross-sell matrix
- `/cross-sell` lays out clients (rows) against **P&C, Cyber, D&O, E&O, Financial Lines** (columns).
  - **Green**: cover is in force.
  - **Amber**: whitespace (an opportunity), or cover that expires within 45 days while the renewal isn't yet binding.
  - **Red**: a line the client must carry is missing. Required lines are set per client on the profile.
- You can filter by client/industry and AE/Broker, show gaps only, and sort a column by gaps. A penetration % is shown for each line.

### Client news and operational updates
- Each client profile has a feed of categorised updates (Expansion, Exposure change, Claims, Market intel, Leadership/M&A). The AE can pin items "for submission" so they stay at the top when the broker packages the submission.

### Team Lead roll-up
- `/team` shows book premium, pipeline by stage, bound YTD, and the renewal rate change. It also shows **pipeline velocity** (average days per stage, calculated from the stage-move log), a per-producer revenue roll-up (hybrid users are credited in both the AE and Broker columns), behind-schedule renewals, and line mix.

## Permission model

Permissions are worked out in two layers, implemented in `src/lib/permissions.ts`:

1. **Capabilities** are set on the user: `AE`, `BROKER`, `TEAM_LEAD`, `ADMIN`. They decide who can be assigned to an account seat, and who has oversight: team leads over their own team, admins over everything.
2. **Account roles** come from the client record: `client.aeId` and `client.brokerId`. A **hybrid Broker/AE** is simply assigned to both seats on the same account and gets the union of both roles. No special mode or role switching is needed.

| Action | AE on account | Broker on account | Hybrid | Team Lead (own team) |
|---|:-:|:-:|:-:|:-:|
| View account, post updates | ✓ | ✓ | ✓ | ✓ |
| Edit profile, pin updates | ✓ | | ✓ | ✓ |
| Upload SOV / Active Policy | ✓ | ✓ | ✓ | ✓ |
| Upload Submission / Proposal | | ✓ | ✓ | ✓ |
| Manage placements & splits | | ✓ | ✓ | ✓ |
| Move renewal 120 → 90 → 30 | ✓ | ✓ | ✓ | ✓ |
| Move renewal into Binding / Bound | | ✓ | ✓ | ✓ |
| Reassign account team | | | | ✓ |

Holding a capability gives no access to accounts you aren't assigned to. Users only see their own book, and team leads also see their team's. The same `can()` function drives both the UI hints and the server-side checks.

## Project layout

```
prisma/
  schema.prisma          data model (auth, clients, policies, participations, documents, renewals, updates)
  seed.ts                demo book: 11 clients, syndicated placements, renewals at every stage
src/
  proxy.ts               fast redirect to /login when there's no session cookie (real checks live in the DAL)
  lib/
    domain.ts            coverage lines, vault categories, stages, workflow gates, matrix rules
    permissions.ts       capability + account-role permission model
    dal.ts               data access layer: session → user
    queries.ts           read models for each screen
    actions.ts           Server Actions (all mutations; each re-checks permissions)
    storage.ts           file storage driver
  app/
    (auth)/login         sign-in
    (app)/…              dashboard, clients, vault, renewals, cross-sell, team
    api/documents        upload (POST) and permission-checked download (GET)
    api/search           ⌘K quick-pull search
  components/            kanban board, split bar, matrix, vault, forms
tests/rules.test.ts      permission matrix, workflow gates, matrix colours
```

## Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run setup` | migrate, generate the client, seed |
| `npm run db:seed` | reset demo data |
| `npm test` | unit tests for permissions and workflow rules |
| `npm run typecheck` / `lint` | |

## Deploying to Vercel

1. **Database.** In the Vercel project, go to **Storage → Marketplace**, add **Neon** (or **Prisma Postgres**), and connect it to the project. This sets `DATABASE_URL` (and `DATABASE_URL_UNPOOLED` for Neon, which migrations use).
2. **File storage.** Go to **Storage → Blob**, create a store with **Private** access, and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
3. **Environment variables.** Under **Settings → Environment Variables**, add:
   - Nothing is needed for the default no-sign-in demo. For real logins, set `AUTH_MODE=password` and `BETTER_AUTH_SECRET` (from `openssl rand -base64 32`).
   - `BETTER_AUTH_URL` (optional): your custom domain. If it's not set, the app uses the Vercel production, branch and deployment URLs.
4. **Redeploy.** Vercel runs `npm run vercel-build`, which:
   - checks the env vars above and fails with a readable message if any are missing,
   - runs `prisma migrate deploy`,
   - seeds the demo book **only if the database has no users**,
   - runs `next build`.

**Upload limit on Vercel.** Functions reject request bodies over 4.5 MB, so uploads on Vercel are capped at 4.5 MB (50 MB locally). Lifting this means switching to direct-to-Blob client uploads with `@vercel/blob/client`.

**SSO.** Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID`, and add a provisioning step that assigns capabilities (for example from Entra group claims).
