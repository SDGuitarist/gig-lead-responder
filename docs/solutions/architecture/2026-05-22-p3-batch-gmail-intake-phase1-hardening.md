---
title: "P3 Batch + Gmail Intake Phase 1: Capabilities Unification, Auth Hardening, Review-Only Mode"
category: architecture
tags: [capabilities, alias-map, family-guesser, spf-dkim, review-only, xss, regex, sanitization, injectable-deps, testability]
module: capabilities.ts, hard-gate.ts, router.ts, orchestrator.ts, source-validator.ts, run-pipeline.ts, post-check.ts, index.html
symptom: "Dual alias/family sources drift; 3 deferred P3 bugs; no safe entry point for Gmail automation"
root_cause: "ALEX_ALIAS_MAP and guessFormatFamily() were separate data sources with overlapping keywords. Gmail intake had no review-only mode, and SPF/DKIM was optional."
date: 2026-05-22
predecessor: 2026-04-22-capability-hardening-alias-map-soft-refusal.md
---

## Problem

Four problems converged into one cycle:

1. **Dual source of truth.** `ALEX_ALIAS_MAP` in hard-gate.ts (capability gating)
   and `guessFormatFamily()` in router.ts (format family inference) matched
   overlapping keywords from separate data structures. The predecessor doc
   explicitly flagged this: "Two sources of truth for 'what terms Alex
   recognizes.' If one is updated without the other, they'll drift."

2. **Three deferred P3 bugs** surfaced by the prior cycle's review:
   - XSS in `index.html` `kvHTML` — renders `format_requested` via innerHTML
     without escaping
   - `"drum"` substring in `NON_ALEX_FORMATS` matches inside "conundrum"
   - `sanitizeClassification()` runs after the hard gate instead of before it

3. **No safe entry point for Gmail automation.** The orchestrator's auto-send
   path calls `dispatchReply()` with no override. Flipping on Gmail polling
   would immediately send unsupervised replies.

4. **SPF/DKIM was optional.** `source-validator.ts` skipped auth checking when
   `Authentication-Results` was empty — a spoofed email could pass validation.

## Solution

### Pattern 1: Registry-Derived Singletons (CAPABILITIES)

**Created `src/capabilities.ts` as single source of truth.** One `CAPABILITIES`
array defines aliases, capability status (KNOWN/ESCALATE), and format family
per entry. Builder functions derive three consumers:

```
CAPABILITIES → buildAliasMap()     → ALIAS_MAP (hard-gate Check 3)
             → buildAliasMatcher() → ALIAS_MATCHER (pre-sorted longest-first)
             → buildFamilyGuesser()→ guessFormatFamily (router cross-family check)
```

Consumers import pre-built singletons. The builders are not re-exported
(except `buildAliasMap` for the duplicate-alias test).

**Key design decisions:**

- **FormatFamily is a union type** (`"solo" | "flamenco" | "mariachi" | "bolero"`),
  not `string`. Catches typos at compile time.
- **Duplicate alias guard.** `buildAliasMap()` throws at module load if two
  entries share an alias. Prevents silent overwrites.
- **Normalization inside builders.** `buildFamilyGuesser()` normalizes input
  internally via `normalizeFormatText()`. Consumers don't need to remember.

### Pattern 2: FAMILY_ONLY_ALIASES (Routing-Safe Keyword Separation)

**Problem:** The old `guessFormatFamily()` matched `"pair"` and `"two"` to
the "solo" family (for pricing). Adding them to `CAPABILITIES` as KNOWN would
remove the `unknown_capability` flag, changing router hold behavior — violating
the plan's constraint.

**Solution:** A separate `FAMILY_ONLY_ALIASES` list. Keywords in this list are
merged into the family guesser's search pairs but excluded from the alias map:

```typescript
const FAMILY_ONLY_ALIASES = [
  { alias: "pair", family: "solo" },
  { alias: "two", family: "solo" },
];
```

`buildFamilyGuesser()` explicitly merges these before sorting. The merge
happens inside the builder, not at the consumer site, so it can't be forgotten.

