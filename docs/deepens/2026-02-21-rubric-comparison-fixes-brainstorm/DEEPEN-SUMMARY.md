# Deepen Summary — 2026-02-21-rubric-comparison-fixes-brainstorm

**Date:** 2026-02-21
**Plan file:** docs/brainstorms/2026-02-21-rubric-comparison-fixes-brainstorm.md
**Batches run:** 3

## Statistics

| Metric | Count |
|--------|-------|
| Sections enhanced | 3 (+ Open Questions + Cross-Cutting) |
| Skills applied | 0 |
| Learnings checked | 4 |
| Research queries | 3 sections + 2 Context7 lookups |
| Review agents run | 14 (13 with findings) |
| Research agents run | 5 |
| Total recommendations merged | 31 |
| Conflicting advice flagged | 3 |

## Top Recommendations by Impact

1. **Move date comparison to TypeScript** — from kieran-ts, pattern-recognition, dhh, architecture, best-practices. Applies to Fix 1. The LLM extracts `event_date_iso`, TypeScript computes the boolean. Prevents wrong date math (LLMs fail at this deterministically).

2. **Simplify signal hierarchy from 6 rows to 1 rule** — from code-simplicity, dhh. Applies to Fix 2. "Default full ensemble. Exception: weekday + corporate background signals -> 4-piece." Eliminates 20-30 lines of classify prompt.

3. **Add `event_date_iso` as shared Step 0** — from kieran-ts, pattern-recognition. Applies to Fix 1 + Fix 2. Hidden shared dependency that neither fix identified. Must be added to Classification before either fix starts.

4. **Ship few-shot examples only, defer vocab table** — from code-simplicity, dhh. Applies to Fix 3. Research validates 2 contrastive FAIL/PASS pairs as optimal. Table is redundant if examples teach the principle.

5. **Put operational constraints in deterministic code** — from pattern-recognition, dhh, architecture. Applies to Fix 2. "4-piece is weekday only" belongs in `resolveFormatRouting()` in `enrich.ts`, not in the classify prompt.

6. **UTC timezone noon anchor** — from kieran-ts, batch2-research. Applies to Fix 1 + Fix 2. `new Date("2026-03-14")` parses as UTC midnight = wrong day in Pacific time. Shared `parseLocalDate()` utility with `T12:00:00`.

7. **Three new gut checks** — from learnings-researcher. `past_date_acknowledged`, `mariachi_pricing_format`, `cultural_vocabulary_used`. Dynamic counting already handles auto-increment.

8. **Fix quinceañera factual error** — from kieran-ts. "Godmother celebration" is wrong — it's a girl's 15th birthday. Small but embarrassing if shipped.

## Conflicting Advice (needs human review)

1. **Vocab table: include or defer?**
   - **Code-simplicity + DHH say:** Ship few-shot only. Table is redundant if examples teach the principle. Add later if needed.
   - **Batch2-research says:** Restructure table as a decision tree with event signal routing.
   - **Architecture says:** Split — vocab table in context.ts, few-shot examples in generate.ts.
   - **Flagged in:** Fix 3 Research Insights. Recommendation leans toward deferring (2 agents + research support this).

2. **Holiday detection: include in routing or remove?**
   - **Brainstorm says:** "Holiday premium is a separate feature" but includes holidays in routing condition.
   - **Pattern-recognition + DHH say:** This is a contradiction. Remove holidays from routing for now.
   - **Flagged in:** Fix 2 Research Insights. Recommendation: remove from routing.

3. **Fix 2 scope: one fix or two phases?**
   - **Brainstorm treats** routing + presentation as one fix.
   - **Kieran-ts says:** Split into Phase A (routing rules in classify) and Phase B (dual-format generate prompt).
   - **Flagged in:** Fix 2 Research Insights. Recommendation: split for cleaner implementation and testing.

## Three Questions

### 1. Hardest decision in this session?

How to handle the 4 review agents that all independently flagged "date comparison belongs in TypeScript" when the original brainstorm explicitly designed it as an LLM-side check. The brainstorm's reasoning was coherent ("same mechanism as timeline_band"), but every source — review agents, batch2 research, best-practices researcher — converged on "code for facts, prompt for judgment." Chose to present it as a critical override rather than softening it, because the convergence was overwhelming and the failure mode (wrong date math) is high-visibility.

### 2. What did you reject, and why?

- **Rejected architecture-strategist's suggestion to create `temporal` sub-object** on Classification. The type is growing (25+ fields) but not yet unwieldy, and sub-objects add indirection for a beginner-level codebase. Revisit when the type hits 35+ fields.
- **Rejected framework-docs-researcher's Structured Outputs migration.** Strong improvement but orthogonal to these three fixes. Would change `callClaude` signature, add `zod` dependency, and affect all pipeline stages. Noted as future enhancement.
- **Rejected performance-oracle's suggestion to use ISO with day-of-week** (`2026-02-21 (Friday)`) for date injection. The parenthetical is noise — TypeScript computes the day, not the LLM.
- **Rejected expanding to 5+ cultural traditions** for vocab mapping. The research (BLEnD) shows adjacent-culture confusion across Hindu, East Asian, Jewish, Filipino, and Arabic traditions — but adding those now is scope creep. Noted for future expansion.

### 3. Least confident about going into the next phase?

The holiday detection question. Removing holidays from the routing condition is the right call *for now*, but Dec 24, 2025 is a Wednesday (if they meant 2025) or Thursday (if they meant 2026). Neither is a weekend. So the original test lead — the one that exposed the problem — would route to "weekday + signals" instead of "weekend/holiday = full ensemble only." The fix works for different reasons (cultural event signals default to full ensemble on weekdays too), but it's solving the problem through a different path than the brainstorm intended. The plan phase should verify this path handles the test lead correctly.
