# Brainstorm: P3 Batch + Gmail Auto-Intake

**Date:** 2026-05-22
**Scope:** Phase 1 of 4-phase roadmap
**Baseline:** 176 tests passing, last cycle: Capability Hardening (2026-04-22)

---

### Prior Phase Risk

> "guessFormatFamily() in router.ts overlaps with ALEX_ALIAS_MAP. Two sources
> of truth for 'what terms Alex recognizes.' Cross-reference comments exist,
> but unification would be better."

This brainstorm directly addresses that risk by auditing the overlap and
proposing a unification strategy (see P3-4 below).

---

## Part A: Resolve 6 Deferred P3s

### P3-1: XSS in index.html kvHTML

**Current state:** `public/index.html:216-219` — the `kvHTML()` function builds
HTML with raw string interpolation. Both `label` and `value` are injected via
`innerHTML` without escaping. The gate_status value comes from AI output and
could contain HTML.

**What dashboard.html does:** Has an `esc()` function at line 301:
```js
function esc(s) {
  if (!s) return '';
  _escDiv.textContent = s;
  return _escDiv.innerHTML;
}
```

**Fix:** Copy the same `esc()` helper into `index.html` and wrap both `label`
and `value` in the `kvHTML()` template literal.

**The gate_status `<span>` problem:** Line 250 builds
`<span class="gate-pass">PASS</span>` and passes it as a kvHTML value. If
kvHTML escapes all values, the `<span>` renders as visible text. Fix: build
the gate_status `<span>` *outside* kvHTML — set innerHTML directly on that
element, escaping only the status text inside. Or: pass a `raw` flag to kvHTML
for values that are already safe structural HTML. Simpler option: just build
gate_status separately with `esc()` on the dynamic text, keep kvHTML escaping
everything else.

**Risk:** Low. Purely additive. The `renderResults` function at line 222 also
builds HTML for several fields (Stealth Premium signals, Concerns) — these all
flow through `kvHTML` so they'll be covered by the fix.

**Test:** Manual test: pass `<img src=x onerror=alert(1)>` as a classification
field value and verify the rendered output shows the escaped text, not an
image tag.

---

### P3-2: "drum" substring false-positive in NON_ALEX_FORMATS

**Current state:** `hard-gate.ts:25` has `"drummer"` AND `"drum"` in the
NON_ALEX_FORMATS list. The check at line 136 uses `requested.includes(f)`,
so `"drum"` matches `"drum circle"` (correct) but also `"drumline"` or
hypothetically any future word containing "drum" as a substring.

More importantly, `"drum"` as a standalone entry is redundant with `"drummer"`
since the matcher is substring-based.

**The real problem:** ALL entries in NON_ALEX_FORMATS use substring matching
(`requested.includes(f)`). This means:
- `"sax player"` matches `"relaxed sax player vibe"` (correct) but also
  hypothetically `"sax player recommendation"` (probably fine actually)
- `"piano player"` matches any string containing "piano player" (correct)
- `"drum"` is the only entry short enough to cause real false positives

**Fix approach:** Keep NON_ALEX_FORMATS as a `string[]` for most entries —
they're multi-word phrases where substring matching is fine ("piano player",
"string quartet"). Only fix the actual problem: replace `"drum"` and
`"drummer"` with a single word-boundary regex check.

For `"drum"`: use `/\bdrum(?:s|mer|line)?\b/i` — catches "drum", "drums",
"drummer", "drumline" while rejecting "eardrum". Remove both `"drummer"` and
`"drum"` from the string array; add the regex to a separate short list of
pattern-based entries (same shape as RED_FLAG_PATTERNS).

The band check at line 131 and the remaining substring checks stay as-is —
they work correctly for multi-word entries.

**Risk:** Low. Minimal change surface — only the drum entries move to regex.

