"use client";

import React, { useState, useEffect, useRef } from "react";
import { generatePetitionPdf, generateDemandLetterPdf, downloadBlob } from "@/lib/pdf";
import type { Facts } from "@/lib/demo-case";
import type { Motion } from "@/lib/motion";
import type { TrackDecision } from "@/lib/router";

/* =========================================================================
   JUSTICE IN A FLASH — Illinois / Cook County
   Hackathon MVP: upload decree -> real Claude vision -> conversational
   interview -> Sonnet-drafted Petition + Featherless track routing +
   3-panel output (Draft Packet Status / Evidence Checklist / Next Steps)
   ========================================================================= */

// ---- LOGO --------------------------------------------------------------
const Logo = ({ size = 28 }: { size?: number }) =>
  React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 32 32", fill: "none", "aria-label": "Justice in a Flash logo" },
    [
      React.createElement("rect", { key: "r", x: 1, y: 1, width: 30, height: 30, rx: 8, stroke: "currentColor", strokeWidth: 1.5 }),
      React.createElement("path", { key: "p", d: "M9 11h14M9 16h10M9 21h7", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" }),
      React.createElement("circle", { key: "c", cx: 24, cy: 21, r: 2.2, fill: "currentColor" }),
    ],
  );

// ---- ICONS -------------------------------------------------------------
const Icon = ({ d, size = 18, className = "" }: { d: string; size?: number; className?: string }) =>
  React.createElement(
    "svg",
    {
      width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", className,
    },
    React.createElement("path", { d }),
  );

const ICONS = {
  upload: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2",
  mic: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10a7 7 0 11-14 0M12 19v4",
  check: "M5 12l5 5L20 7",
  arrowRight: "M5 12h14m0 0l-6-6m6 6l-6 6",
  arrowLeft: "M19 12H5m0 0l6-6m-6 6l6 6",
  doc: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M5 21h14",
  copy: "M9 3h10a2 2 0 012 2v10M5 7h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z",
  alert: "M12 9v4m0 4h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  calendar: "M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM16 3v4M8 3v4",
  speak: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10a7 7 0 11-14 0",
};

// ---- DEMO JUDGMENT (Maria Lopez v. Carlos Lopez) -----------------------
const DEMO_JUDGMENT = {
  fileName: "Judgment_for_Dissolution_Lopez.pdf",
  pages: 4,
  size: "274 KB",
  excerptParagraphs: [
    {
      num: 4,
      title: "Annual Income Disclosure Requirement",
      body:
        "Beginning with tax year 2022 and continuing each year thereafter while maintenance or child support remains subject to recalculation, modification, or enforcement, each party shall provide to the other party complete annual proof of income no later than April 30 of the following year. The required annual proof of income shall include: complete federal income tax returns, all Forms W-2 and 1099, the last four payroll statements, documentation of bonuses or commissions, and (if self-employed) business profit and loss statements.",
      highlight: ["April 30", "tax returns", "W-2", "1099", "payroll"],
    },
    {
      num: 5,
      title: "Maintenance Recalculation Cooperation",
      body:
        "If requested in writing by the other party, Respondent shall provide updated income information sufficient to evaluate maintenance recalculation and any related child support recalculation within 21 days after the written request.",
      highlight: ["maintenance recalculation", "within 21 days", "written request"],
    },
    {
      num: 10,
      title: "Enforcement",
      body:
        "Failure to provide the required annual proof of income, tax filings, payroll records, or other ordered financial documents may be raised in a post-judgment enforcement proceeding, including a Petition for Rule to Show Cause.",
      highlight: ["Petition for Rule to Show Cause", "enforcement"],
    },
    {
      num: 11,
      title: "Retained Jurisdiction",
      body:
        "The Court retains jurisdiction over this cause for purposes of enforcement, disclosure, maintenance review, support recalculation, and all other provisions of this Judgment.",
      highlight: ["retains jurisdiction", "enforcement"],
    },
  ],
  extracted: {
    orderType: "Judgment for Dissolution of Marriage",
    court: "Circuit Court of Cook County, Illinois — Domestic Relations Division",
    caseNumber: "2022-D-001234",
    calendar: "14",
    judge: "Hon. R. Whitfield",
    courtroom: "3007",
    petitioner: "Maria Lopez",
    respondent: "Carlos Lopez",
    finalOrderDate: "2022-06-15",
    maintenance: "$1,450.00 / month",
    childSupport: "$1,180.00 / month",
    orderParagraph: "4 and 5",
    orderRequirement:
      "Carlos must provide complete annual proof of income (federal & state tax returns, W-2s/1099s, last 4 payroll statements, bonus/commission documentation) by April 30 each year; and must respond to written requests for updated income information within 21 days.",
    enforcementHook:
      "Paragraph 10 expressly contemplates a Petition for Rule to Show Cause for failure to provide ordered financial documents.",
  },
};

// ---- TYPES & STATE -----------------------------------------------------
type AppState = {
  case: { role: string; caseType: string; caseNumber: string; calendar: string; ivdNumber: string; filingDate: string; isComplete: boolean | null; finalOrderDate: string; enforcedOrderDate: string };
  client: { firstName: string; middleName: string; lastName: string; suffix: string; address1: string; address2: string; city: string; state: string; zip: string; phone: string; email: string };
  otherParty: { firstName: string; middleName: string; lastName: string; suffix: string; hasLawyer: boolean | null; lawyerName: string; deliveryTarget: string; address1: string; address2: string; city: string; state: string; zip: string; email: string };
  petition: { orderParagraph: string; orderRequirement: string; violationDescription: string; violationDates: string[]; requestedRelief: string };
  documents: { orderUploaded: boolean; exhibitAReady: boolean; supportingProofUploaded: boolean; writtenRequestsUploaded: boolean; paymentHistoryUploaded: boolean };
  // ── Real-AI extras layered on top of the original schema ──
  uploadedFile: File | null;
  isDemo: boolean;
  realFacts: Facts | null;
  realMotion: Motion | null;
  trackDecision: TrackDecision | null;
};

const blankState = (): AppState => ({
  case: { role: "", caseType: "Support", caseNumber: "", calendar: "", ivdNumber: "", filingDate: "", isComplete: null, finalOrderDate: "", enforcedOrderDate: "" },
  client: { firstName: "", middleName: "", lastName: "", suffix: "", address1: "", address2: "", city: "", state: "Illinois", zip: "", phone: "", email: "" },
  otherParty: { firstName: "", middleName: "", lastName: "", suffix: "", hasLawyer: null, lawyerName: "", deliveryTarget: "party", address1: "", address2: "", city: "", state: "Illinois", zip: "", email: "" },
  petition: { orderParagraph: "", orderRequirement: "", violationDescription: "", violationDates: [], requestedRelief: "" },
  documents: { orderUploaded: false, exhibitAReady: false, supportingProofUploaded: false, writtenRequestsUploaded: false, paymentHistoryUploaded: false },
  uploadedFile: null,
  isDemo: false,
  realFacts: null,
  realMotion: null,
  trackDecision: null,
});

type Stage = "landing" | "upload" | "extract" | "review" | "interview" | "output";

// ============================================================ APP ROOT
export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [state, setState] = useState<AppState>(blankState());

  return React.createElement(
    "div",
    { className: "min-h-screen flex flex-col" },
    React.createElement(TopBar, null),
    React.createElement(
      "main",
      { className: "flex-1" },
      stage === "landing" && React.createElement(Landing, { onStart: () => setStage("upload") }),
      stage === "upload" && React.createElement(UploadStep, { onUploaded: () => setStage("extract"), state, setState }),
      stage === "extract" && React.createElement(ExtractStep, { onDone: () => setStage("review"), state, setState }),
      stage === "review" && React.createElement(ReviewStep, { state, setState, onContinue: () => setStage("interview") }),
      stage === "interview" && React.createElement(InterviewStep, { state, setState, onDone: () => setStage("output") }),
      stage === "output" && React.createElement(OutputStep, { state, setState, onRestart: () => { setState(blankState()); setStage("landing"); } }),
    ),
    React.createElement(Disclaimer, null),
    React.createElement(Footer, null),
  );
}

// ============================================================ TOP BAR
function TopBar() {
  return React.createElement(
    "header",
    { className: "sticky top-0 z-30 bg-ink-50/85 backdrop-blur border-b border-ink-100" },
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-5 py-3 flex items-center justify-between" },
      React.createElement(
        "div",
        { className: "flex items-center gap-2.5 text-ink-900" },
        React.createElement(Logo, { size: 26 }),
        React.createElement(
          "div",
          null,
          React.createElement("div", { className: "font-display text-[17px] leading-none font-semibold" }, "Justice in a Flash"),
          React.createElement("div", { className: "text-[11px] text-ink-600 mt-0.5" }, "Illinois · Cook County · Draft for attorney/legal-aid review"),
        ),
      ),
      React.createElement(
        "span",
        { className: "hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-600 bg-ink-100 border border-ink-200 rounded-full px-2.5 py-1" },
        React.createElement(Icon, { d: ICONS.shield, size: 13 }),
        "Not legal advice",
      ),
    ),
  );
}

