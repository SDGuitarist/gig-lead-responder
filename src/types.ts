// Flagged concern constants — used in enrich, generate, and verify prompts
export const CONCERN_4PIECE_ALT = "mention_4piece_alternative" as const;
export const CONCERN_FULL_ENSEMBLE = "mention_full_ensemble_upgrade" as const;

// Valid format strings — must match rate table keys exactly
export type Format =
  | "solo"
  | "duo"
  | "flamenco_duo"
  | "flamenco_trio"
  | "mariachi_4piece"
  | "mariachi_full"
  | "bolero_trio";

export interface Classification {
  // Mode & action
  mode: "confirmation" | "evaluation";
  action: "quote" | "assume_and_quote" | "one_question";
  vagueness: "clear" | "vague";

  // Competition
  competition_level: "low" | "medium" | "high" | "extreme";
  competition_quote_count: number;

  // Stealth premium
  stealth_premium: boolean;
  stealth_premium_signals: string[];

  // Pricing
  tier: "premium" | "standard" | "qualification";
  rate_card_tier: "T1" | "T2" | "T3";
  lead_source_column: "P" | "D";
  price_point: "full_premium" | "slight_premium" | "at_market" | "below_market";

  // Format — BOTH the client's request AND the corrected recommendation
  format_requested: string; // What the client asked for (raw)
  format_recommended: Format; // Corrected format for pricing lookup

  // Duration — extracted from lead text
  duration_hours: 1 | 1.5 | 2 | 3 | 4;

  // Budget — extracted as number from lead text (null if not mentioned)
  stated_budget: number | null;

  // Event date — extracted by LLM, used by code for date math
  event_date_iso: string | null; // ISO date (YYYY-MM-DD) or null if not mentioned
  past_date_detected?: boolean; // Computed in TypeScript, not by LLM

  // Timeline & urgency
  timeline_band: "comfortable" | "short" | "urgent";
  close_type: "direct" | "soft_hold" | "hesitant";

  // Event energy — LLM judgment for format routing
  event_energy: "background" | "performance" | null;

  // Cultural
  cultural_context_active: boolean;
  cultural_tradition: "spanish_latin" | null;

  // Context modifiers
  planner_effort_active: boolean;
  social_proof_active: boolean;
  context_modifiers: string[];
  flagged_concerns: string[];

  // Platform — stamped post-classification, not AI-generated
  platform?: "gigsalad" | "thebash" | "direct";
}

export interface ScopedAlternative {
  duration_hours: number;
  price: number; // floor of scoped duration, not anchor
}

export type BudgetGapResult =
  | { tier: "none" }
  | { tier: "small"; gap: number }
  | { tier: "large"; gap: number; scoped_alternative: ScopedAlternative }
  | { tier: "no_viable_scope"; gap: number };

export interface PricingResult {
  format: Format;
  duration_hours: number;
  tier_key: string; // e.g., "T3P"
  anchor: number;
  floor: number;
  quote_price: number;
  competition_position: string; // e.g., "at anchor, willing to flex"
  budget: BudgetGapResult;
}

export interface Drafts {
  full_draft: string;
  compressed_draft: string;
  compressed_word_count: number;
}

// Gut check keys — single source of truth for count and threshold
export const GUT_CHECK_KEYS = [
  "can_see_it",
  "validated_them",
  "named_fear",
  "differentiated",
  "preempted_questions",
  "creates_relief",
  "best_line_present",
  "prose_flows",
  "competitor_test",
  "lead_specific_opening",
  "budget_acknowledged",
  "past_date_acknowledged",
  "mariachi_pricing_format",
  "cultural_vocabulary_used",
] as const;

export const GUT_CHECK_TOTAL = GUT_CHECK_KEYS.length; // 14
export const GUT_CHECK_THRESHOLD = GUT_CHECK_TOTAL - 2; // 12

export interface GateResult {
  validation_line: string;
  best_line: string;
  concern_traceability: Array<{
    concern: string;
    draft_sentence: string; // Empty string = FAIL
  }>;
  scene_quote: string;
  scene_type: "cinematic" | "structural";
  competitor_test: boolean; // false = rewrite
  gut_checks: {
    can_see_it: boolean;
    validated_them: boolean;
    named_fear: boolean;
    differentiated: boolean;
    preempted_questions: boolean;
    creates_relief: boolean;
    best_line_present: boolean;
    prose_flows: boolean;
    competitor_test: boolean;
    lead_specific_opening: boolean;
    budget_acknowledged: boolean;
    past_date_acknowledged: boolean;
    mariachi_pricing_format: boolean;
    cultural_vocabulary_used: boolean;
  };
  gate_status: "pass" | "fail";
  fail_reasons: string[];
}

