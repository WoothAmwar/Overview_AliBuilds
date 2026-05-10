// Conversational interview agent. Reads current Facts, asks the user one focused
// question about the most-critical missing field, extracts their answer, and
// returns updated Facts + reply. Loops until enough is filled in to draft.
import { anthropic, MODELS, extractJson } from "./clients";
import type { Facts } from "./demo-case";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type InterviewTurn = {
  reply: string;
  facts: Facts;
  complete: boolean;
  mocked: boolean;
  suggestions?: string[];
};

const INTERVIEW_SYSTEM = `You are a warm, focused legal-aid intake assistant helping a self-represented person in Cook County, Illinois fill in the missing facts of their Petition for Rule to Show Cause case.

You will receive:
- The user's CURRENT FACTS (a JSON object).
- The chat history.
- The user's latest message.

Your job each turn:
1. From the user's latest message, extract any new information and merge it into the facts object. Only update fields the user actually addressed — don't invent.
2. Look at the missing fields in this priority order:
   a. petitioner_name + petitioner_address  (the user's own info — ask together)
   b. respondent_name + respondent_address  (the ex's info — ask together)
   c. judgment_date  (date the original support/maintenance order was entered)
   d. last_payment_date + estimated_arrears_months  (last payment + arrears — ask together)
3. Bundle the next 2–3 RELATED missing fields into ONE conversational message. Group fields that share context (e.g., name + address together; last payment + arrears together). Don't ask all 7 at once — pick the next logical cluster.
4. Acknowledge what the user just told you in one short sentence FIRST if it was useful, then ask the bundled question. Total under 50 words.
5. When ALL fields above are filled OR the user clearly says they don't have something, set "complete": true and give a brief closing message saying they're ready to file.

ALWAYS return strict JSON only — no markdown fences, no preamble:

{
  "reply": "<your conversational message back to the user>",
  "facts": { <complete updated Facts object — every original field, with merged updates> },
  "complete": <true|false>,
  "suggestions": <optional string[] — see rule below>
}

OPTIONAL "suggestions" rule:
- ONLY include "suggestions" when your question genuinely has a small, well-bounded set of likely answers (date-shortcuts, yes/no, common amounts).
- Examples of GOOD suggestions: ["About 12 months", "About 18 months", "More than 24 months", "I'm not sure"] for arrears; ["Last week", "Last month", "More than 6 months ago", "Never"] for last payment.
- Examples of when to OMIT suggestions: open-ended fields like full name, address, email, case number — let the user type/speak freely.
- Keep suggestions to 3–4 chips, each under 25 chars.
- Omit the field entirely (don't pass an empty array) when not applicable.

Rules:
- Use the EXACT same key names as the input facts. Don't drop fields you don't update — pass them through.
- Dates as YYYY-MM-DD. If user says "March 2025" with no day, use "2025-03-15" and mention you assumed mid-month.
- Never make up a name or address. If the user is vague, ask a clarifying question.
- When asking 2–3 questions together, separate them clearly with line breaks or numbered list, but keep tone conversational.
- Example good reply (asking 2 grouped questions): "Thanks. To finish your packet I need two more details:\\n\\n1. When was the last full payment you received (date)?\\n2. About how many months of arrears total?"
- Off-topic? Gently steer back: "Let me make sure your packet's complete — I still need {fields}…"`;

export async function interviewTurn(
  facts: Facts,
  history: ChatMsg[],
  userMessage: string,
): Promise<InterviewTurn> {
  const client = anthropic();
  if (!client) {
    return {
      reply:
        "(mocked — no Anthropic key) I'd normally ask: what's your full legal name as it should appear on the Petition?",
      facts,
      complete: false,
      mocked: true,
    };
  }

  // Build the conversation: system + prior turns + current user turn with facts payload.
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: `CURRENT FACTS:\n${JSON.stringify(facts, null, 2)}\n\nUSER MESSAGE:\n${userMessage}`,
    },
  ];

  const msg = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 1024,
    system: INTERVIEW_SYSTEM,
    messages,
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const parsed = extractJson<{ reply: string; facts: Facts; complete: boolean; suggestions?: string[] }>(text);
  return {
    reply: parsed.reply,
    facts: parsed.facts,
    complete: parsed.complete,
    mocked: false,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : undefined,
  };
}

// Generate the opening question with no user message yet — used to greet the user
// the first time they open the Interview tab.
export async function interviewOpener(facts: Facts): Promise<InterviewTurn> {
  const client = anthropic();
  if (!client) {
    return {
      reply:
        "Hi — I'll help you fill in the missing details so your court packet is ready to file. Let's start: what's your full legal name as it should appear on the Petition?",
      facts,
      complete: false,
      mocked: true,
    };
  }
  const msg = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 512,
    system: INTERVIEW_SYSTEM,
    messages: [
      {
        role: "user",
        content: `CURRENT FACTS:\n${JSON.stringify(facts, null, 2)}\n\nUSER MESSAGE:\n[The user just opened the interview tab — there is no message yet. Greet them in one sentence and ask the first priority bundled question.]`,
      },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  const parsed = extractJson<{ reply: string; facts: Facts; complete: boolean; suggestions?: string[] }>(text);
  return {
    reply: parsed.reply,
    facts: parsed.facts,
    complete: parsed.complete,
    mocked: false,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : undefined,
  };
}
