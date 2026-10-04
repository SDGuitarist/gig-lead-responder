import { callClaudeText } from "../claude.js";
import { buildFollowUpPrompt } from "../prompts/follow-up.js";
import type { LeadRecord } from "../types.js";
import { mentionsPrice } from "../utils/price-mention.js";

// The follow-up prompt's own rules, enforced on the draft before it is stored
// (Codex reserve/auth round 2). Text is checked as written; nothing is rewritten.
const CONTACT = /[\w.%+-]+@[\w.-]+\.[a-z]{2,}|\(?\b\d{3}\)?[ .-]?\d{3}[ .-]\d{4}\b|https?:\/\/|\bwww\./i;
const SIGNATURE = /\bAlex Guillen\b|^\s*[-—–]\s*Alex\b|\b(?:best|thanks|cheers|regards),?\s*\n\s*Alex\b/im;
const NOT_NEW = /\bjust checking in\b|\bchecking in\b|\bfollowing up\b|\bfollow(?:ing)? up on\b|\btouch(?:ing)? base\b/i;
const MAX_SENTENCES = 3;

/** Reasons a follow-up draft breaks its prompt's rules; empty = OK. */
export function followUpViolations(draft: string): string[] {
  const v: string[] = [];
  if (mentionsPrice(draft)) v.push("mentions a price");
  if (CONTACT.test(draft)) v.push("contains contact details or a link");
  if (SIGNATURE.test(draft)) v.push("contains a signature");
  if (NOT_NEW.test(draft)) v.push("uses a 'checking in' / 'following up' line");
  const sentences = draft.split(/[.!?]+(?=\s+\S)/).filter((x) => x.trim()).length;
  if (sentences > MAX_SENTENCES) v.push(`${sentences} sentences (max ${MAX_SENTENCES})`);
  return v;
}

/**
 * Generate a follow-up draft for a lead using Claude.
 * Uses Haiku for cost efficiency — follow-ups are short (2-3 sentences).
 * Falls back to Sonnet if Haiku quality proves insufficient.
 */
export async function generateFollowUpDraft(lead: LeadRecord): Promise<string> {
  const followUpNumber = lead.follow_up_count + 1; // 1-indexed
  const systemPrompt = buildFollowUpPrompt(lead, followUpNumber);

  const draft = await callClaudeText(
    systemPrompt,
    "Write the follow-up message now.",
    "claude-haiku-4-5-20251001",
    256, // follow-ups are ~80 tokens; 256 gives safe headroom
  );

  const text = draft.trim();
  const problems = followUpViolations(text);
  if (problems.length > 0) throw new Error(`follow-up draft rejected: ${problems.join("; ")}`);
  return text;
}
