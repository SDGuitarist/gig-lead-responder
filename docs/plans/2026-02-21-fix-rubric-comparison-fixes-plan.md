---
title: "fix: Three rubric comparison fixes (past-date, mariachi routing, cultural vocab)"
type: fix
date: 2026-02-21
brainstorm: docs/brainstorms/2026-02-21-rubric-comparison-fixes-brainstorm.md
deepened: 2026-02-21
---

# Three Rubric Comparison Fixes

## Enhancement Summary

**Deepened on:** 2026-02-21
**Agents used:** 14 review agents, 5 research agents, 4 learnings, 3 research queries, 2 Context7 lookups

### Key Improvements from Deepening
1. **Date comparison in TypeScript, not LLM** — 4 review agents independently flagged this. LLM extracts `event_date_iso`, code computes `past_date_detected` boolean
2. **Signal hierarchy collapsed from 6 rows to 1 rule** — "Default full ensemble. Exception: weekday + corporate background → 4-piece"
3. **Vocab table deferred** — ship 2 FAIL/PASS pairs only. Research shows contrastive examples outperform glossaries (+12% accuracy)
4. **Shared Step 0** — `event_date_iso: string | null` serves both Fix 1 and Fix 2
5. **UTC noon anchor** — `new Date("2026-03-14")` rolls back a day in Pacific. Fix: `T12:00:00`
6. **Holidays removed from routing** — contradiction resolved: holiday premium is future work, don't half-build it now

### Simplifications Applied
- No vocab table (few-shot only)
- No holiday detection (future feature)
- No `format_routing_signals` traceability field (nice-to-have, not blocking)
- No `alternative_format_pricing` on PricingResult (prompt injection is sufficient for now)
- 2 FAIL/PASS pairs instead of 3 (serenata pair dropped per research)

---

## Overview

Three fixes to close the gap between pipeline output (24/40) and Claude Projects
output (37/40) on the same lead. All three trace to the same root cause: the
pipeline lacks deterministic guardrails for things the LLM shouldn't be guessing
at (dates, format routing rules, cultural vocabulary).

## Problem Statement

Running the Alex R. mariachi lead (Dec 24 2025, Chula Vista) through both systems:
1. Pipeline treated a past date as future — no warning
2. Pipeline defaulted to 4-piece mariachi when full ensemble was correct
3. Pipeline used "Las Posadas" (wrong tradition) instead of "Nochebuena"

---

## Implementation Phases

### Phase 0: Shared Infrastructure (src/types.ts, src/prompts/classify.ts, src/pipeline/classify.ts)

Both Fix 1 and Fix 2 need `event_date_iso`. Add it once, use it everywhere.

**src/types.ts** — Add `event_date_iso` to Classification (after `timeline_band`):

```typescript
// After line 42 (timeline_band)
event_date_iso: string | null; // ISO date extracted by LLM, used by code for date math
```

Make it optional with `?` for backward compatibility with existing SQLite blobs.
Actually — since Classification is the *output shape* from the LLM, new runs will
always have it. The backward compatibility concern is for `JSON.parse` of old
`classification_json` in the DB. Downstream code should use `?? null`.

**src/prompts/classify.ts** — Two changes:

1. Change signature: `buildClassifyPrompt()` → `buildClassifyPrompt(today: string)`
2. Inject today's date at TOP of system prompt (assertive sentence format):
   ```
   Today's date is ${today}.
   ```
3. Add to Step 1 (Surface Data Extraction):
   ```
   Extract event_date_iso: the event date as an ISO string (YYYY-MM-DD format).
   If the lead mentions "December 24, 2025" → "2025-12-24".
   If no date mentioned → null.
   ```
4. Add `event_date_iso` to the OUTPUT FORMAT JSON template:
   ```
   "event_date_iso": "YYYY-MM-DD" | null,
   ```

**src/pipeline/classify.ts** — Pass today's date to prompt builder:

```typescript
export async function classifyLead(rawText: string): Promise<Classification> {
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = buildClassifyPrompt(today);
  // ... rest unchanged
}
```

**Shared utility** — Add `parseLocalDate` helper to avoid UTC rollover bug.
Put it in a new file `src/utils/dates.ts` (small, reusable by Fix 1 and Fix 2):

