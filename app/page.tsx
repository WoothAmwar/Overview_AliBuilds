"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import type { Facts } from "@/lib/demo-case";
import type { Motion } from "@/lib/motion";
import type { OpposingResult } from "@/lib/opposing";
import type { JudgeResult } from "@/lib/judge";
import { buildRoadmap, type Roadmap } from "@/lib/roadmap";
import type { ChatMsg } from "@/lib/interview";
import type { TrackDecision } from "@/lib/router";

type Stage = "idle" | "recording" | "transcribing" | "ready" | "error";
type Tab = "interview" | "roadmap" | "packet" | "opposing" | "judge";
type IntakeMode = "voice" | "decree" | "demo";

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [facts, setFacts] = useState<Facts | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [opposing, setOpposing] = useState<OpposingResult | null>(null);
  const [judge, setJudge] = useState<JudgeResult | null>(null);
  const [tab, setTab] = useState<Tab>("interview");
  const [loadingTab, setLoadingTab] = useState<Tab | null>(null);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("demo");
  const [routeDecision, setRouteDecision] = useState<TrackDecision | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const decreeInputRef = useRef<HTMLInputElement | null>(null);

  async function startRecording() {
    setError(null);
    setIntakeMode("voice");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        sendAudio(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setStage("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "mic permission denied");
      setStage("error");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setStage("transcribing");
  }

  async function sendAudio(blob: Blob) {
    const fd = new FormData();
    fd.append("audio", new File([blob], "intake.webm", { type: blob.type }));
    try {
      const res = await fetch("/api/intake", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "intake failed");
      setTranscript(json.transcript);
      setFacts(json.facts);
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "intake failed");
      setStage("error");
    }
  }

  async function useDemoCase() {
    setIntakeMode("demo");
    setStage("transcribing");
    try {
      const res = await fetch("/api/intake");
      const json = await res.json();
      setTranscript(json.transcript);
      setFacts(json.facts);
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "intake failed");
      setStage("error");
    }
  }

  function pickDecreeFile() {
    setError(null);
    decreeInputRef.current?.click();
  }

  async function uploadDecree(file: File) {
    setIntakeMode("decree");
    setStage("transcribing");
    const fd = new FormData();
    fd.append("decree", file);
    try {
      const res = await fetch("/api/decree", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "decree upload failed");
      setTranscript(json.transcript);
      setFacts(json.facts);
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "decree upload failed");
      setStage("error");
    }
  }

  async function loadTab(t: Tab) {
    setTab(t);
    if (!facts) return;
    if (t === "roadmap") return; // derived client-side, no fetch
    if (t === "interview") return; // chat manages its own fetches
    if (t === "packet" && motion) return;
    if (t === "opposing" && opposing) return;
    if (t === "judge" && judge) return;
    setLoadingTab(t);
    try {
      const path = t === "packet" ? "/api/packet" : t === "opposing" ? "/api/opposing" : "/api/judge";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `${t} failed`);
      if (t === "packet") setMotion(json.motion);
      if (t === "opposing") setOpposing(json.result);
      if (t === "judge") setJudge(json.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${t} failed`);
    } finally {
      setLoadingTab(null);
    }
  }

  function reset() {
    setStage("idle");
    setError(null);
    setTranscript("");
    setFacts(null);
    setMotion(null);
    setOpposing(null);
    setJudge(null);
    setRouteDecision(null);
    setTab("interview");
  }

  // Called by the chat after each turn — updates facts and invalidates any
  // LLM-generated downstream artifacts so they regenerate against the new facts.
  function applyInterviewUpdate(nextFacts: Facts) {
    setFacts(nextFacts);
    setMotion(null);
    setOpposing(null);
    setJudge(null);
  }

  // Fire the Featherless track-routing call once facts are available.
  // Re-fires if order_type / issue / case_status change (the routing-relevant fields).
  useEffect(() => {
    if (!facts) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts }),
          signal: ctrl.signal,
        });
        const json = (await res.json()) as TrackDecision | { error: string };
        if (!ctrl.signal.aborted && "track" in json) setRouteDecision(json);
      } catch {
        /* silent — track badge just won't render */
      }
    })();
    return () => ctrl.abort();
  }, [facts?.order_type, facts?.issue, facts?.case_status]);

  return (
    <main className="flex flex-col flex-1 min-h-screen">
      <Header />

      <section className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
        <input
          ref={decreeInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadDecree(f);
            e.currentTarget.value = "";
          }}
        />

        {stage === "idle" && (
          <IdleHero onRecord={startRecording} onUpload={pickDecreeFile} onDemo={useDemoCase} />
        )}

        {stage === "recording" && <Recording onStop={stopRecording} />}

        {stage === "transcribing" && <Transcribing mode={intakeMode} />}

        {stage === "error" && <ErrorBox error={error} onRetry={reset} />}

        {stage === "ready" && facts && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            <IntakePanel transcript={transcript} facts={facts} onReset={reset} />
            <ResultPanel
              tab={tab}
              setTab={loadTab}
              loadingTab={loadingTab}
              facts={facts}
              onFactsUpdate={applyInterviewUpdate}
              routeDecision={routeDecision}
              motion={motion}
              opposing={opposing}
              judge={judge}
            />
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Header / Footer
// ─────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-rule/40 bg-paper/60 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-2xl font-bold tracking-tight">JusticeLink</h1>
          <span className="hidden sm:inline text-xs uppercase tracking-[0.2em] text-terracotta">
            Cook County · access to justice
          </span>
        </div>
        <span className="text-xs text-muted">ALI Builds · May 10, 2026</span>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule/40 bg-paper/60 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted flex flex-wrap gap-x-6 gap-y-2 justify-between">
        <span>JusticeLink — auto-fill, not auto-file. Not legal advice.</span>
        <span>
          Built with Anthropic Claude · Featherless AI · Groq Whisper
        </span>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stages
// ─────────────────────────────────────────────────────────────────────

function IdleHero({
  onRecord,
  onUpload,
  onDemo,
}: {
  onRecord: () => void;
  onUpload: () => void;
  onDemo: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-12">
      <div className="space-y-5">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold">
          Step 1 · Show us your court order
        </p>
        <h2 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
          When the system already has tools to help you, you shouldn't need a $400/hour lawyer to find them.
        </h2>
        <p className="text-lg text-muted max-w-prose">
          Snap a photo of your divorce judgment or support order — or describe the situation in your
          own voice. We'll extract the facts, draft the right Cook County court packet, and rehearse
          you for what opposing counsel and the judge will say.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={onUpload}
            className="rounded-full bg-terracotta hover:bg-terracotta-dark text-paper px-6 py-3 font-medium shadow"
          >
            📎 Upload decree (PDF or photo)
          </button>
          <button
            onClick={onRecord}
            className="rounded-full border border-terracotta/50 text-terracotta hover:bg-terracotta/10 px-6 py-3 font-medium"
          >
            ● Voice intake
          </button>
          <button
            onClick={onDemo}
            className="rounded-full border border-rule text-muted hover:bg-paper px-6 py-3 font-medium"
          >
            Use demo case (Maria)
          </button>
        </div>
        <p className="text-xs text-muted pt-1">
          Accepts PDF, PNG, JPG, WEBP, GIF (≤12 MB). Claude vision reads the document. Voice intake
          uses free Groq Whisper. No account, no upload of personal data beyond your session.
        </p>
      </div>

      <aside className="bg-paper border border-rule/50 rounded-lg p-6 space-y-3 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-sage font-bold">Under the hood</p>
        <ol className="space-y-3 text-sm">
          <Step n={1} title="Voice → text" model="OpenAI Whisper" />
          <Step n={2} title="Extract facts" model="Claude Haiku 4.5" />
          <Step n={3} title="Route track" model="Featherless · Llama 3.3 70B" sponsor />
          <Step n={4} title="Draft packet" model="Claude Sonnet 4.6" />
          <Step n={5} title="Roleplay opposing counsel" model="Claude Sonnet 4.6" />
          <Step n={6} title="Rehearse bench Q&A" model="Claude Sonnet 4.6" />
        </ol>
        <p className="text-xs text-muted pt-2 italic">
          Six LLM calls · three providers · ~$0.04 per case vs $400/hr human counsel.
        </p>
      </aside>
    </div>
  );
}

function Step({ n, title, model, sponsor }: { n: number; title: string; model: string; sponsor?: boolean }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-terracotta text-paper font-bold text-xs flex items-center justify-center font-serif">
        {n}
      </span>
      <div className="flex-1">
        <div className="font-semibold flex items-center gap-2">
          {title}
          {sponsor && (
            <span className="text-[9px] tracking-widest font-bold bg-sage text-paper px-1.5 py-0.5 rounded">
              SPONSOR
            </span>
          )}
        </div>
        <div className="text-xs text-muted">{model}</div>
      </div>
    </li>
  );
}

function Recording({ onStop }: { onStop: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-terracotta/30 animate-ping" />
        <span className="relative block w-24 h-24 rounded-full bg-terracotta" />
      </div>
      <p className="font-serif text-xl">Recording…</p>
      <p className="text-muted text-sm max-w-md text-center">
        Speak naturally. Include the county, what kind of order, when payments stopped, and what
        you've already tried.
      </p>
      <button
        onClick={onStop}
        className="rounded-full bg-foreground text-paper px-6 py-3 font-medium"
      >
        ■ Stop & process
      </button>
    </div>
  );
}

function Transcribing({ mode }: { mode: IntakeMode }) {
  const labels: Record<IntakeMode, { title: string; sub: string }> = {
    voice: { title: "Transcribing & extracting facts…", sub: "Groq Whisper → Claude Haiku" },
    decree: { title: "Reading your court order…", sub: "Claude Sonnet vision" },
    demo: { title: "Loading demo case…", sub: "Maria · Cook County" },
  };
  const { title, sub } = labels[mode];
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-terracotta border-t-transparent animate-spin" />
      <p className="font-serif text-xl">{title}</p>
      <p className="text-muted text-sm">{sub}</p>
    </div>
  );
}

function ErrorBox({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto bg-paper border border-terracotta/40 rounded-lg p-6 text-center mt-12">
      <p className="font-serif text-xl text-terracotta-dark mb-2">Something went wrong.</p>
      <p className="text-sm text-muted mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-terracotta text-paper px-5 py-2 text-sm"
      >
        Try again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Result panels
// ─────────────────────────────────────────────────────────────────────

function IntakePanel({
  transcript,
  facts,
  onReset,
}: {
  transcript: string;
  facts: Facts;
  onReset: () => void;
}) {
  return (
    <aside className="space-y-4">
      <div className="bg-paper border border-rule/50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-2">
          Transcript
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
      </div>

      <div className="bg-paper border border-rule/50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-2">
          Extracted facts
        </p>
        <dl className="text-sm space-y-1">
          <Row k="Jurisdiction" v={`${facts.county}, ${facts.jurisdiction}`} />
          <Row k="Order type" v={facts.order_type} />
          <Row k="Issue" v={facts.issue} />
          <Row k="Role" v={facts.party_role} />
          <Row k="Last payment" v={facts.last_payment_date ?? "—"} />
          <Row k="Arrears (months)" v={facts.estimated_arrears_months?.toString() ?? "—"} />
          <Row k="Monthly amount" v={facts.monthly_amount_owed_usd ? `$${facts.monthly_amount_owed_usd}` : "—"} />
          <Row k="Case #" v={facts.case_number ?? "—"} />
        </dl>
      </div>

      <button
        onClick={onReset}
        className="w-full rounded-full border border-rule text-muted hover:bg-paper px-4 py-2 text-sm"
      >
        ↺ Start over
      </button>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-rule/30 last:border-0 py-1">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  );
}

function ResultPanel({
  tab,
  setTab,
  loadingTab,
  facts,
  onFactsUpdate,
  routeDecision,
  motion,
  opposing,
  judge,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  loadingTab: Tab | null;
  facts: Facts;
  onFactsUpdate: (f: Facts) => void;
  routeDecision: TrackDecision | null;
  motion: Motion | null;
  opposing: OpposingResult | null;
  judge: JudgeResult | null;
}) {
  const roadmap = useMemo(() => buildRoadmap(facts), [facts]);
  return (
    <section className="bg-paper border border-rule/50 rounded-lg shadow-sm overflow-hidden">
      <nav className="flex border-b border-rule/30 bg-sand/40">
        <TabButton current={tab} value="interview" onClick={() => setTab("interview")}>
          Interview
        </TabButton>
        <TabButton current={tab} value="roadmap" onClick={() => setTab("roadmap")}>
          Action plan
        </TabButton>
        <TabButton current={tab} value="packet" onClick={() => setTab("packet")}>
          Court packet
        </TabButton>
        <TabButton current={tab} value="opposing" onClick={() => setTab("opposing")}>
          Opposing counsel
        </TabButton>
        <TabButton current={tab} value="judge" onClick={() => setTab("judge")}>
          Bench rehearsal
        </TabButton>
      </nav>

      <div className="p-6 min-h-[420px]">
        {tab === "interview" && (
          <ChatView
            facts={facts}
            onFactsUpdate={onFactsUpdate}
            completionPct={roadmap.status.completionPct}
            onJumpToPlan={() => setTab("roadmap")}
          />
        )}
        {tab === "roadmap" && (
          <RoadmapView
            roadmap={roadmap}
            routeDecision={routeDecision}
            onContinueInterview={() => setTab("interview")}
          />
        )}
        {loadingTab === tab && tab !== "roadmap" && tab !== "interview" && <PanelLoading label={tabLabel(tab)} />}
        {loadingTab !== tab && tab === "packet" && (motion ? <PacketView motion={motion} /> : <Empty kind="packet" />)}
        {loadingTab !== tab && tab === "opposing" &&
          (opposing ? <OpposingView opposing={opposing} /> : <Empty kind="opposing" />)}
        {loadingTab !== tab && tab === "judge" &&
          (judge ? <JudgeView judge={judge} /> : <Empty kind="judge" />)}
      </div>
    </section>
  );
}

function tabLabel(t: Tab) {
  if (t === "packet") return "Drafting court packet";
  if (t === "opposing") return "Roleplaying opposing counsel";
  if (t === "judge") return "Generating bench questions";
  if (t === "interview") return "Interviewing";
  return "Building action plan";
}

function TabButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Tab;
  value: Tab;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-terracotta text-terracotta-dark bg-paper"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ kind }: { kind: Tab }) {
  const map: Record<Tab, string> = {
    interview: "Conversational intake — fills the missing fields.",
    roadmap: "Personalized action plan ready.",
    packet: "Click to draft Petition for Rule to Show Cause + Rule 13.3.1 demand letter.",
    opposing: "Click to roleplay opposing counsel — 3 pushbacks + your counters.",
    judge: "Click to rehearse the 3 questions a Cook County judge will ask from the bench.",
  };
  return (
    <div className="flex flex-col items-center justify-center h-[380px] text-center gap-4 text-muted">
      <p className="text-sm max-w-md">{map[kind]}</p>
      <p className="text-xs">Tab content loads on first click.</p>
    </div>
  );
}

function RoadmapView({
  roadmap,
  routeDecision,
  onContinueInterview,
}: {
  roadmap: Roadmap;
  routeDecision: TrackDecision | null;
  onContinueInterview: () => void;
}) {
  const { status, nextSteps, evidence } = roadmap;
  const sections: { key: keyof typeof status; title: string; rows: typeof status.petition }[] = [
    { key: "petition", title: "Petition for Rule to Show Cause", rows: status.petition },
    { key: "notice", title: "Notice of Court Date", rows: status.notice },
    { key: "proof", title: "Proof of Delivery", rows: status.proof },
  ];

  return (
    <div className="space-y-8">
      {/* ── Track routing badge (Featherless sponsor integration) ───────── */}
      {routeDecision && <TrackBadge decision={routeDecision} />}

      {/* ── Section 1: Draft packet status ─────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold">
            Draft packet status
          </p>
          <span className="text-xs text-muted">
            {status.completionPct}% complete · {sections.reduce((a, s) => a + s.rows.filter((r) => r.complete).length, 0)} of{" "}
            {sections.reduce((a, s) => a + s.rows.length, 0)} fields filled
          </span>
        </div>
        <div className="w-full h-2 bg-sand rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-terracotta transition-all"
            style={{ width: `${status.completionPct}%` }}
          />
        </div>
        {status.completionPct < 100 && (
          <button
            onClick={onContinueInterview}
            className="w-full mb-4 rounded-lg bg-terracotta/10 hover:bg-terracotta/20 border border-terracotta/40 text-terracotta-dark px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between"
          >
            <span>💬 Continue interview to fill the missing fields</span>
            <span className="text-xs opacity-70">→</span>
          </button>
        )}

        <div className="space-y-3">
          {sections.map((sec) => (
            <details key={sec.key} className="bg-background border border-rule/40 rounded" open={sec.key === "petition"}>
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex justify-between items-center">
                <span>{sec.title}</span>
                <span className="text-xs text-muted">
                  {sec.rows.filter((r) => r.complete).length}/{sec.rows.length}
                </span>
              </summary>
              <div className="px-3 pb-3">
                <ul className="text-xs space-y-1.5">
                  {sec.rows.map((r, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <span className={r.complete ? "text-sage" : "text-terracotta-dark"}>
                        {r.complete ? "✓" : "◯"}
                      </span>
                      <div className="flex-1">
                        <span className="font-medium">{r.label}</span>
                        {r.value && <span className="text-muted"> · {r.value}</span>}
                        {r.note && <div className="text-muted italic text-[11px]">{r.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* ── Section 2: Personalized next steps ─────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-3">
          Your next steps · personalized roadmap
        </p>
        <ol className="space-y-3">
          {nextSteps.map((s) => (
            <li key={s.n} className="flex gap-3 items-start">
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full text-paper font-bold text-xs flex items-center justify-center font-serif ${
                  s.state === "ready"
                    ? "bg-terracotta"
                    : s.state === "after_filing"
                      ? "bg-sage"
                      : "bg-muted"
                }`}
              >
                {s.n}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.title}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    {s.state === "ready" ? "do now" : s.state === "after_filing" ? "after filing" : "after hearing"}
                  </span>
                </div>
                <p className="text-sm text-muted leading-relaxed">{s.body}</p>
                {s.detail && (
                  <p className="text-xs text-muted/80 italic mt-1 border-l-2 border-rule/40 pl-2">{s.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Section 3: Evidence checklist ──────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-3">
          Evidence checklist
        </p>
        <ul className="space-y-2">
          {evidence.map((e, i) => (
            <li
              key={i}
              className={`flex gap-2 items-start p-2 rounded border ${
                e.status === "have"
                  ? "border-sage/40 bg-sage/5"
                  : e.status === "needed"
                    ? "border-terracotta/30 bg-terracotta/5"
                    : "border-rule/30 bg-background"
              }`}
            >
              <span
                className={
                  e.status === "have"
                    ? "text-sage"
                    : e.status === "needed"
                      ? "text-terracotta-dark"
                      : "text-muted"
                }
              >
                {e.status === "have" ? "✓" : e.status === "needed" ? "◯" : "·"}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {e.label}
                  {!e.required && <span className="text-[10px] text-muted ml-2">optional</span>}
                </div>
                {e.note && <div className="text-xs text-muted">{e.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-terracotta-dark italic pt-2 border-t border-rule/30">
        ⚠ Auto-filled, not auto-filed. Review with a licensed attorney or legal aid before
        filing. CARPLS · Legal Aid Chicago · Cook County SRLC.
      </p>
    </div>
  );
}

function TrackBadge({ decision }: { decision: TrackDecision }) {
  const trackInfo: Record<TrackDecision["track"], { title: string; sub: string; tone: string }> = {
    A: {
      title: "Track A · Child support arrears",
      sub: "Routed to DHFS Title IV-D enforcement (free state remedies)",
      tone: "bg-sage/10 border-sage/40 text-sage",
    },
    B: {
      title: "Track B · Hidden income / maintenance",
      sub: "Routed to Motion to Compel + Cook County Rule 13.3.1 demand",
      tone: "bg-terracotta/10 border-terracotta/40 text-terracotta-dark",
    },
    BOTH: {
      title: "Tracks A + B · Child support arrears AND hidden income",
      sub: "Pursue DHFS IV-D enforcement AND a Motion to Compel in parallel",
      tone: "bg-foreground/10 border-foreground/40 text-foreground",
    },
  };
  const info = trackInfo[decision.track];
  const providerLabel =
    decision.provider === "featherless"
      ? "Featherless · Llama 3.3 70B"
      : "Rule-based fallback (no Featherless key)";
  return (
    <div className={`border rounded-lg p-4 ${info.tone}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <p className="font-bold text-sm">{info.title}</p>
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          Routed by {providerLabel}
          {!decision.mocked && ` · ${Math.round(decision.confidence * 100)}% confidence`}
        </span>
      </div>
      <p className="text-xs opacity-80 leading-relaxed">{info.sub}</p>
      <p className="text-xs italic opacity-70 mt-1.5 border-l-2 pl-2 border-current/30">
        {decision.reasoning}
      </p>
    </div>
  );
}

function ChatView({
  facts,
  onFactsUpdate,
  completionPct,
  onJumpToPlan,
}: {
  facts: Facts;
  onFactsUpdate: (f: Facts) => void;
  completionPct: number;
  onJumpToPlan: () => void;
}) {
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [openerLoading, setOpenerLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chatRecorderRef = useRef<MediaRecorder | null>(null);
  const chatChunksRef = useRef<BlobPart[]>([]);
  // Holds the latest send() so the recorder.onstop closure always has it.
  const sendRef = useRef<(msg: string) => Promise<void>>(async () => {});

  // Fire the opener question on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOpenerLoading(true);
      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts, history: [], message: "" }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "interview opener failed");
        setHistory([{ role: "assistant", content: json.reply }]);
        if (json.facts) onFactsUpdate(json.facts);
        setComplete(!!json.complete);
      } catch (e) {
        if (!cancelled) setChatError(e instanceof Error ? e.message : "opener failed");
      } finally {
        if (!cancelled) setOpenerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally only on mount — opener fires once per session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoscroll to bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, sending]);

  async function send(messageOverride?: string) {
    const msg = (messageOverride ?? input).trim();
    if (!msg || sending) return;
    setChatError(null);
    if (!messageOverride) setInput("");
    const newHistory: ChatMsg[] = [...history, { role: "user", content: msg }];
    setHistory(newHistory);
    setSending(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts, history: newHistory, message: msg }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "interview turn failed");
      setHistory((h) => [...h, { role: "assistant", content: json.reply }]);
      if (json.facts) onFactsUpdate(json.facts);
      setComplete(!!json.complete);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "turn failed");
    } finally {
      setSending(false);
    }
  }
  // Keep the ref in sync so MediaRecorder's onstop closure can call the latest send.
  sendRef.current = send;

  async function startVoice() {
    setChatError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chatChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chatChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chatChunksRef.current, { type: mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("audio", new File([blob], "chat.webm", { type: blob.type }));
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "transcribe failed");
          const text = (json.transcript as string)?.trim();
          if (text) await sendRef.current(text);
          else setChatError("Heard silence — try again.");
        } catch (e) {
          setChatError(e instanceof Error ? e.message : "transcribe failed");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      chatRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "mic permission denied");
    }
  }

  function stopVoice() {
    chatRecorderRef.current?.stop();
  }

  return (
    <div className="flex flex-col h-[520px]">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold">
          Conversational intake · fill the gaps
        </p>
        <span className="text-xs text-muted">{completionPct}% complete</span>
      </div>
      <div className="w-full h-1 bg-sand rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-terracotta transition-all"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-background border border-rule/40 rounded-lg p-4 space-y-3"
      >
        {openerLoading && history.length === 0 && (
          <div className="flex items-center gap-2 text-muted text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
            JusticeLink is reading your case…
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-terracotta text-paper"
                  : "bg-paper border border-rule/50 text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-paper border border-rule/50 rounded-lg px-3 py-2 text-sm text-muted flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
              thinking…
            </div>
          </div>
        )}
        {chatError && (
          <div className="text-xs text-terracotta-dark italic">⚠ {chatError}</div>
        )}
        {complete && (
          <div className="bg-sage/15 border border-sage/40 rounded-lg p-3 text-sm">
            <p className="font-medium text-sage mb-1">✓ Your packet is ready</p>
            <p className="text-muted text-xs mb-2">
              All required fields are filled. Review your Action Plan, then check the Court Packet,
              Opposing Counsel, and Bench Rehearsal tabs before filing.
            </p>
            <button
              onClick={onJumpToPlan}
              className="text-xs font-medium text-sage underline"
            >
              Review Action Plan →
            </button>
          </div>
        )}
      </div>

      {/* Input — voice-first, type as fallback */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2 items-center"
      >
        {/* Mic button — primary CTA */}
        <button
          type="button"
          onClick={recording ? stopVoice : startVoice}
          disabled={sending || openerLoading || transcribing}
          aria-label={recording ? "Stop recording and send" : "Record voice answer"}
          title={recording ? "Stop and send" : "Tap to speak your answer"}
          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg shadow transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            recording
              ? "bg-foreground text-paper animate-pulse"
              : "bg-terracotta hover:bg-terracotta-dark text-paper"
          }`}
        >
          {recording ? "■" : transcribing ? (
            <span className="w-4 h-4 rounded-full border-2 border-paper border-t-transparent animate-spin" />
          ) : "🎤"}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending || openerLoading || recording || transcribing}
          placeholder={
            recording
              ? "Recording… tap ■ to stop & send"
              : transcribing
                ? "Transcribing your answer…"
                : complete
                  ? "Anything else? (or just speak)"
                  : "Tap 🎤 to speak — or type here"
          }
          className="flex-1 rounded-full border border-rule/60 bg-paper px-4 py-2.5 text-sm focus:outline-none focus:border-terracotta disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || openerLoading || recording || transcribing || !input.trim()}
          className="rounded-full border border-terracotta/50 text-terracotta hover:bg-terracotta/10 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium"
        >
          Send
        </button>
      </form>
      <p className="text-[10px] text-muted/70 italic text-center mt-2">
        Voice-first · Groq Whisper transcribes free. Your answer auto-sends after recording.
        Switch to Action Plan anytime to see progress.
      </p>
    </div>
  );
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[380px] gap-4 text-muted">
      <div className="w-10 h-10 rounded-full border-4 border-terracotta border-t-transparent animate-spin" />
      <p className="font-serif text-lg">{label}…</p>
    </div>
  );
}

function PacketView({ motion }: { motion: Motion }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-2">
          Petition caption
        </p>
        <pre className="font-serif text-xs whitespace-pre-wrap bg-background border border-rule/50 rounded p-3">
          {motion.petition_caption}
        </pre>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-2">
          Petition body (excerpt)
        </p>
        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-background border border-rule/50 rounded p-3 max-h-72 overflow-auto">
          {motion.petition_body}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold mb-2">
          13.3.1 demand letter
        </p>
        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-background border border-rule/50 rounded p-3 max-h-48 overflow-auto">
          {motion.demand_letter}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sage font-bold mb-2">
            Documents to file
          </p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            {motion.filed_documents_checklist.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sage font-bold mb-2">
            Statutes cited
          </p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            {motion.statutes_cited.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-terracotta-dark italic pt-2 border-t border-rule/30">
        ⚠ Auto-filled, not auto-filed. Review with a licensed attorney or legal aid before
        filing. CARPLS · Legal Aid Chicago · Cook County SRLC.
      </p>
    </div>
  );
}

function OpposingView({ opposing }: { opposing: OpposingResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Opposing counsel will pick the three sharpest arguments your ex's lawyer can make. Practice
        each counter out loud before court.
      </p>
      {opposing.exchanges.map((ex, i) => (
        <article
          key={i}
          className="border border-rule/40 rounded-lg overflow-hidden"
        >
          <div className="bg-terracotta/10 p-4 border-b border-rule/40">
            <p className="text-xs uppercase tracking-[0.2em] text-terracotta-dark font-bold mb-1">
              Pushback {i + 1}
            </p>
            <p className="text-sm leading-relaxed">{ex.pushback}</p>
          </div>
          <div className="p-4 bg-paper">
            <p className="text-xs uppercase tracking-[0.2em] text-sage font-bold mb-1">
              Your one-sentence counter
            </p>
            <p className="text-sm leading-relaxed font-medium">{ex.counter}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function JudgeView({ judge }: { judge: JudgeResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Three questions a Cook County Domestic Relations judge is likely to ask. Be ready with
        specific facts, dates, and exhibits.
      </p>
      {judge.qna.map((q, i) => (
        <article key={i} className="border border-rule/40 rounded-lg p-4 bg-background space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-bold">
            Question {i + 1}
          </p>
          <p className="font-serif text-base leading-relaxed">"{q.question}"</p>
          <p className="text-sm text-muted">
            <span className="font-bold text-sage uppercase tracking-wider text-xs">Tip · </span>
            {q.tip}
          </p>
        </article>
      ))}
    </div>
  );
}
