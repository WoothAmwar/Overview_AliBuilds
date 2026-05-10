// POST /api/route — body: { facts } → { track, confidence, reasoning, provider, model, mocked }
// Track classifier (Featherless · Llama 3.3 70B sponsor integration).
import { NextRequest, NextResponse } from "next/server";
import { routeTrack } from "@/lib/router";
import type { Facts } from "@/lib/demo-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { facts: Facts };
    if (!body?.facts) {
      return NextResponse.json({ error: "missing facts" }, { status: 400 });
    }
    const decision = await routeTrack(body.facts);
    return NextResponse.json(decision);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
