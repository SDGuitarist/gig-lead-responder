# Plan: P3 Batch + Gmail Auto-Intake (Phase 1)

**Date:** 2026-05-22
**Brainstorm:** `docs/brainstorms/2026-05-22-p3-batch-gmail-intake-brainstorm.md`
**Baseline:** 176 tests passing, branch `main`

```yaml
feed_forward:
  risk: "P3-4 capabilities unification — if derived maps diverge from current
         behavior by even one keyword, routing or gating changes silently.
         Snapshot tests are essential."
  verify_first: true
```

---

## Enhancement Summary

**Deepened on:** 2026-05-22
**Research agents used:** 8 (TypeScript reviewer, Security sentinel, Architecture
strategist, Performance oracle, Pattern recognition, Spec flow analyzer, Best
practices researcher, Solution doc checker)

### Key Improvements Found

1. **P0: Missing standalone `"acoustic"` and `"classical"` aliases** — Current
   `guessFormatFamily()` regex matches these as individual words; unified
   substring approach requires them as explicit aliases or behavior changes
   silently. (Architecture + Pattern agents)
2. **P0: SPF/DKIM bypass in source-validator.ts** — Auth check is optional when
   `Authentication-Results` header is missing. Must fix before Gmail intake goes
   live. (Security agent)
3. **P0: `"pair"`/`"two"` routing contradiction** — Initial plan added these as
   KNOWN, contradicting "router hold logic must not change." Resolved by
   introducing `FAMILY_ONLY_ALIASES` — keywords in family guesser but NOT in
   alias map. No routing change. (Spec flow agent + plan-fix pass)
4. **P1: Normalization should live inside builders, not consumers** — If a third
   consumer forgets to normalize, results diverge silently. (Architecture agent)
5. **P1: `FormatFamily` should be a union type** — `"solo" | "flamenco" |
   "mariachi" | "bolero"`, not `string | null`. Catches typos at compile time.
   (TypeScript agent)
6. **P1: Duplicate alias guard** — `buildAliasMap()` silently overwrites if two
   entries share an alias. Must throw at module load. (TypeScript agent)

### Confirmed Safe

- ReDoS in `.{1,30}` pattern: O(30) worst case, no nested quantifiers
- Review-only mode: `dispatchReply()` unreachable when `autoSendEnabled: false`
- Performance: No blockers at any relevant scale
- Implementation order: Dependencies verified correct

---

### Prior Phase Risk

> "The capabilities unification (P3-4). It's structurally correct but
> high-touch — if the derived alias map or family guesser diverges from current
> behavior by even one keyword, it could silently change routing or gating
> decisions. Plan phase must include a snapshot test that asserts byte-for-byte
> equivalence for every existing keyword before and after unification."

**How this plan addresses it:** P3-4 is scoped to positive-list unification
only (aliases + KNOWN/ESCALATE + formatFamily). The plan requires a regression
test matrix that exhaustively checks every keyword from both current sources
against the unified source. The test runs _before_ any consumer is switched
over, so divergence is caught at build time, not production.

---

## What is changing

1. **P3-1:** `public/index.html` — add `esc()` helper, escape kvHTML values
2. **P3-2:** `src/pipeline/hard-gate.ts` — replace "drum"/"drummer" with word-boundary regex
3. **P3-3:** `src/run-pipeline.ts` — call `sanitizeClassification()` before hard gate
4. **P3-4:** New `src/capabilities.ts` — unified alias/family source; update
   `hard-gate.ts` and `src/automation/router.ts` to consume it
5. **P3-5:** `src/pipeline/post-check.ts` — add 2 narrow soft-refusal patterns
6. **P3-6:** `src/capabilities.ts` — add whitespace normalization + explicit
   plural aliases
7. **Part B:** `src/automation/orchestrator.ts` + `src/automation/config.ts` —
   constrain the existing Gmail automation path to review-only mode

## What must NOT change

- Existing 176 tests all pass
- `NON_ALEX_FORMATS` stays in `hard-gate.ts` (negative list, separate concept)
- Hard gate decline behavior for DJ, karaoke, bands, other instruments
- Router hold logic (all existing hold triggers remain intact)
- Prompt builders keep their own `sanitizeClassification()` calls (belt-and-suspenders)
- Dashboard filter model (pending/sent/done/failed tabs)
- Follow-up scheduler behavior
- SMS notification behavior (must still fire for held and review-only leads)
- No new npm dependencies
- SPF/DKIM validation must remain mandatory after the fix (never optional again)

---

## Part A: P3 Fixes

### Step A1: P3-4 — Unified capabilities source (do FIRST)

**Why first:** P3-6 (normalization + plurals) modifies the same alias data.
P3-2 (drum regex) touches the same file. Doing P3-4 first establishes the
single source that the other fixes build on.

**Scope fence:** This is a positive-list unification only. It unifies:
- `ALEX_ALIAS_MAP` (hard-gate.ts) — capability status per alias
- `guessFormatFamily()` (router.ts) — format family per keyword

It does NOT touch:
- `NON_ALEX_FORMATS` (stays in hard-gate.ts)
- `FORMAT_FAMILIES` (stays in router.ts — maps Format enum to family)
- Pricing tiers, rate cards, or any downstream data

**New file: `src/capabilities.ts`**

```ts
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
    aliases: ["guitar", "acoustic guitar", "guitarist", "spanish guitar",
              "classical guitar", "nylon string",
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
    aliases: ["ukulele", "uke", "ukulele player"],
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
    aliases: ["musician", "live music", "background music"],
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
function buildAliasMap(entries: readonly CapabilityEntry[]): Record<string, "KNOWN" | "ESCALATE"> {
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
```