```typescript
/**
 * Parse an ISO date string as local noon to avoid UTC midnight rollover.
 * new Date("2026-03-14") = UTC midnight = March 13 in Pacific.
 * new Date("2026-03-14T12:00:00") = noon = correct day everywhere in US.
 */
export function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}
```

**Files touched:** `src/types.ts`, `src/prompts/classify.ts`, `src/pipeline/classify.ts`, `src/utils/dates.ts` (new)
**Commit:** "feat: add event_date_iso to Classification + today's date injection + parseLocalDate utility"

---

### Phase 1: Past-Date Detection (src/pipeline/enrich.ts, src/prompts/generate.ts, src/prompts/verify.ts, src/index.ts)

Two layers: code detects it, prompt handles it, verify catches missed handling.

**src/types.ts** — Add `past_date_detected` to Classification:

```typescript
// After event_date_iso
past_date_detected?: boolean; // Computed in TypeScript, not by LLM. Optional for old DB rows.
```

**src/pipeline/enrich.ts** — Add past-date computation to enrichment:

```typescript
import { parseLocalDate } from "../utils/dates.js";

export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
): Classification {
  let enriched = classification;

  // Past-date detection (deterministic — never ask the LLM)
  if (classification.event_date_iso) {
    const eventDate = parseLocalDate(classification.event_date_iso);
    const today = parseLocalDate(new Date().toISOString().slice(0, 10));
    if (eventDate < today) {
      enriched = { ...enriched, past_date_detected: true };
    }
  }

  // Existing budget enrichment
  if (
    pricing.budget.tier === "large" ||
    pricing.budget.tier === "no_viable_scope"
  ) {
    enriched = {
      ...enriched,
      tier: "qualification",
      close_type: "hesitant",
    };
  }

  // Only spread if we made changes, return original otherwise
  return enriched === classification ? classification : enriched;
}
```

Note: `enrichClassification` currently returns original when no budget override.
We're adding past-date as a second enrichment concern. The function still returns
a new object only when something changed.

**src/prompts/generate.ts** — Inject flagged concern when past date detected.
Add after the `budgetBlock` construction (around line 15):

```typescript
const pastDateBlock = classification.past_date_detected
  ? `
## FLAGGED: EVENT DATE APPEARS TO BE IN THE PAST
The event date in this lead has already passed. Address this politely in the draft — ask to confirm the year, assume they meant the next occurrence, and frame it as a quick clarification rather than an error. Example: "Quick note — your request mentions December 24, 2025, which has already passed. I'm guessing you mean 2026?"
This must appear in the first 2-3 sentences of the draft. Do NOT ignore this flag.
`
  : "";
```

Inject `${pastDateBlock}` into the prompt template after `${budgetBlock}`.

**src/prompts/verify.ts** — Add `past_date_acknowledged` gut check.
Add to the gut_checks section (after `budget_acknowledged`):

```typescript
- past_date_acknowledged: ${buildPastDateInstruction(classification)}
```

Helper function:

```typescript
function buildPastDateInstruction(classification: Classification): string {
  if (!classification.past_date_detected) {
    return "Always true — no past date detected.";
  }
  return 'Draft must contain language clarifying the date (asking about the year, suggesting next occurrence). Deletion test: remove the date clarification — does the draft still work for a future event? If yes → false.';
}
```

**src/types.ts** — Add `past_date_acknowledged` to GateResult gut_checks:

```typescript
past_date_acknowledged: boolean;
```

**src/index.ts** — Add CLI warning for past dates (formatted output mode):

After the `Timeline` line in the formatted output (around line 58):

```typescript
if (classification.past_date_detected) {
  console.log("** WARNING: Event date appears to be in the past **");
}
```

**Files touched:** `src/types.ts`, `src/pipeline/enrich.ts`, `src/prompts/generate.ts`, `src/prompts/verify.ts`, `src/index.ts`
**Commit:** "fix: detect past event dates in code, inject clarification into draft"

---

### Phase 2: Mariachi Format Routing (src/pipeline/enrich.ts, src/prompts/classify.ts, src/prompts/generate.ts, src/prompts/verify.ts)

Two parts: (A) fix routing rules in code, (B) add dual-format prompt injection.

#### Phase 2A: Format Routing Rules

The LLM still classifies the lead (energy signals, event context). But the hard
constraint — "4-piece is weekday only" — moves to deterministic code.

**src/prompts/classify.ts** — Simplify FORMAT ROUTING RULES section.

