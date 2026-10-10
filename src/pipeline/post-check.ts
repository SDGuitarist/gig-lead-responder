/**
 * Deterministic post-generation checks.
 * Runs AFTER AI generate+verify to catch violations the AI self-policing misses.
 * Auto-fixes what it can (em dashes), flags what it can't (banned phrases).
 */
import { clientTotal, findMinFloor, IN_KIND_ORG_PLACEHOLDER, rateTableFor } from "./price.js";
import { FORMAT_NAME, type PriceBlock } from "./price-block.js";
import type { PricingResult } from "../types.js";

export interface PostCheckResult {
  full_draft: string;         // cleaned draft (auto-fixes applied)
  compressed_draft: string;   // cleaned compressed draft
  violations: string[];       // issues that need a rewrite (couldn't auto-fix)
}

// --- Banned phrases (zero tolerance per system prompt) ---

const BANNED_PHRASES = [
  "i'd be happy to help",
  "let me help you with that",
  "great question",
  "certainly",
  "absolutely",
  "leverage",
  "utilize",
  "facilitate",
  "synergy",
  "elevated experience",
  "seamless experience",
  "i'd be thrilled",
  "it would be my pleasure",
  "i'd love to",
  "investment",      // should say "rate" instead
  "package",         // should describe the service directly
  "opportunity",
  "solution",
  "offering",
];

// --- Alex's voice kill list (docs/LEAD_RESPONSE_VOICE.md, port manifest F2) ---
// Mechanical items only. Words Alex uses in his own converted replies ("just",
// "really", plain "perfect", "dream") and context-dependent ones ("foster",
// "journey", "vision") are judgment calls left to the verify prompt.
const VOICE_KILL_LIST = [
  // recent additions (Apr 29, 2026 voice tuning)
  "land", "landed", "lands", "rotation", "alignment", "framing", "to be clear", "lane", "well before", "asymmetry",
  // Tier 1 AI tells
  "delve", "tapestry", "realm", "harness", "unlock", "embark", "unleash", "elevate", "beacon", "groundbreaking",
  "cutting-edge", "unprecedented", "seamless", "pivotal", "intricate", "robust", "transformative", "revolutionize",
  "supercharge", "streamline", "game-changer", "empower", "innovative", "paradigm", "comprehensive", "bespoke",
  "holistic", "turbocharge", "meticulous", "multifaceted",
  // performative directness
  "honestly?", "here's the thing", "here's the breakdown", "the bottom line", "let me be clear",
  // generic vendor / wedding-industrial complex
  "special day", "love story", "magical", "make memories", "create magic", "perfect soundtrack", "dream day", "bridal vision",
  // salesy, apologetic, pedestal, corporate, tech-bro
  "don't miss out", "limited availability", "act now", "i hope this works for you", "if you don't mind me asking",
  "my craft", "my artistry", "my musical journey", "solutions-oriented", "turnkey", "white-glove",
  "strategic positioning", "value proposition", "differentiated offering",
  // generic cinematic setups
  "in a world where", "imagine a place where",
];