**Consumers:**

`hard-gate.ts`: Replace `ALEX_ALIAS_MAP` constant and Check 3 with:
```ts
import { ALIAS_MATCHER, normalizeFormatText } from "../capabilities.js";

// In checkHardGate, normalize requested at top of function:
const requested = normalizeFormatText(classification.format_requested || "");

// Check 3: use pre-sorted ALIAS_MATCHER instead of Object.entries().sort()
const matched = ALIAS_MATCHER.find(({ alias }) => requested.includes(alias));
```
Remove the old hardcoded map. Check 3 no longer sorts per call (pre-sorted).

`router.ts`: Replace `guessFormatFamily()` with the pre-built singleton:
```ts
import { guessFormatFamily } from "../capabilities.js";
```
Remove the old function body and `FORMAT_FAMILIES` stays untouched.

**Semantic change to track:** The current `guessFormatFamily()` uses regex
(`/mariachi/i`, `/flamenco/i`, etc.) while `ALEX_ALIAS_MAP` uses `.includes()`.
The unified `buildFamilyGuesser()` uses `.includes()` (substring matching with
longest-first sort) for both. This means:

- `"I want mariachi music"` — matches `"mariachi"` substring. Same result.
- `"flamenco duo"` — matches `"flamenco"` substring. Same result.
- `"solo guitar"` — matches both `"solo"` and `"guitar"`. Longest-first:
  `"solo guitar"` doesn't match `"acoustic guitar"` (11 chars), but matches
  `"guitar"` (6 chars, family: "solo") before `"solo"` (4 chars, family: "solo").
  Same result regardless.
- `"pair"` / `"two"` — the current `guessFormatFamily()` catches these via
  `/duo|pair|two/i`. The unified source does NOT have "pair" or "two" as
  aliases. **This is an intentional omission** — "pair" and "two" are not in
  `ALEX_ALIAS_MAP` either. They don't represent capabilities; they're quantity
  words. If router gets `format_requested: "a pair of musicians"`, the current
  code maps it to "solo" family. The unified code returns `null`.

  **Decision:** Do NOT add `"pair"` and `"two"` to the CAPABILITIES entries.
  Adding them as KNOWN would remove `unknown_capability` from `flagged_concerns`,
  changing router behavior from hold to potential auto-send — contradicting the
  plan's "router hold logic must not change" constraint.

  Instead, add a `FAMILY_ONLY_ALIASES` list in `capabilities.ts` — keywords
  that inform the family guesser but are excluded from the alias map.
  `FAMILY_ONLY_ALIASES` is defined above the `buildFamilyGuesser()` function,
  which explicitly merges them into its sorted pairs list (see code block).
  `buildAliasMap()` and `buildAliasMatcher()` ignore them entirely.

  This preserves the current `guessFormatFamily()` behavior (returns "solo"
  for "pair"/"two") AND preserves the current alias map behavior (these
  keywords still flag `unknown_capability` → router holds). No behavioral
  change to routing.

**Regression test matrix (mandatory before switching consumers):**

```ts
describe("capabilities regression", () => {
  // Every keyword from the old ALEX_ALIAS_MAP
  const ALIAS_MAP_KEYWORDS = [
    ["guitar", "KNOWN"], ["acoustic guitar", "KNOWN"], ["guitarist", "KNOWN"],
    ["spanish guitar", "KNOWN"], ["classical guitar", "KNOWN"],
    ["nylon string", "KNOWN"], ["flamenco", "KNOWN"],
    ["flamenco guitar", "KNOWN"], ["ukulele", "KNOWN"], ["uke", "KNOWN"],
    ["ukulele player", "KNOWN"], ["mariachi", "KNOWN"],
    ["mariachi band", "KNOWN"], ["mariachi ensemble", "KNOWN"],
    ["bolero", "KNOWN"], ["bolero trio", "KNOWN"], ["trio", "KNOWN"],
    ["solo", "KNOWN"], ["duo", "KNOWN"], ["musician", "KNOWN"],
    ["live music", "KNOWN"], ["background music", "KNOWN"],
    ["latin band", "ESCALATE"], ["spanish music", "ESCALATE"],
    ["hawaiian music", "ESCALATE"], ["latin music", "ESCALATE"],
    ["ensemble", "ESCALATE"],
  ] as const;

  for (const [keyword, expectedStatus] of ALIAS_MAP_KEYWORDS) {
    it(`alias map: "${keyword}" -> ${expectedStatus}`, () => {
      expect(aliasMap[keyword]).toBe(expectedStatus);
    });
  }

  // Every match from the old guessFormatFamily()
  const FAMILY_KEYWORDS = [
    ["mariachi band", "mariachi"],
    ["flamenco guitar for dinner", "flamenco"],
    ["bolero trio", "bolero"],
    ["solo guitar", "solo"],
    ["acoustic guitarist", "solo"],
    ["classical guitar", "solo"],
    ["duo for our party", "solo"],
    ["a pair of musicians", "solo"],
    ["need two players", "solo"],
    // Standalone words — must match (preserves old regex behavior)
    ["acoustic entertainment", "solo"],
    ["classical music for dinner", "solo"],
    // Currently returns null
    ["live music", null],
    ["jazz band", null],
    ["something fun", null],
  ] as const;

  for (const [input, expectedFamily] of FAMILY_KEYWORDS) {
    it(`family guesser: "${input}" -> ${expectedFamily}`, () => {
      expect(guessFamily(input)).toBe(expectedFamily);
    });
  }

  // Cross-check: aliases in the map that had no family mapping before
  // should STILL return null from the family guesser
  const INTENTIONAL_NULL_FAMILY = [
    "trio",         // could be bolero or mariachi
    "musician",     // too generic
    "live music",   // too generic
    "background music", // too generic
    "latin band",   // ESCALATE, no family
    "spanish music", // ESCALATE, no family
    "hawaiian music", // ESCALATE, no family
    "ensemble",      // ESCALATE, no family
  ];

  for (const keyword of INTENTIONAL_NULL_FAMILY) {
    it(`family guesser: "${keyword}" -> null (intentional)`, () => {
      expect(guessFamily(keyword)).toBeNull();
    });
  }

  // FAMILY_ONLY_ALIASES: in family guesser, NOT in alias map
  // These preserve guessFormatFamily behavior without changing routing.
  it('family guesser: "pair" -> "solo" (family-only alias)', () => {
    expect(guessFamily("a pair of musicians")).toBe("solo");
  });
  it('family guesser: "two" -> "solo" (family-only alias)', () => {
    expect(guessFamily("need two players")).toBe("solo");
  });
  it('alias map: "pair" is NOT a capability alias (preserves unknown_capability)', () => {
    expect(aliasMap["pair"]).toBeUndefined();
  });
  it('alias map: "two" is NOT a capability alias (preserves unknown_capability)', () => {
    expect(aliasMap["two"]).toBeUndefined();
  });

  // Duplicate alias guard — must throw at module load
  it("throws on duplicate alias", () => {
    const duped: CapabilityEntry[] = [
      { aliases: ["guitar"], status: "KNOWN", formatFamily: "solo" },
      { aliases: ["guitar"], status: "ESCALATE", formatFamily: null },
    ];
    expect(() => buildAliasMap(duped)).toThrow(/Duplicate alias "guitar"/);
  });

  // Longest-first precedence — overlapping aliases
  it('"mariachi ensemble" matches KNOWN before "ensemble" matches ESCALATE', () => {
    const matched = ALIAS_MATCHER.find(({ alias }) =>
      "mariachi ensemble".includes(alias)
    );
    expect(matched?.alias).toBe("mariachi ensemble");
    expect(matched?.status).toBe("KNOWN");
  });
});
```

