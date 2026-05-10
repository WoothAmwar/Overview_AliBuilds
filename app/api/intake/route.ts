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

// Allow GET → returns mocked path for quick UI testing without audio
export async function GET() {
  const stt = await transcribe(new File([], "empty.webm"));
  const ex = await extractFacts(stt.transcript);
  return NextResponse.json({
    transcript: stt.transcript,
    facts: ex.facts,
    mocked: { transcribe: stt.mocked, extract: ex.mocked },
  });
}
