import type { Classification } from "../types.js";

/**
 * Hard gate result — deterministic checks that run BEFORE AI generation.
 * When pass is false, the pipeline skips generate+verify and returns
 * a template decline instead of burning AI tokens.
 */
export interface HardGateResult {
  pass: boolean;
  fail_reasons: string[];
  flags: string[];           // warnings attached to classification, not auto-fails
  decline_draft: string | null;  // pre-written decline when pass is false
}

// --- Instrument / format checks ---

// Formats that are definitely NOT Alex (trigger auto-decline).
// Checked against format_requested (raw client text), case-insensitive.
const NON_ALEX_FORMATS = [
  "dj", "disc jockey", "karaoke",
  "rock band", "country band", "cover band",
  "pianist", "piano player",
  "violinist", "violin player", "string quartet",
  "harpist", "harp player",
  "drummer", "drum",
  "brass", "trumpet", "saxophone", "sax player",
  "bagpipe",
];

// Red flag keywords in raw lead text (trigger flag, not auto-decline).
// These get attached to classification.flagged_concerns.
const RED_FLAG_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\bcommission\b/i, flag: "commission_structure" },
  { pattern: /\bexposure\b/i, flag: "exposure_payment" },
  { pattern: /\bbar sales\b/i, flag: "bar_sales_commission" },
  { pattern: /\btips only\b/i, flag: "tips_only_payment" },
  { pattern: /\bfor free\b/i, flag: "free_performance" },
  { pattern: /\bno pay\b/i, flag: "no_payment" },
  { pattern: /\bvolunteer\b/i, flag: "volunteer_request" },
];

// Pre-written decline templates keyed by reason type.
const DECLINE_TEMPLATES: Record<string, (name: string | null) => string> = {
  format_dj: (name) =>
    `${name ? `Hi ${name},\n\n` : ""}Thanks for reaching out. I'm a live guitarist, so a DJ setup isn't something I offer. I'd recommend Will Chitwood at Dancing DJ Productions — he's great and covers San Diego.\n\nAlex Guillen`,

  format_karaoke: (name) =>
    `${name ? `Hi ${name},\n\n` : ""}Thanks for reaching out. Karaoke isn't something I offer — I specialize in live Spanish and acoustic guitar. If your plans shift toward live music, I'd be glad to help.\n\nAlex Guillen`,

  format_other_instrument: (name) =>
    `${name ? `Hi ${name},\n\n` : ""}Thanks for reaching out. That instrument isn't in my wheelhouse — I specialize in Spanish guitar, classical guitar, flamenco, and ukulele. I'd keep searching the platform for the right fit.\n\nAlex Guillen`,

  format_band: (name) =>
    `${name ? `Hi ${name},\n\n` : ""}Thanks for reaching out. I'm a solo and small-ensemble performer — full band setups aren't something I coordinate. I'd recommend searching the platform for bands in San Diego.\n\nAlex Guillen`,
};

/**
 * Run deterministic hard gate checks after classification, before pricing.
 * These are fact-based decisions that should never be left to AI reasoning.
 *
 * @param classification - The AI-generated classification from Stage 1
 * @param rawText - The original lead text (for red flag keyword scanning)
 */
export function checkHardGate(
  classification: Classification,
  rawText: string,
): HardGateResult {
  const fail_reasons: string[] = [];
  const flags: string[] = [];
  let decline_draft: string | null = null;
  const clientName = classification.client_first_name;

  // --- Check 1: Non-Alex format (DJ, karaoke, band, other instruments) ---
  const requested = (classification.format_requested || "").toLowerCase();

  if (requested) {
    // DJ check
    if (/\bdj\b/i.test(requested) || /\bdisc\s*jockey\b/i.test(requested)) {
      fail_reasons.push("format_mismatch: client requested DJ — not a live music format");
      decline_draft = DECLINE_TEMPLATES.format_dj(clientName);
    }
    // Karaoke check
    else if (/\bkaraoke\b/i.test(requested)) {
      fail_reasons.push("format_mismatch: client requested karaoke — not offered");
      decline_draft = DECLINE_TEMPLATES.format_karaoke(clientName);
    }
    // Band check
    else if (NON_ALEX_FORMATS.some((f) => f.includes("band") && requested.includes(f))) {
      fail_reasons.push(`format_mismatch: client requested "${requested}" — band format not offered`);
      decline_draft = DECLINE_TEMPLATES.format_band(clientName);
    }
    // Other non-Alex instruments
    else if (NON_ALEX_FORMATS.some((f) => requested.includes(f))) {
      fail_reasons.push(`instrument_mismatch: client requested "${requested}" — not in Alex's instrument set`);
      decline_draft = DECLINE_TEMPLATES.format_other_instrument(clientName);
    }
  }

  // --- Check 2: Red flag keywords in raw text ---
  for (const { pattern, flag } of RED_FLAG_PATTERNS) {
    if (pattern.test(rawText)) {
      flags.push(flag);
    }
  }

  return {
    pass: fail_reasons.length === 0,
    fail_reasons,
    flags,
    decline_draft,
  };
}