### Step A2: P3-6 — Normalization + explicit plurals

**Depends on:** A1 (adds plurals to the unified capabilities source)

`normalizeFormatText()` is already defined in A1's `capabilities.ts`.
`buildFamilyGuesser()` already normalizes internally (from A1).

This step adds:
1. Explicit plural aliases to CAPABILITIES entries:
   - Guitar entry: add `"guitarists"`
   - Musician entry: add `"musicians"`
   - Ukulele entry: add `"ukuleles"`
2. Apply `normalizeFormatText()` at the top of `checkHardGate()` — before ALL
   checks, not just Check 3. This prevents double-spaced inputs like
   `"rock  band"` from bypassing Check 1's substring match.

```ts
// In checkHardGate(), first line after extracting format_requested:
const requested = normalizeFormatText(classification.format_requested || "");
```

**Test through `checkHardGate`, not direct map lookup:**
```ts
it("matches double-spaced input via hard gate", () => {
  const result = checkHardGate(
    makeClassification({ format_requested: "acoustic  guitar" }), ""
  );
  expect(result.flags).not.toContain("unknown_capability");
});
it("matches plural alias", () => {
  const result = checkHardGate(
    makeClassification({ format_requested: "guitarists" }), ""
  );
  expect(result.flags).not.toContain("unknown_capability");
});
it("double-spaced 'rock  band' still declines", () => {
  const result = checkHardGate(
    makeClassification({ format_requested: "rock  band" }), ""
  );
  expect(result.pass).toBe(false);
});
```

### Step A3: P3-2 — "drum" word-boundary regex

**Depends on:** A1 (NON_ALEX_FORMATS stays in hard-gate.ts, but alias matching
is now unified)

In `hard-gate.ts`:
1. Remove `"drummer"` and `"drum"` from `NON_ALEX_FORMATS` string array
2. Add a `NON_ALEX_PATTERNS` array (field name `flag` matches `RED_FLAG_PATTERNS`):
```ts
const NON_ALEX_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\bdrum(?:s|mer|line)?\b/iu, flag: "drum" },
];
```
Note: `"drumline"` is a **new decline trigger** (not in old NON_ALEX_FORMATS).
This is intentional — drumline is not a guitar format. Call out in commit.

3. In Check 1, after the existing substring check, use single `.find()` (not
   `.some()` + `.find()` which runs regex twice):
```ts
const drumMatch = NON_ALEX_PATTERNS.find(({ pattern }) => pattern.test(requested));
if (drumMatch) {
  fail_reasons.push(`instrument_mismatch: client requested "${requested}" — not in Alex's instrument set`);
  decline_draft = DECLINE_TEMPLATES.format_other_instrument(clientName);
}
```

**Tests:**

```ts
// Positive matches (should trigger decline)
for (const input of ["drum", "drums", "drummer", "drumline", "drum circle"]) {
  it(`declines "${input}"`, () => {
    const result = checkHardGate(makeClassification({ format_requested: input }), "");
    expect(result.pass).toBe(false);
  });
}

// Negative matches (should NOT trigger decline)
for (const input of ["eardrum", "snare drum technique"]) {
  // "snare drum technique" SHOULD match — it contains \bdrum\b
  // Actually: /\bdrum(?:s|mer|line)?\b/ matches "drum" in "snare drum technique"
  // That's correct — it IS a drum request
}

