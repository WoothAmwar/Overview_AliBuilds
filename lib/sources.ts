// Per-field provenance tracking for Facts. Lets the UI show "this came from your
// decree (green)" vs "you said this in interview (terracotta)" vs "we derived this
// (grey)" — directly addresses the "how do you avoid hallucinations?" judge question.
import type { Facts } from "./demo-case";

export type FactSource = "decree" | "voice" | "interview" | "derived";
export type FactSources = Partial<Record<keyof Facts, FactSource>>;

const KEYS: (keyof Facts)[] = [
  "jurisdiction",
  "county",
  "order_type",
  "case_status",
  "issue",
  "party_role",
  "last_payment_date",
  "estimated_arrears_months",
  "ex_employed",
  "case_number",
  "monthly_amount_owed_usd",
  "notes",
  "petitioner_name",
  "petitioner_address",
  "respondent_name",
  "respondent_address",
  "judgment_date",
];

// Mark every non-null/non-default field as coming from `source`.
// Used right after a decree upload, voice intake, or demo case load.
export function sourcesFromFacts(facts: Facts, source: FactSource): FactSources {
  const out: FactSources = {};
  for (const k of KEYS) {
    const v = facts[k];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length === 0) continue;
    if (v === "unknown") continue;
    out[k] = source;
  }
  return out;
}

// After an interview turn, any field that was empty/unknown before and is now
// filled gets tagged as "interview". Existing source tags are preserved.
export function mergeSourcesAfterInterview(
  prev: FactSources,
  prevFacts: Facts,
  nextFacts: Facts,
): FactSources {
  const out: FactSources = { ...prev };
  for (const k of KEYS) {
    const before = prevFacts[k];
    const after = nextFacts[k];
    const wasEmpty =
      before === null || before === undefined || before === "unknown" || before === "";
    const nowSet =
      after !== null && after !== undefined && after !== "unknown" && after !== "";
    if (wasEmpty && nowSet) {
      out[k] = "interview";
    } else if (!wasEmpty && nowSet && before !== after) {
      // User corrected something — also count as interview source.
      out[k] = "interview";
    }
  }
  return out;
}

export const SOURCE_LABELS: Record<FactSource, string> = {
  decree: "from your decree",
  voice: "from your voice note",
  interview: "you confirmed in interview",
  derived: "computed from other fields",
};

export const SOURCE_TONE: Record<FactSource, string> = {
  decree: "bg-sage/15 text-sage border-sage/40",
  voice: "bg-sage/15 text-sage border-sage/40",
  interview: "bg-terracotta/15 text-terracotta-dark border-terracotta/40",
  derived: "bg-rule/30 text-muted border-rule/50",
};

// Return the set of literal string values that came from "decree" (or "voice"),
// so the Petition body can highlight verbatim spans inline.
export function verifiableValues(facts: Facts, sources: FactSources): string[] {
  const out: string[] = [];
  for (const k of KEYS) {
    const src = sources[k];
    if (src !== "decree" && src !== "voice") continue;
    const v = facts[k];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length > 2) out.push(v);
    if (typeof v === "number") out.push(`$${v.toLocaleString()}`, `${v}`);
  }
  return out;
}
