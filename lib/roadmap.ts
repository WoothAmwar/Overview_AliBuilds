// Personalized action roadmap derived from extracted Facts.
// Pure client-side — no LLM call. Deterministic, instant, demo-stable.
// The 6-step "Next Steps" map directly to the Cook County Petition for Rule
// to Show Cause Instructions (in /content/Instructions.pdf).
import type { Facts } from "./demo-case";

export type DraftField = {
  label: string;
  value: string | null;
  complete: boolean;
  note?: string;
};

export type DraftStatus = {
  petition: DraftField[];
  notice: DraftField[];
  proof: DraftField[];
  completionPct: number;
};

export type NextStep = {
  n: number;
  title: string;
  body: string;
  detail?: string;
  state: "ready" | "after_filing" | "after_hearing";
};

export type EvidenceItem = {
  label: string;
  required: boolean;
  status: "have" | "needed" | "optional";
  note?: string;
};

export type Roadmap = {
  status: DraftStatus;
  nextSteps: NextStep[];
  evidence: EvidenceItem[];
};

export function buildRoadmap(facts: Facts): Roadmap {
  const orderTypeLabel =
    facts.order_type === "both"
      ? "maintenance + child support"
      : facts.order_type === "maintenance"
        ? "maintenance"
        : facts.order_type === "child_support"
          ? "child support"
          : "support";

  const monthlyStr = facts.monthly_amount_owed_usd
    ? `$${facts.monthly_amount_owed_usd.toLocaleString()}/month`
    : "amount on order";

  const arrearsStr =
    facts.estimated_arrears_months && facts.monthly_amount_owed_usd
      ? `~$${(facts.estimated_arrears_months * facts.monthly_amount_owed_usd).toLocaleString()} (≈${facts.estimated_arrears_months} months)`
      : null;

  // ───── Section 1: Draft packet status ─────
  const petitionerCombined =
    facts.petitioner_name && facts.petitioner_address
      ? `${facts.petitioner_name} · ${facts.petitioner_address}`
      : facts.petitioner_name || facts.petitioner_address || null;
  const respondentCombined =
    facts.respondent_name && facts.respondent_address
      ? `${facts.respondent_name} · ${facts.respondent_address}`
      : facts.respondent_name || facts.respondent_address || null;

  const petition: DraftField[] = [
    { label: "Court (county / division)", value: `${facts.county}, ${facts.jurisdiction}`, complete: facts.county !== "unknown" },
    { label: "Case number", value: facts.case_number, complete: !!facts.case_number },
    { label: "Order type", value: orderTypeLabel, complete: facts.order_type !== "unknown" },
    { label: "Monthly obligation", value: facts.monthly_amount_owed_usd ? `$${facts.monthly_amount_owed_usd}/mo` : null, complete: !!facts.monthly_amount_owed_usd },
    { label: "Petitioner full name + address", value: petitionerCombined, complete: !!(facts.petitioner_name && facts.petitioner_address), note: !!(facts.petitioner_name && facts.petitioner_address) ? undefined : "Add in interview / sign on filing" },
    { label: "Respondent full name + last known address", value: respondentCombined, complete: !!(facts.respondent_name && facts.respondent_address), note: !!(facts.respondent_name && facts.respondent_address) ? undefined : "Add in interview / required for service" },
    { label: "Date of original judgment / order", value: facts.judgment_date ?? null, complete: !!facts.judgment_date, note: facts.judgment_date ? undefined : "Add in interview" },
    { label: "Date of last full payment", value: facts.last_payment_date, complete: !!facts.last_payment_date, note: facts.last_payment_date ? undefined : "Pull from ILSDU history at ilsdu.com" },
    { label: "Arrears total", value: arrearsStr, complete: !!arrearsStr, note: arrearsStr ? undefined : "Compute once last payment date is confirmed" },
  ];

  const notice: DraftField[] = [
    { label: "Hearing date + time", value: null, complete: false, note: "Filled after clerk schedules" },
    { label: "Courtroom number", value: null, complete: false, note: "Filled after clerk schedules" },
    { label: "Courthouse address", value: null, complete: false, note: "Filled after clerk schedules" },
    { label: "Petitioner signature", value: null, complete: false, note: "Sign before filing" },
  ];

  const proof: DraftField[] = [
    { label: "Method of delivery (Certified Mail w/ green card recommended)", value: null, complete: false, note: "Filled after delivery" },
    { label: "Date + time of delivery (by 5:00 PM)", value: null, complete: false, note: "Filled after delivery" },
    { label: "Petitioner signature", value: null, complete: false, note: "Sign after delivery" },
  ];

  const allFields = [...petition, ...notice, ...proof];
  const completionPct = Math.round((allFields.filter((f) => f.complete).length / allFields.length) * 100);

  // ───── Section 2: Personalized next steps (6 steps from Instructions.pdf) ─────
  const nextSteps: NextStep[] = [
    {
      n: 1,
      state: "ready",
      title: "Prepare your forms",
      body: `Sign the Petition on pages 2 and 3. Attach a copy of your ${orderTypeLabel} order as Exhibit A. Attach your payment history (download from ilsdu.com if your payments go through ILSDU) as Exhibit B.`,
      detail: facts.estimated_arrears_months ? `Bring a one-page chart: month / amount due / amount received / shortfall, totaled at ${arrearsStr}.` : "Bring a one-page chart: month / amount due / amount received / shortfall.",
    },
    {
      n: 2,
      state: "ready",
      title: "File with the Cook County Clerk",
      body: "Most Cook County matters require e-filing through Odyssey eFileIL. If you can't afford the fee, apply for a Fee Waiver (illinoislegalaid.org/legal-information/fee-waiver) BEFORE filing — attach the waiver to the same submission.",
      detail: "There's no minimum waiting period — but waiting at least 30 days from the original order makes enforcement easier per the Instructions.",
    },
    {
      n: 3,
      state: "after_filing",
      title: "Schedule your hearing",
      body: "Once filed, the e-filing system or the clerk will assign or let you pick a court date. Add the hearing date, time, courtroom number, and courthouse address to your Notice of Court Date for Motion.",
      detail: "Cook County Domestic Relations is at the Daley Center, 50 W. Washington, Chicago. Courtroom assignments come from the clerk.",
    },
    {
      n: 4,
      state: "after_filing",
      title: "Deliver to the other party",
      body: "Deliver a file-stamped copy of your Petition (with all Exhibits), the Notice of Court Date, and the Proof of Delivery to the respondent (or their lawyer if they have one) by 5:00 PM on your delivery date.",
      detail: "Use Certified Mail with Return Receipt Requested (the green card). The signed receipt is your proof the respondent knew about the hearing.",
    },
    {
      n: 5,
      state: "after_hearing",
      title: "Attend the petition hearing",
      body: "Bring copies of every document you delivered, plus a blank Order on Rule to Show Cause for the judge to sign if granted.",
      detail: "If the respondent doesn't show up but the judge believes they were properly served, the judge can issue a body attachment (warrant). If they show up but don't have a lawyer, expect the judge to give them one continuance to find one.",
    },
    {
      n: 6,
      state: "after_hearing",
      title: "Return for the rule (compliance) hearing",
      body: "If the respondent paid in full, the contempt finding is purged. If not, the judge can order jail until they comply, or order alternative remedies (job-search diary, license suspension, etc.).",
      detail: "Bring updated payment records to every return date. Keep a tight paper trail.",
    },
  ];

  // ───── Section 3: Evidence checklist ─────
  const evidence: EvidenceItem[] = [
    { label: "Original order or judgment (Exhibit A)", required: true, status: "have", note: "✓ Auto-attached from your uploaded decree" },
    { label: "Payment history — ILSDU printout, bank statements, or both (Exhibit B)", required: true, status: facts.last_payment_date ? "have" : "needed", note: facts.last_payment_date ? "✓ Last payment date captured" : "Pull from ilsdu.com (if payments go through ILSDU) or your bank statements" },
    { label: "Prior written demand to respondent (Exhibit C, optional but strong)", required: false, status: "optional", note: "Auto-drafted as the 13.3.1 demand letter — send Certified Mail before filing if possible" },
    { label: "Petitioner's verified Financial Affidavit (IL Supreme Court statewide form)", required: true, status: "needed", note: "Required for any post-judgment proceeding involving support" },
    { label: "Cook County Disclosure Statement (CCDR0022)", required: true, status: "needed", note: "Cook County local rule" },
    { label: "Respondent's full legal name + last known address", required: true, status: "needed", note: "Required for service of process" },
    { label: "Communication records (texts/emails refusing to pay or disclose)", required: false, status: "optional", note: "Strong supporting evidence if you have it" },
    { label: "Job-status info — employer name, suspected income source", required: false, status: facts.ex_employed === true ? "have" : "needed", note: facts.ex_employed === true ? "✓ Employment status known" : "Helpful for income-withholding requests" },
  ];

  return { status: { petition, notice, proof, completionPct }, nextSteps, evidence };
}