// The real false-positive test:
for (const input of ["eardrum", "conundrum"]) {
  it(`does not decline "${input}"`, () => {
    const result = checkHardGate(makeClassification({ format_requested: input }), "");
    expect(result.pass).toBe(true);
  });
}
```

### Step A4: P3-3 — Move sanitizeClassification() before hard gate

**Interaction with P3-4 and P3-6:** After this change, the hard gate and the
alias/family matching see truncated `format_requested` (max 200 chars). This
is fine because:
- All legitimate format_requested values are well under 200 chars (typical:
  5-30 chars like "flamenco guitar", "mariachi band for wedding")
- If truncation cuts a valid alias at 200 chars, the match fails and
  `unknown_capability` is flagged — this is correct behavior for a 200+ char
  input (it's likely prompt stuffing, not a real format request)

**In `src/run-pipeline.ts`:** After line 107, before line 115:

```ts
import { sanitizeClassification } from "./utils/sanitize.js";

// ... after verifyClassificationHeuristics:
const sanitized = sanitizeClassification(verifiedClassification);

// Use sanitized from here on
const hardGate = checkHardGate(sanitized, rawText);
```

Replace all subsequent references to `verifiedClassification` with `sanitized`
through the rest of the function.

**What must NOT change:** The calls in `src/prompts/generate.ts:39` and
`src/prompts/verify.ts:24` stay. Belt-and-suspenders.

**Tests:**

```ts
it("truncates format_requested before hard gate", () => {
  const longFormat = "a".repeat(500);
  // After sanitization, format_requested is 200 chars + "…"
  // Hard gate should see the truncated version
  const result = await runPipeline("...", undefined, undefined);
  // Verify via mock that checkHardGate receives truncated input
});

it("under-200-char format_requested is behaviorally unchanged", () => {
  const result = checkHardGate(
    sanitizeClassification(makeClassification({ format_requested: "flamenco guitar" })),
    "",
  );
  expect(result.flags).not.toContain("unknown_capability");
});

it("truncation does not turn a valid alias into unknown_capability", () => {
  // "acoustic guitar" is 15 chars — well under 200
  const sanitized = sanitizeClassification(
    makeClassification({ format_requested: "acoustic guitar" }),
  );
  expect(sanitized.format_requested).toBe("acoustic guitar");
  const result = checkHardGate(sanitized, "");
  expect(result.flags).not.toContain("unknown_capability");
});

it("200+ char format_requested flags unknown_capability (accepted behavior)", () => {
  const longFormat = "acoustic guitar " + "x".repeat(200);
  const sanitized = sanitizeClassification(
    makeClassification({ format_requested: longFormat }),
  );
  // Truncated — the alias is still at the start, so it might still match
  // Actually "acoustic guitar" is at the start, which is within 200 chars
  // So it should still match. Let's use a different test:
  const stuffed = "x".repeat(201);
  const sanitized2 = sanitizeClassification(
    makeClassification({ format_requested: stuffed }),
  );
  const result = checkHardGate(sanitized2, "");
  expect(result.flags).toContain("unknown_capability");
});
```

### Step A5: P3-5 — Two narrow soft-refusal patterns

**Scope: Option A — fix only the 2 observed phrasings.** No broader
generalization. If production data shows additional refusal variants, they
are deferred to a future cycle.

**In `src/pipeline/post-check.ts`,** add to `SOFT_REFUSAL_PATTERNS`:

```ts
/\bprimarily (?:focus|specialize)(?:s)? (?:on|in) (?:other|different)\b/i,
/\bwhile\b.{1,30}\bisn't my (?:main|primary)\b/i,
```

**Explicitly deferred variants** (not in scope for this cycle):
- `"primarily focus on [Alex's instruments]"` — positive statement, not refusal
- `"I mainly do [other thing]"` — no production data yet
- `"not my strongest area"` — no production data yet

**Tests (exact, from brainstorm):**

```ts
// VIOLATIONS
const SHOULD_VIOLATE = [
  "I primarily focus on other styles",
  "I primarily specialize in different genres",
  "while drums isn't my main instrument",
  "while this style isn't my primary focus",
];

// NO VIOLATION
const SHOULD_NOT_VIOLATE = [
  "I primarily focus on creating the perfect atmosphere",
  "I focus primarily on Spanish guitar",
  "My primary focus is live acoustic music",
  "I bring a unique focus to every event",
];

for (const text of SHOULD_VIOLATE) {
  it(`flags: "${text}"`, () => {
    const result = postCheckDrafts(text, text);
    expect(result.violations.some(v => v.includes("soft_refusal"))).toBe(true);
  });
}

for (const text of SHOULD_NOT_VIOLATE) {
  it(`does not flag: "${text}"`, () => {
    const result = postCheckDrafts(text, text);
    expect(result.violations.some(v => v.includes("soft_refusal"))).toBe(false);
  });
}
```

### Step A6: P3-1 — XSS escaping in index.html

**In `public/index.html`:**

1. Add the `esc()` helper (same as dashboard.html):
```js
var _escDiv = document.createElement('div');
function esc(s) {
  if (!s) return '';
  _escDiv.textContent = s;
  return _escDiv.innerHTML;
}
```

2. Modify `kvHTML()` to escape both label and value:
```js
function kvHTML(pairs) {
  return pairs.map(([label, value]) =>
    `<div class="kv"><span class="kv-label">${esc(label)}</span><span class="kv-value">${esc(value)}</span></div>`
  ).join("");
}
```

3. Fix gate_status rendering (line 250). Currently:
```js
["Status", `<span class="${...}">...</span>${...}`],
```
This passes structural HTML as a kvHTML value — escaping would break it.

**Fix:** Remove the Status entry from the kvHTML call. Render it directly:
```js
const statusEl = document.getElementById("gate-kv");
// Render other KV pairs first
statusEl.innerHTML = kvHTML([
  ["Validation", g.validation_line],
  // ... other pairs (no Status)
]);
// Prepend status with controlled HTML structure
const statusClass = g.gate_status === 'pass' ? 'gate-pass' : 'gate-fail';
const statusHTML = `<div class="kv"><span class="kv-label">Status</span>`
  + `<span class="kv-value"><span class="${statusClass}">`
  + `${esc(g.gate_status.toUpperCase())}</span>`
  + `${data.verified ? '' : ' (unverified — best attempt)'}</span></div>`;
