// Vision extractor: read a photo of a divorce judgment / support order →
// structured Facts ready for the same downstream agents (motion / opposing / judge).
import { anthropic, MODELS, extractJson } from "./clients";
import { MARIA, type Facts } from "./demo-case";

const DECREE_VISION_SYSTEM = `You read a photo of a divorce judgment, child-support order, maintenance order, or related Cook County / Illinois court document and extract structured legal-aid intake data for a self-represented person.

Return ONLY a JSON object matching this exact shape (no prose, no markdown fences):

{
  "jurisdiction": "Illinois" | "<other>",
  "county": "Cook County" | "<other county>" | "unknown",
  "order_type": "child_support" | "maintenance" | "both" | "unknown",
  "case_status": "post_judgment" | "pre_judgment" | "no_order_yet",
  "issue": "non_payment" | "income_change" | "no_disclosure" | "modification",
  "party_role": "payor" | "payee",
  "last_payment_date": "YYYY-MM-DD" | null,
  "estimated_arrears_months": <number> | null,
  "ex_employed": true | false | "unknown",
  "case_number": "<string>" | null,
  "monthly_amount_owed_usd": <number> | null,
  "notes": "<one-sentence summary of judgment date, parties, and what was ordered>"
}

Rules:
- If a field cannot be determined from the document alone, use null. The user will fill gaps in a follow-up interview.
- Default 'issue' to "non_payment" unless the document explicitly indicates something else.
- Default 'party_role' to "payee" unless the document makes the user's role obvious.
- For 'monthly_amount_owed_usd', extract the dollar amount the order requires (the periodic obligation), not arrears.
- The 'notes' field is the place to put judgment date, party names, and ordered amount + frequency in plain English.`;

export type DecreeMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

export async function extractFromDecree(
  base64: string,
  mediaType: DecreeMediaType,
): Promise<{ facts: Facts; mocked: boolean }> {
  const client = anthropic();
  if (!client) {
    return { facts: MARIA, mocked: true };
  }

  // Claude vision uses different content block types for PDFs vs images.
  const sourceBlock =
    mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
        }
      : {
          type: "image" as const,
          source: { type: "base64" as const, media_type: mediaType, data: base64 },
        };

  const msg = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 1024,
    system: DECREE_VISION_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          sourceBlock,
          { type: "text", text: "Extract the case facts from this document." },
        ],
      },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  return { facts: extractJson<Facts>(text), mocked: false };
}
