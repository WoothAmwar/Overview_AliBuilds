// Speech-to-text wrapper. Falls back to canned Maria transcript when no OpenAI key.
import { openai, MODELS } from "./clients";
import { MARIA_TRANSCRIPT } from "./demo-case";

export async function transcribe(file: File): Promise<{ transcript: string; mocked: boolean }> {
  const client = openai();
  if (!client) {
    return { transcript: MARIA_TRANSCRIPT, mocked: true };
  }
  const result = await client.audio.transcriptions.create({
    file,
    model: MODELS.whisper,
    language: "en",
  });
  return { transcript: result.text, mocked: false };
}
