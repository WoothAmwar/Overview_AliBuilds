// POST /api/decree — multipart image OR pdf of a decree/order  →  { facts, mocked }
import { NextRequest, NextResponse } from "next/server";
import { extractFromDecree, type DecreeMediaType } from "@/lib/decree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES: readonly DecreeMediaType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB — Claude PDF limit comfort

// Map common file extensions to MIME types — browsers sometimes send empty `type`
// (especially for .pdf via drag-drop).
function inferMediaType(file: File): DecreeMediaType | null {
  if (file.type && (ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return file.type as DecreeMediaType;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "pdf": return "application/pdf";
    default: return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("decree");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing decree file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `file too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — max 12 MB` },
        { status: 413 },
      );
    }
    const mediaType = inferMediaType(file);
    if (!mediaType) {
      return NextResponse.json(
        { error: `unsupported file type: ${file.type || file.name} — accepts PNG, JPG, WEBP, GIF, PDF` },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const result = await extractFromDecree(base64, mediaType);
    const kind = mediaType === "application/pdf" ? "PDF" : "photo";
    return NextResponse.json({
      transcript: `[Uploaded decree ${kind}: ${file.name}]`,
      facts: result.facts,
      mocked: { decree: result.mocked },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