Replace the current mariachi bullet:
```
- Mexican heritage event → mariachi_4piece (default) or mariachi_full (if 150+ guests)
```

With:
```
- Mexican heritage event (quinceañera, Mexican wedding, Día de los Muertos, Cinco de Mayo) + ANY guitar/music request → **mariachi_full** (default). Code may override to mariachi_4piece for weekday corporate background events — classify the event context signals, not the format constraint.
```

Add a new field to the classify prompt's output JSON:
```
"event_energy": "background" | "performance" | null,
```

This captures whether the lead signals background music (cocktail, ambient, dinner)
or performance music (entertainment, featured moment, high energy). The LLM is
good at this judgment call. `null` when no signal either way.

**src/types.ts** — Add `event_energy` to Classification:

```typescript
// After cultural_tradition
event_energy: "background" | "performance" | null;
```

**src/pipeline/enrich.ts** — Add `resolveFormatRouting()`:

```typescript
/**
 * Override format routing for mariachi leads based on day-of-week + event signals.
 * Hard constraint: 4-piece is weekday only. Default: full ensemble.
 * Exception: weekday + corporate + background → 4-piece.
 */
function resolveFormatRouting(
  classification: Classification,
): { format_recommended: Format; show_alternative: boolean } | null {
  // Only applies to mariachi formats
  if (
    classification.format_recommended !== "mariachi_4piece" &&
    classification.format_recommended !== "mariachi_full"
  ) {
    return null; // No override for non-mariachi
  }

  const dateISO = classification.event_date_iso;
  if (!dateISO) {
    // No date → can't determine day-of-week → keep LLM's recommendation
    return null;
  }

  const day = parseLocalDate(dateISO).getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 5 || day === 6; // Fri, Sat, Sun

  if (isWeekend) {
    // 4-piece not available on weekends → full ensemble, no alternative
    return { format_recommended: "mariachi_full", show_alternative: false };
  }

  // Weekday: default full ensemble, exception for corporate background
  const isCorporateBackground =
    classification.tier === "premium" &&
    classification.event_energy === "background";

  if (isCorporateBackground) {
    return { format_recommended: "mariachi_4piece", show_alternative: true };
  }

  // Weekday, not corporate background → full ensemble, mention 4-piece as option
  return { format_recommended: "mariachi_full", show_alternative: true };
}
```

Call this from `enrichClassification` after past-date detection:

```typescript
// Format routing override (mariachi weekday/weekend rules)
const routing = resolveFormatRouting(enriched);
if (routing) {
  enriched = {
    ...enriched,
    format_recommended: routing.format_recommended,
    // Store whether to show alternative in flagged_concerns
    ...(routing.show_alternative && {
      flagged_concerns: [
        ...enriched.flagged_concerns,
        routing.format_recommended === "mariachi_full"
          ? "mention_4piece_alternative"
          : "mention_full_ensemble_upgrade",
      ],
    }),
  };
}
```

We signal the dual-format option via `flagged_concerns` — the existing concern
traceability system already ensures it appears in the draft and is verified.

#### Phase 2B: Dual-Format Prompt Injection

**src/prompts/generate.ts** — Add anchor-high framing when alternative is flagged.

Add a helper function:

```typescript
function buildDualFormatBlock(classification: Classification, pricing: PricingResult): string {
  if (classification.flagged_concerns.includes("mention_4piece_alternative")) {
    return `
## DUAL FORMAT: ANCHOR HIGH
Lead with the full ensemble at $${pricing.quote_price}. Then offer the 4-piece as:
"For a weekday event, a confident 4-piece — the format designed for intimate rooms and weekday energy."
The 4-piece is NOT "mariachi without extra musicians." It IS "the format designed for weekday events."
Never use: "instead of", "budget option", "if cost is a concern."
`;
  }
  if (classification.flagged_concerns.includes("mention_full_ensemble_upgrade")) {
    return `
## FORMAT NOTE
You're quoting the 4-piece as the right fit for this weekday corporate setting.
Mention the full ensemble only if asked: "If the event grows, a full ensemble is also available."
`;
  }
  return "";
}
```

Inject `${buildDualFormatBlock(classification, pricing)}` into the prompt after the pricing section.

**src/prompts/verify.ts** — Add `mariachi_pricing_format` gut check:

