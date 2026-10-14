// The bounded classification inventory for the verify-prompt snapshots (plan
// docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md, "The snapshot inventory", S0-S12).
// Used by src/clarification-gate-prompt.test.ts and scripts/snapshot-verify-prompts.ts. Not imported by the app.
import { CONCERN_4PIECE_ALT, type Classification, type PricingResult } from "./types.js";

type VerifyPricing = Pick<PricingResult, "budget" | "residency">;
export interface VerifyCase { id: string; what: string; classification: Classification; pricing: VerifyPricing }

const base = (over: Partial<Classification> = {}): Classification => ({
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "medium", competition_quote_count: 2,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "P",
  price_point: "slight_premium", format_requested: "solo guitar", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: "Sam", ...over,
} as Classification);
const none: VerifyPricing = { budget: { tier: "none" } };

export const VERIFY_CASES: VerifyCase[] = [
  { id: "S0", what: "clarification (one_question + unresolved), direct", pricing: none,
    classification: base({ action: "one_question", vagueness: "vague", format_recommended: "unresolved", flagged_concerns: ["vague format request"] }) },
  { id: "S1", what: "quote, direct, solo, no budget (baseline)", pricing: none, classification: base() },
  { id: "S2", what: "quote, GigSalad", pricing: none, classification: base({ platform: "gigsalad" }) },
  { id: "S3", what: "residency quote", classification: base(),
    pricing: { budget: { tier: "none" }, residency: { tier: "R2", cadence: "weekly", hours: 2, rate: 300, floor: 250, reason: null } } },
  { id: "S4", what: "no_viable_scope budget tier", classification: base({ stated_budget: 100 }),
    pricing: { budget: { tier: "no_viable_scope", gap: 400 } } },
  { id: "S5", what: "graceful decline", pricing: none, classification: base({ graceful_decline: true }) },
  { id: "S6", what: "sourced delivery (alex_sources)", pricing: none, classification: base({ delivery_mode: "alex_sources" }) },
  { id: "S7", what: "hybrid delivery", pricing: none, classification: base({ delivery_mode: "hybrid" }) },
  { id: "S8", what: "near-miss: one_question with a resolved format", pricing: none,
    classification: base({ action: "one_question", vagueness: "vague", format_recommended: "solo" }) },
  { id: "S9", what: "near-miss: quote with an unresolved format", pricing: none, classification: base({ format_recommended: "unresolved" }) },
  { id: "S10", what: "cultural context active", pricing: none,
    classification: base({ cultural_context_active: true, cultural_tradition: "spanish_latin" }) },
  { id: "S11", what: "past date detected", pricing: none, classification: base({ past_date_detected: true }) },
  { id: "S12", what: "dual-format concern (4-piece alternative)", pricing: none,
    classification: base({ flagged_concerns: [CONCERN_4PIECE_ALT] }) },
];

// Plan docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md (Revision 1b), S13-S17: the vague-quote mode and its
// near-misses. A SEPARATE list: src/generate-prompt-cases.ts derives its C0-C12 cases from VERIFY_CASES by id, and its
// C13-C17 are different cases.
export const VAGUE_GATE_CASES: VerifyCase[] = [
  { id: "S13", what: "vague-quote mode: one_question + vague + duo", pricing: none,
    classification: base({ action: "one_question", vagueness: "vague", format_recommended: "duo", format_requested: "" }) },
  { id: "S14", what: "near-miss: assume_and_quote + vague + solo (D3: out of scope)", pricing: none,
    classification: base({ action: "assume_and_quote", vagueness: "vague", format_recommended: "solo", format_requested: "" }) },
  { id: "S15", what: "near-miss: one_question + clear + solo", pricing: none,
    classification: base({ action: "one_question", vagueness: "clear", format_recommended: "solo" }) },
  { id: "S16", what: "near-miss: one_question + vague + a resolved non-solo/duo format", pricing: none,
    classification: base({ action: "one_question", vagueness: "vague", format_recommended: "mariachi_full", format_requested: "mariachi" }) },
  { id: "S17", what: "vague-quote mode with a format the lead named (format_requested set)", pricing: none,
    classification: base({ action: "one_question", vagueness: "vague", format_recommended: "solo", format_requested: "a solo guitarist" }) },
  { id: "S18", what: "vague-quote mode with a generic format_requested word (not a format anchor)", pricing: none,
    classification: base({ action: "one_question", vagueness: "vague", format_recommended: "solo", format_requested: "live music" }) },
];

/**
 * The body of one section of the verify prompt, by its id (`6b`, `7a`, `8`, `9`). A section starts at the line
 * `### <id>.` and runs up to, and excluding, the next line that starts with `### ` or `## `, or the end of the
 * prompt. Throws when the heading is absent or appears more than once, so a missing section cannot compare equal
 * to another missing section.
 */
export function sectionOf(prompt: string, id: string): string {
  const lines = prompt.split("\n");
  const head = new RegExp(`^### ${id}\\.`);
  const starts = lines.flatMap((l, i) => (head.test(l) ? [i] : []));
  if (starts.length !== 1) throw new Error(`verify prompt section ${id}: found ${starts.length} headings, expected 1`);
  const rest = lines.slice(starts[0] + 1);
  const next = rest.findIndex((l) => /^##? /.test(l) || /^### /.test(l));
  return lines.slice(starts[0], next === -1 ? lines.length : starts[0] + 1 + next).join("\n");
}

const VOICE_BLOCK = /## VOICE CALIBRATION REFERENCES[\s\S]*?(?=\n## EVALUATION CRITERIA)/g;

/** The raw "VOICE CALIBRATION REFERENCES" block of a verify prompt. Throws unless it appears exactly once. */
export function voiceBlockOf(prompt: string): string {
  const found = prompt.match(VOICE_BLOCK) ?? [];
  if (found.length !== 1) throw new Error(`voiceBlockOf: expected one voice references block, found ${found.length}`);
  return found[0];
}

/**
 * The form a snapshot is stored and compared in. The prompt's "VOICE CALIBRATION REFERENCES" block is replaced by a
 * marker: the reference replies carry private venue text that scripts/check-venue-history.ts (rightly) forbids in a
 * new file. So a snapshot comparison is byte-equal OUTSIDE that block only; the block itself is pinned separately by
 * a SHA-256 of its text (G8 in src/clarification-gate-prompt.test.ts), which stores no private text.
 * Throws unless the block is found exactly once, so the normalisation cannot silently do nothing.
 */
export function snapshotForm(prompt: string): string {
  voiceBlockOf(prompt);
  return prompt.replace(VOICE_BLOCK, "## VOICE CALIBRATION REFERENCES\n[omitted from snapshots: the reference replies carry private venue text]\n");
}