**Why not a `familyOnly: true` flag on CapabilityEntry?** Because "pair" and
"two" are quantity words, not capability descriptions. They don't belong in the
capabilities registry — they're pricing hints that happen to correlate with
a format family. Keeping them separate makes the semantic distinction explicit.

**Risk:** A future contributor could add a keyword to `CAPABILITIES` instead of
`FAMILY_ONLY_ALIASES` (or vice versa), changing routing/gating behavior.
The comment documents the distinction, but it relies on the developer reading it.
The regression test matrix catches behavioral drift if tests are maintained.

### Pattern 3: Deferred P3 Resolution

Three deferred bugs from the predecessor cycle, resolved:

**P3-1 (XSS):** Added `esc()` to `index.html` using DOM-based escaping
(`textContent → innerHTML`). Applied to both labels and values in `kvHTML()`.
Gate status rendering extracted from kvHTML to avoid double-escaping its
structural `<span>` wrapper — the status text itself passes through `esc()`.

**P3-2 (Drum regex):** Removed `"drum"` and `"drummer"` from `NON_ALEX_FORMATS`
substring array. Added `NON_ALEX_PATTERNS` with word-boundary regex:
`/\bdrum(?:s|mer|line)?\b/iu`. This catches drum/drums/drummer/drumline but
not eardrum/conundrum. "drumline" is a new intentional decline trigger.

**P3-3 (Sanitize ordering):** Moved `sanitizeClassification()` call from after
the hard gate to immediately after `verifyClassificationHeuristics()`. All
downstream consumers (hard gate, pricing, enrichment, context, generate, verify)
now see truncated fields. Belt-and-suspenders: prompt builders keep their own
`sanitizeClassification()` calls.

### Pattern 4: Mandatory Auth Reject with Observability

**Changed SPF/DKIM from optional to mandatory.** The old code:
```typescript
if (authenticationResults && !checkAuthHeaders(authenticationResults))
```
Skipped the check when the header was empty. The fix:
```typescript
if (!checkAuthHeaders(authenticationResults))
```

`checkAuthHeaders("")` returns false (first line: `if (!authResults) return false`),
so empty header now rejects.

**Operational tradeoff:** Mandatory reject is the right security call — a
spoofed email would consume Claude API tokens. But if Gmail ever omits the
`Authentication-Results` header for a legitimate inbox message, the lead is
silently lost.

**Observability measures:**
1. `console.warn` (not `console.log`) for rejections — stands out in Railway logs
2. In-memory rejection counter exposed at `/health` endpoint
3. Startup confirmation log (which sender patterns and SPF/DKIM policy are active)

Alex can check `/health` to see if legitimate emails are being rejected.
If the counter climbs unexpectedly, investigate before assuming spoofing.

### Pattern 5: Review-Only Orchestrator Mode

**New config field:** `autoSendEnabled: boolean` (default `false`). When false,
leads that would auto-send get stored with `status: "sent"` and
`done_reason: "review-only: would-auto-send via {platform}"`. SMS fires with
"REVIEW" prefix instead of "HOLD". `dispatchReply()` is unreachable.

**Why `"sent"` not a new status:** Adding a status requires type changes,
migration, dashboard filter changes, and API contract changes. `"sent"` already
means "processed, has drafts, ready for human action" — the semantic match.
`done_reason` distinguishes natural holds from review-only overrides.

**Phase 2 transition:** Flipping `AUTO_SEND_ENABLED=true` only affects new
leads. Existing review-only leads stay in "sent" and must be manually approved.
Dashboard rendering of `done_reason` is deferred to Phase 2.

### Pattern 6: Injectable Dependencies for Testability

**Problem:** `processLead()` has 10+ side-effect imports (DB, SMS, pipeline,
logger, source-validator). Testing the review-only branch required either
experimental module mocking or dependency injection.

**Solution:** Extracted `handleAutoSendDecision()` with a `deps` parameter that
defaults to the real module-level imports:

