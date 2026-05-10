// Speech-to-text wrapper. Prefers Groq (free Whisper-large-v3) → OpenAI → canned Maria transcript.
import { groq, openai, MODELS } from "./clients";
import { MARIA_TRANSCRIPT } from "./demo-case";

export async function transcribe(
  file: File,
): Promise<{ transcript: string; mocked: boolean; provider: "groq" | "openai" | "mock" }> {
  const groqClient = groq();
  if (groqClient) {
    const result = await groqClient.audio.transcriptions.create({
      file,
      model: MODELS.whisperGroq,
      language: "en",
    });
    return { transcript: result.text, mocked: false, provider: "groq" };
  }
  const openaiClient = openai();
  if (openaiClient) {
    const result = await openaiClient.audio.transcriptions.create({
      file,
      model: MODELS.whisperOpenAI,
      language: "en",
    });
    return { transcript: result.text, mocked: false, provider: "openai" };
  }
  return { transcript: MARIA_TRANSCRIPT, mocked: true, provider: "mock" };
}
