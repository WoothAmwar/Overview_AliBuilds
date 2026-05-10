# JusticeLink

> When the system already has tools to help you, you shouldn't need a $400/hour lawyer to find them.

An agentic legal-aid sidekick for **Cook County, Illinois** child-support and maintenance enforcement. Built at **ALI Builds Hackathon · May 10, 2026**.

## What it does

A self-represented parent records a 60-second voice note describing their situation. JusticeLink:

1. Transcribes (OpenAI Whisper)
2. Extracts structured facts (Claude Haiku)
3. Routes to the right enforcement track — Child support → DHFS Title IV-D, OR maintenance → Petition for Rule to Show Cause + Cook County Local Rule 13.3.1 demand
4. Drafts a court-ready packet with the right citations (Claude Sonnet)
5. **Roleplays opposing counsel** — 3 pushbacks + your counters
6. **Rehearses bench Q&A** — 3 questions a Cook County Domestic Relations judge will likely ask, with answer tips

End-to-end in <60 seconds. ~$0.04 per case vs $400/hr human counsel.

## Run locally

```bash
npm install
cp .env.local.example .env.local
# edit .env.local — but the app also runs fully-mocked with NO keys
npm run dev
```

Open http://localhost:3000.

If keys are absent, the app uses canned outputs for the canonical demo case (Maria, post-judgment Cook County maintenance enforcement). Useful for UI work without burning tokens.

## Built with

- **Anthropic Claude** — Sonnet 4.6 for drafting + roleplay agents, Haiku 4.5 for fact extraction
- **OpenAI Whisper** — speech-to-text
- **Featherless AI** *(sponsor)* — Llama 3.3 70B for the classification / routing step
- **Flora** *(sponsor)* — brand assets
- **Next.js 16, TypeScript, Tailwind CSS, MediaRecorder API**

## File map

```
app/
  page.tsx                  ← single-page demo UI (voice → result panels)
  layout.tsx
  globals.css
  api/
    intake/route.ts         ← POST audio → { transcript, facts }
    packet/route.ts         ← POST { facts } → { motion }   (drafted petition + demand letter)
    opposing/route.ts       ← POST { facts } → { result }   (3 pushbacks + counters)
    judge/route.ts          ← POST { facts } → { result }   (3 bench Q&A)
lib/
  demo-case.ts              ← Maria — the canonical case all team members reference
  prompts.ts                ← All system prompts (edit here)
  clients.ts                ← Anthropic + OpenAI lazy clients + JSON parser
  stt.ts                    ← Whisper wrapper (mocks if no OPENAI_API_KEY)
  extract.ts                ← Haiku intake extractor
  motion.ts                 ← Sonnet drafter
  opposing.ts               ← Opposing counsel agent
  judge.ts                  ← Judge agent
```

## Legal sources cited

- 750 ILCS 5/504 (maintenance formula)
- 750 ILCS 5/505 (child support)
- Cook County Local Rule 13.3.1 (mandatory financial disclosure)
- Illinois Supreme Court Rule 219(c) (discovery sanctions)
- IRS Form 4506-T (tax transcript request)
- Illinois HFS Title IV-D enforcement (free state remedies)
- Illinois Legal Aid Online · LawHelpInteractive.org (the existing form-generation layer we sit above)

## Disclaimer

JusticeLink is **not a law firm and does not provide legal advice**. Every generated document is for review by a licensed attorney or legal-aid organization (CARPLS, Legal Aid Chicago, Cook County SRLC, Illinois Legal Aid Online) before filing.

## Team

Tim & team — ALI Builds Hackathon · Chicago Booth Harper Center · May 10, 2026
