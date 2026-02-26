import { callClaudeText } from "../claude.js";
import { buildFollowUpPrompt } from "../prompts/follow-up.js";
import type { LeadRecord } from "../types.js";

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
  );

  return draft.trim();
}
