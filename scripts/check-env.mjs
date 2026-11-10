// Fails the Vercel build early with a readable message instead of shipping a
// deployment where every sign-in returns a 500.
const missing = [];
if (!process.env.DATABASE_URL) {
  missing.push("DATABASE_URL — connect Neon or Prisma Postgres (Vercel → Storage → Marketplace) to this project");
}
// Only needed when real sign-in is enabled; the default demo mode has no logins.
if (process.env.AUTH_MODE === "password" && (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)) {
  missing.push("BETTER_AUTH_SECRET — add a random value of 32+ chars (openssl rand -base64 32) under Settings → Environment Variables");
}
if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
  missing.push("BLOB_READ_WRITE_TOKEN — create a PRIVATE Vercel Blob store (Storage → Blob) and connect it to this project");
}
if (missing.length) {
  console.error("\n✖ Covira is missing required environment variables:\n");
  for (const m of missing) console.error(`  • ${m}`);
  console.error("\nAdd them, then redeploy.\n");
  process.exit(1);
}
console.log("✓ Environment looks good");
