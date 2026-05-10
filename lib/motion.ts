import { anthropic, MODELS, extractJson } from "./clients";
import { MOTION_SYSTEM } from "./prompts";
import type { Facts } from "./demo-case";

export type Motion = {
  petition_caption: string;
  petition_body: string;
  demand_letter: string;
  filed_documents_checklist: string[];
  statutes_cited: string[];
};

const MOCK_MOTION: Motion = {
  petition_caption: `IN THE CIRCUIT COURT OF COOK COUNTY, ILLINOIS
COUNTY DEPARTMENT — DOMESTIC RELATIONS DIVISION

IN RE THE MARRIAGE OF
MARIA [LAST NAME],
   Petitioner,
and                                Case No. 2022-D-001234
[RESPONDENT NAME],
   Respondent.

PETITION FOR RULE TO SHOW CAUSE`,
  petition_body: `NOW COMES Petitioner, MARIA [LAST NAME], appearing pro se, and respectfully petitions
this Honorable Court to issue a Rule to Show Cause against Respondent, and in support thereof
states as follows:

1. On or about [Judgment Date], this Court entered a Judgment for Dissolution of Marriage
   ordering Respondent to pay Petitioner maintenance pursuant to 750 ILCS 5/504 in the
   amount of $1,450 per month.

2. Respondent has failed to pay the full maintenance amount since on or about November 15,
   2024, resulting in approximately 18 months of arrears at the time of this filing.

3. Pursuant to Cook County Local Rule 13.3.1, Respondent is required to exchange a completed
   Financial Affidavit, the last two years of federal and state income tax returns, and recent
   pay stubs (or, where applicable, 1099 documentation and year-to-date earnings) prior to any
   hearing involving maintenance. Respondent has failed to comply with this disclosure
   obligation despite Petitioner's request.

4. Petitioner is informed and believes that Respondent's income has materially increased since
   the entry of the original maintenance order, and that Respondent has transitioned from
   W-2 employment to self-employment in 2024, but has refused to produce documentation.

WHEREFORE, Petitioner respectfully requests that this Honorable Court enter a Rule to Show
Cause directing Respondent to appear and demonstrate why he should not be held in indirect
civil contempt for non-payment of maintenance, and for sanctions under Illinois Supreme Court
Rule 219(c) for non-compliance with mandatory financial disclosure.

Respectfully submitted,

____________________________
MARIA [LAST NAME], Pro Se

⚠ FOR REVIEW BY A LICENSED ATTORNEY OR LEGAL-AID ORG BEFORE FILING.`,
  demand_letter: `Dear [Counsel for Respondent / Respondent],

Pursuant to Cook County Local Rule 13.3.1, please produce within fourteen (14) days the
following financial documentation, which you are required to exchange in any post-judgment
proceeding involving maintenance or support:

  (a) The last two (2) calendar years of filed federal and state individual income tax
      returns, including all schedules, W-2s, 1099s, and K-1s;
  (b) Year-to-date pay stubs (or, if self-employed, year-to-date 1099 records, profit-and-loss
      statements, and bank deposits);
  (c) A completed and verified Financial Affidavit on the Illinois Supreme Court approved
      statewide form.

Failure to comply may result in a motion to compel and a request for sanctions under Illinois
Supreme Court Rule 219(c), including but not limited to an award of attorney's fees and costs.

Sincerely,
Maria [Last Name], Pro Se

⚠ FOR REVIEW BY A LICENSED ATTORNEY OR LEGAL-AID ORG BEFORE FILING.`,
  filed_documents_checklist: [
    "Petition for Rule to Show Cause",
    "Notice of Motion (with hearing date)",
    "Petitioner's Financial Affidavit (Illinois Supreme Court approved form)",
    "Cook County Disclosure Statement (CCDR0022)",
    "Affidavit of Service",
    "Proposed Order (Rule to Show Cause)",
  ],
  statutes_cited: [
    "750 ILCS 5/504 (Maintenance)",
    "Cook County Local Rule 13.3.1 (Financial Disclosure)",
    "Illinois Supreme Court Rule 219(c) (Discovery Sanctions)",
    "Illinois Supreme Court Rule 137 (Pleadings)",
  ],
};

export async function draftMotion(
  facts: Facts,
): Promise<{ motion: Motion; mocked: boolean }> {
  const client = anthropic();
  if (!client) {
    return { motion: MOCK_MOTION, mocked: true };
  }
  const msg = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 4096,
    system: MOTION_SYSTEM,
    messages: [
      { role: "user", content: `Case facts:\n${JSON.stringify(facts, null, 2)}\n\nDraft the packet now.` },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  return { motion: extractJson<Motion>(text), mocked: false };
}