statusEl.insertAdjacentHTML('afterbegin', statusHTML);
```

This keeps all dynamic text (`g.gate_status`) escaped while the `<span>`
wrapper is structural HTML we control.

**Automated verification:**

Since `kvHTML` and `esc` are pure functions in browser JS, add a test file
`src/xss-escape.test.ts` that duplicates the logic and verifies:

```ts
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function kvHTML(pairs: [string, string][]): string {
  return pairs.map(([label, value]) =>
    `<div class="kv"><span class="kv-label">${esc(label)}</span><span class="kv-value">${esc(value)}</span></div>`
  ).join("");
}

it("escapes XSS in value", () => {
  const html = kvHTML([["Test", '<img src=x onerror=alert(1)>']]);
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
});

it("escapes XSS in label", () => {
  const html = kvHTML([['<script>alert(1)</script>', "safe"]]);
  expect(html).not.toContain("<script>");
});

it("handles empty strings", () => {
  const html = kvHTML([["Label", ""]]);
  expect(html).toContain("kv-value");
});
```

---

## Part B: Gmail Auto-Intake (Review-Only Mode)

### Current Orchestrator Status Model

The existing `processLead()` in `orchestrator.ts` writes these DB statuses:

| Path | DB Status | SMS? | markProcessed? |
|------|-----------|------|----------------|
| Source validation fails | (no insert) | No | No |
| Dedup hit | (no insert) | No | No |
| Low-confidence parse | `"failed"` + error_message | Yes (hold SMS) | Yes |
| Pipeline error | `"failed"` + error_message | Yes (fail SMS) | Yes |
| Router -> hold | `"sent"` | Yes (hold SMS) | Yes |
| Router -> auto-send, success | `"done"` + done_reason | No | Yes |
| Router -> auto-send, failure | `"failed"` + error_message | Yes (fail SMS) | Yes |

### Review-Only Mode Design

**New config field:** `autoSendEnabled: boolean` in `AutomationConfig`.
Default: `false` (safe default). Env var: `AUTO_SEND_ENABLED=true` to enable.

**New path: would-auto-send with review-only override:**

| Path | DB Status | SMS? | markProcessed? | done_reason |
|------|-----------|------|----------------|-------------|
| Router -> auto-send + `autoSendEnabled: false` | `"sent"` | Yes (review SMS) | Yes | `"review-only: would-auto-send via {platform}"` |

**Why `"sent"` and not a new status:**
- `LeadStatus = "received" | "sending" | "sent" | "done" | "failed"` — adding
  a new status requires type changes, migration, dashboard filter changes,
  and API contract changes. Too much for Phase 1.
- `"sent"` already means "processed, has drafts, ready for human action" —
  this is the semantic match. Both natural holds and review-only overrides
  are in this state.
- The `done_reason` field distinguishes them: natural holds have no
  `done_reason`; review-only overrides have `"review-only: would-auto-send
  via {platform}"`.
- The dashboard's "Sent" filter tab already shows these leads correctly.

**Why `markProcessed()` still runs:** Without it, the next poll cycle would
re-process the same email. The dedup table is essential regardless of send mode.

**Why SMS still fires:** Alex needs to know a lead arrived and needs review.
The SMS message will say "REVIEW" instead of "HOLD" to distinguish:
```
REVIEW: Lead #42 gigsalad — auto-send suppressed. Check dashboard.
```

### Implementation in orchestrator.ts

Replace the current auto-send block (lines 177-209) with:

```ts
// 8. Auto-send (or review-only override)
if (config.autoSendEnabled) {
  // Existing auto-send logic (unchanged)
  const replyText = output.drafts.compressed_draft;
  let sendResult: SendResult;
  if (config.dryRun) { /* ... existing dry-run ... */ }
  else { sendResult = await dispatchReply(/* ... */); }
  // ... existing logging, DB update, SMS on failure ...
} else {
  // Review-only mode: log what would happen, don't send
  console.log(`[review-only] Would auto-send ${platform} reply for lead #${leadId}`);
  updateLead(leadId, {
    status: "sent",
    done_reason: `review-only: would-auto-send via ${platform}`,
  });
  if (!config.dryRun) {
    await sendSms(config, `REVIEW: Lead #${leadId} ${platform} — auto-send suppressed. Check dashboard.`);
  } else {
    console.log(`[DRY-RUN] REVIEW: Lead #${leadId} ${platform} — auto-send suppressed`);
  }
  logLead({
    timestamp: new Date().toISOString(),
    gmailMessageId: msg.id,
    platform,
    parseConfidence: lead.parseConfidence,
    classification: output.classification.format_recommended,
    quotePrice: output.pricing.quote_price,
    edgeCase: false,
    status: config.dryRun ? "dry-run" : "review-only",
    durationMs: Date.now() - startTime,
  });
}
markProcessed(msg.id);
```

**Side effects audit — all paths accounted for:**

| Side effect | Natural hold | Would-auto-send (review-only) | Auto-send (future) |
|-------------|-------------|-------------------------------|---------------------|
| `insertLead()` | Yes (line 58) | Yes (line 58) | Yes (line 58) |
| `updateLead()` status | `"sent"` | `"sent"` | `"done"` |
| `updateLead()` done_reason | (none) | `"review-only: would-auto-send"` | `"auto-sent via {platform}"` |
| Pipeline results saved | Yes (line 133) | Yes (line 133) | Yes (line 133) |
| `dispatchReply()` | No | **No** | Yes |
| SMS notification | Yes (hold msg) | Yes (review msg) | Only on failure |
| `logLead()` | Yes | Yes | Yes |
| `markProcessed()` | Yes | Yes | Yes |

### Security fix: SPF/DKIM must be mandatory (not optional)

**Found by security review.** In `src/automation/source-validator.ts:56`, the
SPF/DKIM check is skipped when `authenticationResults` is empty. A forged email
could pass validation on the `From` address alone.

Fix in `validateSource()`: invert the logic — require SPF+DKIM pass, reject
when the header is missing:

```ts
if (!checkAuthHeaders(authenticationResults)) {
  return {
    valid: false,
    platform: platform as GmailPlatform,
    reason: `Sender ${email} matched ${platform} but SPF/DKIM not verified`,
  };
}
```

This fix is part of Step B1.

**Operational tradeoff:** Mandatory reject is the right security call, but
source validation failures are currently invisible — `console.log` only, no
DB insert, no SMS, no dashboard entry. If Gmail ever omits the header for a
legitimate email (unlikely but possible), the lead is silently lost.

**Observability requirements:**

1. **Log level:** Change `console.log` to `console.warn` for auth failures so
   they stand out in Railway deploy logs:
   ```ts
   console.warn(`[source-validator] REJECTED ${msg.from}: ${validation.reason}`);
   ```

2. **Rejection counter:** Add a simple in-memory counter that the `/health`
   endpoint exposes:
   ```ts
   let rejectedEmailCount = 0;
   // In processLead, after validation fails:
   rejectedEmailCount++;
   // In health endpoint:
   { rejectedEmails: rejectedEmailCount }
   ```
   Alex can check `/health` to see if emails are being silently rejected.

3. **Startup confirmation log:** At poller startup, log which sender patterns
   and SPF/DKIM policy are active so deploy logs confirm the config.

**Why not quarantine/hold instead of reject:** A spoofed email in the dashboard
creates noise and costs Claude API tokens. Reject is cheaper and safer. The
observability measures above ensure legitimate rejects are detectable without
polluting the lead pipeline.

**Tests:**
- Email with matching sender but empty `authenticationResults` → rejected
- Email with matching sender and `spf=fail` → rejected
- Email with matching sender and `spf=pass; dkim=pass` → accepted
- Rejection increments the counter

### Config change in config.ts

```ts
export interface AutomationConfig {
  // ... existing fields ...
  /**
   * When true, the orchestrator sends replies automatically via the platform.
   * When false (default), leads that would auto-send are held for review.
   *
   * Env: AUTO_SEND_ENABLED=true
   * Phase 1: always false (review-only mode)
   * Phase 2: flip to true after monitoring review-only leads
   */
  readonly autoSendEnabled: boolean;
}

// In loadConfig():
autoSendEnabled: process.env.AUTO_SEND_ENABLED === "true", // default false
```

**`dryRun` x `autoSendEnabled` interaction matrix** (document in config.ts):

| dryRun | autoSendEnabled | Behavior |
|--------|----------------|----------|
| true   | true           | Dry-run: log send result, no actual dispatch |
| true   | false          | Dry-run: log review-only, no SMS |
| false  | true           | **Real auto-send** |
| false  | false          | Review-only: SMS fires, lead stored as "sent" |

**Phase 2 transition note:** Flipping `AUTO_SEND_ENABLED=true` only affects new
leads. Leads already stored with `done_reason: "review-only"` remain in Sent
status and must be manually approved via the dashboard.

### Dashboard compatibility

No dashboard changes needed. Review-only leads get `status: "sent"`, which
the dashboard already displays:
- `STATUS_DISPLAY.sent = { label: 'Sent', css: 'sent' }`
- Filter pill "Sent" maps to `FILTER_TO_API.sent = 'sent'`
- The lead card shows full_draft, compressed_draft, approve/skip buttons

**The distinction between natural holds and review-only overrides is NOT
visible in the current dashboard.** `done_reason` exists in the DB but is
not included in `LeadApiResponse` (see `src/types.ts:298-338`) and
`shapeLead()` does not return it. The dashboard has no rendering for it.

**Why this is acceptable for Phase 1:** In review-only mode
(`autoSendEnabled: false`), ALL leads that pass routing end up in "Sent"
status — both natural holds and would-auto-sends. Alex reviews every lead
regardless. The distinction only matters when auto-send is enabled (Phase 2),
at which point natural holds would stay in "Sent" while auto-sends would be
"Done". In Phase 1, the uniform "Sent" status is functionally correct because
every lead requires review.

**For Phase 2:** When `autoSendEnabled` is flipped to true, add `done_reason`
to `LeadApiResponse` and `shapeLead()`, and render it as a subtle label on
the lead card. This is deferred — it's a dashboard-only change with no
pipeline impact.

---

## Acceptance Tests

### P3-1 XSS

```
WHEN kvHTML receives a value containing "<img src=x onerror=alert(1)>"
THE SYSTEM SHALL render escaped text "&lt;img..." not an image element

