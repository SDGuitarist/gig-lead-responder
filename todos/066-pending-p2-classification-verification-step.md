---
status: pending
priority: p2
issue_id: "066"
tags: [pipeline, classify, quality, verification]
dependencies: []
unblocks: []
sub_priority: 1
---

# Add Classification Verification Step

## Problem

After Stage 1 (Classify), the pipeline does basic field validation (do required
fields exist?) and sanitization (fix bad date formats, empty strings), but never
verifies that the classification is *correct*.

If Claude misclassifies a lead — wrong format, missed stealth premium, wrong
competition level, cultural context not activated — that bad classification
flows unchallenged into pricing, context assembly, and draft generation. The
verify gate in Stage 5 catches some downstream symptoms (wrong voice, bad scene)
but never questions the root classification.

Examples of what could go wrong undetected:
- Lead says "mariachi" but classify returns "duo"
- Luxury venue present but stealth_premium = false
- 8 quotes received but competition_level = "low"
- Quinceañera for a Mexican family but cultural_context_active = false
- Client stated $500 budget but stated_budget = null

## Proposed Solution

Add a lightweight classification verification step between Stage 1 and Stage 2.
Options:

### Option A: Rule-Based Sanity Checks (no AI cost)
Write code that cross-references the raw lead text against the classification:
- If raw text contains "mariachi" and format_recommended is not mariachi_* → flag
- If raw text contains a number before "quotes" and it doesn't match
  competition_quote_count → flag
- If raw text contains a dollar amount and stated_budget is null → flag
- If venue_name matches known luxury venues and stealth_premium is false → flag
- If event type matches cultural keywords and cultural_context_active is false → flag

Pro: Zero latency, zero cost. Con: Only catches obvious mismatches.

### Option B: Second AI Pass (more thorough)
A short verification prompt that receives the raw lead text + classification
JSON and asks: "Does this classification match the lead? Flag any mismatches."

Pro: Catches subtle errors. Con: Adds ~2-3 seconds and one API call.

### Option C: Hybrid
Rule-based checks first. Only call the AI verification if a rule flags a
potential mismatch. Best of both — zero cost on clean leads, AI backup on
suspicious ones.

**Recommendation: Option C (hybrid).** Most leads will pass the rule checks
cleanly. The AI verification only fires when something looks off, keeping the
common path fast and cheap.

## Files to Change

- `src/pipeline/classify.ts` or new file `src/pipeline/classify-verify.ts`
- `src/run-pipeline.ts` — insert verification between Stage 1 and Stage 2

## Origin

Discovered while reviewing pipeline architecture (2026-04-13). Classification
errors are root causes that cascade through every downstream stage, but nothing
currently validates them.
