// Track classifier — routes a case to Track A (DHFS Title IV-D enforcement for
// child-support arrears) or Track B (Motion to Compel + Rule 13.3.1 for
// maintenance / hidden-income disputes).
//
// Runs on Featherless AI (sponsor) using Llama 3.3 70B Instruct.
// Falls back to a deterministic rule-based decision if no Featherless key.
import { featherless, MODELS } from "./clients";
import type { Facts } from "./demo-case";

export type TrackKey = "A" | "B" | "BOTH";

export type TrackDecision = {
  track: TrackKey;
  confidence: number; // 0..1
  reasoning: string;
  provider: "featherless" | "rule-based";
  model: string;
  mocked: boolean;
};

const ROUTER_SYSTEM = `You are a triage classifier for a Cook County, Illinois legal-aid intake tool.

Given a JSON object of case facts, decide which enforcement track this case belongs in:

TRACK A — Child-support arrears
  Route here when: order_type contains child_support AND issue is non_payment.
  These cases get free state enforcement via DHFS Title IV-D (tax-refund intercept,
  income withholding, license/passport suspension, credit reporting, bank liens).

TRACK B — Hidden income / maintenance
  Route here when: order_type is maintenance, OR issue is no_disclosure,
  OR issue is income_change.
  These cases need a Motion to Compel + Cook County Rule 13.3.1 demand +
  Rule 219 sanctions — driven by user, not the state.

BOTH — When the case has child support arrears AND a hidden-income dimension.

Return ONLY a JSON object — no prose, no markdown fences:

{
  "track": "A" | "B" | "BOTH",
  "confidence": <number 0..1>,
  "reasoning": "<one sentence: why this track based on the facts>"
}`;

// Deterministic fallback when there's no Featherless key. Same logic the
// classifier should arrive at — keeps the demo functional in mock mode.
function ruleBasedRoute(facts: Facts): TrackDecision {
  const isChildSupport = facts.order_type === "child_support" || facts.order_type === "both";
  const isMaintenance = facts.order_type === "maintenance" || facts.order_type === "both";
  const hiddenIncome = facts.issue === "no_disclosure" || facts.issue === "income_change";

  let track: TrackKey;
  let reasoning: string;
  if (isChildSupport && (isMaintenance || hiddenIncome)) {
    track = "BOTH";
    reasoning =
      "Case has child support arrears AND a maintenance / hidden-income dimension — pursue both DHFS IV-D enforcement and a Motion to Compel.";
  } else if (isChildSupport && facts.issue === "non_payment") {
    track = "A";
    reasoning =
      "Order is child support and the issue is non-payment — DHFS Title IV-D has free enforcement tools (tax intercept, license suspension, IWO).";
  } else {
    track = "B";
    reasoning =
      "Case turns on maintenance or hidden income — needs a self-driven Motion to Compel + Cook County Rule 13.3.1 demand.";
  }

  return {
    track,
    confidence: 0.85,
    reasoning,
    provider: "rule-based",
    model: "deterministic-fallback",
    mocked: true,
  };
}

export async function routeTrack(facts: Facts): Promise<TrackDecision> {
  const client = featherless();
  if (!client) return ruleBasedRoute(facts);

  try {
    const completion = await client.chat.completions.create({
      model: MODELS.llamaFeatherless,
      max_tokens: 300,
      temperature: 0,
      messages: [
        { role: "system", content: ROUTER_SYSTEM },
        { role: "user", content: `Case facts:\n${JSON.stringify(facts, null, 2)}` },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip ```json fences if Llama wraps them, then parse the {…} block.
    const cleaned = text.replace(/```(?:json)?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error(`No JSON in router output: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      track: TrackKey;
      confidence: number;
      reasoning: string;
    };

    return {
      track: parsed.track,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      provider: "featherless",
      model: MODELS.llamaFeatherless,
      mocked: false,
    };
  } catch (err) {
    // If Featherless errors out (rate limit, bad key, etc.), fall back to the
    // deterministic rule rather than blocking the user.
    const fallback = ruleBasedRoute(facts);
    fallback.reasoning = `[Featherless unavailable: ${err instanceof Error ? err.message : "error"}] ${fallback.reasoning}`;
    return fallback;
  }
}
