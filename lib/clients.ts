// Lazy SDK clients. Returns null if API key not set so we can mock cleanly.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;
let _groq: OpenAI | null = null;

export function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export function openai(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// Groq exposes an OpenAI-compatible endpoint, so we reuse the OpenAI SDK with a different baseURL.
// Free tier hosts Whisper-large-v3 at sub-second latency.
export function groq(): OpenAI | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!_groq) {
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _groq;
}

let _featherless: OpenAI | null = null;
// Featherless AI (sponsor) — serverless inference for open-source models, OpenAI-compatible API.
// Used for the cheap classification step (Track A vs Track B routing).
export function featherless(): OpenAI | null {
  if (!process.env.FEATHERLESS_API_KEY) return null;
  if (!_featherless) {
    _featherless = new OpenAI({
      apiKey: process.env.FEATHERLESS_API_KEY,
      baseURL: "https://api.featherless.ai/v1",
    });
  }
  return _featherless;
}

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  whisperOpenAI: "whisper-1",
  whisperGroq: "whisper-large-v3",
  llamaFeatherless: "meta-llama/Meta-Llama-3.1-70B-Instruct",
} as const;

export function extractJson<T = unknown>(text: string): T {
  // Strip ```json fences if present, find first {…} block.
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model output: " + text.slice(0, 200));
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
