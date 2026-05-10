// POST /api/intake — multipart audio  →  { transcript, facts, mocked }
import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/stt";
import { extractFacts } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing audio file" }, { status: 400 });
    }

    const stt = await transcribe(file);
    const ex = await extractFacts(stt.transcript);

    return NextResponse.json({
      transcript: stt.transcript,
      facts: ex.facts,
      mocked: { transcribe: stt.mocked, extract: ex.mocked },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET = "Use demo case (Maria)" — return the canonical Maria case directly.
// Bypasses STT entirely (passing an empty audio file to Groq throws).
export async function GET() {
  try {
    const { MARIA, MARIA_TRANSCRIPT } = await import("@/lib/demo-case");
    return NextResponse.json({
      transcript: MARIA_TRANSCRIPT,
      facts: MARIA,
      mocked: { transcribe: true, extract: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
