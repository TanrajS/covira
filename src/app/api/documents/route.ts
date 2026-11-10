import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { DOC_CATEGORY_KEYS, DOC_TYPE_KEYS, isTermYear, type DocCategory } from "@/lib/domain";
import { can, permissionHint } from "@/lib/permissions";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, storage, storageKeyFor } from "@/lib/storage";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** Multipart upload into the term-year vault. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return bad("Not signed in", 401);

  const fd = await req.formData();
  const clientId = String(fd.get("clientId") ?? "");
  const termYear = String(fd.get("termYear") ?? "");
  const category = String(fd.get("category") ?? "") as DocCategory;
  const docType = String(fd.get("docType") || "OTHER");
  const policyId = (fd.get("policyId") as string) || null;
  const notes = ((fd.get("notes") as string) || "").trim() || null;
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);

  if (!isTermYear(termYear)) return bad("Choose a valid policy term, e.g. 2025-2026.");
  if (!DOC_CATEGORY_KEYS.includes(category)) return bad("Choose an upload category.");
  if (!(DOC_TYPE_KEYS as string[]).includes(docType)) return bad("Unknown document type.");
  if (!files.length) return bad("Attach at least one file.");

  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, aeId: true, brokerId: true, teamId: true } });
  if (!client || !can(user, client, { type: "client.view" })) return bad("Client not found", 404);
  if (!can(user, client, { type: "doc.upload", category })) return bad(permissionHint({ type: "doc.upload", category }), 403);
  if (policyId && !(await db.policy.findFirst({ where: { id: policyId, clientId } }))) return bad("Policy not found for this client.");

  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS[ext]) return bad(`${f.name}: file type ${ext || "(none)"} is not allowed.`);
    if (f.size > MAX_UPLOAD_BYTES) return bad(`${f.name}: exceeds the 50 MB limit.`);
  }

  const created = [];
  for (const f of files) {
    const key = storageKeyFor(clientId, termYear, category, f.name);
    await storage.put(key, Buffer.from(await f.arrayBuffer()));
    created.push(
      await db.document.create({
        data: {
          clientId, termYear, category, policyId, notes,
          docType: category === "ACTIVE_POLICY" ? docType : "OTHER",
          fileName: f.name,
          storageKey: key,
          mimeType: ALLOWED_EXTENSIONS[path.extname(f.name).toLowerCase()],
          sizeBytes: f.size,
          uploadedById: user.id,
        },
        select: { id: true, fileName: true },
      }),
    );
  }
  return NextResponse.json({ ok: true, documents: created });
}
