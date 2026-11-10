import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

// On Vercel, fall back to the deployment's own URLs so production and preview
// deployments work without hand-setting BETTER_AUTH_URL for each one.
const vercelUrls = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`);

const microsoftConfigured = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? vercelUrls[0],
  trustedOrigins: vercelUrls,
  database: prismaAdapter(db, { provider: "postgresql" }),
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
