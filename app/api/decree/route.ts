// POST /api/decree — multipart image of a decree/order  →  { facts, mocked }
import { NextRequest, NextResponse } from "next/server";
import { extractFromDecree } from "@/lib/decree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("decree");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing decree image" }, { status: 400 });
    }
    const mediaType = (file.type || "image/png") as AllowedType;
    if (!ALLOWED_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: `unsupported image type: ${mediaType}` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const result = await extractFromDecree(base64, mediaType);
    return NextResponse.json({
      transcript: `[Uploaded decree photo: ${file.name}]`,
      facts: result.facts,
      mocked: { decree: result.mocked },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