```typescript
- mariachi_pricing_format: ${buildMariachiPricingInstruction(classification)}
```

Helper:

```typescript
function buildMariachiPricingInstruction(classification: Classification): string {
  if (
    !classification.flagged_concerns.includes("mention_4piece_alternative") &&
    !classification.flagged_concerns.includes("mention_full_ensemble_upgrade")
  ) {
    return "Always true — no dual-format context.";
  }
  if (classification.flagged_concerns.includes("mention_4piece_alternative")) {
    return "First price presented must be the full ensemble (higher option). Deletion test: remove the context and does the high anchor still lead? If not → false.";
  }
  return "Always true — 4-piece is the lead format, no anchor-high requirement.";
}
```

**src/types.ts** — Add `mariachi_pricing_format` to GateResult gut_checks:

```typescript
mariachi_pricing_format: boolean;
```

**Files touched:** `src/types.ts`, `src/pipeline/enrich.ts`, `src/prompts/classify.ts`, `src/prompts/generate.ts`, `src/prompts/verify.ts`
**Commit:** "fix: mariachi format routing — full ensemble default, 4-piece weekday-only"

---

### Phase 3: Cultural Vocabulary (src/prompts/generate.ts, src/prompts/verify.ts)

Simplest fix — prompt-only, no code changes beyond the prompt files.

**src/prompts/generate.ts** — Replace the vague cultural context instruction.

Currently (around line 108):
```typescript
${classification.cultural_context_active ? "ACTIVE — Use cultural terminology, gift-giver frame, heritage validation. See CULTURAL_SPANISH_LATIN.md in context above." : "Not active for this lead."}
```

Replace with:
```typescript
${classification.cultural_context_active ? buildCulturalVocabBlock(classification) : "Not active for this lead."}
```

New helper:

```typescript
function buildCulturalVocabBlock(classification: Classification): string {
  if (classification.cultural_tradition !== "spanish_latin") {
    return "ACTIVE — Use cultural terminology appropriate to the tradition.";
  }

  return `ACTIVE — Gift-giver frame, heritage validation. See CULTURAL_SPANISH_LATIN.md in context above.

CULTURAL VOCABULARY — Use the word the family uses, not an adjacent tradition.

FAIL: "the mariachi opens with the first notes of Las Posadas"
PASS: "Nochebuena in Chula Vista — the mariachi opens and someone stops mid-sentence"
WHY: Las Posadas is a 9-day procession, not Christmas Eve. The family calls it Nochebuena. Use THEIR word.

FAIL: "a traditional birthday performance with Mexican songs"
PASS: "Las Mañanitas at her table, three generations surrounding her"
WHY: Las Mañanitas IS the birthday song. Name it — the family knows exactly what it is and hearing it named creates instant recognition.

GENERALIZATION: This rule applies to ALL cultural terms. Adjacent terms from the same tradition are NOT interchangeable — each names a distinct event. Match the term to the event signal in the lead.`;
}
```

Note: 2 FAIL/PASS pairs (not 3). The serenata pair is dropped per research
recommendation — less likely to be confused, and 2 pairs is the sweet spot.

**src/prompts/verify.ts** — Add `cultural_vocabulary_used` gut check:

```typescript
- cultural_vocabulary_used: ${buildCulturalVocabInstruction(classification)}
```

Helper:

```typescript
function buildCulturalVocabInstruction(classification: Classification): string {
  if (!classification.cultural_context_active) {
    return "Always true — no cultural context active.";
  }
  return 'Draft must use specific cultural terminology (e.g., "Nochebuena" not "Christmas Eve", "Las Mañanitas" not "birthday song"). Deletion test: swap the cultural term for a generic English equivalent — does the sentence still work? If yes → false.';
}
```

**src/types.ts** — Add `cultural_vocabulary_used` to GateResult gut_checks:

```typescript
cultural_vocabulary_used: boolean;
```

**Files touched:** `src/types.ts`, `src/prompts/generate.ts`, `src/prompts/verify.ts`
**Commit:** "fix: cultural vocab few-shot examples — Nochebuena, Las Mañanitas"

---

### Phase 4: Verify Gate Threshold Update (src/prompts/verify.ts)

After all 3 fixes, GateResult has **14 gut checks** (was 11). Update the pass
threshold in the verify prompt.

Current (verify.ts line 80):
```
At least 9 of 11 gut_checks are true
```

