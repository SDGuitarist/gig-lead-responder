import { callClaude } from "../claude.js";
import { ClassificationError } from "../errors.js";
import { buildClassifyPrompt } from "../prompts/classify.js";
import { wrapUntrustedData } from "../utils/sanitize.js";
import type { Classification, DeliveryMode, EngagementType, EventArc, Format, NpTier, ResidencyCadence, ResidencyTier } from "../types.js";

const VALID_COMPETITION = new Set(["low", "medium", "high", "extreme"]);
const VALID_TIERS = new Set(["premium", "standard", "qualification"]);
const VALID_RATE_TIERS = new Set(["T1", "T2", "T3", "T4"]);
const VALID_ACTIONS = new Set(["quote", "assume_and_quote", "one_question"]);

const VALID_ARCS = new Set<EventArc>(["wedding", "corporate", "private_celebration", "memorial"]);

/** Parses the model's event_arc once; anything outside the four arcs is null. */
export function normalizeEventArc(value: unknown): EventArc | null {
  return typeof value === "string" && VALID_ARCS.has(value as EventArc) ? (value as EventArc) : null;
}

// Instrument Rule (Project PROTOCOL Step 0.5 + memory): Alex performs guitar in any
// style and ukulele; sourcing only for instruments he doesn't play or 3+ musicians.
// A Record over Format, so a new format can't ship without a delivery mode.
const DELIVERY_MODE: Record<Format, DeliveryMode> = {
  solo: "alex_performs",
  duo: "alex_performs",
  flamenco_duo: "alex_performs",
  flamenco_trio: "hybrid",
  flamenco_trio_full: "hybrid",
  mariachi_4piece: "alex_sources",
  mariachi_full: "alex_sources",
  bolero_trio: "alex_sources",
  sourced_cultural_solo: "alex_sources",
  sourced_cultural_duo: "alex_sources",
  sourced_cultural_trio: "alex_sources",
  sourced_cultural_quartet: "alex_sources",
  sourced_cultural_5piece: "alex_sources",
};

/** Delivery mode for a format; null for "unresolved" or anything unknown. */
export function deliveryModeFor(format: unknown): DeliveryMode | null {
  return typeof format === "string" && Object.hasOwn(DELIVERY_MODE, format) ? DELIVERY_MODE[format as Format] : null;
}

/** Parses the model's graceful_decline once; only a real boolean true counts (port manifest R320). */
export function normalizeGracefulDecline(value: unknown): boolean {
  return value === true;
}

const ENGAGEMENT_TYPES: readonly EngagementType[] = ["private", "residency", "wedding_adjacent"];
const RESIDENCY_TIERS: readonly ResidencyTier[] = ["R1", "R2", "R3"];
const RESIDENCY_CADENCES: readonly ResidencyCadence[] = ["weekly", "biweekly", "monthly"];

/**
 * Parses the model's engagement fields once (port manifest R220/R276, R281–R283).
 * Unknown engagement → private. Tier and cadence exist only on a residency; an
 * unusable tier is R2 (the source's default when ambiguous). price_asked: only true counts.
 */
export function normalizeEngagement(obj: Record<string, unknown>): {
  engagement_type: EngagementType; residency_tier: ResidencyTier | null;
  residency_cadence: ResidencyCadence | null; price_asked: boolean;
} {
  const engagement_type = ENGAGEMENT_TYPES.includes(obj.engagement_type as EngagementType)
    ? (obj.engagement_type as EngagementType) : "private";
  const residency = engagement_type === "residency";
  return {
    engagement_type,
    residency_tier: !residency ? null
      : RESIDENCY_TIERS.includes(obj.residency_tier as ResidencyTier) ? (obj.residency_tier as ResidencyTier) : "R2",
    residency_cadence: residency && RESIDENCY_CADENCES.includes(obj.residency_cadence as ResidencyCadence)
      ? (obj.residency_cadence as ResidencyCadence) : null,
    price_asked: obj.price_asked === true,
  };
}

/** Parses the model's extended_dancer once; only a real boolean true counts. */
export function normalizeExtendedDancer(value: unknown): boolean {
  return value === true;
}

