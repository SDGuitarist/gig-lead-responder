// The grounding measurement's seam (Codex code review R1 P1-2): run the PRODUCTION classifyLead (validateClassification,
// coerce, ground) and also capture what the model returned for `lead_words` BEFORE the code check, so a dropped phrase
// can be counted. The text is cleaned by production's own stripCodeFences (Codex code R2 P1-1). The only thing added to the production path is a wrapper around the requester.
import { setClaudeRequesterForTests, stripCodeFences } from "./claude.js";
import { classifyLead } from "./pipeline/classify.js";
import { coerceLeadWords, type LeadWords } from "./lead-words.js";

type Requester = (request: unknown) => Promise<{ content?: Array<{ type?: string; text?: string }> }>;

export interface GroundingRun { returned: LeadWords; kept: LeadWords }

/** `inner` makes the real (or, in tests, a fake) model call; the wrapper records its text and passes the response through. */
export async function groundingRun(leadText: string, today: string, inner: Requester): Promise<GroundingRun> {
  let lastText = "";
  setClaudeRequesterForTests((async (request: unknown) => {
    const res = await inner(request);
    // production reads content[0] and rejects a non-text block (src/claude.ts), so the seam does the same (Codex code R3)
    const first = res.content?.[0];
    lastText = first && first.type === "text" ? first.text ?? "" : "";
    return res;
  }) as never);
  try {
    const result = await classifyLead(leadText, today);
    let raw: unknown = null;
    try { raw = (JSON.parse(stripCodeFences(lastText)) as { lead_words?: unknown }).lead_words; } catch { /* not JSON: the production path would have thrown or retried */ }
    return { returned: coerceLeadWords(raw), kept: coerceLeadWords(result.lead_words) };
  } finally { setClaudeRequesterForTests(); }
}