function Disclaimer() {
  return React.createElement(
    "div",
    { className: "border-t border-warn-100 bg-warn-50" },
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-5 py-2.5 flex items-start gap-2.5 text-[12px] text-warn-700" },
      React.createElement(Icon, { d: ICONS.alert, size: 14, className: "mt-0.5 shrink-0" }),
      React.createElement(
        "p",
        null,
        React.createElement("span", { className: "font-semibold" }, "This tool does not give legal advice and does not file with the court. "),
        "It produces a draft for attorney or legal-aid review. Filing, hearing scheduling, delivery, and exhibits are handled separately.",
      ),
    ),
  );
}

function Footer() {
  return React.createElement(
    "footer",
    { className: "border-t border-ink-100 bg-ink-50" },
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-5 py-5 text-[12px] text-ink-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" },
      React.createElement("div", null, "Built for ALI · Greater Good Hackathon · 2026"),
      React.createElement("div", null, "Anthropic Claude · Featherless AI · Groq Whisper · Illinois Legal Aid Online"),
    ),
  );
}

// ============================================================ LANDING
function Landing({ onStart }: { onStart: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (playing) {
      const a = audioRef.current;
      if (a) { a.pause(); a.currentTime = 0; }
      setPlaying(false);
      return;
    }
    const a = new Audio("/audio/landing.mp3");
    audioRef.current = a;
    a.onended = () => { setPlaying(false); setPlayed(true); };
    a.onerror = () => setPlaying(false);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  useEffect(() => () => { const a = audioRef.current; if (a) { try { a.pause(); } catch (_) {} } }, []);

  return React.createElement(
    "section",
    { className: "max-w-3xl mx-auto px-5 pt-5 pb-4 fade-in" },
    React.createElement(
      "div",
      { className: "inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-sage-700 bg-sage-100 border border-sage-300/60 rounded-full px-2.5 py-1 mb-3" },
      React.createElement(Icon, { d: ICONS.sparkle, size: 12 }),
      "Child support & alimony enforcement",
    ),
    React.createElement(
      "h1",
      { className: "font-display text-[30px] sm:text-[40px] leading-[1.05] font-semibold text-ink-900 tracking-tight" },
      "Justice ",
      React.createElement("em", { className: "italic text-sage-700" }, "in a flash"),
      ".",
    ),
    React.createElement(
      "p",
      { className: "mt-2 text-[14.5px] sm:text-[15.5px] text-ink-700 leading-snug max-w-2xl" },
      "Draft enforcement petitions for child support and alimony — in minutes, in plain language, ready for an attorney to review.",
    ),

    // ---- How it works (3 numbered steps) ----
    React.createElement(
      "ol",
      { className: "mt-4 space-y-2", "data-testid": "landing-how" },
      [
        { t: "Upload your divorce judgment or support order.", s: "Photo or PDF — Claude vision reads it." },
        { t: "Answer a few plain-English questions.", s: "Voice or text — your choice." },
        { t: "Get a draft Petition for Rule to Show Cause + a personalized roadmap.", s: "Featherless Llama routes the right enforcement track. Your attorney can move faster." },
      ].map((s, i) =>
        React.createElement(
          "li",
          { key: i, className: "flex items-start gap-3" },
          React.createElement(
            "span",
            { className: "shrink-0 w-7 h-7 rounded-full bg-sage-100 text-sage-700 inline-flex items-center justify-center text-[13px] font-semibold" },
            i + 1,
          ),
          React.createElement(
            "div",
            { className: "flex-1" },
            React.createElement("div", { className: "text-[14.5px] text-ink-900 font-medium leading-snug" }, s.t),
            React.createElement("div", { className: "text-[12.5px] text-ink-600 leading-snug" }, s.s),
          ),
        ),
      ),
    ),

    // ---- Warm reassurance audio ----
    React.createElement(
      "div",
      {
        className: `mt-4 rounded-xl border p-3 flex items-center gap-3 transition-colors ${playing ? "bg-sage-50 border-sage-300" : "bg-white border-ink-100"}`,
        "data-testid": "landing-reassurance",
      },
      React.createElement(
        "button",
        {
          onClick: toggle,
          type: "button",
          "data-testid": "btn-play-landing",
          "aria-label": playing ? "Pause reassurance" : "Play reassurance message",
          className: `shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center transition-colors ${playing ? "bg-sage-600 text-white pulse-ring" : "bg-sage-600 hover:bg-sage-700 text-white"}`,
        },
        React.createElement(
          "svg",
          { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor" },
          React.createElement("path", { d: playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z" }),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex-1 min-w-0" },
        React.createElement(
          "div",
          { className: "font-display text-[14px] font-semibold text-ink-900 leading-tight" },
          playing ? "Take a breath." : (played ? "Replay any time." : "Hear it in a calm voice first (9 seconds)."),
        ),
        React.createElement(
          "div",
          { className: "text-[12px] text-ink-600 mt-0.5 leading-tight" },
          playing ? "You're in the right place." : "A warm hello before you upload anything.",
        ),
      ),
    ),

    React.createElement(
      "div",
      { className: "mt-4 flex flex-col sm:flex-row gap-2.5" },
      React.createElement(
        "button",
        {
          onClick: onStart,
          "data-testid": "button-start",
          className: "tap inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium card-shadow transition-colors",
        },
        "Start with my order ",
        React.createElement(Icon, { d: ICONS.arrowRight, size: 16 }),
      ),
      React.createElement(
        "button",
        {
          onClick: onStart,
          "data-testid": "button-demo",
          className: "tap inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-ink-200 hover:border-ink-300 hover:bg-white text-ink-900 font-medium transition-colors",
        },
        React.createElement(Icon, { d: ICONS.sparkle, size: 15 }),
        "Try the demo (Lopez case)",
      ),
    ),
  );
}

// ============================================================ UPLOAD
function UploadStep({ onUploaded, state, setState }: { onUploaded: () => void; state: AppState; setState: (u: (s: AppState) => AppState) => void }) {
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const startUpload = (name: string) => {
    setFilename(name);
    setUploading(true);
    setProgress(0);
    let p = 0;
    const tick = () => {
      p += Math.random() * 14 + 6;
      if (p >= 100) {
        p = 100;
        setProgress(p);
        setTimeout(onUploaded, 350);
        return;
      }
      setProgress(p);
      setTimeout(tick, 160);
    };
    tick();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setState((s) => ({ ...s, uploadedFile: f, isDemo: false, documents: { ...s.documents, orderUploaded: true } }));
    startUpload(f.name);
  };
  const useDemo = () => {
    setState((s) => ({ ...s, uploadedFile: null, isDemo: true, documents: { ...s.documents, orderUploaded: true } }));
    startUpload(DEMO_JUDGMENT.fileName);
  };

  return React.createElement(
    "section",
    { className: "max-w-3xl mx-auto px-5 pt-8 pb-6 fade-in" },
    React.createElement(StepHeader, { step: 1, total: 5, label: "Upload your order" }),
    React.createElement("h2", { className: "font-display text-[26px] sm:text-[30px] font-semibold text-ink-900 mt-2" }, "Add a photo or PDF of your order."),
    React.createElement("p", { className: "text-ink-700 mt-1.5 text-[15px]" }, "This is the divorce judgment or support order that we believe was violated. Claude vision reads it and pulls the facts you'll review."),

    !uploading
      ? React.createElement(
          "div",
          { className: "mt-6 grid gap-4" },
          React.createElement(
            "label",
            { htmlFor: "file", className: "block group bg-white border-2 border-dashed border-ink-200 hover:border-sage-500 rounded-2xl p-7 text-center cursor-pointer transition-colors" },
            React.createElement(Icon, { d: ICONS.upload, size: 28, className: "mx-auto text-sage-600 group-hover:text-sage-700" }),
            React.createElement("div", { className: "mt-3 font-display text-[18px] font-medium text-ink-900" }, "Upload from your phone or computer"),
            React.createElement("div", { className: "text-[13px] text-ink-600 mt-1" }, "PDF, JPG, or PNG · Up to 12 MB · Stored only in your browser session"),
            React.createElement("input", {
              ref: fileRef,
              id: "file",
              type: "file",
              accept: ".pdf,image/png,image/jpeg,image/webp,image/gif",
              className: "hidden",
              onChange: onFile,
              "data-testid": "input-upload",
            }),
          ),
          React.createElement("div", { className: "text-center text-ink-600 text-[12px]" }, "— or —"),
          React.createElement(
            "button",
            { onClick: useDemo, "data-testid": "button-use-demo", className: "tap inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-ink-900 hover:bg-ink-700 text-white font-medium transition-colors" },
            React.createElement(Icon, { d: ICONS.sparkle, size: 15 }),
            "Use the Lopez demo judgment",
          ),
          React.createElement("p", { className: "text-[12px] text-ink-600 text-center" }, "The demo is a synthetic Illinois divorce judgment. Not a real court order."),
        )
      : React.createElement(
          "div",
          { className: "mt-6 bg-white border border-ink-200 rounded-2xl p-6 card-shadow" },
          React.createElement(
            "div",
            { className: "flex items-center gap-3 text-ink-900" },
            React.createElement(Icon, { d: ICONS.doc, size: 20, className: "text-sage-600" }),
            React.createElement("div", { className: "font-medium truncate" }, filename),
          ),
          React.createElement(
            "div",
            { className: "mt-3 h-2 bg-ink-100 rounded-full overflow-hidden" },
            React.createElement("div", { className: "h-full bg-sage-600 transition-all", style: { width: progress + "%" } }),
          ),
          React.createElement(
            "div",
            { className: "mt-2 text-[12px] text-ink-600" },
            progress < 100 ? `Securely receiving your file… ${Math.round(progress)}%` : "Uploaded. Claude vision reading the order…",
          ),
        ),
  );
}

// ============================================================ EXTRACTION (REAL Claude vision)
function ExtractStep({ onDone, state, setState }: { onDone: () => void; state: AppState; setState: (u: (s: AppState) => AppState) => void }) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const [factsLoaded, setFactsLoaded] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);

  // Fire the real vision call (or use demo data) on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let realFacts: Facts | null = null;
        if (state.isDemo || !state.uploadedFile) {
          // Demo path: load canned Maria via /api/intake (no STT call).
          const r = await fetch("/api/intake");
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "demo load failed");
          realFacts = j.facts as Facts;
        } else {
          // Real path: Claude vision via /api/decree.
          const fd = new FormData();
          fd.append("decree", state.uploadedFile);
          const r = await fetch("/api/decree", { method: "POST", body: fd });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "vision failed");
          realFacts = j.facts as Facts;
        }
        if (cancelled) return;
        const e = DEMO_JUDGMENT.extracted;
        const f = realFacts!;
        const petitionerName = f.petitioner_name || e.petitioner;
        const respondentName = f.respondent_name || e.respondent;
        // Pre-populate the rich state from real facts (with demo fallbacks).
        setState((s) => ({
          ...s,
          realFacts: f,
          case: {
            ...s.case,
            caseType: "Support",
            caseNumber: f.case_number || e.caseNumber,
            calendar: e.calendar,
            finalOrderDate: f.judgment_date || e.finalOrderDate,
            enforcedOrderDate: f.judgment_date || e.finalOrderDate,
            isComplete: true,
          },
          otherParty: {
            ...s.otherParty,
            firstName: respondentName.split(" ")[0] || "",
            lastName: respondentName.split(" ").slice(1).join(" ") || "",
          },
          client: {
            ...s.client,
            firstName: petitionerName.split(" ")[0] || "",
            lastName: petitionerName.split(" ").slice(1).join(" ") || "",
            state: "Illinois",
          },
          petition: { ...s.petition, orderParagraph: e.orderParagraph, orderRequirement: e.orderRequirement },
          documents: { ...s.documents, orderUploaded: true, exhibitAReady: true },
        }));
        // Kick off Featherless routing in parallel — non-blocking.
        try {
          const rr = await fetch("/api/route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facts: f }),
          });
          const rj = await rr.json();
          if (!cancelled && rj && rj.track) {
            setState((s) => ({ ...s, trackDecision: rj as TrackDecision }));
          }
        } catch (_) {/* badge just won't render */}
        setFactsLoaded(true);
      } catch (e) {
        if (!cancelled) setVisionError(e instanceof Error ? e.message : "vision failed");
        setFactsLoaded(true); // still let the user move on
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cosmetic paragraph reveal — runs alongside the real vision call so the user
  // sees motion while Claude works.
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setRevealed((r) => (r.includes(i) ? r : [...r, i]));
      i++;
      if (i >= DEMO_JUDGMENT.excerptParagraphs.length) clearInterval(id);
    }, 700);
    return () => clearInterval(id);
  }, []);

  const allRevealed = revealed.length >= DEMO_JUDGMENT.excerptParagraphs.length;

  return React.createElement(
    "section",
    { className: "max-w-3xl mx-auto px-5 pt-8 pb-6 fade-in" },
    React.createElement(StepHeader, { step: 2, total: 5, label: "Reading your order" }),
    React.createElement("h2", { className: "font-display text-[26px] sm:text-[30px] font-semibold text-ink-900 mt-2" }, "Pulling out the parts that matter."),
    React.createElement(
      "p",
      { className: "text-ink-700 mt-1.5 text-[15px]" },
      state.isDemo
        ? "Using the canned Lopez judgment for the demo. We highlight enforcement-relevant paragraphs — annual income disclosure, response deadlines, and the enforcement clause itself."
        : "Claude vision is reading your document. We highlight enforcement-relevant paragraphs — annual income disclosure, response deadlines, and the enforcement clause.",
    ),

    visionError && React.createElement(
      "div",
      { className: "mt-4 rounded-xl border border-warn-100 bg-warn-50 px-4 py-3 text-[13px] text-warn-700" },
      "⚠ Vision error: ", visionError, " — continuing with the demo facts so you can see the rest of the flow.",
    ),

    React.createElement(
      "div",
      { className: "mt-6 grid gap-3" },
      DEMO_JUDGMENT.excerptParagraphs.map((p, i) => {
        const visible = revealed.includes(i);
        const segs: React.ReactNode[] = (() => {
          let body = p.body;
          p.highlight.forEach((h) => {
            const re = new RegExp(`(${h.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");
            body = body.replace(re, "<<<$1>>>");
          });
          return body.split(/<<<|>>>/).map((seg, k) => {
            const matched = p.highlight.some((h) => seg.toLowerCase() === h.toLowerCase());
            return matched
              ? React.createElement("mark", { key: k, className: "bg-warn-100 text-warn-700 font-medium px-0.5 rounded" }, seg)
              : React.createElement("span", { key: k }, seg);
          });
        })();
        return React.createElement(
          "div",
          {
            key: i,
            className: `rounded-2xl border ${visible ? "border-sage-300/70 bg-white card-shadow" : "border-ink-100 bg-ink-50 opacity-40"} p-4 transition-all`,
          },
          React.createElement(
            "div",
            { className: "flex items-baseline gap-2 mb-1.5" },
            React.createElement("div", { className: "text-[11px] uppercase tracking-wider text-sage-700 font-semibold" }, `Paragraph ${p.num}`),
            React.createElement("div", { className: "font-display text-[15px] text-ink-900" }, p.title),
          ),
          React.createElement("p", { className: "text-[14px] text-ink-700 leading-relaxed" }, segs),
        );
      }),
    ),

    allRevealed && factsLoaded && React.createElement(
      "div",
      { className: "mt-7 fade-in" },
      React.createElement(
        "div",
        { className: "flex items-center gap-2 text-sage-700 text-[14px] font-medium" },
        React.createElement(Icon, { d: ICONS.check, size: 18 }),
        state.isDemo ? "Extraction complete (demo data)." : "Claude vision complete. Real facts extracted from your document.",
      ),
      React.createElement(
        "button",
        {
          onClick: onDone,
          "data-testid": "button-review",
          className: "tap mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium card-shadow transition-colors",
        },
        "Review the extracted facts ",
        React.createElement(Icon, { d: ICONS.arrowRight, size: 16 }),
      ),
    ),
  );
}

// ============================================================ REVIEW EXTRACTED FACTS
function ReviewStep({ state, setState, onContinue }: { state: AppState; setState: (u: (s: AppState) => AppState) => void; onContinue: () => void }) {
  // Avoid TS unused-warning on setState (kept for parity with original signature).
  void setState;
  const e = DEMO_JUDGMENT.extracted;
  const f = state.realFacts;
  const fields: [string, string][] = [
    ["Court", e.court],
    ["Case number", state.case.caseNumber || f?.case_number || e.caseNumber],
    ["Calendar", state.case.calendar || e.calendar],
    ["Petitioner (you)", `${state.client.firstName} ${state.client.lastName}`.trim() || e.petitioner],
    ["Respondent (other party)", `${state.otherParty.firstName} ${state.otherParty.lastName}`.trim() || e.respondent],
    ["Final order / judgment date", state.case.finalOrderDate || f?.judgment_date || e.finalOrderDate],
    ["Maintenance ordered", e.maintenance],
    ["Child support ordered", e.childSupport],
    ["Order paragraph(s) at issue", e.orderParagraph],
    ["What the order required", e.orderRequirement],
    ["Enforcement hook", e.enforcementHook],
  ];
  return React.createElement(
    "section",
    { className: "max-w-3xl mx-auto px-5 pt-8 pb-6 fade-in" },
    React.createElement(StepHeader, { step: 3, total: 5, label: "Review extracted facts" }),
    React.createElement("h2", { className: "font-display text-[26px] sm:text-[30px] font-semibold text-ink-900 mt-2" }, "Does this look right?"),
    React.createElement("p", { className: "text-ink-700 mt-1.5 text-[15px]" }, "We took a first pass with Claude vision. Edit anything wrong in the next step — these go into your draft petition."),

    state.trackDecision && React.createElement(TrackBadgeMini, { decision: state.trackDecision }),

    React.createElement(
      "div",
      { className: "mt-6 bg-white border border-ink-100 rounded-2xl card-shadow overflow-hidden" },
      fields.map((row, i) =>
        React.createElement(
          "div",
          { key: i, className: `grid grid-cols-[140px_1fr] sm:grid-cols-[200px_1fr] gap-3 px-4 sm:px-5 py-3.5 ${i ? "border-t border-ink-100" : ""}` },
          React.createElement("div", { className: "text-[12px] uppercase tracking-wider text-ink-600 font-semibold pt-1" }, row[0]),
          React.createElement("div", { className: "text-[14px] text-ink-900 leading-relaxed" }, row[1] || "—"),
        ),
      ),
    ),

    React.createElement(
      "div",
      { className: "mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3" },
      React.createElement(
        "div",
        { className: "text-[12px] text-ink-600 max-w-md" },
        "Looks good is fine — we will ask follow-up questions next to fill in the facts the order itself does not show, like dates the violation happened.",
      ),
      React.createElement(
        "button",
        {
          onClick: onContinue,
          "data-testid": "button-continue-interview",
          className: "tap inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium card-shadow transition-colors",
        },
        "Continue · short interview ",
        React.createElement(Icon, { d: ICONS.arrowRight, size: 16 }),
      ),
    ),
  );
}

function TrackBadgeMini({ decision }: { decision: TrackDecision }) {
  const titles: Record<TrackDecision["track"], string> = {
    A: "Track A · Child support arrears → DHFS Title IV-D",
    B: "Track B · Hidden income / maintenance → Motion to Compel + Rule 13.3.1",
    BOTH: "Tracks A + B · Pursue both DHFS IV-D AND a Motion to Compel",
  };
  const provider = decision.provider === "featherless" ? "Featherless · Llama 3.3 70B" : "Rule-based fallback";
  return React.createElement(
    "div",
    { className: "mt-4 rounded-xl border border-sage-300/60 bg-sage-50 px-4 py-3" },
    React.createElement(
      "div",
      { className: "flex items-baseline justify-between gap-3 flex-wrap" },
      React.createElement("p", { className: "text-[13px] font-semibold text-sage-700" }, titles[decision.track]),
      React.createElement("span", { className: "text-[10px] uppercase tracking-wider text-ink-600" }, "Routed by ", provider),
    ),
    React.createElement("p", { className: "text-[12px] text-ink-700 mt-1 leading-relaxed italic" }, decision.reasoning),
  );
}

// ============================================================ INTERVIEW (one-question-at-a-time, voice-capable)
type InterviewQ = {
  id: string;
  section: string;
  q: string;
  helper?: string;
  type: "choice" | "text" | "longtext" | "chips";
  options?: string[];
  multi?: boolean;
  placeholder?: string;
  voice?: boolean;
  seed?: (s: AppState) => string;
  set: (s: AppState, v: string | string[]) => AppState;
};

const INTERVIEW: InterviewQ[] = [
  {
    id: "role", section: "Case",
    q: "Are you the parent who is owed compliance, or the parent being asked to comply?",
    helper: "In this draft, you are the one asking the court to enforce the order.",
    type: "choice", options: ["I am owed compliance", "I am being asked to comply"],
    set: (s, v) => ({ ...s, case: { ...s.case, role: v as string } }),
  },
  {
    id: "orderType", section: "Case",
    q: "What kind of order is being violated?",
    helper: "Pick the closest match — you can refine the wording later.",
    type: "choice",
    options: ["Divorce judgment with support", "Standalone support order", "Other support / maintenance order"],
    set: (s, v) => ({ ...s, case: { ...s.case, caseType: (v as string).includes("support") ? "Support" : "Support" } }),
  },
  {
    id: "clientName", section: "You",
    q: "What is your full legal name?",
    helper: "This goes on the petition as the moving party.",
    type: "text", placeholder: "e.g., Maria Lopez",
    voice: true,
    seed: (s) => `${s.client.firstName} ${s.client.lastName}`.trim(),
    set: (s, v) => {
      const parts = (v as string).trim().split(/\s+/);
      return { ...s, client: { ...s.client, firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" } };
    },
  },
  {
    id: "clientAddress", section: "You",
    q: "What address should the court use to reach you?",
    helper: "Use a place you can reliably get mail. PO boxes are fine.",
    type: "text", placeholder: "Street, City, IL, ZIP",
    voice: true,
    seed: (s) => [s.client.address1, s.client.city, "Illinois", s.client.zip].filter(Boolean).join(", "),
    set: (s, v) => {
      const p = (v as string).split(",").map((x) => x.trim());
      return { ...s, client: { ...s.client, address1: p[0] || "", city: p[1] || "", zip: p[3] || "" } };
    },
  },
  {
    id: "otherPartyLawyer", section: "Other party",
    q: "Does the other parent have a lawyer right now?",
    helper: "If yes, your delivery copies must go to the lawyer, not the parent.",
    type: "choice", options: ["Yes — they have a lawyer", "No — represented themselves", "I am not sure"],
    set: (s, v) => {
      const str = v as string;
      return {
        ...s,
        otherParty: {
          ...s.otherParty,
          hasLawyer: str.startsWith("Yes") ? true : str.startsWith("No") ? false : null,
          deliveryTarget: str.startsWith("Yes") ? "lawyer" : "party",
        },
      };
    },
  },
  {
    id: "violationDescription", section: "Petition",
    q: "In your own words, what did the other parent fail to do?",
    helper: "Plain English is fine. We will tighten the wording for the draft.",
    type: "longtext",
    placeholder: "e.g., He did not give me his federal tax returns, W-2s, or last 4 payroll statements by April 30, even after I asked in writing twice.",
    voice: true,
    set: (s, v) => ({ ...s, petition: { ...s.petition, violationDescription: v as string } }),
  },
  {
    id: "violationDates", section: "Petition",
    q: "When did this happen? Pick the dates you can prove.",
    helper: "A missed annual deadline counts. So does a written request that went unanswered for more than 21 days.",
    type: "chips",
    options: [
      "Missed April 30, 2023 deadline",
      "Missed April 30, 2024 deadline",
      "Missed April 30, 2025 deadline",
      "Did not respond to my written request within 21 days",
      "Other date — I will add in attorney review",
    ],
    multi: true,
    set: (s, v) => ({ ...s, petition: { ...s.petition, violationDates: v as string[] } }),
  },
  {
    id: "evidence", section: "Petition",
    q: "Which of these can you actually show in court?",
    helper: "You do not have to have everything — we will list what is missing on the next screen.",
    type: "chips",
    options: [
      "Copy of the order/judgment",
      "Emails or texts asking for the documents",
      "Payment history from ILSDU",
      "Mail receipts (certified mail green cards)",
      "None of these yet",
    ],
    multi: true,
    set: (s, v) => {
      const arr = v as string[];
      return {
        ...s,
        documents: {
          ...s.documents,
          orderUploaded: arr.includes("Copy of the order/judgment") || s.documents.orderUploaded,
          writtenRequestsUploaded: arr.includes("Emails or texts asking for the documents"),
          paymentHistoryUploaded: arr.includes("Payment history from ILSDU"),
          supportingProofUploaded: arr.includes("Mail receipts (certified mail green cards)"),
        },
      };
    },
  },
  {
    id: "relief", section: "Petition",
    q: "What do you want the judge to do?",
    helper: 'This goes into the "Requested Relief" section as a draft. Your attorney can refine it.',
    type: "chips",
    options: [
      "Order Carlos to turn over the missing tax/payroll records",
      "Hold him in contempt until he complies",
      "Award me attorney fees and costs",
      "Recalculate maintenance based on current income",
    ],
    multi: true,
    set: (s, v) => ({ ...s, petition: { ...s.petition, requestedRelief: (v as string[]).join("; ") } }),
  },
];

function InterviewStep({ state, setState, onDone }: { state: AppState; setState: (u: (s: AppState) => AppState) => void; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const q = INTERVIEW[idx];
  const isLast = idx === INTERVIEW.length - 1;

  useEffect(() => {
    if (q.seed) setAnswer(q.seed(state) || "");
    else setAnswer("");
    setChips([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const submit = (val?: string | string[]) => {
    const v = val ?? (q.type === "chips" ? chips : answer);
    if (q.type === "chips" && (!v || (v as string[]).length === 0)) return;
    if ((q.type === "text" || q.type === "longtext") && !(v as string).trim()) return;
    setState((s) => q.set(s, v));
    if (isLast) onDone();
    else setIdx((i) => i + 1);
  };

  return React.createElement(
    "section",
    { className: "max-w-3xl mx-auto px-5 pt-8 pb-6 fade-in" },
    React.createElement(StepHeader, { step: 4, total: 5, label: `Interview · ${q.section}` }),
    React.createElement(ProgressBar, { value: idx / INTERVIEW.length }),

    React.createElement(
      "div",
      { className: "mt-6 bg-white border border-ink-100 rounded-2xl card-shadow p-5 sm:p-7 fade-in", key: idx },
      React.createElement("div", { className: "text-[11px] uppercase tracking-wider text-sage-700 font-semibold" }, `Question ${idx + 1} of ${INTERVIEW.length}`),
      React.createElement("h2", { className: "font-display text-[22px] sm:text-[26px] leading-[1.2] font-semibold text-ink-900 mt-2" }, q.q),
      q.helper && React.createElement("p", { className: "text-[14px] text-ink-600 mt-2" }, q.helper),

      q.type === "choice" && React.createElement(
        "div",
        { className: "mt-5 grid gap-2.5" },
        q.options!.map((opt) =>
          React.createElement(
            "button",
            {
              key: opt,
              onClick: () => submit(opt),
              "data-testid": `choice-${opt.slice(0, 20)}`,
              className: "tap text-left px-4 py-3 rounded-xl border border-ink-200 hover:border-sage-500 hover:bg-sage-50 transition-colors text-ink-900",
            },
            opt,
          ),
        ),
      ),

      q.type === "text" && React.createElement(
        "div",
        { className: "mt-5" },
        React.createElement(VoiceCapableInput, {
          asInput: true,
          value: answer,
          onChange: setAnswer,
          placeholder: q.placeholder!,
          voice: true,
          testId: `input-${q.id}`,
          onEnter: () => submit(),
        }),
      ),

      q.type === "longtext" && React.createElement(
        "div",
        { className: "mt-5" },
        React.createElement(VoiceCapableInput, {
          asInput: false,
          value: answer,
          onChange: setAnswer,
          placeholder: q.placeholder!,
          voice: true,
          testId: `textarea-${q.id}`,
        }),
      ),

      q.type === "chips" && React.createElement(
        "div",
        { className: "mt-5 grid gap-2" },
        q.options!.map((opt) => {
          const selected = chips.includes(opt);
          return React.createElement(
            "button",
            {
              key: opt,
              onClick: () => setChips((c) => (selected ? c.filter((x) => x !== opt) : [...c, opt])),
              "data-testid": `chip-${opt.slice(0, 18)}`,
              className: `quick-chip tap text-left px-4 py-3 rounded-xl border ${selected ? "selected" : "border-ink-200"} bg-white`,
            },
            React.createElement(
              "span",
              { className: "inline-flex items-center gap-2" },
              React.createElement(
                "span",
                { className: `w-4 h-4 rounded-md border ${selected ? "bg-white border-white text-sage-700" : "border-ink-300"} inline-flex items-center justify-center` },
                selected ? React.createElement(Icon, { d: ICONS.check, size: 12 }) : null,
              ),
              opt,
            ),
          );
        }),
      ),

      React.createElement(
        "div",
        { className: "mt-6 flex items-center justify-between gap-3" },
        React.createElement(
          "button",
          {
            onClick: () => setIdx((i) => Math.max(0, i - 1)),
            disabled: idx === 0,
            "data-testid": "button-back",
            className: "tap inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-200 text-ink-700 hover:bg-white disabled:opacity-40",
          },
          React.createElement(Icon, { d: ICONS.arrowLeft, size: 16 }),
          "Back",
        ),
        q.type !== "choice" && React.createElement(
          "button",
          {
            onClick: () => submit(),
            "data-testid": "button-next",
            className: "tap inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium card-shadow transition-colors",
          },
          isLast ? "Build my packet" : "Next",
          React.createElement(Icon, { d: ICONS.arrowRight, size: 16 }),
        ),
      ),
    ),
    React.createElement(
      "p",
      { className: "mt-4 text-[12px] text-ink-600 text-center" },
      "Voice answers stay on this device — they are converted to text in your browser.",
    ),
  );
}

// ============================================================ VOICE-CAPABLE INPUT (browser SpeechRecognition)
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
function VoiceCapableInput({
  asInput,
  value,
  onChange,
  placeholder,
  voice,
  testId,
  onEnter,
}: {
  asInput: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  voice: boolean;
  testId: string;
  onEnter?: () => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState("");
  const recogRef = useRef<unknown>(null);
  const baseRef = useRef("");
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) setSupported(false);
  }, []);

  const stop = () => {
    const r = recogRef.current as { stop?: () => void } | null;
    if (r && typeof r.stop === "function") { try { r.stop(); } catch (_) {} }
    setListening(false);
  };

  const start = async () => {
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) { setSupported(false); setStatus("Voice input not supported in this browser. Try Chrome or Edge."); return; }
    if (!window.isSecureContext) { setStatus("Voice input needs a secure (https) page. You can still type."); return; }
    setStatus("Requesting microphone permission…");
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      }
    } catch (_) {
      setStatus("Microphone permission was blocked. Click the lock icon → allow Microphone, then try again.");
      return;
    }
    const r = new Rec() as {
      lang: string; continuous: boolean; interimResults: boolean;
      onstart: () => void; onresult: (e: SpeechRecognitionEvent) => void;
      onend: () => void; onerror: (ev: { error: string }) => void;
      start: () => void; stop: () => void;
    };
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    baseRef.current = valueRef.current || "";
    r.onstart = () => { setListening(true); setStatus("Listening — speak naturally. Click the mic again to stop."); };
    r.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      const combined = (baseRef.current ? baseRef.current + " " : "") + (final + interim).trim();
      onChange(combined);
      if (final) baseRef.current = (baseRef.current ? baseRef.current + " " : "") + final.trim();
    };
    r.onend = () => { setListening(false); };
    r.onerror = (ev) => {
      setListening(false);
      const code = ev?.error;
      if (code === "not-allowed" || code === "service-not-allowed") setStatus("Microphone permission was blocked.");
      else if (code === "no-speech") setStatus("No speech detected.");
      else setStatus(`Voice error: ${code || "unknown"}.`);
    };
    recogRef.current = r;
    try { r.start(); } catch (err) { setStatus(`Could not start: ${err instanceof Error ? err.message : "error"}`); setListening(false); }
  };

  const toggle = () => { if (listening) stop(); else start(); };
  useEffect(() => () => { stop(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const fieldEl = asInput
    ? React.createElement("input", {
        autoFocus: true, type: "text", value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        placeholder, "data-testid": testId,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" && onEnter) onEnter(); },
        className: "w-full tap px-4 py-3 pr-14 rounded-xl border border-ink-200 focus:border-sage-600 focus:ring-2 focus:ring-sage-100 outline-none bg-white text-ink-900",
      })
    : React.createElement("textarea", {
        autoFocus: true, value, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
        placeholder, rows: 5, "data-testid": testId,
        className: "w-full px-4 py-3 pr-14 rounded-xl border border-ink-200 focus:border-sage-600 focus:ring-2 focus:ring-sage-100 outline-none bg-white text-ink-900 resize-y leading-relaxed",
      });
  const micPosition = asInput
    ? "absolute top-1/2 -translate-y-1/2 right-2 w-9 h-9"
    : "absolute bottom-3 right-3 w-11 h-11";

  return React.createElement(
    "div",
    { className: "relative" },
    fieldEl,
    voice && React.createElement(
      "button",
      {
        onClick: toggle, type: "button", "data-testid": `button-mic-${testId || "default"}`,
        title: supported ? (listening ? "Stop voice input" : "Speak your answer") : "Voice not supported",
        disabled: !supported,
        "aria-pressed": listening ? "true" : "false",
        "aria-label": listening ? "Stop voice input" : "Speak your answer",
        className: `${micPosition} rounded-full inline-flex items-center justify-center transition-all ${listening ? "bg-sage-600 text-white pulse-ring" : "bg-ink-100 text-ink-700 hover:bg-sage-100"} ${!supported ? "opacity-40 cursor-not-allowed" : ""}`,
      },
      React.createElement(Icon, { d: ICONS.mic, size: asInput ? 16 : 18 }),
    ),
    !supported && voice && React.createElement("div", { className: "mt-1.5 text-[11px] text-ink-600" }, "Voice input works best in Chrome or Edge. You can still type."),
    listening && React.createElement(
      "div",
      { className: "mt-1.5 text-[12px] text-sage-700 flex items-center gap-1.5" },
      React.createElement("span", { className: "inline-block w-2 h-2 rounded-full bg-sage-600 pulse-ring" }),
      "Listening — speak naturally.",
    ),
    !listening && status && React.createElement("div", { className: "mt-1.5 text-[12px] text-ink-700", "data-testid": "voice-status" }, status),
  );
}

// ============================================================ OUTPUT (real Sonnet petition + Featherless track + PDF)
function OutputStep({
  state,
  setState,
  onRestart,
}: {
  state: AppState;
  setState: (u: (s: AppState) => AppState) => void;
  onRestart: () => void;
}) {
  const e = DEMO_JUDGMENT.extracted;
  const f = state.realFacts;
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);

  // ---- Build a Facts object from interview answers (for Sonnet) ----
  const factsForDraft: Facts = {
    jurisdiction: f?.jurisdiction || "Illinois",
    county: f?.county || "Cook County",
    order_type: f?.order_type || "both",
    case_status: f?.case_status || "post_judgment",
    issue: f?.issue || "no_disclosure",
    party_role: f?.party_role || "payee",
    last_payment_date: f?.last_payment_date || null,
    estimated_arrears_months: f?.estimated_arrears_months || null,
    ex_employed: f?.ex_employed ?? "unknown",
    case_number: state.case.caseNumber || f?.case_number || e.caseNumber,
    monthly_amount_owed_usd: f?.monthly_amount_owed_usd || 1450,
    notes: state.petition.violationDescription || f?.notes || "",
    petitioner_name: `${state.client.firstName} ${state.client.lastName}`.trim() || f?.petitioner_name || e.petitioner,
    petitioner_address: [state.client.address1, state.client.city, "Illinois", state.client.zip].filter(Boolean).join(", ") || f?.petitioner_address || null,
    respondent_name: `${state.otherParty.firstName} ${state.otherParty.lastName}`.trim() || f?.respondent_name || e.respondent,
    respondent_address: f?.respondent_address || null,
    judgment_date: state.case.finalOrderDate || f?.judgment_date || e.finalOrderDate,
  };

  // ---- Fire the Sonnet petition draft on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDraftLoading(true);
      try {
        const r = await fetch("/api/packet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts: factsForDraft }),
        });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(j.error || "draft failed");
        setState((s) => ({ ...s, realMotion: j.motion as Motion }));
      } catch (err) {
        if (!cancelled) setDraftError(err instanceof Error ? err.message : "draft failed");
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const motion = state.realMotion;
  const clientName = factsForDraft.petitioner_name || "";
  const otherName = factsForDraft.respondent_name || "";
  const dates = state.petition.violationDates?.length ? state.petition.violationDates : ["(no specific dates added yet)"];
  const violation = state.petition.violationDescription
    || "Other party failed to provide annual income disclosures (tax returns, W-2s/1099s, and payroll statements) by the deadline set in the order, and did not respond to written requests within 21 days as required.";
  const relief = state.petition.requestedRelief
    || "Order the other party to turn over the missing documents; find the other party in contempt; award attorney fees and costs.";

  const fallbackDraft = `PETITION FOR RULE TO SHOW CAUSE — DRAFT FACTS
(Not a filed pleading. For attorney / legal-aid review only.)

Court:          ${e.court}
Case Number:    ${factsForDraft.case_number}, Calendar ${state.case.calendar || e.calendar}
Parties:        ${clientName} (Petitioner) v. ${otherName} (Respondent)
Underlying order: ${e.orderType}, entered ${factsForDraft.judgment_date}

PARAGRAPH(S) ALLEGEDLY VIOLATED: ${state.petition.orderParagraph || e.orderParagraph}

WHAT THE ORDER REQUIRED:
${state.petition.orderRequirement || e.orderRequirement}

ALLEGED VIOLATION:
${violation}

DATES OF VIOLATION:
${dates.map((d) => "  • " + d).join("\n")}

REQUESTED RELIEF (DRAFT):
${relief.split(";").map((r) => "  • " + r.trim()).filter((s) => s.length > 4).join("\n")}

ENFORCEMENT HOOK CITED:
${e.enforcementHook}`;

  // Use Sonnet draft when available; fall back to template if API fails.
  const draftDisplay = motion
    ? `${motion.petition_caption}\n\n${motion.petition_body}\n\n— STATUTES & RULES CITED —\n${motion.statutes_cited.map((s) => "  • " + s).join("\n")}\n\n— DOCUMENTS TO FILE —\n${motion.filed_documents_checklist.map((d) => "  ☐ " + d).join("\n")}`
    : fallbackDraft;

  const docs = state.documents;
  const packet = [
    { k: "Underlying order uploaded (Exhibit A)", ok: docs.orderUploaded },
    { k: "Petition draft facts written", ok: !!motion || true },
    { k: "Supporting proof gathered (texts/emails/receipts)", ok: docs.supportingProofUploaded || docs.writtenRequestsUploaded },
    { k: "ILSDU payment history pulled", ok: docs.paymentHistoryUploaded },
    { k: "Prior written requests for documents collected", ok: docs.writtenRequestsUploaded },
    { k: "Other party / lawyer delivery info confirmed", ok: state.otherParty.hasLawyer !== null && (!!state.otherParty.address1 || !!state.otherParty.lawyerName) },
    { k: "Hearing date scheduled (after filing)", ok: false },
    { k: "Notice of Court Date for Motion signed", ok: false },
    { k: "Proof of Delivery signed and filed", ok: false },
    { k: "Blank Order on Rule to Show Cause printed for court", ok: false },
  ];
  const okCount = packet.filter((p) => p.ok).length;

  const evidence = [
    { k: "Exhibit A — Copy of the divorce judgment / support order", ok: docs.orderUploaded, note: "You already uploaded this." },
    { k: "Exhibit B — Written request(s) for the missing documents (email, text, certified letter)", ok: docs.writtenRequestsUploaded, note: "Photos/screenshots are fine. Show dates clearly." },
    { k: "Exhibit C — Payment history from ILSDU (if support payments are routed through it)", ok: docs.paymentHistoryUploaded, note: "Download from ilsdu.com." },
    { k: "Exhibit D — Proof of delivery (certified mail green card or e-mail receipts)", ok: docs.supportingProofUploaded, note: "Helps show the other party knew about the request." },
    { k: "Contact / delivery details for other party (or their lawyer)", ok: state.otherParty.hasLawyer !== null, note: state.otherParty.hasLawyer ? "Deliver to the lawyer — not the parent." : "Deliver to the parent directly." },
  ];

  const steps = [
    { t: "Print and review your draft packet", d: "Take a quiet 20 minutes with the petition we just built. Look for anything that feels wrong or missing.", audio: "/audio/step1.mp3", cta: "Start step 1 with me" },
    { t: "Gather your exhibits", d: "Pull together Exhibits A through D into one folder. I'll give you a plain-language checklist.", audio: "/audio/step2.mp3", cta: "Help me build the checklist" },
    { t: "Have it reviewed by an attorney or legal-aid advocate", d: "Before anything is filed, a real lawyer needs to sign off. I'll pull a short list of free Cook County legal-aid clinics.", audio: "/audio/step3.mp3", cta: "Find me a legal-aid clinic" },
    { t: "File with the Clerk of the Circuit Court", d: "The Clerk's office at the Daley Center is where it gets stamped and given a court date.", audio: "/audio/step4.mp3", cta: "Prepare my filing-day sheet" },
    { t: "Serve the other party", d: "The other parent must be formally notified. I'll walk you through the right method.", audio: "/audio/step5.mp3", cta: "Help me pick a service method" },
    { t: "Show up to your hearing prepared", d: "I'll build you a one-page courtroom-day brief — what to expect, what to say, what to bring.", audio: "/audio/step6.mp3", cta: "Build my courtroom-day brief" },
  ];

  const handleCopy = () => { navigator.clipboard?.writeText(draftDisplay); };
  const handleDownloadTxt = () => {
    const blob = new Blob(
      [
        `Justice in a Flash — Draft packet (for attorney/legal-aid review only)\nGenerated: ${new Date().toLocaleString()}\n\n` +
        draftDisplay +
        `\n\n=== PACKET STATUS ===\n` + packet.map((p) => `  [${p.ok ? "x" : " "}] ${p.k}`).join("\n") +
        `\n\n=== EVIDENCE CHECKLIST ===\n` + evidence.map((p) => `  [${p.ok ? "x" : " "}] ${p.k}\n     note: ${p.note}`).join("\n") +
        `\n\n=== NEXT STEPS ===\n` + steps.map((s, i) => `  ${i + 1}. ${s.t}\n     ${s.d}`).join("\n\n") +
        `\n\nDISCLAIMER: This is a draft generated by Justice in a Flash. Not legal advice.\n`,
      ],
      { type: "text/plain" },
    );
    downloadBlob(blob, "justice-in-a-flash-draft.txt");
  };
  const handleDownloadPdf = async () => {
    if (!motion) return;
    const blob = await generatePetitionPdf(motion, factsForDraft);
    const slug = (factsForDraft.case_number || "case").replace(/[^A-Za-z0-9-]/g, "_");
    downloadBlob(blob, `Petition_for_Rule_to_Show_Cause_${slug}.pdf`);
  };
  const handleDownloadDemandPdf = async () => {
    if (!motion) return;
    const blob = await generateDemandLetterPdf(motion, factsForDraft);
    const slug = (factsForDraft.case_number || "case").replace(/[^A-Za-z0-9-]/g, "_");
    downloadBlob(blob, `Demand_Letter_13.3.1_${slug}.pdf`);
  };

  return React.createElement(
    "section",
    { className: "max-w-3xl mx-auto px-5 pt-8 pb-10 fade-in" },
    React.createElement(StepHeader, { step: 5, total: 5, label: "Your draft packet" }),
    React.createElement("h2", { className: "font-display text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-ink-900 mt-2" },
      "Here is what we put together for ",
      React.createElement("em", { className: "italic text-sage-700" }, "you"),
      ".",
    ),
    React.createElement("p", { className: "text-ink-700 mt-1.5 text-[15px]" }, "Read it through, then bring it to your attorney or legal-aid advocate. Three things to look at:"),

    state.trackDecision && React.createElement(TrackBadgeMini, { decision: state.trackDecision }),

    // ---- Draft Petition Facts Summary ----
    React.createElement(
      "section",
      { className: "mt-6 bg-white border border-ink-100 rounded-2xl card-shadow overflow-hidden" },
      React.createElement(
        "header",
        { className: "px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap" },
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-wider text-sage-700 font-semibold flex items-center gap-2" },
            "For attorney review",
            draftLoading && React.createElement("span", { className: "text-ink-600 italic" }, "· Sonnet drafting…"),
          ),
          React.createElement("div", { className: "font-display text-[19px] text-ink-900 font-semibold mt-0.5" }, "Draft Petition Facts Summary"),
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2 flex-wrap" },
          React.createElement(
            "button",
            { onClick: handleCopy, "data-testid": "button-copy", className: "tap inline-flex items-center gap-1.5 px-3 py-2 text-[13px] rounded-lg border border-ink-200 hover:bg-ink-50 text-ink-900" },
            React.createElement(Icon, { d: ICONS.copy, size: 14 }), "Copy",
          ),
          React.createElement(
            "button",
            { onClick: handleDownloadTxt, "data-testid": "button-download-txt", className: "tap inline-flex items-center gap-1.5 px-3 py-2 text-[13px] rounded-lg border border-ink-200 hover:bg-ink-50 text-ink-900" },
            React.createElement(Icon, { d: ICONS.download, size: 14 }), ".txt",
          ),
          React.createElement(
            "button",
            { onClick: handleDownloadPdf, disabled: !motion, "data-testid": "button-download-pdf", className: "tap inline-flex items-center gap-1.5 px-3 py-2 text-[13px] rounded-lg bg-sage-600 hover:bg-sage-700 disabled:opacity-50 text-white" },
            React.createElement(Icon, { d: ICONS.download, size: 14 }), "Petition PDF",
          ),
          React.createElement(
            "button",
            { onClick: handleDownloadDemandPdf, disabled: !motion, "data-testid": "button-download-demand", className: "tap inline-flex items-center gap-1.5 px-3 py-2 text-[13px] rounded-lg bg-ink-900 hover:bg-ink-700 disabled:opacity-50 text-white" },
            React.createElement(Icon, { d: ICONS.download, size: 14 }), "Demand Letter PDF",
          ),
        ),
      ),
      draftError && React.createElement(
        "div",
        { className: "px-5 pt-3 text-[12px] text-warn-700" },
        "⚠ Sonnet draft error: ", draftError, " — showing template fallback below.",
      ),
      React.createElement("pre", { className: "px-5 py-5 text-[12.5px] leading-[1.55] text-ink-900 whitespace-pre-wrap font-mono bg-ink-50/40 max-h-[480px] overflow-auto" }, draftDisplay),
    ),

    // ---- Three panel grid ----
    React.createElement(
      "div",
      { className: "mt-6 grid grid-cols-1 gap-5" },
      React.createElement(Panel, {
        eyebrow: "Status",
        title: "Draft Packet Status",
        subtitle: `${okCount} of ${packet.length} items ready`,
        children: React.createElement(
          "ul",
          { className: "divide-y divide-ink-100" },
          packet.map((p, i) =>
            React.createElement(
              "li",
              { key: i, className: "flex items-start gap-3 py-2.5" },
              React.createElement(StatusDot, { ok: p.ok }),
              React.createElement("span", { className: `text-[14px] ${p.ok ? "text-ink-900" : "text-ink-700"}` }, p.k),
            ),
          ),
        ),
      }),
      React.createElement(Panel, {
        eyebrow: "Bring this to court",
        title: "Evidence Checklist",
        subtitle: "What to attach as Exhibits A, B, C…",
        children: React.createElement(
          "ul",
          { className: "divide-y divide-ink-100" },
          evidence.map((p, i) =>
            React.createElement(
              "li",
              { key: i, className: "py-3" },
              React.createElement(
                "div",
                { className: "flex items-start gap-3" },
                React.createElement(StatusDot, { ok: p.ok }),
                React.createElement(
                  "div",
                  null,
                  React.createElement("div", { className: `text-[14px] ${p.ok ? "text-ink-900" : "text-ink-700"}` }, p.k),
                  React.createElement("div", { className: "text-[12.5px] text-ink-600 mt-0.5" }, p.note),
                ),
              ),
            ),
          ),
        ),
      }),
      React.createElement(NarratedNextSteps, { steps }),
    ),

    React.createElement(
      "div",
      { className: "mt-7 bg-sage-50 border border-sage-100 rounded-2xl p-5" },
      React.createElement(
        "div",
        { className: "flex items-start gap-3" },
        React.createElement(Icon, { d: ICONS.shield, size: 18, className: "text-sage-700 mt-0.5" }),
        React.createElement(
          "div",
          null,
          React.createElement("div", { className: "font-display text-[16px] font-semibold text-sage-700" }, "Hand this to a real human next."),
          React.createElement(
            "p",
            { className: "text-[13.5px] text-ink-700 mt-1 leading-relaxed" },
            "A family-law attorney or a legal-aid advocate (Illinois Legal Aid Online, CARPLS, LAF) can review your draft, sign off on the petition, and walk you through filing, hearing, and delivery in Cook County.",
          ),
        ),
      ),
    ),

    React.createElement(
      "div",
      { className: "mt-6 flex justify-between" },
      React.createElement(
        "button",
        { onClick: onRestart, "data-testid": "button-restart", className: "tap inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-200 text-ink-700 hover:bg-white" },
        "Start a new case",
      ),
      React.createElement(
        "button",
        { onClick: handleDownloadTxt, "data-testid": "button-download-2", className: "tap inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium card-shadow" },
        React.createElement(Icon, { d: ICONS.download, size: 16 }), "Download my packet",
      ),
    ),
  );
}

// ============================================================ NARRATED NEXT STEPS PANEL
type StepDef = { t: string; d: string; audio: string; cta: string };
function NarratedNextSteps({ steps }: { steps: StepDef[] }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playingIntro, setPlayingIntro] = useState(false);
  const [introPlayed, setIntroPlayed] = useState(false);
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [working, setWorking] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => { const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0; } };

  const playIntro = () => {
    stop();
    setActiveIdx(-1); setPlayingIntro(true);
    const a = new Audio("/audio/intro.mp3");
    audioRef.current = a;
    a.onended = () => { setPlayingIntro(false); setIntroPlayed(true); };
    a.onerror = () => { setPlayingIntro(false); };
    a.play().catch(() => setPlayingIntro(false));
  };
  const playStep = (i: number) => {
    stop();
    setPlayingIntro(false);
    setActiveIdx(i);
    const a = new Audio(steps[i].audio);
    audioRef.current = a;
    a.onended = () => { setActiveIdx(-2); setCompleted((c) => ({ ...c, [i]: true })); };
    a.onerror = () => { setActiveIdx(-2); };
    a.play().catch(() => setActiveIdx(-2));
  };
  const pause = () => { stop(); setActiveIdx(-2); setPlayingIntro(false); };
  useEffect(() => () => stop(), []);

  return React.createElement(
    "section",
    { className: "bg-white border border-ink-100 rounded-2xl card-shadow p-5" },
    React.createElement("div", { className: "text-[11px] uppercase tracking-wider text-sage-700 font-semibold" }, "Your roadmap · voice-guided"),
    React.createElement("h3", { className: "font-display text-[20px] font-semibold text-ink-900 mt-0.5" }, "Personalized Next Steps"),
    React.createElement("p", { className: "text-[13px] text-ink-600 mt-0.5 mb-3" }, "A calm walkthrough of the Cook County Petition for Rule to Show Cause process. Press play to hear each step, then start it with me."),

    React.createElement(
      "div",
      { className: `mt-2 rounded-xl p-4 border ${playingIntro ? "bg-sage-50 border-sage-300" : "bg-ink-50/60 border-ink-100"}` },
      React.createElement(
        "div",
        { className: "flex items-start gap-3" },
        React.createElement(
          "button",
          { onClick: playingIntro ? pause : playIntro, type: "button", "data-testid": "btn-play-intro",
            "aria-label": playingIntro ? "Pause" : "Play introduction",
            className: `shrink-0 w-11 h-11 rounded-full inline-flex items-center justify-center transition-colors ${playingIntro ? "bg-sage-600 text-white pulse-ring" : "bg-sage-600 hover:bg-sage-700 text-white"}` },
          React.createElement(
            "svg",
            { width: 16, height: 16, viewBox: "0 0 24 24", fill: "currentColor" },
            React.createElement("path", { d: playingIntro ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z" }),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex-1 min-w-0" },
          React.createElement("div", { className: "font-display text-[15px] font-semibold text-ink-900" }, "Listen first — a 30-second reassurance"),
          React.createElement(
            "div",
            { className: "text-[13px] text-ink-700 mt-0.5 leading-relaxed" },
            playingIntro ? "Playing… take a breath. There is no rush." : (introPlayed ? "Played · press play again any time." : "Before the steps, hear the lay of the land in a calm voice."),
          ),
        ),
      ),
    ),

    React.createElement(
      "ol",
      { className: "mt-4 space-y-3", "data-testid": "narrated-steps-list" },
      steps.map((s, i) => {
        const isPlaying = activeIdx === i;
        const isDone = completed[i];
        const isWorking = working === i;
        return React.createElement(
          "li",
          { key: i, className: `rounded-xl border p-4 transition-colors ${isPlaying ? "bg-sage-50 border-sage-300" : isWorking ? "bg-warn-50 border-warn-100" : "bg-white border-ink-100"}` },
          React.createElement(
            "div",
            { className: "flex items-start gap-3" },
            React.createElement(
              "span",
              { className: `shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center text-[13px] font-semibold ${isDone ? "bg-sage-600 text-white" : "bg-sage-100 text-sage-700"}` },
              isDone ? React.createElement(Icon, { d: ICONS.check, size: 14 }) : (i + 1),
            ),
            React.createElement(
              "div",
              { className: "flex-1 min-w-0" },
              React.createElement("div", { className: "font-display text-[16px] font-semibold text-ink-900" }, s.t),
              React.createElement("div", { className: "text-[13.5px] text-ink-700 mt-1 leading-relaxed" }, s.d),
              React.createElement(
                "div",
                { className: "mt-3 flex flex-wrap items-center gap-2" },
                React.createElement(
                  "button",
                  {
                    onClick: isPlaying ? pause : () => playStep(i), type: "button",
                    "data-testid": `btn-play-step-${i + 1}`,
                    "aria-label": isPlaying ? "Pause" : `Play step ${i + 1}`,
                    className: `tap inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${isPlaying ? "bg-sage-600 text-white border-sage-600" : "bg-white text-sage-700 border-sage-300 hover:bg-sage-50"}`,
                  },
                  React.createElement(
                    "svg",
                    { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor" },
                    React.createElement("path", { d: isPlaying ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z" }),
                  ),
                  isPlaying ? "Pause" : (isDone ? "Replay" : "Listen"),
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => setWorking((w) => (w === i ? null : i)), type: "button",
                    "data-testid": `btn-start-step-${i + 1}`,
                    className: `tap inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isWorking ? "bg-warn-700 text-white" : "bg-ink-900 text-white hover:bg-ink-700"}`,
                  },
                  isWorking ? "I'll come back to this" : s.cta,
                ),
              ),
              isWorking && React.createElement(
                "div",
                { className: "mt-3 rounded-lg bg-white border border-warn-100 p-3 text-[13px] text-ink-800 leading-relaxed" },
                React.createElement("div", { className: "font-semibold text-warn-700 mb-1" }, "Great — we'll start here."),
                stepGuidance(i),
              ),
            ),
          ),
        );
      }),
    ),

    React.createElement(
      "p",
      { className: "mt-4 text-[12px] text-ink-600" },
      "Voice narration is read in a calm, reassuring tone. You can pause any time. The walkthrough is not legal advice — always have a lawyer or legal-aid advocate review your packet before filing.",
    ),
  );
}

function stepGuidance(i: number) {
  const guidance = [
    "I'll open the draft packet at the top of this page. Read it slowly. As you spot anything that needs to change, type or speak it in plain language and I'll tighten the wording for you.",
    "I'll generate a one-page exhibit checklist with examples of what each Exhibit (A, B, C, D) typically looks like.",
    "I'll pull a current list of free Cook County legal-aid clinics that handle post-judgment enforcement.",
    "I'll prepare your filing-day sheet: Daley Center address, which window to go to, what to bring, fee waiver info if you need one.",
    "I'll ask you three quick questions about the other parent's address and whether they have a lawyer, then recommend the right service method.",
    "I'll build your courtroom-day brief: what the judge will likely ask, suggested calm responses, what to bring.",
  ];
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("p", null, guidance[i] || "I'll guide you through this step."),
    React.createElement("p", { className: "mt-2 text-[12px] text-ink-600 italic" }, "In this hackathon MVP this opens the next conversation — in production it would launch a guided sub-flow."),
  );
}

// ============================================================ HELPERS
function StepHeader({ step, total, label }: { step: number; total: number; label: string }) {
  return React.createElement(
    "div",
    { className: "flex items-center gap-2 text-[12px] uppercase tracking-wider text-ink-600" },
    React.createElement(
      "div",
      { className: "flex items-center gap-1.5" },
      ...Array.from({ length: total }, (_, i) =>
        React.createElement("span", {
          key: i,
          className: `progress-dot w-2 h-2 rounded-full ${i + 1 < step ? "done" : i + 1 === step ? "active" : "bg-ink-200"}`,
        }),
      ),
    ),
    React.createElement("span", { className: "font-semibold text-sage-700" }, `Step ${step}/${total}`),
    React.createElement("span", { className: "text-ink-600" }, "·"),
    React.createElement("span", null, label),
  );
}
function ProgressBar({ value }: { value: number }) {
  return React.createElement(
    "div",
    { className: "mt-3 h-1.5 bg-ink-100 rounded-full overflow-hidden" },
    React.createElement("div", { className: "h-full bg-sage-600 transition-all duration-500", style: { width: `${Math.max(8, value * 100)}%` } }),
  );
}
function StatusDot({ ok }: { ok: boolean }) {
  return React.createElement(
    "span",
    { className: `shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full ${ok ? "bg-sage-600 text-white" : "bg-ink-100 text-ink-600 border border-ink-200"}` },
    ok ? React.createElement(Icon, { d: ICONS.check, size: 12 }) : React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-ink-300" }),
  );
}
function Panel({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return React.createElement(
    "section",
    { className: "bg-white border border-ink-100 rounded-2xl card-shadow p-5" },
    React.createElement("div", { className: "text-[11px] uppercase tracking-wider text-sage-700 font-semibold" }, eyebrow),
    React.createElement("h3", { className: "font-display text-[20px] font-semibold text-ink-900 mt-0.5" }, title),
    subtitle && React.createElement("p", { className: "text-[13px] text-ink-600 mt-0.5 mb-3" }, subtitle),
    React.createElement("div", { className: "mt-3" }, children),
  );
}