export interface PipelineOutput {
  classification: Classification;
  pricing: PricingResult;
  drafts: Drafts;
  gate: GateResult;
  verified: boolean;
  timing: Record<string, number>; // stage name → milliseconds
  confidence_score: number; // 0-100, how much pipeline intelligence was activated and verified
}

// --- Outcome tracking types ---

// --- Follow-up status types ---

export const FOLLOW_UP_STATUSES = ["pending", "sent", "skipped", "exhausted"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

// --- Outcome tracking types ---

export const LEAD_OUTCOMES = ["booked", "lost", "no_reply"] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export const LOSS_REASONS = ["price", "competitor", "cancelled", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export interface AnalyticsBreakdown {
  label: string;
  total: number;
  booked: number;
  rate: number;
}

export interface AnalyticsResponse {
  total_leads: number;
  total_with_outcome: number;
  total_untracked: number;
  booked: number;
  lost: number;
  no_reply: number;
  conversion_rate: number;
  revenue: number;
  avg_quote_price: number | null;
  avg_actual_price: number | null;
  by_platform: AnalyticsBreakdown[];
  by_format: AnalyticsBreakdown[];
}

// --- Dashboard API response type ---
// Single source of truth for the shape returned by shapeLead() in api.ts.
// Client-side FORMAT_NAMES/CHECK_NAMES in dashboard.html must stay in sync.

export interface LeadApiResponse {
  id: number;
  status: LeadStatus;
  event_type: string | null;
  event_date: string | null;
  venue: string | null;
  client_name: string | null;
  confidence_score: number | null;
  edit_round: number;
  created_at: string;
  updated_at: string;
  full_draft: string | null;
  compressed_draft: string | null;
  error_message: string | null;
  // classification (parsed from classification_json)
  format_recommended: string | null;
  duration_hours: number | null;
  tier: string | null;
  competition_level: string | null;
  // pricing (parsed from pricing_json)
  quote_price: number | null;
  anchor: number | null;
  floor: number | null;
  // gate
  gate_passed: boolean | null;
  gut_check_passed: number | null;
  gut_check_total: number | null;
  fail_reasons: string[] | null;
  failed_checks: string[];
  // outcome tracking
  outcome: LeadOutcome | null;
  outcome_reason: LossReason | null;
  actual_price: number | null;
  outcome_at: string | null;
  // follow-up
  follow_up_status: FollowUpStatus | null;
  follow_up_count: number;
  follow_up_due_at: string | null;
  follow_up_draft: string | null;
}

// --- Email parser types (Chunk 2) ---

export interface ParsedLead {
  platform: "gigsalad" | "thebash";
  external_id: string;
  event_type: string;
  event_date: string;
  location?: string;
  token_url: string;
  raw_text: string;
}

export type ParseResult =
  | { ok: true; lead: ParsedLead }
  | { ok: false; reason: "skip" | "parse_error"; detail: string };

// --- Lead persistence types (Phase 1) ---

export type LeadStatus = "received" | "sending" | "sent" | "done" | "failed";

export interface LeadRecord {
  id: number;
  source_platform: string | null;
  mailgun_message_id: string | null;
  raw_email: string;
  client_name: string | null;
  event_date: string | null;
  event_type: string | null;
  venue: string | null;
  guest_count: number | null;
  budget_note: string | null;
  status: LeadStatus;
  classification_json: string | null;
  pricing_json: string | null;
  full_draft: string | null;
  compressed_draft: string | null;
  gate_passed: boolean | null;
  gate_json: string | null;
  confidence_score: number | null;
  error_message: string | null;
  pipeline_completed_at: string | null;
  sms_sent_at: string | null;
  edit_round: number;
  edit_instructions: string | null;
  done_reason: string | null;
  outcome: LeadOutcome | null;
  outcome_reason: LossReason | null;
  actual_price: number | null;
  outcome_at: string | null;
  // Follow-up fields
  follow_up_status: FollowUpStatus | null;
  follow_up_count: number;
  follow_up_due_at: string | null;
  follow_up_draft: string | null;
  created_at: string;
  updated_at: string;
}
