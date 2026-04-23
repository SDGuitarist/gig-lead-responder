---
title: "Capability Hardening: Alias Map + Soft Refusal Detection"
phase: plan
date: 2026-04-22
revised: 2026-04-22
brainstorm_ref: ~/Projects/expert-pipeline/docs/brainstorms/2026-04-22-voice-enrichment-without-agent-authority.md
feed_forward:
  risk: "If the LR's Sonnet classifier starts exhibiting the same synthesis bias as Opus 4.7 (compressing 'plays guitar AND ukulele' into 'guitar guy'), the hard gate's negative-only list won't catch it."
  verify_first: true
---

## Prior Phase Risk

> "Least confident: Whether the debrief lessons actually make it into the agent's drafts today." (from brainstorm)

Not directly applicable to this plan. This plan hardens the LR pipeline itself, not the expert-pipeline enrichment path.

The relevant risk carried forward: the hard gate uses a negative list only (`NON_ALEX_FORMATS`). An instrument that's not on the negative list AND not something Alex offers (charango, mandolin, vihuela) passes the gate silently. The classifier might map it to a plausible-sounding format, and the pipeline generates a draft for something Alex can't actually deliver.

## Review Findings Applied (v2)

Three review agents (architecture, simplicity, pattern) ran in parallel. Consensus changes:

1. **Removed `CAPABILITIES` object** -- no consumer in the plan. Dead code. YAGNI.
2. **Inlined `ALIAS_MAP` into `hard-gate.ts`** -- only one consumer, no need for a new file. Matches how `NON_ALEX_FORMATS` and `RED_FLAG_PATTERNS` already live in the same file.
3. **Soft refusal checks both drafts** -- full AND compressed, matching existing post-check pattern (`banned_phrase_full` / `banned_phrase_compressed`).
4. **Cut 2 broad regex patterns** -- "primarily focus" and "while X isn't my main" false-positive on valid Alex sentences. Ship 6 tight patterns, expand from production data.
5. **Fixed test location** -- `src/*.test.ts`, not `tests/`. Uses `node:test` + `node:assert/strict`.
6. **Fixed verification commands** -- `--test-name-pattern`, not `--grep`.
7. **Clarified matching strategy** -- word-boundary substring matching (like `NON_ALEX_FORMATS` uses), not exact string equality.
8. **Noted `guessFormatFamily` overlap** -- existing function in `src/router.ts` does similar keyword matching. Comment added to alias map referencing it; unification deferred to a future session.

## What exactly is changing?

Two additions to existing files. No new files, no new pipeline stages, no architectural changes.

### 1. Alias map + capability check in hard gate (`src/pipeline/hard-gate.ts`)

Add an `ALEX_ALIAS_MAP` constant and a Check 3 after the existing two checks.

```typescript
// Source: Alex's known instruments and formats. Keep in sync with rate cards.
// See also: guessFormatFamily() in src/router.ts (overlapping keyword matching
// for a different purpose — format family routing vs capability gating).
const ALEX_ALIAS_MAP: Record<string, "KNOWN" | "ESCALATE"> = {
  // Guitar variants
  "guitar":             "KNOWN",
  "acoustic guitar":    "KNOWN",
  "guitarist":          "KNOWN",
  "spanish guitar":     "KNOWN",
  "classical guitar":   "KNOWN",
  "nylon string":       "KNOWN",
  "flamenco":           "KNOWN",
  "flamenco guitar":    "KNOWN",

  // Ukulele (maps to solo format for pricing)
  "ukulele":            "KNOWN",
  "uke":                "KNOWN",
  "ukulele player":     "KNOWN",

  // Ensembles Alex sources
  "mariachi":           "KNOWN",
  "mariachi band":      "KNOWN",
  "mariachi ensemble":  "KNOWN",
  "bolero":             "KNOWN",
  "bolero trio":        "KNOWN",
  "trio":               "KNOWN",

  // Generic terms that are fine
  "solo":               "KNOWN",
  "duo":                "KNOWN",
  "musician":           "KNOWN",
  "live music":         "KNOWN",
  "background music":   "KNOWN",

  // Ambiguous — escalate, don't guess
  "latin band":         "ESCALATE",
  "spanish music":      "ESCALATE",
  "hawaiian music":     "ESCALATE",
  "latin music":        "ESCALATE",
  "ensemble":           "ESCALATE",
};
```

The check logic, added as Check 3 inside `checkHardGate()`:

```typescript
// --- Check 3: Capability alias map (positive-list check) ---
// Only runs when Check 1 passed (format_requested not in NON_ALEX_FORMATS).
// Uses word-boundary substring matching, same approach as NON_ALEX_FORMATS.
if (fail_reasons.length === 0 && requested) {
  const matched = Object.entries(ALEX_ALIAS_MAP).find(
    ([alias]) => requested.includes(alias)
  );
  if (matched) {
    if (matched[1] === "ESCALATE") {
      flags.push("ambiguous_capability");
    }
    // "KNOWN" — no flag needed
  } else {
    flags.push("unknown_capability");
  }
}
```

**Matching strategy:** Word-boundary substring matching via `requested.includes(alias)`, consistent with how `NON_ALEX_FORMATS` is checked on lines 88-96. The alias map is iterated longest-first if needed, but in practice `format_requested` from the classifier is typically a clean term like "ukulele" or "spanish guitar", not a sentence.

**Flags go into `HardGateResult.flags`** (existing field), which `run-pipeline.ts:99-104` already attaches to `classification.flagged_concerns`. The dashboard already shows flagged concerns.

**Critical: unknown capability is a FLAG, not a FAIL.** The pipeline generates a draft. The dashboard shows a yellow indicator. Alex reviews before sending. This matches the existing pattern (red flags like "commission_structure" don't block, they flag).

### 2. Soft refusal detection (`src/pipeline/post-check.ts`)

Add a new check after the existing banned phrases check. Checks BOTH `full_draft` and `compressed_draft`, matching the existing dual-draft pattern.

```typescript
// --- Soft refusal / fit-undermining patterns ---
// Catches AI drafts that undermine Alex's capability for an eligible format.
// These should never appear — the LR voice rules prohibit vendor-speak.
const SOFT_REFUSAL_PATTERNS: RegExp[] = [
  /\bnot (?:really )?my (?:main |primary )?(?:specialty|instrument|focus)\b/i,
  /\bmay not be the best fit\b/i,
  /\bif you're set on\b/i,
  /\bnot (?:really )?(?:something|what) (?:I|we) (?:typically |usually )?(?:do|offer|play)\b/i,
  /\byou might (?:want to |be better off )(?:look|search|try)\b/i,
  /\bi(?:'d| would) recommend (?:looking|searching|trying) elsewhere\b/i,
];
```

Check logic (after existing banned phrases loop):

```typescript
// --- Check: soft refusal / fit-undermining language ---
for (const pattern of SOFT_REFUSAL_PATTERNS) {
  if (pattern.test(cleanedFull)) {
    violations.push(`soft_refusal_full: "${pattern.source}"`);
  }
  if (pattern.test(cleanedCompressed)) {
    violations.push(`soft_refusal_compressed: "${pattern.source}"`);
  }
}
```

**6 patterns shipped, 2 deferred.** "primarily focus" and "while X isn't my main" were cut because they false-positive on valid Alex sentences ("I primarily focus on Spanish and classical guitar for events like yours"). Add narrower versions when production data shows refusals slipping through the 6 tight patterns.

## What must NOT change?

1. **The existing pipeline flow.** No new stages, no reordering. Hard gate still runs after classify, post-check still runs after generate+verify.
2. **Existing hard gate behavior.** `NON_ALEX_FORMATS` still auto-declines. Check 3 runs AFTER, only for leads that pass Check 1.
3. **The 153 existing tests.** All must continue passing.
4. **The `HardGateResult` interface.** No new fields -- `flags` already exists and is the right place.
5. **The `PostCheckResult` interface.** No new fields -- `violations` already exists.
6. **No blocking on unknown capabilities.** Flag only. Alex decides.

## Acceptance Tests

### Alias Map (Check 3)

```
WHEN format_requested is "ukulele" THE SYSTEM SHALL pass hard gate with no capability flags
WHEN format_requested is "uke" THE SYSTEM SHALL pass hard gate with no capability flags
WHEN format_requested is "spanish guitar" THE SYSTEM SHALL pass hard gate with no capability flags
WHEN format_requested is "mariachi band" THE SYSTEM SHALL pass hard gate with no capability flags
WHEN format_requested is "latin band" THE SYSTEM SHALL pass hard gate with flag "ambiguous_capability"
WHEN format_requested is "spanish music" THE SYSTEM SHALL pass hard gate with flag "ambiguous_capability"
WHEN format_requested is "charango" THE SYSTEM SHALL pass hard gate with flag "unknown_capability"
WHEN format_requested is "mandolin" THE SYSTEM SHALL pass hard gate with flag "unknown_capability"
WHEN format_requested is "vihuela" THE SYSTEM SHALL pass hard gate with flag "unknown_capability"
WHEN format_requested is "DJ" THE SYSTEM SHALL fail hard gate (existing behavior unchanged)
WHEN format_requested is "pianist" THE SYSTEM SHALL fail hard gate (existing behavior unchanged)
```

### Soft Refusal Detection

```
WHEN full_draft contains "not really my specialty" THE SYSTEM SHALL add violation "soft_refusal_full"
WHEN compressed_draft contains "not really my specialty" THE SYSTEM SHALL add violation "soft_refusal_compressed"
WHEN full_draft contains "may not be the best fit" THE SYSTEM SHALL add violation "soft_refusal_full"
WHEN full_draft contains "you might want to look elsewhere" THE SYSTEM SHALL add violation "soft_refusal_full"
WHEN full_draft contains "not something I typically offer" THE SYSTEM SHALL add violation "soft_refusal_full"
WHEN full_draft contains "A solo ukulele set for your ceremony" THE SYSTEM SHALL NOT add any soft refusal violation
WHEN full_draft contains "I focus the setlist on your playlist" THE SYSTEM SHALL NOT add any soft refusal violation
WHEN full_draft contains "I primarily focus on Spanish and classical guitar for events like yours" THE SYSTEM SHALL NOT add any soft refusal violation (cut pattern -- valid Alex sentence)
```

### Regression

```
WHEN any existing test runs THE SYSTEM SHALL pass (153 tests unchanged)
WHEN format_requested is "DJ" THE SYSTEM SHALL still fail with template decline (existing)
WHEN format_requested is "guitar" THE SYSTEM SHALL still pass with no flags (existing behavior preserved)
```

### Verification Commands

```bash
npm test                                               # all 153+ tests pass
npm test -- --test-name-pattern "capability"            # new alias map tests pass
npm test -- --test-name-pattern "soft.refusal"          # new soft refusal tests pass
```

## Scope

| File | Change | Lines |
|---|---|---|
| `src/pipeline/hard-gate.ts` | Add `ALEX_ALIAS_MAP` + Check 3 | ~45 |
| `src/pipeline/post-check.ts` | Add `SOFT_REFUSAL_PATTERNS` + dual-draft check | ~15 |
| `src/hard-gate.test.ts` | New: alias map tests (11 cases) | ~40 |
| `src/post-check.test.ts` | New: soft refusal tests (8 cases) | ~30 |
| **Total** | | **~130** |

Two incremental commits: (1) alias map + hard gate Check 3 + tests, (2) soft refusal detection + tests.

## What is the most likely way this plan is wrong?

**The alias map matching is too naive.** `requested.includes(alias)` is substring matching. If the classifier returns "acoustic guitar player" and the alias is "acoustic guitar", the substring match works. But if the classifier returns something like "guitar/ukulele", the "guitar" alias matches first and returns KNOWN before checking "ukulele". This is actually fine (both are KNOWN), but for ESCALATE entries, order could matter.

Mitigation: Iterate the alias map longest-first to prefer specific matches over generic ones. And the unknown_capability flag is advisory, not blocking -- a false "unknown" just shows a yellow dot in the dashboard. Low blast radius.

**Second risk:** The 6 soft refusal patterns may not catch every form of soft refusal. The AI could invent new hedging language. Mitigation: start with 6 tight patterns, review production drafts monthly, expand from real examples rather than hypotheticals.

**Third risk (noted by reviewers):** `guessFormatFamily()` in `src/router.ts` does overlapping keyword matching. Two sources of truth for "what terms map to Alex's capabilities." If someone adds an alias to the map but not to `guessFormatFamily` (or vice versa), they'll drift. Deferred: unify in a future session. For now, a code comment in both files references the other.

## Feed-Forward

- **Hardest decision:** Whether to make unknown capabilities block (escalate) or flag (advisory). Chose flag because the existing pipeline has no blocking escalation path, and adding one would change the architecture. Flagging is consistent with how red flags already work.
- **Rejected alternatives:** (1) The full Stage 1/Stage 2 refactor from the Claude Projects document -- sound theory, wrong target. (2) A separate `CAPABILITIES` data object -- no consumer, removed after review. (3) Two broad regex patterns ("primarily focus", "while X isn't my main") -- false-positive risk, cut after review.
- **Least confident:** Whether the alias map needs fuzzy matching (Levenshtein distance, stemming) or if substring matches are sufficient. Real lead data would answer this -- start with substring, add fuzzy if the "unknown_capability" flag fires too often on leads Alex can actually fulfill.
