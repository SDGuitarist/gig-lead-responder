# Gig Lead Responder — Entropy Audit Findings

## Overview

6 findings from applying the Research Agent entropy audit framework to the Gig Lead Responder pipeline. Mapped to the five entropy problems: entropy collapse, hallucination, signal-to-noise degradation, web search interference, and knowledge vacuums.

**Pipeline assessed:**
```
Lead Email → Classify (Claude) → Price (lookup) → Context (docs + PF-Intel) → Generate (Claude) → Verify (Claude) → Dashboard → Human Approve → SMS
```

**Core principle:** The code is the prompter. Every entropy/prompting principle applies to the 5-stage pipeline, but the human approval gate is a strong final defense.

---

## Findings

### GLR-1: Verify Gate Is Advisory

**Priority:** P3
**Entropy problem:** Advisory verification
**Module:** `pipeline/verify.ts`, dashboard UI

**What happens:** The verify gate runs 14 gut checks. If all retries fail, the draft is still shown in the dashboard (`verified: false`) with a confidence score. A human under time pressure may approve without examining what specifically failed.

**Current defense:** Human must click "Approve" before SMS sends.

**Fix:** Surface the specific failed gut checks prominently in the dashboard UI next to the draft. Show "Failed: competitor test, concern traceability" — not just `verified: false`.

**Effort:** Low (UI change only)

---

### GLR-2: LLM-to-LLM Chain Amplification

**Priority:** P2
**Entropy problem:** Noise feedback loop
**Module:** `run-pipeline.ts`, `pipeline/classify.ts`, `pipeline/generate.ts`, `pipeline/verify.ts`
**Dependencies:** None

**What happens:** If Stage 1 (Classify) misclassifies event format or tier, Stage 4 (Generate) writes a response for the wrong event type, Stage 5 (Verify) catches a mismatch but issues rewrite instructions based on the wrong classification. The retry loop polishes a draft built on a wrong foundation.

**Current defense:** Classification validated with date format checks and field truncation. Human reviews full draft.

**Fix:** Before retrying after a verify failure, check if the failure reason traces back to classification (e.g., "wrong format", "wrong tier", "wrong mode"). If so, re-run classify instead of re-running generate. Don't refine a draft built on a wrong foundation.

**Effort:** Medium (conditional logic in retry loop + failure reason parsing)

---

### GLR-3: Venue Context as Unweighted Source

**Priority:** P3
**Entropy problem:** Source quality tiers not enforced
**Module:** `pipeline/context.ts`, `venue-lookup.ts`
**Dependencies:** None

**What happens:** PF-Intel venue context (policies, contacts, event history) is concatenated into the Stage 4 prompt alongside RESPONSE_CRAFT.md and PRICING_TABLES.md. All context is treated equally — venue intel from a single past visit has the same weight as established pricing rules.

**Current defense:** PF-Intel data is optional (3-second timeout, graceful degradation).

**Fix:** Add a recency marker to venue context: "Last updated: [date]. Based on [N] visits." For venues with only 1 visit or data older than 6 months, add: "Venue data may be outdated — do not make specific promises about venue policies."

**Effort:** Low (add metadata to context formatting)

---

### GLR-4: Follow-Up Prompt Injection Surface

**Priority:** P2
**Entropy problem:** Unsanitized data in prompts
**Module:** `follow-up.ts`
**Dependencies:** None
**Unblocks:** None (independent fix)

**What happens:** Follow-up SMS generation pulls `client_name`, `event_type`, `venue`, and `compressed_draft` from the database. These values originated from LLM output (Stage 1/4) and were stored. When re-injected into a follow-up prompt, they're DB-sourced strings — not XML-wrapped with `wrapUntrustedData()`.

**Current defense:** Issue #025 marked done. Three-layer defense applies to initial processing but not stored+replayed values.

**Fix:** Apply `wrapUntrustedData()` to all DB-sourced fields in follow-up prompts. The origin doesn't matter — if it came from outside the system at any point, wrap it.

**Effort:** Low (add wrapping calls to follow-up prompt construction)

---

### GLR-5: No Input Vagueness Detection on Manual Path

**Priority:** P3
**Entropy problem:** Vague input enters pipeline unchecked
**Module:** `api.ts` (`/api/analyze` endpoint)
**Dependencies:** None

**What happens:** The `/api/analyze` endpoint accepts free-text with only a length check (50,000 chars). A vague submission like "need music for a thing" runs the full 5-stage pipeline, producing a generic draft.

**Current defense:** Webhook path (primary) uses regex extraction from GigSalad/TheBash formats. Manual submissions are rare. Human reviews all drafts.

**Fix:** For `/api/analyze`, add a minimum-fields check: the text must contain at least an event type OR a date OR a location (quick regex, not an LLM call). Return 422 with guidance if none are extractable.

**Effort:** Low (regex check before pipeline entry)

---

### GLR-6: SMS Truncation by Carrier

**Priority:** P3
**Entropy problem:** Truncation destroys information
**Module:** `pipeline/generate.ts`, dashboard UI
**Dependencies:** None

**What happens:** The compressed draft targets ~1,600 characters. If still too long, it's a warning log — no enforcement. Carrier truncation/splitting is uncontrolled and may cut mid-sentence, losing the call-to-action or contact info.

**Current defense:** LLM instructed to write compressed version. Word count computed and logged.

**Fix:** If compressed draft exceeds 1,500 characters, re-run compression with explicit instruction: "Must be under 1,500 characters. Prioritize: greeting, value proposition, call to action, contact info." Hard-reject drafts over 1,600 chars from the approval UI.

**Effort:** Low (length check + re-compression logic)

---

## Recommended Fix Order

| # | Finding | Priority | Why This Order |
|---|---------|----------|---------------|
| 1 | GLR-4 — Wrap DB fields in follow-up prompts | P2 | Injection surface bypassing existing defenses. Low effort, high impact. |
| 2 | GLR-2 — Re-classify on tier/format verify failures | P2 | Classification errors propagate through all retries. Root cause fix. |
| 3 | GLR-1 — Surface failed gut checks in dashboard | P3 | Strengthens the human gate. Quick UI change. |
| 4 | GLR-5 — Minimum-fields check on manual submissions | P3 | Prevents wasted API calls on vague input. |
| 5 | GLR-3 — Add recency marker to venue context | P3 | Prevents stale data from being treated as current. |
| 6 | GLR-6 — Hard-reject oversized compressed drafts | P3 | Edge case safety net. |

**Estimated effort:** 2-3 sessions total (P2s in one session, P3s bundled in another)

---

## What's Already Done Well

- **Three-layer prompt injection defense** — XML wrapping + field truncation + control char sanitization
- **Human approval gate** — All SMS requires explicit dashboard approval
- **Deterministic pricing** — Stage 2 uses lookup tables, not LLM-generated prices
- **Retry with targeted rewrite** — Verify failures produce specific rewrite instructions, not blind retries
- **Graceful degradation** — PF-Intel calls have 3-second timeout, pipeline continues without venue context

---

## Source

Derived from the Research Agent entropy audit (2026-03-09).
See: `~/Documents/dev-notes/2026-03-09-entropy-cross-project-reference.md`