WHEN kvHTML receives a label containing "<script>alert(1)</script>"
THE SYSTEM SHALL render escaped text, not execute the script

WHEN gate_status is rendered
THE SYSTEM SHALL escape the status text while preserving the structural <span> wrapper
```

**Verification:** `npm test` (xss-escape.test.ts)

### P3-2 Drum Regex

```
WHEN format_requested is "drum" or "drums" or "drummer" or "drumline" or "drum circle"
THE SYSTEM SHALL fail the hard gate with instrument_mismatch

WHEN format_requested is "eardrum" or "conundrum"
THE SYSTEM SHALL NOT fail the hard gate

WHEN format_requested is "acoustic guitar" (no drum-related content)
THE SYSTEM SHALL pass the hard gate drum check
```

**Verification:** `npm test` (hard-gate.test.ts)

### P3-3 Sanitize Before Gate

```
WHEN format_requested is under 200 characters (e.g., "flamenco guitar")
THE SYSTEM SHALL produce identical hard gate results whether sanitization
  runs before or after the gate

WHEN format_requested is over 200 characters
THE SYSTEM SHALL truncate it before the hard gate runs

WHEN format_requested is "acoustic guitar" + 190 characters of padding
THE SYSTEM SHALL still match the "acoustic guitar" alias (it's within
  the first 200 chars) and NOT flag unknown_capability

WHEN format_requested is 201 characters of non-alias text
THE SYSTEM SHALL flag unknown_capability (truncated text contains no alias)
```

**Verification:** `npm test` (run-pipeline.test.ts or hard-gate.test.ts)

### P3-4 Alias/Family Regression

```
WHEN any keyword from the old ALEX_ALIAS_MAP is looked up in the new derived map
THE SYSTEM SHALL return the same KNOWN/ESCALATE status

WHEN any input that old guessFormatFamily() matched to a family is tested
  against the new buildFamilyGuesser()
THE SYSTEM SHALL return the same family string

WHEN "trio" is looked up for format family
THE SYSTEM SHALL return null (ambiguous — could be bolero or mariachi)

WHEN "ukulele" is looked up for capability status
THE SYSTEM SHALL return "KNOWN"

WHEN "ukulele" is looked up for format family
THE SYSTEM SHALL return "solo"

WHEN "pair" or "two" is tested against the family guesser
THE SYSTEM SHALL return "solo" (family-only alias, preserves guessFormatFamily)

WHEN "pair" or "two" is looked up in the alias map
THE SYSTEM SHALL return undefined (NOT a capability alias — preserves
  unknown_capability flag and router hold behavior)

WHEN "acoustic entertainment" is tested against the family guesser
THE SYSTEM SHALL return "solo" (standalone "acoustic" alias preserves old regex)

WHEN "classical music for dinner" is tested against the family guesser
THE SYSTEM SHALL return "solo" (standalone "classical" alias preserves old regex)

WHEN a duplicate alias is added to CAPABILITIES (e.g., "guitar" in two entries)
THE SYSTEM SHALL throw an Error at module load time with a message
  containing the duplicate alias name

WHEN "mariachi ensemble" is matched against ALIAS_MATCHER
THE SYSTEM SHALL match "mariachi ensemble" (17 chars) before "ensemble" (8 chars)
  because ALIAS_MATCHER is sorted longest-first, returning KNOWN not ESCALATE
```

**Verification:** `npm test` (capabilities.test.ts) — full regression matrix

### P3-5 Soft Refusal

```
WHEN a draft contains "I primarily focus on other styles"
THE SYSTEM SHALL flag soft_refusal violation

WHEN a draft contains "I primarily specialize in different genres"
THE SYSTEM SHALL flag soft_refusal violation

WHEN a draft contains "while drums isn't my main instrument"
THE SYSTEM SHALL flag soft_refusal violation

WHEN a draft contains "while this style isn't my primary focus"
THE SYSTEM SHALL flag soft_refusal violation

WHEN a draft contains "I primarily focus on creating the perfect atmosphere"
THE SYSTEM SHALL NOT flag soft_refusal violation

WHEN a draft contains "I focus primarily on Spanish guitar"
THE SYSTEM SHALL NOT flag soft_refusal violation

WHEN a draft contains "My primary focus is live acoustic music"
THE SYSTEM SHALL NOT flag soft_refusal violation
```

**Verification:** `npm test` (post-check.test.ts)

### Part B: Review-Only Mode

```
WHEN autoSendEnabled is false AND the router returns action "auto-send"
THE SYSTEM SHALL NOT call dispatchReply()

WHEN autoSendEnabled is false AND the router returns action "auto-send"
THE SYSTEM SHALL store the lead with status "sent" and done_reason
  containing "review-only: would-auto-send"

WHEN autoSendEnabled is false AND the router returns action "hold"
THE SYSTEM SHALL store the lead with status "sent" (same as current behavior)

WHEN autoSendEnabled is false AND the router returns action "auto-send"
THE SYSTEM SHALL send an SMS notification with "REVIEW" prefix

WHEN autoSendEnabled is false AND a lead is processed
THE SYSTEM SHALL call markProcessed() (dedup still works)

WHEN autoSendEnabled is false AND a low-confidence lead arrives
THE SYSTEM SHALL write status "failed" with error_message (existing behavior unchanged)

WHEN autoSendEnabled is false AND the pipeline errors
THE SYSTEM SHALL write status "failed" with error_message (existing behavior unchanged)

WHEN dryRun is true AND autoSendEnabled is false AND router returns auto-send
THE SYSTEM SHALL log but NOT send SMS (dryRun gates SMS in review-only path)

