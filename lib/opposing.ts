import { anthropic, MODELS, extractJson } from "./clients";
import { OPPOSING_SYSTEM } from "./prompts";
import type { Facts } from "./demo-case";

export type Exchange = { pushback: string; counter: string };
export type OpposingResult = { exchanges: Exchange[] };

const MOCK_OPPOSING: OpposingResult = {
  exchanges: [
    {
      pushback:
        "My client's income has not materially changed since the original maintenance order. The shift from W-2 to 1099 was a defensive change after a layoff, not a windfall — there is no basis for additional disclosure beyond what was filed at judgment.",
      counter:
        "Cook County Rule 13.3.1 requires both parties to exchange complete tax returns and pay records in any post-judgment proceeding involving support — irrespective of whether income changed.",
    },
    {
      pushback:
        "Petitioner has failed to follow Rule 201(k) and engage in a good-faith conference before filing this petition. The court should deny on procedural grounds and require the parties to confer first.",
      counter:
        "On record, I sent Respondent a written demand on [date] under Rule 13.3.1 with a 14-day response window; he did not respond. That is the good-faith effort. We are now properly before the court.",
    },
    {
      pushback:
        "There is no specific allegation of arrears with documentation attached. Petitioner is asking the court to draw an adverse inference from non-disclosure, which is not the standard for a Rule to Show Cause.",
      counter:
        "Petitioner's Financial Affidavit and bank records, attached as Exhibit A, document the missing payments. Respondent's refusal to produce his own records is itself sanctionable under Rule 219(c).",
    },
  ],
};

export async function roleplayOpposing(
  facts: Facts,
): Promise<{ result: OpposingResult; mocked: boolean }> {
  const client = anthropic();
  if (!client) {
    return { result: MOCK_OPPOSING, mocked: true };
  }
  const msg = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2048,
    system: OPPOSING_SYSTEM,
    messages: [
      { role: "user", content: `Case facts:\n${JSON.stringify(facts, null, 2)}` },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  return { result: extractJson<OpposingResult>(text), mocked: false };
}
