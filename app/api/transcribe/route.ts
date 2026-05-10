// POST /api/transcribe — multipart audio  →  { transcript, mocked, provider }
// Thin wrapper around lib/stt.transcribe — used by the in-chat voice input.
import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/stt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing audio file" }, { status: 400 });
    }
    const result = await transcribe(file);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
