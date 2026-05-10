// Browser-side PDF generation. Takes a drafted Motion + Facts and renders
// court-ready downloadable PDFs (Petition for Rule to Show Cause + 13.3.1
// Demand Letter). Uses pdf-lib (no server round-trip needed).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Motion } from "./motion";
import type { Facts } from "./demo-case";

const PAGE_W = 612; // US Letter width in pt
const PAGE_H = 792;
const MARGIN_X = 72; // 1in
const MARGIN_TOP = 72;
const MARGIN_BOT = 72;
const LINE_HEIGHT = 14;
const SIZE_BODY = 11;
const SIZE_HEAD = 13;

// Wrap text into lines that fit within a max width using the given font.
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  // Preserve paragraph breaks
  for (const paragraph of text.split(/\n/)) {
    if (paragraph.trim().length === 0) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxW) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

type PageCtx = { page: PDFPage; y: number };

function newPage(doc: PDFDocument): PageCtx {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  return { page, y: PAGE_H - MARGIN_TOP };
}

// Draw text starting from ctx.y, advancing y down. Add a new page when y < bottom margin.
function drawBlock(
  ctx: PageCtx,
  doc: PDFDocument,
  text: string,
  font: PDFFont,
  size: number,
  extraSpacingAfter = 0,
): PageCtx {
  const lines = wrapText(text, font, size, PAGE_W - 2 * MARGIN_X);
  let { page, y } = ctx;
  const lineH = size + 3;
  for (const line of lines) {
    if (y < MARGIN_BOT + lineH) {
      const next = newPage(doc);
      page = next.page;
      y = next.y;
    }
    page.drawText(line, { x: MARGIN_X, y, size, font, color: rgb(0, 0, 0) });
    y -= lineH;
  }
  y -= extraSpacingAfter;
  return { page, y };
}

function drawCenteredHeading(ctx: PageCtx, doc: PDFDocument, text: string, font: PDFFont): PageCtx {
  let { page, y } = ctx;
  const size = SIZE_HEAD + 1;
  if (y < MARGIN_BOT + size + 12) {
    const next = newPage(doc);
    page = next.page;
    y = next.y;
  }
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color: rgb(0, 0, 0) });
  y -= size + 12;
  return { page, y };
}

function drawWatermark(ctx: PageCtx, font: PDFFont): void {
  ctx.page.drawText("DRAFT — REVIEW WITH ATTORNEY OR LEGAL AID BEFORE FILING", {
    x: MARGIN_X,
    y: PAGE_H - 36,
    size: 8,
    font,
    color: rgb(0.7, 0.25, 0.15),
  });
}

export async function generatePetitionPdf(motion: Motion, facts: Facts): Promise<Blob> {
  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontItal = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let ctx = newPage(doc);
  drawWatermark(ctx, fontItal);
  ctx.y = PAGE_H - MARGIN_TOP - 6;

  // Caption block — preserve as-is, monospace-feel via Times bold
  ctx = drawBlock(ctx, doc, motion.petition_caption, fontBold, SIZE_BODY, 18);
  // Heading
  ctx = drawCenteredHeading(ctx, doc, "PETITION FOR RULE TO SHOW CAUSE", fontBold);
  // Body
  ctx = drawBlock(ctx, doc, motion.petition_body, fontReg, SIZE_BODY, 18);

  // Statutes cited
  if (motion.statutes_cited?.length) {
    ctx = drawBlock(ctx, doc, "Statutes & Rules Cited:", fontBold, SIZE_BODY, 4);
    ctx = drawBlock(
      ctx,
      doc,
      motion.statutes_cited.map((s) => `  •  ${s}`).join("\n"),
      fontReg,
      SIZE_BODY,
      18,
    );
  }

  // Filed documents checklist
  if (motion.filed_documents_checklist?.length) {
    ctx = drawBlock(ctx, doc, "Documents to File:", fontBold, SIZE_BODY, 4);
    ctx = drawBlock(
      ctx,
      doc,
      motion.filed_documents_checklist.map((d) => `  ☐  ${d}`).join("\n"),
      fontReg,
      SIZE_BODY,
      24,
    );
  }

  // Footer disclaimer
  ctx = drawBlock(
    ctx,
    doc,
    "⚠  Auto-filled, not auto-filed. Review with a licensed attorney or legal-aid organization (CARPLS · Legal Aid Chicago · Cook County SRLC) before filing. JusticeLink does not provide legal advice.",
    fontItal,
    9,
  );

  // Per-page case footer
  for (const page of doc.getPages()) {
    const caseStr = `${facts.county} · Case No. ${facts.case_number ?? "_______"}`;
    page.drawText(caseStr, { x: MARGIN_X, y: 36, size: 9, font: fontItal, color: rgb(0.4, 0.4, 0.4) });
    const pageNum = `Petition · p. ${doc.getPages().indexOf(page) + 1} of ${doc.getPages().length}`;
    const w = fontItal.widthOfTextAtSize(pageNum, 9);
    page.drawText(pageNum, { x: PAGE_W - MARGIN_X - w, y: 36, size: 9, font: fontItal, color: rgb(0.4, 0.4, 0.4) });
  }

  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export async function generateDemandLetterPdf(motion: Motion, facts: Facts): Promise<Blob> {
  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontItal = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let ctx = newPage(doc);
  drawWatermark(ctx, fontItal);
  ctx.y = PAGE_H - MARGIN_TOP - 6;

  const today = new Date().toISOString().slice(0, 10);
  ctx = drawBlock(ctx, doc, today, fontReg, SIZE_BODY, 18);
  ctx = drawCenteredHeading(
    ctx,
    doc,
    "RE: DEMAND FOR DISCLOSURE — Cook County Local Rule 13.3.1",
    fontBold,
  );
  ctx = drawBlock(
    ctx,
    doc,
    `In re Marriage of ${facts.petitioner_name ?? "[PETITIONER]"} and ${facts.respondent_name ?? "[RESPONDENT]"}\nCase No. ${facts.case_number ?? "_______"}\n${facts.county ?? "Cook County"}, ${facts.jurisdiction ?? "Illinois"}`,
    fontReg,
    SIZE_BODY,
    18,
  );
  ctx = drawBlock(ctx, doc, motion.demand_letter, fontReg, SIZE_BODY, 18);

  ctx = drawBlock(
    ctx,
    doc,
    "⚠  Auto-filled, not auto-filed. Review with a licensed attorney or legal-aid organization before sending. JusticeLink does not provide legal advice.",
    fontItal,
    9,
  );

  // Footer
  for (const page of doc.getPages()) {
    const caseStr = `${facts.county} · Case No. ${facts.case_number ?? "_______"}`;
    page.drawText(caseStr, { x: MARGIN_X, y: 36, size: 9, font: fontItal, color: rgb(0.4, 0.4, 0.4) });
    const pageNum = `Demand Letter · p. ${doc.getPages().indexOf(page) + 1}`;
    const w = fontItal.widthOfTextAtSize(pageNum, 9);
    page.drawText(pageNum, { x: PAGE_W - MARGIN_X - w, y: 36, size: 9, font: fontItal, color: rgb(0.4, 0.4, 0.4) });
  }

  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

// Helper that triggers a download in the browser.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
