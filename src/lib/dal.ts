import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "./db";
import { PERSONA_COOKIE, isDemoMode, personaByKey } from "./personas";
import { can, parseCapabilities, permissionHint, type Action, type SessionUser } from "./permissions";

/** Resolves who is making the request: a chosen demo role, or a real session. */
async function resolveUserId(): Promise<string | null> {
  if (isDemoMode()) {
    const persona = personaByKey((await cookies()).get(PERSONA_COOKIE)?.value);
    if (!persona) return null;
    const user = await db.user.findUnique({ where: { email: persona.email }, select: { id: true } });
    return user?.id ?? null;
  }
  // Loaded lazily so demo deployments don't need auth secrets configured.
  const { auth } = await import("./auth");
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

/**
 * Data Access Layer: the only place that turns a request into a user.
 * Reads request cookies/headers, so callers must render behind a Suspense
 * boundary (each (app) route has a loading.tsx for this).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const id = await resolveUserId();
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    teamId: user.teamId,
    capabilities: parseCapabilities(user.roles),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(isDemoMode() ? "/welcome" : "/login");
  return user;
}

/** Load a client's assignment and 404 if the user may not see it. */
export async function requireClientAccess(clientId: string, action: Action = { type: "client.view" }) {
  const user = await requireUser();
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, aeId: true, brokerId: true, teamId: true },
  });
  if (!client || !can(user, client, { type: "client.view" })) notFound();
  if (!can(user, client, action)) throw new ForbiddenError(permissionHint(action));
  return { user, client };
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
