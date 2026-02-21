# Batch 1 — Deletes and Removals Results

**Branch:** rubric-comparison-fixes
**Date:** 2026-02-21
**Commit:** dc06ae7

## Changes Made

### #25 Classify prompt leaks "Code may override" implementation detail
**File:** `src/prompts/classify.ts:91`
**What changed:** Removed "Code may override to mariachi_4piece for weekday corporate background events" from the LLM prompt. Replaced with neutral guidance: "Classify the event context signals (day of week, corporate vs private, background vs performance), not the format constraint." The LLM still gets the same classification task but no longer sees how the code post-processes its output.
**Review finding:** P3 — Implementation detail leaked into prompt text

---

### #17 Friday-as-weekend needs documentation
**File:** `src/pipeline/enrich.ts:81-82`
**What changed:** Added comment explaining why Friday is treated as weekend: 4-piece musicians have day-job conflicts on weekdays, but Friday evening gigs run like weekend events for scheduling.
**Review finding:** P3 — Business rule undocumented

---

### #18 `tier === "premium"` as proxy for "corporate" is imprecise
**File:** `src/pipeline/enrich.ts:90-92`
**What changed:** Added comment documenting the proxy assumption: tier "premium" currently covers corporate events per classify.ts Step 4, with a note to revisit if non-corporate events start getting premium tier.
**Review finding:** P3 — Implicit assumption undocumented

---

### #8 Implicit enrichment ordering dependency
**File:** `src/pipeline/enrich.ts:14-15`
**What changed:** Added warning comment at the top of the enrichment sequence: budget enrichment (last) overwrites tier/close_type, so format routing (middle) must run first while tier still reflects the LLM's original value.
**Review finding:** P2 — Ordering dependency between enrichment steps not documented

## Considered but Rejected

- Making the enrichment order enforced programmatically (e.g., a pipeline pattern with declared dependencies) — overkill for 3 sequential steps. A comment is sufficient.

## Deferred to Later Batch

- Nothing deferred from Batch A.

## Three Questions

### 1. Hardest decision in this batch?

The #25 rewrite. The original "Code may override" text told the LLM something useful — don't stress about format routing because code will fix it. The replacement needed to give the same "focus on context, not format" guidance without revealing the override mechanism. Settled on "Classify the event context signals... not the format constraint" which preserves the intent.

### 2. What did you reject, and why?

Rejected deleting the entire second sentence of the mariachi format rule (#25). The LLM benefits from knowing it should focus on context signals rather than trying to nail the exact format, so keeping guidance there (just without the implementation leak) is better than leaving only "mariachi_full (default)."

### 3. Did anything in this batch change the scope or approach for the next batch?

No. All four changes were additive comments or a prompt text swap. No runtime behavior changed, so Batch B's hot-path fixes remain unaffected.
