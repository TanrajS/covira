import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { searchClients } from "@/lib/queries";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  return NextResponse.json({ results: await searchClients(user, q) });
}
