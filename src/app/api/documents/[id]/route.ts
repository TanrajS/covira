import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { storage } from "@/lib/storage";

/** Stream a vault document after re-checking account access. */
export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.document.findUnique({
    where: { id },
    include: { client: { select: { aeId: true, brokerId: true, teamId: true } } },
  });
  if (!doc || !can(user, doc.client, { type: "client.view" })) return new Response("Not found", { status: 404 });

  const data = await storage.get(doc.storageKey).catch(() => null);
  if (!data) return new Response("File missing from storage", { status: 410 });

  const inline = new URL(req.url).searchParams.get("download") !== "1" && /^(application\/pdf|image\/|text\/)/.test(doc.mimeType);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
