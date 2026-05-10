# Justice in a Flash

> **Draft enforcement petitions for child support and alimony — in minutes, in plain language, ready for an attorney to review.**

A conversational AI assistant that helps self-represented parents in **Cook County, Illinois** prepare a draft Petition for Rule to Show Cause packet from a photo or PDF of their court order plus a short guided interview. Built at the **ALI Builds Hackathon · Unfair Advantage for Greater Good · May 2026**.

> ⚠️ **Not legal advice.** Drafts are for review by a licensed attorney or legal-aid organization (CARPLS, Legal Aid Chicago, Cook County SRLC, Illinois Legal Aid Online) before filing.

---

## What it does

```
1. Upload    →  Photo or PDF of the divorce judgment / support order
2. Extract   →  Claude vision pulls the case facts (parties, $, dates, paragraphs)
3. Route     →  Featherless Llama classifies Track A vs Track B vs BOTH
4. Interview →  9 short questions (voice or text) fill in the gaps
5. Draft     →  Claude Sonnet writes the Petition for Rule to Show Cause
                + Cook County Local Rule 13.3.1 demand letter
6. Output    →  Three panels: Draft Packet Status · Evidence Checklist · Personalized Next Steps
                Two real PDF downloads · narrated 6-step roadmap
```

End-to-end in <2 minutes. **~$0.06 per case** vs $400/hour for a Cook County family-law attorney.

---

## Live demo

