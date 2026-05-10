// POST /api/opposing  body: { facts }  →  { result, mocked }
import { NextRequest, NextResponse } from "next/server";
import { roleplayOpposing } from "@/lib/opposing";
import type { Facts } from "@/lib/demo-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { facts: Facts };
    if (!body?.facts) return NextResponse.json({ error: "missing facts" }, { status: 400 });
    const out = await roleplayOpposing(body.facts);
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
