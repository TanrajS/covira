"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { PERSONA_COOKIE, isDemoMode, personaByKey } from "./personas";

async function setPersona(key: string) {
  if (!isDemoMode()) throw new Error("Role selection is disabled when AUTH_MODE=password");
  if (!personaByKey(key)) throw new Error("Unknown role");
  (await cookies()).set(PERSONA_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Role picker on /welcome. */
export async function choosePersona(key: string) {
  await setPersona(key);
  redirect("/");
}

/**
 * Header role switcher. Record pages (a specific client) may not be visible to
 * the new role, so those fall back to the client list; other pages refresh in place.
 */
export async function switchPersona(key: string, pathname: string) {
  await setPersona(key);
  if (/^\/clients\/[^/]+/.test(pathname) && pathname !== "/clients/new") redirect("/clients");
  refresh();
}