```typescript
export async function handleAutoSendDecision(
  opts: { config, leadId, platform, ... },
  deps: AutoSendDeps = { updateLead, sendSms, logLead, dispatchReply },
): Promise<void>
```

In production, `processLead()` calls it without `deps` — defaults bind to the
real functions. In tests, injectable fakes verify:
- `dispatchReply` is unreachable when `autoSendEnabled=false`
- `updateLead` receives `status: "sent"` + review-only `done_reason`
- SMS fires with "REVIEW" prefix (or suppressed when `dryRun=true`)
- Log status is `"review-only"` or `"dry-run"` as appropriate

**General rule:** When a function has too many import-level dependencies to mock,
extract the testable decision logic with a default-injected deps parameter.
Production callers don't change. Tests inject fakes.

## Files Changed

### New files
- `src/capabilities.ts` — unified CAPABILITIES registry + builders + singletons
- `src/capabilities.test.ts` — 57 regression tests
- `src/orchestrator.test.ts` — 9 tests for review-only/auto-send decision
- `src/config.test.ts` — 4 tests for autoSendEnabled config
- `src/source-validator.test.ts` — 10 tests (8 SPF/DKIM + 2 rejection counter)
- `src/xss-escape.test.ts` — 5 tests for kvHTML escaping

### Modified files
- `src/pipeline/hard-gate.ts` — import ALIAS_MATCHER, normalize before all checks, drum regex
- `src/automation/router.ts` — import guessFormatFamily singleton
- `src/run-pipeline.ts` — sanitizeClassification before hard gate
- `src/pipeline/post-check.ts` — 2 new soft-refusal patterns
- `public/index.html` — esc() helper, kvHTML escaping, gate_status extraction
- `src/automation/config.ts` — autoSendEnabled field
- `src/automation/orchestrator.ts` — review-only path, handleAutoSendDecision extraction
- `src/automation/source-validator.ts` — mandatory SPF/DKIM, rejection counter
- `src/automation/logger.ts` — "review-only" added to LeadLogEntry status union
- `src/app.ts` — rejectedEmails in /health

## Related Patterns

- **Predecessor:** `2026-04-22-capability-hardening-alias-map-soft-refusal.md` — this
  cycle resolves all 3 deferred P3s and the dual-source-of-truth warning from
  that doc's Three Questions section.
- **Escape at interpolation site:** `escape-at-interpolation-site.md` — the XSS
  fix follows this principle (esc() inside kvHTML, not at call sites).
- **Human-in-the-loop lifecycle:** `follow-up-pipeline-human-in-the-loop-lifecycle.md` —
  review-only mode follows the same pattern (human approval gate before action).
- **Stale rates / over-restrictive regex:** `2026-03-07-stale-rates-and-over-restrictive-regex.md` —
  drum word-boundary regex follows the lesson: use explicit boundaries, not quantifiers.

## Three Questions

1. **Hardest pattern to extract from the fixes?** The FAMILY_ONLY_ALIASES
   separation. It looks like a simple list, but the design decision encodes
   a semantic distinction (quantity words vs capability descriptions) that
   prevents a routing behavior change. If the distinction isn't understood,
   a future contributor will merge the lists and break hold behavior. The
   regression test matrix is the safety net, not the comment.

2. **What did you consider documenting but left out?** The `dryRun x
   autoSendEnabled` interaction matrix (4 combinations). It's documented in
   config.ts comments and tested, but it's a runtime behavior matrix, not an
   architectural pattern. Including it here would bloat the doc without adding
   reusable insight. The general pattern is: "two boolean flags create 4
   behaviors — document the matrix where it's consumed, not in the architecture
   doc."

3. **What might future sessions miss that this solution doesn't cover?** The
   `normalizeFormatText()` function handles whitespace but not Unicode
   normalization (accented characters, fullwidth chars). A lead with
   `"flam\u00e9nco"` (precomposed) vs `"flame\u0301nco"` (decomposed) would
   match differently. This hasn't appeared in production data, but it's the
   kind of edge case that substring matching doesn't handle well. If it
   surfaces, consider NFC normalization in `normalizeFormatText()`.
