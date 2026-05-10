// Lazy SDK clients. Returns null if API key not set so we can mock cleanly.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

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

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  whisper: "whisper-1",
} as const;

export function extractJson<T = unknown>(text: string): T {
  // Strip ```json fences if present, find first {…} block.
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model output: " + text.slice(0, 200));
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
