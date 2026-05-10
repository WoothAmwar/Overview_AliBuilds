// POST /api/interview — body: { facts, history, message } → { reply, facts, complete, mocked }
// Two-mode: opener (no message + empty history) returns the first greeting + question,
// otherwise it's a normal turn.
import { NextRequest, NextResponse } from "next/server";
import { interviewTurn, interviewOpener, type ChatMsg } from "@/lib/interview";
import type { Facts } from "@/lib/demo-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { facts: Facts; history?: ChatMsg[]; message?: string };
    if (!body?.facts) {
      return NextResponse.json({ error: "missing facts" }, { status: 400 });
    }
    const history = body.history ?? [];
    const message = (body.message ?? "").trim();

    const result =
      message.length === 0 && history.length === 0
        ? await interviewOpener(body.facts)
        : await interviewTurn(body.facts, history, message);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
