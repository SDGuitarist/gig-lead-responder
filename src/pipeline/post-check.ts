/**
 * Deterministic post-generation checks.
 * Runs AFTER AI generate+verify to catch violations the AI self-policing misses.
 * Auto-fixes what it can (em dashes), flags what it can't (banned phrases).
 */

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
const SOFT_REFUSAL_PATTERNS: RegExp[] = [
  /\bnot (?:really )?my (?:main |primary )?(?:specialty|instrument|focus)\b/i,
  /\bmay not be the best fit\b/i,
  /\bif you're set on\b/i,
  /\bnot (?:really )?(?:something|what) (?:I|we) (?:typically |usually )?(?:do|offer|play)\b/i,
  /\byou might (?:want to |be better off )(?:look|search|try)\b/i,
  /\bi(?:'d| would) recommend (?:looking|searching|trying) elsewhere\b/i,
  /\bprimarily (?:focus|specialize)(?:s)? (?:on|in) (?:other|different)\b/i,
  /\bwhile\b.{1,30}\bisn't my (?:main|primary)\b/i,
];

// --- Price format checks ---

// Matches price ranges like "$800-$1,000" or "$800 - $1,000" or "$800 to $1,000"
export const PRICE_RANGE_PATTERN = /\$[\d,]+\s*[-–—]\s*\$[\d,]+|\$[\d,]+\s+to\s+\$[\d,]+/i;

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

  return {
    full_draft: cleanedFull,
    compressed_draft: cleanedCompressed,
    violations,
  };
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