// --- Soft refusal / fit-undermining patterns ---
// Catches AI drafts that undermine Alex's capability for an eligible format.
// These should never appear — the LR voice rules prohibit vendor-speak.
// Ships 6 tight patterns; 2 broader ones deferred (false-positive risk).
const YOU_MIGHT_LOOK_ELSEWHERE = /\byou might (?:want to |be better off )(?:look|search|try)\b/i;
const RECOMMEND_LOOKING_ELSEWHERE = /\bi(?:'d| would) recommend (?:looking|searching|trying) elsewhere\b/i;
// A graceful decline's exit line names where else to look (port manifest R320), so
// these two pass when the decline mode is active. Every other soft refusal still fails.
const DECLINE_EXIT_PATTERNS: ReadonlySet<RegExp> = new Set([YOU_MIGHT_LOOK_ELSEWHERE, RECOMMEND_LOOKING_ELSEWHERE]);

const SOFT_REFUSAL_PATTERNS: RegExp[] = [
  /\bnot (?:really )?my (?:main |primary )?(?:specialty|instrument|focus)\b/i,
  /\bmay not be the best fit\b/i,
  /\bif you're set on\b/i,
  /\bnot (?:really )?(?:something|what) (?:I|we) (?:typically |usually )?(?:do|offer|play)\b/i,
  YOU_MIGHT_LOOK_ELSEWHERE,
  RECOMMEND_LOOKING_ELSEWHERE,
  /\bprimarily (?:focus|specialize)(?:s)? (?:on|in) (?:other|different)\b/i,
  /\bwhile\b.{1,30}\bisn't my (?:main|primary)\b/i,
];

// --- Price format checks ---

// Matches price ranges like "$800-$1,000" or "$800 - $1,000" or "$800 to $1,000"
// The second number may omit "$" ("$550-595"); both need 3+ digits so hours or song
// counts after a price ("$1,100 — 2 hours") are not ranges.
export const PRICE_RANGE_PATTERN = /\$[\d,]{3,}\s*(?:[-–—]|to)\s*\$?[\d,]{3,}/i;

// Matches "starting at $X" or "from $X" pricing language
const SOFT_PRICE_PATTERN = /\b(starting at|from|as low as|prices? start)\s+\$/i;

/**
 * Run deterministic post-checks on generated drafts.
 * Auto-fixes em dashes in prose (preserves them in pricing lines).
 * Flags banned phrases and price format violations.
 *
 * @param fullDraft - The AI-generated full draft
 * @param compressedDraft - The AI-generated compressed draft
 * @param platform - Optional platform for platform-specific checks
 */
export function postCheckDrafts(
  fullDraft: string,
  compressedDraft: string,
  platform?: string,
  options: { gracefulDecline?: boolean; pricing?: PricingResult; askedHours?: number; priceBlock?: PriceBlock | null } = {},
): PostCheckResult {
  const violations: string[] = [];

  // --- Auto-fix: em dashes in prose ---
  // Replace em dashes (—) with commas, EXCEPT in pricing lines (e.g., "Solo Guitar — $950")
  const fixEmDashes = (text: string): string => {
    return text.replace(/—/g, (_, offset) => {
      // Check if this em dash is in a pricing line (has a $ within 10 chars after it)
      const after = text.slice(offset + 1, offset + 15);
      if (/\s*\$/.test(after)) return " —"; // keep in pricing lines
      return ",";
    });
  };

  let cleanedFull = fixEmDashes(fullDraft);
  let cleanedCompressed = fixEmDashes(compressedDraft);

  // --- Check: banned phrases ---
  for (const phrase of BANNED_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i");
    if (regex.test(cleanedFull)) {
      violations.push(`banned_phrase_full: "${phrase}"`);
    }
    if (regex.test(cleanedCompressed)) {
      violations.push(`banned_phrase_compressed: "${phrase}"`);
    }
  }

  // --- Check: Alex's voice kill list + one exclamation mark at most ---
  for (const phrase of VOICE_KILL_LIST) {
    const regex = new RegExp(`(?<![\\w-])${escapeRegex(phrase)}(?![\\w-])`, "i");
    if (regex.test(cleanedFull)) violations.push(`voice_kill_full: "${phrase}"`);
    if (regex.test(cleanedCompressed)) violations.push(`voice_kill_compressed: "${phrase}"`);
  }
  for (const [label, text] of [["full", cleanedFull], ["compressed", cleanedCompressed]] as const) {
    const bangs = (text.match(/!/g) ?? []).length;
    if (bangs > 1) violations.push(`voice_exclamations_${label}: ${bangs}`);
  }

  // --- Check: soft refusal / fit-undermining language ---
  for (const pattern of SOFT_REFUSAL_PATTERNS) {
    if (options.gracefulDecline === true && DECLINE_EXIT_PATTERNS.has(pattern)) continue;
    if (pattern.test(cleanedFull)) {
      violations.push(`soft_refusal_full: "${pattern.source}"`);
    }
    if (pattern.test(cleanedCompressed)) {
      violations.push(`soft_refusal_compressed: "${pattern.source}"`);
    }
  }

  // --- Check: price ranges (should be single confident number) ---
  if (PRICE_RANGE_PATTERN.test(cleanedFull)) {
    violations.push("price_range_in_full: draft uses a price range instead of a single confident number");
  }
  if (PRICE_RANGE_PATTERN.test(cleanedCompressed)) {
    violations.push("price_range_in_compressed: draft uses a price range instead of a single confident number");
  }

  // --- Check: soft pricing language ---
  if (SOFT_PRICE_PATTERN.test(cleanedFull)) {
    violations.push("soft_price_in_full: draft uses 'starting at' or similar hedging language instead of a firm price");
  }

  // --- Check: battery-powered sound (Alex: never mention it; unannounced backup) ---
  const batteryPattern = /\bbatter(?:y|ies)\b/i;
  if (batteryPattern.test(cleanedFull)) violations.push("battery_mention_full");
  if (batteryPattern.test(cleanedCompressed)) violations.push("battery_mention_compressed");

  // --- Check: GigSalad contact info (backup for AI verifier) ---
  if (platform === "gigsalad") {
    const contactPattern = /\b(\d{3}[-.)]\s*\d{3}[-.)]\s*\d{4}|@\w+\.\w+|www\.|\.com|\.net|instagram|facebook)\b/i;
    if (contactPattern.test(cleanedFull)) {
      violations.push("gigsalad_contact_leak_full: draft contains contact info (platform policy violation)");
    }
    if (contactPattern.test(cleanedCompressed)) {
      violations.push("gigsalad_contact_leak_compressed: draft contains contact info (platform policy violation)");
    }
  }

  // --- Check: a written price below the quote (port manifest R058/R072/R104; Alex option c, 2026-10-07) ---
  if (options.pricing) {
    violations.push(...belowFloorPrices(cleanedFull, "full", options.pricing));
    violations.push(...belowFloorPrices(cleanedCompressed, "compressed", options.pricing));
  }

  // --- Check: the hours the draft states are the hours priced (Codex round 1, no 1-hour duo, P1) ---
  // Ordinary quotes only (Codex round 2): residency, graceful-decline and no-viable-scope drafts
  // correctly state other hours or none, and an asked duration must be a positive number.
  const asked = options.askedHours;
  const pr = options.pricing;
  if (pr && typeof asked === "number" && Number.isFinite(asked) && asked > 0 && !options.gracefulDecline
      && !pr.residency && pr.budget.tier !== "no_viable_scope") {
    violations.push(...pricedHoursMissing(cleanedFull, "full", pr, asked));
    violations.push(...pricedHoursMissing(cleanedCompressed, "compressed", pr, asked));
  }

  // --- Check: the app's NP2 price block is intact (plan 2026-10-09; price-block.ts inserts it) ---
  const block = options.priceBlock;
  if (block) {
    for (const [label, text] of [["full", cleanedFull], ["compressed", cleanedCompressed]] as const) {
      if (!hasPriceBlock(text, block)) {
        violations.push(`in_kind_line_${label}: the NP2 draft must carry the app's price block unchanged`);
      }
    }
    // No usable organization name (inKindSentence kept the placeholder): Alex fills it.
    if (block.inKind.includes(IN_KIND_ORG_PLACEHOLDER)) {
      violations.push(`in_kind_org_missing: the lead names no organization; Alex fills ${IN_KIND_ORG_PLACEHOLDER} before sending`);
    }
  }

  return {
    full_draft: cleanedFull,
    compressed_draft: cleanedCompressed,
    violations,
  };
}

