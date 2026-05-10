import { anthropic, MODELS, extractJson } from "./clients";
import { JUDGE_SYSTEM } from "./prompts";
import type { Facts } from "./demo-case";

export type QnA = { question: string; tip: string };
export type JudgeResult = { qna: QnA[] };

const MOCK_JUDGE: JudgeResult = {
  qna: [
    {
      question:
        "Counsel — well, Petitioner — what specific steps did you take to obtain the financial documents from Respondent before bringing this petition?",
      tip: "Have a clear timeline ready: dates of written demand, certified mail receipt, and any verbal request. Produce the demand letter as an exhibit.",
    },
    {
      question:
        "How are you calculating the arrears? I want a number, the underlying math, and which payments specifically are missing.",
      tip: "Bring a one-page chart: month / amount due / amount received / shortfall, totaled at the bottom. Reference your bank statements.",
    },
    {
      question:
        "What relief are you seeking — payment of arrears, modification of the maintenance amount, or both? And on what statutory authority?",
      tip: "Be specific: '$26,100 in arrears under the existing order, plus an order to compel financial disclosure under Cook County Rule 13.3.1, with sanctions under Supreme Court Rule 219(c).'",
    },
  ],
};

export async function rehearseJudge(
  facts: Facts,
): Promise<{ result: JudgeResult; mocked: boolean }> {
  const client = anthropic();
  if (!client) {
    return { result: MOCK_JUDGE, mocked: true };
  }
  const msg = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2048,
    system: JUDGE_SYSTEM,
    messages: [
      { role: "user", content: `Case facts:\n${JSON.stringify(facts, null, 2)}` },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  return { result: extractJson<JudgeResult>(text), mocked: false };
}