**Branch for submission:** [`redesign-justice-flash`](https://github.com/WoothAmwar/Overview_AliBuilds/tree/redesign-justice-flash)

```bash
git clone -b redesign-justice-flash https://github.com/WoothAmwar/Overview_AliBuilds.git
cd Overview_AliBuilds
npm install
cp .env.local.example .env.local      # paste any/all keys (see below)
npm run dev                            # http://localhost:3000
```

The app runs in **fully-mocked mode** if no API keys are set — every call falls back to canned demo data so judges can clone and explore cold.

---

## Stack

| Layer | Choice |
|---|---|
| **Frontend** | Next.js 16 (App Router · Turbopack) · React 19 · TypeScript strict · Tailwind v4 |
| **Voice input** | Web Speech API (browser-native, free, on-device) |
| **Voice output** | 8 pre-recorded calm-voice MP3 narrations in `public/audio/` |
| **AI · Vision + extraction** | Anthropic Claude Haiku 4.5 |
| **AI · Drafting + agents** | Anthropic Claude Sonnet 4.6 (drafter + opposing-counsel + judge + interview) |
| **AI · Sponsor — track routing** | **Featherless · Llama 3.3 70B Instruct** (OpenAI-compatible API) |
| **Speech-to-text (server)** | Groq Whisper-large-v3 (free tier) |
| **PDF generation** | pdf-lib (client-side, no server round-trip) |
| **Hosting** | Local / any Node host |

---

## API routes (8 typed routes, all in `app/api/`)

| Route | Method | Provider · Model | Job |
|---|---|---|---|
| `/api/decree` | POST multipart | Anthropic · Haiku 4.5 (vision) | Reads uploaded PDF/image of the court order; returns structured `Facts` JSON |
| `/api/intake` | POST multipart / GET | Anthropic Haiku + STT | Voice intake → transcript → fact extraction. GET returns canned Maria for the demo path |
| `/api/transcribe` | POST multipart | Groq · Whisper-large-v3 | Pure STT — used by the in-chat voice mic |
| `/api/route` | POST JSON | **Featherless · Llama 3.3 70B** | Classifies the case as Track A (DHFS Title IV-D) / Track B (Motion to Compel + Rule 13.3.1) / BOTH. Falls back to a deterministic rule when no key. |
| `/api/packet` | POST JSON | Anthropic · Sonnet 4.6 | Drafts the Petition for Rule to Show Cause + 13.3.1 demand letter + statutes cited + filed-doc checklist |
| `/api/opposing` | POST JSON | Anthropic · Sonnet 4.6 | Plays opposing counsel — 3 sharpest pushbacks + the user's one-sentence counter for each |
| `/api/judge` | POST JSON | Anthropic · Sonnet 4.6 | Plays a Cook County Domestic Relations judge — 3 likely bench questions + answer tip |
| `/api/interview` | POST JSON | Anthropic · Haiku 4.5 | Conversational follow-up to fill missing fields after vision extraction |

---

## File map

```
app/
  page.tsx                 ← Justice in a Flash UI (5-stage linear flow)
  layout.tsx               ← Fraunces serif + Inter sans
  globals.css              ← ink/sage/warn palette, Tailwind v4 @theme inline
  api/
    decree/route.ts        ← POST multipart → Claude vision extraction
    intake/route.ts        ← POST multipart audio | GET canned demo case
    transcribe/route.ts    ← POST multipart audio → Groq Whisper STT
    route/route.ts         ← POST { facts } → Featherless track classifier
    packet/route.ts        ← POST { facts } → Sonnet petition drafter
    opposing/route.ts      ← POST { facts } → Sonnet opposing-counsel agent
    judge/route.ts         ← POST { facts } → Sonnet judge agent
    interview/route.ts     ← POST { facts, history, message } → Haiku interview turn
lib/
  clients.ts               ← anthropic() / openai() / groq() / featherless() factories
  demo-case.ts             ← Facts type + canned Maria
  prompts.ts               ← System prompts (single source of truth)
  decree.ts                ← Vision extractor (Haiku 4.5, accepts PNG/JPG/WEBP/GIF/PDF)
  extract.ts               ← Voice-path fact extractor (Haiku)
  stt.ts                   ← Groq → OpenAI → mock STT chain
  router.ts                ← Featherless track classifier + rule-based fallback
  motion.ts                ← Sonnet petition drafter
  opposing.ts              ← Sonnet opposing-counsel agent
  judge.ts                 ← Sonnet judge agent
  interview.ts             ← Haiku interview agent
  roadmap.ts               ← Client-side 6-step roadmap derivation
  sources.ts               ← Per-field provenance tracking (hallucinations eliminated)
  pdf.ts                   ← pdf-lib Petition + Demand Letter PDF generation
public/
  audio/                   ← 8 calm-voice MP3 narrations (landing, intro, step1-6)
```

---

## Environment variables — all optional

| Var | Provider | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude (vision + draft + agents) | Returns canned Maria for every call |
| `GROQ_API_KEY` | Groq Whisper free tier | Falls back to OpenAI Whisper if `OPENAI_API_KEY` is set; else canned transcript |
| `FEATHERLESS_API_KEY` | Featherless · Llama 3.3 70B (track routing — sponsor) | Falls back to a deterministic rule with the same logic |
| `OPENAI_API_KEY` | OpenAI Whisper (optional STT fallback) | Skipped if Groq is available |

**App runs fully without any keys** — every API call has a typed mock fallback.

---

## Verifiability — "hallucinations eliminated"

Every field in the extracted `Facts` carries a source tag: `decree` (Claude vision saw it on your document), `voice` (you said it in voice intake), `interview` (you confirmed it in the chat), or `derived` (we computed it). The Court Packet view highlights spans pulled verbatim from the user's decree in green so you can audit every word back to its source. See `lib/sources.ts`.

---

## Cost economics

| Step | Model | Approx cost |
|---|---|---|
| Vision extraction | Haiku 4.5 | ~$0.003 |
| Track routing | **Featherless Llama 3.3 70B** | ~$0.001 |
| Interview turns (~3) | Haiku 4.5 | ~$0.003 |
| Petition draft | Sonnet 4.6 | ~$0.020 |
| Opposing counsel | Sonnet 4.6 | ~$0.015 |
| Judge agent | Sonnet 4.6 | ~$0.015 |
| **Total per case** | | **~$0.06** |

vs **$400/hour** for a Cook County family-law attorney. Multi-model routing keeps the bill down — classification goes to cheap Llama, reasoning goes to Sonnet.

---

## Legal sources cited in the drafted packet

- 750 ILCS 5/504 (maintenance formula)
- 750 ILCS 5/505 (child support)
- Cook County Local Rule 13.3.1 (mandatory financial disclosure)
- Illinois Supreme Court Rule 219(c) (discovery sanctions)
- IRS Form 4506-T (tax transcript request)
- Illinois HFS Title IV-D enforcement (free state remedies)
- Illinois Legal Aid Online · LawHelpInteractive.org

---

## Team

**Anwar Kader · Tim Markin · Yevgeny Frolov**
ALI Build Hackathon: Unfair Advantage for Greater Good · Chicago Booth Harper Center · May 2026

---

## Disclaimer

Justice in a Flash is **not a law firm and does not provide legal advice**. Every generated document is for review by a licensed attorney or legal-aid organization before filing. Filing, hearing scheduling, delivery, and exhibits are handled separately.