**Test:** Test that "drum circle" and "drummer" still trigger decline,
but "acoustic guitar" (which shouldn't contain any match) doesn't, and
that words like "eardrum" don't false-positive.

---

### P3-3: Move sanitizeClassification() earlier in pipeline

**Current state:** `sanitizeClassification()` is only called inside the prompt
builders (`src/prompts/generate.ts:39` and `src/prompts/verify.ts:24`). It
truncates free-text fields to 200 chars to prevent prompt stuffing.

The hard gate at `run-pipeline.ts:115` runs `checkHardGate(verifiedClassification, rawText)`
BEFORE sanitization happens. This means the hard gate sees un-truncated
`format_requested` strings.

**Why this matters:** If an attacker stuffs `format_requested` with a 10K
string, the hard gate processes all of it through regex matching and substring
checks. The alias map sorts and iterates over all entries for each check. While
this isn't a security vulnerability per se (the gate uses `.includes()` and
regex, not AI), it's a defense-in-depth gap.

**Fix:** Call `sanitizeClassification()` immediately after classification
verification at `run-pipeline.ts:107`, before the hard gate at line 115.
The sanitized classification flows through the rest of the pipeline.

**What changes:** `verifiedClassification` becomes sanitized before the hard
gate, travel lookup, pricing, enrichment, and all downstream stages.

**What must NOT change:** The prompt builders still call `sanitizeClassification()`
themselves for belt-and-suspenders safety. Don't remove those calls — they're
the last line of defense if someone refactors the pipeline later.

**Risk:** Very low. The sanitization is pure truncation — it doesn't alter
semantics for strings under 200 chars, which is all legitimate lead data.

**Test:** Test that a classification with a 500-char `format_requested` gets
truncated before the hard gate runs, and that the gate still works correctly
on the truncated string.

---

### P3-4: Unify ALEX_ALIAS_MAP with guessFormatFamily()

**Overlap audit:**

| Keyword | ALEX_ALIAS_MAP (hard-gate.ts) | guessFormatFamily (router.ts) |
|---------|-------------------------------|-------------------------------|
| mariachi | KNOWN | "mariachi" family |
| flamenco | KNOWN | "flamenco" family |
| bolero | KNOWN | "bolero" family |
| guitar/acoustic/classical | KNOWN | "solo" family |
| solo | KNOWN | "solo" family |
| duo | KNOWN | "solo" family |
| ukulele/uke | KNOWN | (missing) |
| trio | KNOWN | (missing) |
| mariachi band/ensemble | KNOWN | "mariachi" (only via "mariachi") |
| latin band/spanish music | ESCALATE | (missing) |
| hawaiian music | ESCALATE | (missing) |
| live music/background music/musician | KNOWN | (missing) |

**Two different questions:**
- ALEX_ALIAS_MAP asks: "Is this something Alex can do?" (KNOWN/ESCALATE/unknown)
- `guessFormatFamily()` asks: "What pricing family does this belong to?" (solo/flamenco/mariachi/bolero/null)

**Why they drift:** They serve different purposes but share keyword lists.
When someone adds "bolero trio" to the alias map, they might forget to add
the pattern to `guessFormatFamily()`. The cross-reference comment in
hard-gate.ts:32 is the only link.

**Proposed unification:**

Create a single canonical source: `src/capabilities.ts` with a data structure
that encodes both questions:

```ts
interface CapabilityEntry {
  aliases: string[];           // all ways this capability is expressed
  status: "KNOWN" | "ESCALATE";
  formatFamily: string | null; // null = can't determine family from this alias
}

const CAPABILITIES: CapabilityEntry[] = [
  {
    aliases: ["guitar", "acoustic guitar", "guitarist", "spanish guitar",
              "classical guitar", "nylon string"],
    status: "KNOWN",
    formatFamily: "solo",
  },
  {
    aliases: ["flamenco", "flamenco guitar"],
    status: "KNOWN",
    formatFamily: "flamenco",
  },
  // ... etc
];
```