New:
```
At least 12 of 14 gut_checks are true
```

Rationale: same ~80% pass rate. 9/11 = 82%, 12/14 = 86% — slightly stricter but
the new checks are no-ops when their condition isn't active (always true), so real
leads only face stricter gating when the feature is relevant.

Also update the OUTPUT FORMAT JSON template in verify.ts to include the 3 new keys.

**Files touched:** `src/prompts/verify.ts`
**Commit:** "fix: update verify gate threshold 9/11 → 12/14 for new gut checks"

---

### Phase 5: Test All 4 Leads

Run all 4 test leads through the pipeline and confirm they still pass.
The mariachi lead (lead 1 — Wedding @ Hilton La Jolla) should now get
`mariachi_full` instead of `mariachi_4piece` (it's a Saturday cultural event).

```bash
cat leads/wedding-hilton.txt | npx tsx src/index.ts --json
cat leads/birthday-march22.txt | npx tsx src/index.ts --json
cat leads/birthday-october.txt | npx tsx src/index.ts --json
cat leads/corporate-march14.txt | npx tsx src/index.ts --json
```

Check:
- `event_date_iso` present on all 4
- Lead 1: `past_date_detected` is `true` (if Dec 2025), `format_recommended` is `mariachi_full`
- Lead 4: corporate March 14 — is it a weekday? March 14, 2026 = Saturday. So `mariachi_full` if it's a mariachi lead, otherwise no change.
- All 4 gate results still pass (12/14+ gut checks)

**Commit:** no code commit — just validation

---

## Work Session Plan

| Session | Phases | ~Lines | Key files |
|---------|--------|--------|-----------|
| 1 | Phase 0 + Phase 1 | ~60 | types.ts, classify.ts (prompt), classify.ts (pipeline), enrich.ts, dates.ts, generate.ts, verify.ts, index.ts |
| 2 | Phase 2A + 2B | ~70 | types.ts, classify.ts (prompt), enrich.ts, generate.ts, verify.ts |
| 3 | Phase 3 + Phase 4 + Phase 5 | ~40 | types.ts, generate.ts, verify.ts + test runs |

Each session: read this plan, implement the phases, commit after each phase,
push at end of session.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM doesn't reliably output `event_date_iso` in correct format | Medium | High | Validate format in classifyLead, fall back to null |
| `event_energy` misclassified (background vs performance) | Medium | Medium | Default to full ensemble when null — safe failure mode |
| New gut checks cause existing leads to fail verify gate | Low | High | No-op when condition inactive (always true) |
| UTC rollover bug despite noon anchor | Low | Medium | Only affects dates near midnight — noon anchor is robust |
| `enrichClassification` shallow copy issue (pre-existing) | Known | Low | Not blocking — tracked separately in brainstorm |

---

## Future Enhancements (Not in Scope)

- Holiday detection + premium pricing
- `format_routing_signals: string[]` traceability field
- `alternative_format_pricing` on PricingResult (structured dual-format)
- Vocab table expansion (more Spanish/Latin terms, other cultural traditions)
- Structured Outputs (Anthropic SDK) to replace manual JSON.parse

---

## Three Questions

1. **Hardest decision in this session?** How to signal dual-format to the generate
   prompt. Considered adding `alternative_format_pricing` to PricingResult (mirrors
   `scoped_alternative`), but that requires pricing lookup for the alternative
   format too. Simpler: use `flagged_concerns` to signal "mention the other option"
   and let the prompt handle the framing. Keeps the pricing stage untouched.

2. **What did you reject, and why?** Rejected putting `resolveFormatRouting` in
   `classify.ts` (prompt file) — it's deterministic code, not a prompt instruction.
   Rejected adding `event_energy` classification to the enrichment step — the LLM
   should make this judgment during classification when it has the full lead text,
   not after the fact. Rejected 3 FAIL/PASS pairs for cultural vocab — research
   says 2 is optimal, 3 risks over-prompting.

3. **Least confident about going into the next phase?** The `event_energy` field.
   It's a new LLM judgment call ("is this background or performance?") and I haven't
   tested how reliably Claude classifies it. If it's unreliable, the fallback is
   safe (null → full ensemble), but it means the 4-piece corporate exception never
   fires. May need signal word lists in the classify prompt if initial results are
   inconsistent.