/** Parses the model's nonprofit_buyer once (port manifest R403); only a real boolean true counts. */
export function normalizeNonprofitBuyer(value: unknown): boolean {
  return value === true;
}

/** NP tier (R403): only "NP1" | "NP2" | "NP3", and only for a nonprofit buyer; anything else null (unsure). */
export function normalizeNpTier(value: unknown, nonprofitBuyer: boolean): NpTier | null {
  return nonprofitBuyer && (value === "NP1" || value === "NP2" || value === "NP3") ? value : null;
}

/**
 * organization_name (R403): a trimmed non-empty string, and only for a nonprofit buyer; else null.
 * Never the venue (plan 2026-10-09; the classifier returned the venue on 2 of 2 real runs when the lead named no
 * organization): a match returns null, so the in-kind line keeps [organization] and the lead is held for Alex.
 */
export function normalizeOrganizationName(value: unknown, nonprofitBuyer: boolean, venueName?: unknown): string | null {
  const name = typeof value === "string" ? value.trim() : "";
  if (!nonprofitBuyer || !name) return null;
  return namesMatch(name, venueName) ? null : name;
}

// Accents folded, & = and, punctuation dropped, one leading "the" removed: "The Café & Bar." -> [cafe, and, bar].
function nameWords(raw: unknown): string[] {
  const words = (typeof raw === "string" ? raw : "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
  return words[0] === "the" ? words.slice(1) : words;
}

// Identical word lists (any length), or the shorter (2+ words) inside the longer as whole words. An empty list
// never matches. One-word containment is not a match: "The Rock" must not drop "Rock the Vote". Known miss
// (pinned by a test): abbreviations such as "St." vs "Saint".
function namesMatch(a: unknown, b: unknown): boolean {
  const [x, y] = [nameWords(a), nameWords(b)];
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length === long.length) return short.every((w, i) => w === long[i]);
  if (short.length < 2) return false;
  return long.some((_, i) => short.every((w, j) => long[i + j] === w));
}