Then derive both maps:
- `buildAliasMap(CAPABILITIES)` -> the KNOWN/ESCALATE map for hard-gate.ts
- `buildFamilyMap(CAPABILITIES)` -> the family guesser for router.ts

**NON_ALEX_FORMATS stays separate.** It's a *negative* list (things Alex
doesn't do). CAPABILITIES is a *positive* list (things Alex does do). These
are different concepts — a unified structure would be awkward ("status:
DECLINED"?). NON_ALEX_FORMATS remains in hard-gate.ts.

**Rejected alternative:** Keep both but add a lint/test that asserts every
keyword in one appears in the other. Rejected because it's more work to
maintain than a single source, and the test would need updating every time
a keyword is added.

**Risk:** Medium. This touches two files that are both on the hot path.
Need to ensure the derived maps produce identical behavior to the current
hardcoded ones. Write a snapshot test that compares old vs new output for
every existing keyword.

**Test:** Snapshot test: feed every keyword from both current sources through
the new unified source and assert identical results.

---

### P3-5: Add 2 deferred soft refusal patterns

**Current state:** `post-check.ts:41-48` has 6 patterns. Two were deferred
from the capability hardening cycle due to false-positive risk:
- `"primarily focus"` — AI might write "I primarily focus on Spanish guitar"
  (which is a *positive* statement about Alex's capability, not a refusal)
- `"while X isn't my main"` — AI might write "while this isn't my main
  performance style" (clear soft refusal)

**Analysis and decision:**

The broad pattern `/\bprimarily (?:focus|specialize)\b/i` would flag positive
statements like "I primarily focus on creating the perfect atmosphere." That's
a false positive — the sentence is about Alex's strength, not a limitation.

**Decision: use the narrow pattern with negative context words.**

```ts
/\bprimarily (?:focus|specialize)(?:s)? (?:on|in) (?:other|different)\b/i,
/\bwhile\b.{1,30}\bisn't my (?:main|primary)\b/i,
```

The first only fires when followed by "other" or "different" — the words
that make it a refusal. This misses "I primarily focus on guitar, not drums"
but that sentence structure is rare in AI output (the AI hedges with generic
phrases, not specific comparisons). If production shows misses, widen later.

The second uses a bounded `.{1,30}` gap to catch variations like "while
flamenco isn't my main style" without ReDoS risk.

**Risk:** Low. These run in post-check (after AI generation), so a false
positive causes a retry, not a crash. The cost is one extra AI call, not
a wrong response to a client.

**Test cases (exact):**
- `"I primarily focus on other styles"` -> VIOLATION
- `"I primarily specialize in different genres"` -> VIOLATION
- `"while drums isn't my main instrument"` -> VIOLATION
- `"while this style isn't my primary focus"` -> VIOLATION
- `"I primarily focus on creating the perfect atmosphere"` -> NO violation
- `"I focus primarily on Spanish guitar"` -> NO violation (word order)
- `"My primary focus is live acoustic music"` -> NO violation (noun form)

---

### P3-6: Improve alias matching

**Current state:** ALEX_ALIAS_MAP matching in hard-gate.ts:154-165 uses
`requested.includes(alias)` with longest-first sort. This catches exact
substrings but misses:
- Plurals: "guitarists" doesn't match "guitarist"
- Minor typos: "flamenko" doesn't match "flamenco"
- Spacing: "acoustic  guitar" (double space) doesn't match "acoustic guitar"

**Approach: substring/normalization first, Levenshtein only if justified.**

Step 1 — Normalize before matching:
- Collapse whitespace: `text.replace(/\s+/g, ' ').trim()`
- Lowercase (already done)

Step 2 — Add plural aliases directly to the alias list.
Don't strip trailing "s" programmatically — too fragile ("bass" -> "bas",
"class" -> "clas"). Instead, add the handful of plurals that real leads
actually use: `"guitarists"`, `"musicians"`, `"ukuleles"`. This adds ~5
entries and is explicit, not magical. The capabilities.ts unification (P3-4)
makes this a single place to add them.

Step 3 — Levenshtein: NOT justified for this cycle.
- The unknown_capability flag fires rarely in production (verified during
  capability hardening cycle — most leads use recognizable terms)
- Levenshtein adds a dependency and complexity
- False positives from Levenshtein (matching "drum" to "duo" at distance 2)
  could be worse than missing a rare typo
- **Decision: defer Levenshtein.** If unknown_capability fires > 5% of leads
  in the next month, revisit.

**Test:** Test normalization: "acoustic  guitar" (double space) matches.
Test explicit plurals: "guitarists" matches via alias entry. Test that no
new dependency was added (package.json unchanged).

---

## Part B: Gmail Auto-Intake

### Existing Architecture Audit

The Gmail automation path is **already built and running in production**:

| Module | Status | Purpose |
|--------|--------|---------|
| `src/automation/config.ts` | Working | Loads all config from env vars, `dryRun` defaults true |
| `src/automation/gmail-watcher.ts` | Working | OAuth2 + Gmail API polling + message parsing |
| `src/automation/source-validator.ts` | Working | Sender allowlist + SPF/DKIM checks |
| `src/automation/parsers/` | Working | Platform-specific email parsers (GigSalad, Yelp, Squarespace) |
| `src/automation/dedup.ts` | Working | Dedup via `processed_emails` table |
| `src/automation/orchestrator.ts` | Working | Full pipeline: validate -> parse -> run pipeline -> route -> send |
| `src/automation/router.ts` | Working | Route to auto-send or hold based on guardrails |
| `src/automation/poller.ts` | Working | Polling loop, credential bootstrap from env vars |
| `src/server.ts` | Working | Starts poller on boot (non-fatal if no Gmail creds) |

**Key finding: The intake path already exists.** The orchestrator already:
1. Validates source emails
2. Parses lead text
3. Runs the 5-stage pipeline
4. Stores results in the leads DB
5. Routes to auto-send or hold

### What Needs to Change for Review-Only Mode

The current architecture has auto-send behavior in `orchestrator.ts:177-209`.
When `routeLead()` returns `action: "auto-send"`, the orchestrator calls
`dispatchReply()` which sends via Gmail/Yelp/GigSalad portals.

**For Phase 1, ALL leads must go to hold/review state.** No auto-send.

**Three approaches considered:**

1. **Config flag: `autoSendEnabled: false`** — Add a config option that the
   orchestrator checks before dispatching. When false, treat all auto-send
   results as holds. Simple, reversible, minimal code change.

2. **Force dryRun mode** — Set `DRY_RUN=true` in production. Problem: this
   also affects SMS notifications, which we want to keep.

3. **Modify router to always return hold** — Wrong. The router logic is
   correct; we want to *see* what it would auto-send but not actually send.

**Decision: Approach 1 (config flag).**

Add `autoSendEnabled: boolean` to `AutomationConfig` (default `false`).
In the orchestrator, when `routeLead()` returns `action: "auto-send"` and
`config.autoSendEnabled === false`:
- Log as "would-auto-send" (for monitoring what the system would do)
- Store in DB with status "review" (or "sent" — same as current hold path)
- Send SMS notification so Alex knows to check dashboard
- Do NOT call `dispatchReply()`

This preserves the routing logic so we can see which leads *would* auto-send,
while enforcing review-only behavior.

### OAuth Credential Handling on Railway

Already solved in `poller.ts:20-31` — `bootstrapCredentialFiles()` writes
`GMAIL_CREDENTIALS_JSON` and `GMAIL_TOKEN_JSON` env vars to files on disk.
The Gmail API client reads from files. Railway stores secrets as env vars.

**Gap:** Token refresh. The `gmail-watcher.ts:41-47` auto-saves refreshed
tokens to disk. On Railway, this works within a single deploy but is lost
on redeploy. The token env var becomes stale.

**Mitigation:** Not a blocker for Phase 1. Token refresh is rare (Google
OAuth2 tokens last ~1 hour, refresh tokens last indefinitely unless revoked).
On redeploy, the env var token is re-written to disk and the googleapis
library handles refresh. The only risk is if the refresh token itself is
revoked — but that requires manual action in Google Console.

**For Phase 1:** Accept this behavior. If token issues arise, the poller
logs clearly and stops gracefully (`authFailed` flag in poller.ts:79).

### What Tests Prove

**Gmail intake stores leads:**
- Integration test: mock Gmail API to return a test message, verify
  `insertLead` is called with correct fields and lead appears in DB

**No auto-send:**
- Unit test: with `autoSendEnabled: false`, verify `dispatchReply` is
  never called even when router returns `action: "auto-send"`
- Integration test: process a lead end-to-end, verify DB status is
  "review" not "done"

**Existing tests continue passing:**
- Run `npm test` — all 176 baseline tests must pass

---

## Approach Summary

| Item | Approach | Risk | New Dependencies |
|------|----------|------|------------------|
| P3-1 XSS | Copy `esc()` from dashboard.html to index.html | Low | None |
| P3-2 drum | Word-boundary regex for "drum" only; rest stays substring | Low | None |
| P3-3 sanitize ordering | Call sanitizeClassification() before hard gate | Very low | None |
| P3-4 alias unification | New `src/capabilities.ts` as single source | Medium | None |
| P3-5 soft refusal | Add 2 regex patterns to post-check.ts | Low | None |
| P3-6 alias matching | Normalize whitespace + explicit plural aliases | Low | None |
| Part B Gmail intake | Config flag `autoSendEnabled: false` | Low | None |

**Total new files:** 1 (`src/capabilities.ts`)
**Modified files:** ~6 (index.html, hard-gate.ts, run-pipeline.ts, post-check.ts, router.ts, orchestrator.ts + config.ts)
**New dependencies:** 0

---

## Feed-Forward

- **Hardest decision:** Whether the capabilities unification (P3-4) is worth
  the medium risk or if a lint test would suffice. Chose unification because
  the two-source drift is the prior phase's explicitly flagged risk and lint
  tests are maintenance overhead that doesn't eliminate the duplication.
- **Rejected alternatives:** (1) Levenshtein matching — deferred, not enough
  production evidence of typo-based misses. (2) Force `dryRun` for no-auto-send
  — rejected because it also disables SMS notifications. (3) Full CAPABILITIES
  data structure with pricing tiers — YAGNI, same as prior cycle's rejection.
- **Least confident:** The capabilities unification (P3-4). It's the right
  structural fix but touches two hot-path files. If the derived maps don't
  produce identical behavior to the current hardcoded ones, subtle routing
  or gating regressions could slip through. Snapshot tests are essential.

## Three Questions

1. **Hardest decision in this session?** The capabilities unification scope.
   A full data structure that encodes capability + family + pricing would be
   clean but is YAGNI. Chose the minimal version: aliases + status + family.
   Enough to eliminate the two-source problem without over-engineering.

2. **What did you reject, and why?** Levenshtein fuzzy matching. The production
   data from the capability hardening cycle showed unknown_capability fires
   rarely. Adding edit-distance matching risks false positives (e.g., "drum" <->
   "duo" at distance 2) that are worse than missing the occasional typo. Will
   revisit with data.

3. **Least confident about going into the next phase?** The capabilities
   unification (P3-4). It's structurally correct but high-touch — if the
   derived alias map or family guesser diverges from current behavior by
   even one keyword, it could silently change routing or gating decisions.
   Plan phase must include a snapshot test that asserts byte-for-byte
   equivalence for every existing keyword before and after unification.