WHEN a sender matches the allowlist but Authentication-Results header is empty
THE SYSTEM SHALL reject the email with a console.warn log containing the
  sender address and reason

WHEN a sender matches the allowlist AND SPF/DKIM both pass
THE SYSTEM SHALL accept the email

WHEN a source validation rejection occurs
THE SYSTEM SHALL increment the rejection counter visible at /health

WHEN the existing 176 baseline tests are run
THE SYSTEM SHALL have 0 failures
```

**Verification:**
- `npm test` (orchestrator.test.ts) — mock router, mock dispatchReply
- `npm test` (source-validator.test.ts) — SPF/DKIM mandatory check
- `npm test` — full baseline

---

## Implementation Order

1. **A1:** `src/capabilities.ts` + regression tests (P3-4)
2. **A2:** Normalization + plural aliases (P3-6) — extends capabilities.ts
3. **A3:** Drum regex (P3-2) — modifies hard-gate.ts
4. **A4:** sanitizeClassification before gate (P3-3) — modifies run-pipeline.ts
5. **A5:** Soft refusal patterns (P3-5) — modifies post-check.ts
6. **A6:** XSS escaping (P3-1) — modifies index.html + adds test
   (Note: test duplicates `esc()` logic in TS — add `// Mirrors browser esc()
   from index.html — keep in sync manually` comment)
7. **B1:** Config flag + orchestrator review-only path + SPF/DKIM fix (Part B)

Each step gets its own commit. Run `npm test` after each commit.

---

## How we will know it worked

- All new tests pass (capabilities regression, drum regex, sanitize ordering,
  soft refusal, XSS escaping, review-only orchestrator)
- All 176 existing tests still pass
- `npm test` exits with 0 failures
- Manual smoke test: paste a test lead into the analyze page, verify escaped
  output renders correctly

## The most likely way this plan is wrong

**P3-4 unification changes matching semantics.** The current
`guessFormatFamily()` uses regex (`/solo|guitar|acoustic|classical/i`) while
the unified version uses substring matching (`lower.includes(alias)`). For
most inputs these are equivalent, but regex can match partial words that
substring of a complete alias would miss — e.g., regex `/acoustic/i` matches
"electroacoustic" while substring "acoustic guitar" does NOT match
"electroacoustic guitar." In practice, leads don't contain
"electroacoustic," but the semantic difference exists. The regression test
matrix must cover these edge cases.

**Secondary risk:** The `FAMILY_ONLY_ALIASES` pattern is new. `"pair"` and
`"two"` appear in the family guesser but NOT in the alias map. If a future
contributor adds a new keyword and puts it in `CAPABILITIES` instead of
`FAMILY_ONLY_ALIASES` (or vice versa), the behavior diverges between family
inference and capability gating. The separation is documented but relies on
the developer reading the comment.

**Tertiary risk:** The SPF/DKIM fix makes the auth check mandatory. If Gmail
ever omits the `Authentication-Results` header for legitimate inbox messages,
leads would be silently rejected. This is unlikely (Gmail always adds this
header for inbox messages) but should be monitored via logs.

---

## Feed-Forward

- **Hardest decision:** The `"pair"`/`"two"` resolution. The initial plan added
  them as KNOWN aliases, which contradicted the "router hold logic must not
  change" constraint. Resolved by introducing `FAMILY_ONLY_ALIASES` — keywords
  that inform the family guesser for pricing but are excluded from the capability
  alias map. This preserves both `guessFormatFamily("pair") → "solo"` and
  `unknown_capability` flagging for "pair" as a format request.
- **Rejected alternatives:** (1) Adding pair/two as KNOWN — contradicts the
  plan's own non-change constraint on router hold logic. (2) Removing pair/two
  entirely — breaks the family guesser's current behavior for "a pair of
  musicians". (3) Quarantine path for SPF/DKIM failures — adds pipeline
  complexity and costs Claude API tokens for potentially spoofed emails.
  Chose mandatory reject with observability (warn log + rejection counter on
  /health). (4) Surfacing done_reason in dashboard for Phase 1 — unnecessary
  because all leads require review in review-only mode anyway.
- **Least confident:** The SPF/DKIM mandatory-reject tradeoff. If Gmail ever
  omits the `Authentication-Results` header for a legitimate inbox message,
  the lead is silently lost. The observability measures (warn log + rejection
  counter) mitigate but don't eliminate this risk. Monitor `/health` endpoint
  after deploy.

## Three Questions

1. **Hardest decision in this session?** Resolving the pair/two contradiction.
   The plan simultaneously claimed "router hold logic must not change" and
   proposed a change that removes hold triggers for pair/two leads. Introduced
   `FAMILY_ONLY_ALIASES` as a clean separation: family inference uses them,
   capability gating does not.

2. **What did you reject, and why?** (1) Adding pair/two as KNOWN aliases —
   creates an undocumented routing change. (2) Quarantine path for SPF/DKIM
   failures — pollutes the dashboard with potentially spoofed leads. (3)
   Dashboard done_reason rendering in Phase 1 — unnecessary when all leads
   are in review-only mode. (4) Silent reject without observability — makes
   legitimate failures invisible.

3. **Least confident about going into the next phase?** The SPF/DKIM
   mandatory-reject policy. It's the right security decision, but the failure
   mode (legitimate lead silently lost) is worse than the attack it prevents
   (spoofed lead in dashboard). The observability measures (warn log +
   `/health` counter) are the mitigation, but they require Alex to actively
   check. A missed lead is a missed gig.
