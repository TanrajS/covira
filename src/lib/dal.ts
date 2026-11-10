import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { can, parseCapabilities, permissionHint, type Action, type SessionUser } from "./permissions";

/**
 * Data Access Layer: the only place that turns a request into a user.
 * Reads request headers, so callers must render behind a Suspense boundary
 * (each (app) route has a loading.tsx for this).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
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
  if (!user) redirect("/login");
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
