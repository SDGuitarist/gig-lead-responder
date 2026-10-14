// The grounding measurement's seam (Codex code review R1 P1-2): run the PRODUCTION classifyLead (validateClassification,
// coerce, ground) and also capture what the model returned for `lead_words` BEFORE the code check, so a dropped phrase
// can be counted. The only thing added to the production path is a wrapper around the requester.
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead } from "./pipeline/classify.js";
import { coerceLeadWords, type LeadWords } from "./lead-words.js";

type Requester = (request: unknown) => Promise<{ content?: Array<{ text?: string }> }>;

export interface GroundingRun { returned: LeadWords; kept: LeadWords }

/** `inner` makes the real (or, in tests, a fake) model call; the wrapper records its text and passes the response through. */
export async function groundingRun(leadText: string, today: string, inner: Requester): Promise<GroundingRun> {
  let lastText = "";
  setClaudeRequesterForTests((async (request: unknown) => {
    const res = await inner(request);
    lastText = (res.content ?? []).map((c) => c.text ?? "").join("");
    return res;
  }) as never);
  try {
    const result = await classifyLead(leadText, today);
    let raw: unknown = null;
    try { raw = (JSON.parse(lastText.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { lead_words?: unknown }).lead_words; } catch { /* not JSON: the production path would have thrown or retried */ }
    return { returned: coerceLeadWords(raw), kept: coerceLeadWords(result.lead_words) };
  } finally { setClaudeRequesterForTests(); }
}
