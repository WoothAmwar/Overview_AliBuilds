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
};

const INTERVIEW_SYSTEM = `You are a warm, focused legal-aid intake assistant helping a self-represented person in Cook County, Illinois fill in the missing facts of their Petition for Rule to Show Cause case.

You will receive:
- The user's CURRENT FACTS (a JSON object).
- The chat history.
- The user's latest message.

Your job each turn:
1. From the user's latest message, extract any new information and merge it into the facts object. Only update fields the user actually addressed — don't invent.
2. Identify the SINGLE most-critical still-missing field, in this priority order:
   a. petitioner_name (the user's own full legal name)
   b. petitioner_address (their full mailing address)
   c. respondent_name (the ex's full legal name)
   d. respondent_address (the ex's last-known mailing address — required for service of process)
   e. judgment_date (date the original support/maintenance order was entered)
   f. last_payment_date (date of the last full payment received)
   g. estimated_arrears_months (how many months of payments have been missed or short)
3. Ask ONE short, conversational, plain-English question about that field. Keep it under 25 words. Don't lecture. Don't list multiple questions. Acknowledge what they just told you in 1 short sentence first if it was useful.
4. When ALL of (a)–(g) are non-null OR the user clearly says they don't have something, set "complete": true and give a closing message that says they're ready to file.

ALWAYS return strict JSON only — no markdown fences, no preamble:

{
  "reply": "<your conversational message back to the user>",
  "facts": { <complete updated Facts object — every original field, with merged updates> },
  "complete": <true|false>
}

Rules:
- Use the EXACT same key names as the input facts. Don't drop fields you don't update — pass them through.
- Dates as YYYY-MM-DD when you have them. If user says "March 2025" with no day, use "2025-03-15" and mention you assumed mid-month.
- Never make up a name or address. If the user is vague, ask a clarifying question.
- If the user says something off-topic, gently steer back: "I want to make sure your packet's complete — I still need {field}…"`;

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

  const parsed = extractJson<{ reply: string; facts: Facts; complete: boolean }>(text);
  return { reply: parsed.reply, facts: parsed.facts, complete: parsed.complete, mocked: false };
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
        content: `CURRENT FACTS:\n${JSON.stringify(facts, null, 2)}\n\nUSER MESSAGE:\n[The user just opened the interview tab — there is no message yet. Greet them in one sentence and ask the first priority question.]`,
      },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  const parsed = extractJson<{ reply: string; facts: Facts; complete: boolean }>(text);
  return { reply: parsed.reply, facts: parsed.facts, complete: parsed.complete, mocked: false };
}
