// SHARED CANONICAL DEMO CASE
// All three workstreams (voice, drafter, roleplay) read from this so the demo is deterministic.
// Lock this file. Don't edit during the build.

export type Facts = {
  jurisdiction: string;
  county: string;
  order_type: "child_support" | "maintenance" | "both" | "unknown";
  case_status: "post_judgment" | "pre_judgment" | "no_order_yet";
  issue: "non_payment" | "income_change" | "no_disclosure" | "modification";
  party_role: "payor" | "payee";
  last_payment_date: string | null;
  estimated_arrears_months: number | null;
  ex_employed: boolean | "unknown";
  case_number: string | null;
  monthly_amount_owed_usd: number | null;
  notes?: string;
};

export const MARIA: Facts = {
  jurisdiction: "Illinois",
  county: "Cook County",
  order_type: "maintenance",
  case_status: "post_judgment",
  issue: "no_disclosure",
  party_role: "payee",
  last_payment_date: "2024-11-15",
  estimated_arrears_months: 18,
  ex_employed: true,
  case_number: "2022-D-001234",
  monthly_amount_owed_usd: 1450,
  notes:
    "Ex switched from W-2 to 1099 contractor work in 2024. Has not produced tax returns. Believes income materially increased.",
};

export const MARIA_TRANSCRIPT = `Hi, my name is Maria, I'm in Cook County. My ex and I divorced in 2022.
The court ordered him to pay me fourteen fifty a month in maintenance. He stopped sending the
full amount about eighteen months ago — last full payment was November 2024. I think his income
went up because he switched from regular employment to contracting in 2024, but he refuses to
share his tax returns or any income records. I can't afford a lawyer. I just need to know what
to do.`;