// The app wrote the block (insertPriceBlock), so this confirms text it knows exactly; it never infers a price line
// from prose (Codex round 3, NP2: that detector was the wrong shape). Plan 2026-10-09 row D, conditions:
// (1) no marker text is left; (2) exactly one "<format name>, <tail>" line, the next line exactly the in-kind
// sentence; (3)+(4) outside the block, no in-kind mention and no "my standard ... rate is $" (counted outside, so an
// organization named "In Kind Foundation" cannot fail a correct draft); (5) the structured core "$695, 2 hours"
// occurs once (a model-written copy of the price line, full or shortened, is held; prose is not that shape);
// (6) the block comes before the sign-off LINE (a line that is exactly "Alex Guillen"), not any mention of the name.
const IN_KIND_MENTION = /\bin\s*-?\s*kind\b/gi; // in-kind, in kind, in  kind, inkind, In - Kind
// Alex's own rate claim ("my standard ... rate is $"), not any "standard" near "rate" (Codex round 2 NP2 P2).
const STANDARD_RATE_STATEMENT = /\bmy\s+(?:\S+\s+){0,2}?standard\b(?:\s+\S+){0,5}?\s+rate\s+(?:is|was)\s+\$/gi;
function hasPriceBlock(text: string, block: PriceBlock): boolean {
  if (text.includes("[[PRICE")) return false;
  const lines = text.split("\n");
  const suffix = `, ${block.tail}`;
  const at = lines.flatMap((l, i) => (lines[i + 1] === block.inKind && l.endsWith(suffix)
    && FORMAT_NAME.test(l.slice(0, -suffix.length)) ? [i] : []));
  if (at.length !== 1) return false;
  const outside = [...lines.slice(0, at[0]), ...lines.slice(at[0] + 2)].join("\n");
  const count = (re: RegExp) => (outside.match(re) ?? []).length;
  if (count(IN_KIND_MENTION) !== 0 || count(STANDARD_RATE_STATEMENT) !== 0) return false;
  const core = block.tail.split(" | ")[0]; // "$695, 2 hours": priceLineTail puts the included clause after " | "
  if (text.split(core).length - 1 !== 1) return false;
  const signOff = lines.map((l) => l.trim()).lastIndexOf("Alex Guillen");
  return signOff === -1 || signOff > at[0];
}

/**
 * Every dollar figure the app hands the model: the quote, the travel fee and the quote+travel
 * total, a 50% deposit of either (rounded both ways), the budget gap, the scoped alternative, the
 * no-viable-scope minimum and the residency rate. Any OTHER figure below the price the client is
 * told (the quote, or quote+travel) is held: below the floor (Alex option a, 2026-10-06), and also
 * undercutting the quote above the floor (option c, Alex 2026-10-07). Figures above it ($1M
 * insurance, an upgrade) are not checked. NOT the client's stated budget (Alex 2026-10-07): "$400
 * works for me" is the likeliest too-low price. A malformed amount is held as unreadable.
 */
