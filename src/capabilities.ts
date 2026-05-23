// Registry pattern: define data once, derive multiple views.
// Consumers import pre-built singletons, not builder functions.

export type FormatFamily = "solo" | "flamenco" | "mariachi" | "bolero";

export interface CapabilityEntry {
  readonly aliases: readonly string[];
  readonly status: "KNOWN" | "ESCALATE";
  readonly formatFamily: FormatFamily | null; // null = can't determine family
}

export const CAPABILITIES = [
  {
    aliases: ["guitar", "acoustic guitar", "guitarist", "guitarists",
              "spanish guitar", "classical guitar", "nylon string",
              "acoustic", "classical"],  // standalone — preserves guessFormatFamily regex behavior
    status: "KNOWN",
    formatFamily: "solo",
  },
  {
    aliases: ["flamenco", "flamenco guitar"],
    status: "KNOWN",
    formatFamily: "flamenco",
  },
  {
    aliases: ["ukulele", "ukuleles", "uke", "ukulele player"],
    status: "KNOWN",
    formatFamily: "solo",  // maps to solo for pricing
  },
  {
    aliases: ["mariachi", "mariachi band", "mariachi ensemble"],
    status: "KNOWN",
    formatFamily: "mariachi",
  },
  {
    aliases: ["bolero", "bolero trio"],
    status: "KNOWN",
    formatFamily: "bolero",
  },
  {
    aliases: ["trio"],
    status: "KNOWN",
    formatFamily: null,  // could be bolero or mariachi — can't tell from "trio" alone
  },
  {
    aliases: ["solo"],
    status: "KNOWN",
    formatFamily: "solo",
  },
  {
    aliases: ["duo"],
    status: "KNOWN",
    formatFamily: "solo",  // duo is in solo family
  },
  {
    aliases: ["musician", "musicians", "live music", "background music"],
    status: "KNOWN",
    formatFamily: null,  // too generic to determine family
  },
  // Ambiguous — escalate
  {
    aliases: ["latin band", "latin music"],
    status: "ESCALATE",
    formatFamily: null,
  },
  {
    aliases: ["spanish music"],
    status: "ESCALATE",
    formatFamily: null,
  },
  {
    aliases: ["hawaiian music"],
    status: "ESCALATE",
    formatFamily: null,
  },
  {
    aliases: ["ensemble"],
    status: "ESCALATE",
    formatFamily: null,
  },
] as const satisfies readonly CapabilityEntry[];

/** Normalize format text before matching. */
export function normalizeFormatText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Build the KNOWN/ESCALATE alias map. Throws on duplicate aliases. */
export function buildAliasMap(entries: readonly CapabilityEntry[]): Record<string, "KNOWN" | "ESCALATE"> {
  const map: Record<string, "KNOWN" | "ESCALATE"> = {};
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (alias in map) throw new Error(`Duplicate alias "${alias}" in CAPABILITIES`);
      map[alias] = entry.status;
    }
  }
  return map;
}

/** Pre-sorted alias list for substring matching (longest-first). */
function buildAliasMatcher(entries: readonly CapabilityEntry[]): Array<{ alias: string; status: "KNOWN" | "ESCALATE" }> {
  const result: Array<{ alias: string; status: "KNOWN" | "ESCALATE" }> = [];
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      result.push({ alias, status: entry.status });
    }
  }
  return result.sort((a, b) => b.alias.length - a.alias.length);
}

/** Keywords for family inference only — NOT added to the capability alias map. */
const FAMILY_ONLY_ALIASES: Array<{ alias: string; family: FormatFamily }> = [
  { alias: "pair", family: "solo" },
  { alias: "two", family: "solo" },
];

/** Build a format family guesser. Normalizes input internally. */
function buildFamilyGuesser(entries: readonly CapabilityEntry[]): (requested: string) => FormatFamily | null {
  const pairs: Array<{ alias: string; family: FormatFamily }> = [];
  for (const entry of entries) {
    if (entry.formatFamily === null) continue;
    for (const alias of entry.aliases) {
      pairs.push({ alias, family: entry.formatFamily });
    }
  }
  // Merge family-only aliases (these inform pricing family but are NOT capability aliases)
  for (const fo of FAMILY_ONLY_ALIASES) {
    pairs.push(fo);
  }
  pairs.sort((a, b) => b.alias.length - a.alias.length);

  return (requested: string): FormatFamily | null => {
    const normalized = normalizeFormatText(requested);
    for (const { alias, family } of pairs) {
      if (normalized.includes(alias)) return family;
    }
    return null;
  };
}

// Pre-built singletons — consumers import these, not builder functions.
export const ALIAS_MAP = buildAliasMap(CAPABILITIES);
export const ALIAS_MATCHER = buildAliasMatcher(CAPABILITIES);
export const guessFormatFamily = buildFamilyGuesser(CAPABILITIES);
