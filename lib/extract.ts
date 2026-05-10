import { anthropic, MODELS, extractJson } from "./clients";
import { EXTRACT_SYSTEM } from "./prompts";
import { MARIA, type Facts } from "./demo-case";

export async function extractFacts(transcript: string): Promise<{ facts: Facts; mocked: boolean }> {
  const client = anthropic();
  if (!client) {
    return { facts: MARIA, mocked: true };
  }
  const msg = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 1024,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: `Transcript:\n"""\n${transcript}\n"""` }],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  return { facts: extractJson<Facts>(text), mocked: false };
}
