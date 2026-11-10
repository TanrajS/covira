import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

const microsoftConfigured = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    // Brokerage staff are provisioned by an admin (or via SSO), not self-signup.
    disableSignUp: true,
  },
  socialProviders: microsoftConfigured
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 12, // one working day
    updateAge: 60 * 60,
  },
  plugins: [nextCookies()],
});

export const ssoProviders = { microsoft: microsoftConfigured };