const validateClassification = (raw: unknown): Classification => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new ClassificationError("Expected JSON object from LLM");
  const obj = raw as Record<string, unknown>;
  // Required fields
  if (!obj.format_recommended) throw new ClassificationError("Classification missing format_recommended");
  if (!obj.duration_hours) throw new ClassificationError("Classification missing duration_hours");
  if (!obj.rate_card_tier) throw new ClassificationError("Classification missing rate_card_tier");
  if (!obj.lead_source_column) throw new ClassificationError("Classification missing lead_source_column");
  // Branching-critical fields — invalid values cause silent wrong behavior downstream
  if (!VALID_COMPETITION.has(obj.competition_level as string)) {
    throw new ClassificationError(`Classification invalid competition_level: "${obj.competition_level}"`);
  }
  if (!VALID_TIERS.has(obj.tier as string)) {
    throw new ClassificationError(`Classification invalid tier: "${obj.tier}"`);
  }
  if (!VALID_RATE_TIERS.has(obj.rate_card_tier as string)) {
    throw new ClassificationError(`Classification invalid rate_card_tier: "${obj.rate_card_tier}"`);
  }
  if (!VALID_ACTIONS.has(obj.action as string)) {
    throw new ClassificationError(`Classification invalid action: "${obj.action}"`);
  }
  if (
    obj.format_recommended !== "unresolved" &&
    typeof obj.format_recommended !== "string"
  ) {
    throw new ClassificationError(`Classification invalid format_recommended: "${obj.format_recommended}"`);
  }
  if (typeof obj.duration_hours !== "number" || obj.duration_hours <= 0) {
    throw new ClassificationError(`Classification invalid duration_hours: "${obj.duration_hours}"`);
  }
  if (obj.stated_budget !== null && typeof obj.stated_budget !== "number") {
    throw new ClassificationError(`Classification invalid stated_budget: expected number or null, got "${typeof obj.stated_budget}"`);
  }
  // Fields the code branches on: parse, don't trust (Codex round 1, finding 2's second instance).
  const oneOf = (k: string, allowed: readonly unknown[]) => {
    if (!allowed.includes(obj[k])) throw new ClassificationError(`Classification invalid ${k}: "${String(obj[k])}"`);
  };
  oneOf("lead_source_column", ["P", "D"]);
  oneOf("mode", ["confirmation", "evaluation"]);
  oneOf("vagueness", ["clear", "vague"]);
  oneOf("timeline_band", ["comfortable", "short", "urgent"]);
  oneOf("close_type", ["direct", "soft_hold", "hesitant"]);
  oneOf("cultural_context_active", [true, false]);
  oneOf("cultural_tradition", ["spanish_latin", null]);
  oneOf("stealth_premium", [true, false]);
  oneOf("event_energy", ["background", "performance", null]);
  const count = obj.competition_quote_count;
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    throw new ClassificationError(`Classification invalid competition_quote_count: "${String(count)}"`);
  }
  if (typeof obj.format_requested !== "string") {
    throw new ClassificationError("Classification invalid format_requested: expected a string");
  }
  // Absent is allowed here (classifyLead fills null); anything else must be a string.
  for (const k of ["venue_name", "client_first_name"]) {
    if (obj[k] !== undefined && obj[k] !== null && typeof obj[k] !== "string") {
      throw new ClassificationError(`Classification invalid ${k}: expected a string or null`);
    }
  }
  for (const k of ["flagged_concerns", "stealth_premium_signals", "context_modifiers"]) {
    const v = obj[k];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
      throw new ClassificationError(`Classification invalid ${k}: expected an array of strings`);
    }
  }
  obj.event_arc = normalizeEventArc(obj.event_arc);
  obj.extended_dancer = normalizeExtendedDancer(obj.extended_dancer);
  obj.nonprofit_buyer = normalizeNonprofitBuyer(obj.nonprofit_buyer);
  obj.np_tier = normalizeNpTier(obj.np_tier, obj.nonprofit_buyer as boolean);
  obj.organization_name = normalizeOrganizationName(obj.organization_name, obj.nonprofit_buyer as boolean, obj.venue_name);
  obj.graceful_decline = normalizeGracefulDecline(obj.graceful_decline);
  obj.delivery_mode = deliveryModeFor(obj.format_recommended);
  Object.assign(obj, normalizeEngagement(obj));
  return raw as Classification;
};

/**
 * Stage 1: Classify a raw lead into structured JSON.
 * Implements PROTOCOL.md Steps 0-5.
 */
export async function classifyLead(rawText: string, today: string): Promise<Classification> {
  const systemPrompt = buildClassifyPrompt(today);
  const userMessage = `Classify this lead:\n\n${wrapUntrustedData("lead_email", rawText)}`;

  const result = await callClaude<Classification>(systemPrompt, userMessage, undefined, validateClassification);

  // Sanitize event_date_iso — LLM may return "March 22" or "TBD" instead of YYYY-MM-DD
  if (result.event_date_iso && !/^\d{4}-\d{2}-\d{2}$/.test(result.event_date_iso)) {
    console.warn(`Invalid event_date_iso from LLM: "${result.event_date_iso}" — treating as null`);
    result.event_date_iso = null;
  }

  // Sanitize venue_name — LLM may return empty string instead of null
  if (result.venue_name !== undefined && result.venue_name !== null && result.venue_name.trim() === "") {
    result.venue_name = null;
  }
  // Backward compat: old cached classifications may lack this field
  if (result.venue_name === undefined) {
    result.venue_name = null;
  }

  // Sanitize client_first_name — LLM may return empty string or omit entirely
  if (result.client_first_name !== undefined && result.client_first_name !== null && result.client_first_name.trim() === "") {
    result.client_first_name = null;
  }
  if (result.client_first_name === undefined) {
    result.client_first_name = null;
  }

  // Clarification-first leads may intentionally defer format selection.
  if (result.action === "one_question" && result.vagueness === "vague" && result.format_recommended === "unresolved") {
    return result;
  }

  return result;
}