function belowFloorPrices(text: string, label: string, pricing: PricingResult): string[] {
  if (!(pricing.floor > 0) || !(pricing.quote_price > 0)) return []; // placeholder pricing: nothing to check
  // One travel rule with the prompt (Codex round 2, price line): clientTotal() adds the fee exactly
  // when the travel section tells the client a total.
  const totals = [pricing.quote_price];
  const supplied = new Set<number>();
  const told0 = clientTotal(pricing, pricing.quote_price);
  if (told0 !== pricing.quote_price) {
    supplied.add(told0 - pricing.quote_price); // the travel fee
    totals.push(told0);
  }
  for (const t of totals) { supplied.add(t); supplied.add(Math.floor(t / 2)); supplied.add(Math.ceil(t / 2)); }
  if (pricing.budget.tier === "small" || pricing.budget.tier === "large") supplied.add(pricing.budget.gap);
  // The scoped set and the no-viable-scope minimum, as base and as the client total (with its
  // deposit): the prompt states the total (clientTotal, Codex round 1, price line).
  const alsoTotal = (base: number) => {
    const total = clientTotal(pricing, base);
    for (const n of [base, total, Math.floor(total / 2), Math.ceil(total / 2)]) supplied.add(n);
  };
  if (pricing.budget.tier === "large") alsoTotal(pricing.budget.scoped_alternative.price);
  if (pricing.budget.tier === "no_viable_scope") alsoTotal(findMinFloor(rateTableFor(pricing), pricing.tier_key).min_floor);
  if (pricing.residency?.rate) supplied.add(pricing.residency.rate);
  const told = Math.max(...totals);

  const out: string[] = [];
  for (const { text: shown, amount } of dollarAmounts(text)) {
    if (Number.isNaN(amount)) out.push(`price_unreadable_${label}: ${shown} is not a readable amount`);
    else if (amount < told && !supplied.has(amount)) {
      out.push(`price_below_quote_${label}: ${shown} is below the $${told} quote and is not a figure the app supplied`);
    }
  }
  return [...new Set(out)];
}

// Read the WHOLE digit run first (no backtracking to a shorter number), then validate it: "$1.5k"
// is 1500, "$1,2345" is unreadable (NaN, held; Codex round 2), a sentence comma after a number is
// dropped. Counts US$, "N dollars", "N USD", "N bucks". Residue: amounts spelled out in words.
const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6 };
const VALID_NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
function dollarAmounts(text: string): { text: string; amount: number }[] {
  const run = "(\\d[\\d,]*(?:\\.\\d+)?)";
  const suffix = "(?:\\s?(k|thousand|mm|m|million)\\b)?";
  const found: { text: string; amount: number; at: number }[] = [];
  const add = (raw: string, mult: string | undefined, at: number) => {
    const n = raw.replace(/,+$/, "");
    const amount = VALID_NUMBER.test(n) ? Number(n.replace(/,/g, "")) * (mult ? MULTIPLIER[mult.toLowerCase()] : 1) : NaN;
    found.push({ text: `$${n}${mult ?? ""}`, amount, at });
  };
  for (const m of text.matchAll(new RegExp(`(?:US)?\\$\\s?${run}${suffix}`, "gi"))) add(m[1], m[2], m.index ?? 0);
  for (const m of text.matchAll(new RegExp(`(?<![$\\d.,])${run}${suffix}\\s?(?:dollars?|usd|bucks)\\b`, "gi"))) add(m[1], m[2], m.index ?? 0);
  return found.sort((a, b) => a.at - b.at);
}

// When pricing rounded the request UP (1h -> 2h duo/mariachi, 2.5h -> 3h), the draft must name the
// priced hours ("2 hours", "two-hour", "2hr"): the prompt says so, this makes it a rule.
const HOUR_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
// "2 hours", "two-hour", "2hr": the hours a draft states (pricedHoursMissing, the in-kind price line).
function statesHours(h: number): RegExp {
  const word = Number.isInteger(h) && HOUR_WORDS[h] ? `|${HOUR_WORDS[h]}` : "";
  return new RegExp(`\\b(?:${h}${word})(?:\\s|-)?(?:hours?|hrs?|h)\\b`, "i");
}

function pricedHoursMissing(text: string, label: string, pricing: PricingResult, askedHours: number): string[] {
  const h = pricing.duration_hours;
  if (!(pricing.quote_price > 0) || !(h > askedHours)) return [];
  return statesHours(h).test(text) ? []
    : [`priced_hours_${label}: the client asked for ${askedHours}h but the price is for ${h}h; the draft must say ${h} hours`];
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
