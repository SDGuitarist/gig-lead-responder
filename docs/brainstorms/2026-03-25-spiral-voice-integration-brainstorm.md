---
title: Spiral Voice Integration
date: 2026-03-25
status: complete
origin: HANDOFF.md "Next Major Initiative" (5 integration questions)
research: docs/research/2026-03-22-spiral-methodology-report.md
related_solutions:
  - docs/solutions/architecture/hybrid-llm-deterministic-computation.md
  - docs/solutions/prompt-engineering/testable-constraints-for-prompt-compliance.md
  - docs/solutions/prompt-engineering/contrastive-pair-vocabulary-enforcement.md
  - docs/solutions/prompt-engineering/2026-03-15-llm-pipeline-prompt-injection-hardening.md
---

# Spiral Voice Integration Brainstorm

## Problem Statement

The pipeline generates responses that sound like Alex but lacks demonstration-based voice training. Voice rules are scattered inline in the generate prompt as instructions ("write like this, not like that") rather than examples ("here's what good looks like"). Spiral's methodology research (7 patterns from 17 tests) proved that a three-layer hierarchy -- references, style guide, knowledge docs -- produces higher voice fidelity than instruction-only prompting.

The challenge: graft Spiral's voice layer onto the pipeline's structural backbone without breaking deterministic pricing or overwhelming the context window.

## What We're Building

Integrate Spiral's three-layer voice reinforcement into the generate stage of the pipeline:

1. **8 reference responses as few-shot examples** -- injected inline in the generate prompt to define the voice ceiling (Spiral Pattern 7)
2. **Style guide section** -- format rules (dual output, word counts, compression targets) separated from content rules (Spiral Pattern 4)
3. **Voice section** -- tone, vocabulary, cultural terms, mandatory language patterns
4. **Hard pricing wall** -- all Spiral pricing content excluded; deterministic price engine remains the single source of truth
5. **Mandatory language audit** -- upgrade soft prompt language ("consider," "worth noting") to proven mandatory phrasing ("MANDATORY," "always") per Spiral Pattern 2

## Why This Approach

### Generate-stage only
- Keeps classify, price, context, and verify stages untouched
- Smallest blast radius -- only `src/prompts/generate.ts` changes significantly
- Matches the hybrid LLM-deterministic pattern: fuzzy voice work in the prompt, hard enforcement in code (pricing, JSON schema, verify gate)

### All 8 references inline
- Spiral Pattern 7: "the reference corpus defines the ceiling, not the knowledge base"
- Few-shot examples in the system prompt are stronger reinforcement than a separate context document
- ~2-3K token cost is manageable given the generate prompt's existing size

### Hard pricing wall (not read-only context)
- Spiral's Pricing Calibration doc caused pricing errors in testing ($1,050 vs $1,200, $750 vs $595)
- The pipeline solved pricing by removing it from LLM judgment entirely
- Even "read-only" pricing context risks the LLM second-guessing the deterministic number
- Zero pricing content from Spiral enters the prompt

### Format/content separation
- Spiral Pattern 4: mixing format rules with content rules caused regressions (dual output breaking)
- The generate prompt currently mixes these -- word count targets sit alongside wedge source instructions
- Two distinct prompt sections: STYLE (format, structure, length) and VOICE (tone, vocabulary, references)

### Audit existing mandatory language (not full rewrite)
- Spiral Pattern 2 proved soft language gets ignored
- Pipeline already uses FORCING RULE and HARD CONSTRAINT in some places
- Targeted audit of voice/tone rules and cultural vocab blocks -- upgrade soft to mandatory
- Don't touch working prompt sections that already use strong language

## Key Decisions

| # | Decision | Chosen | Rejected | Why |
|---|----------|--------|----------|-----|
| 1 | Where Spiral plugs in | Generate stage only | Generate+Verify, Context+Generate+Verify | Smallest blast radius; verify upgrades flagged for future |
| 2 | Reference response handling | All 8 inline as few-shot | 3-4 matched per lead type, separate context doc | Pattern 7 says references define ceiling; full set is strongest |
| 3 | Pricing interaction | Hard wall -- exclude entirely | Read-only context, merge framing+numbers | Spiral got prices wrong; deterministic engine is the advantage |
| 4 | Prompt structure | Separate STYLE and VOICE sections | Keep current + append, full 3-layer restructure | Matches Pattern 4 without a full rewrite |
| 5 | Mandatory language | Audit + upgrade existing rules | New sections only, full rewrite | Targeted improvement without regression risk on working prompts |
| 6 | Verify gate | Flag for future (YAGNI) | Include in scope | Ship voice in generate first, measure, then decide |

## Scope Boundaries

### In scope
- Restructure generate prompt into STYLE and VOICE sections
- Add 8 reference responses as few-shot examples in generate prompt
- Strip Spiral pricing content before injection
- Audit and upgrade soft language to mandatory phrasing ONLY in voice/tone rules and cultural vocab blocks (not pricing, not format enforcement, not classification)
- Create voice-specific contrastive pairs (leveraging existing pattern from cultural vocab)

### Out of scope
- Verify gate upgrades (future initiative after measuring voice quality improvement)
- Classify stage changes
- Price stage changes (deterministic engine is untouched)
- Context stage changes (references go inline, not as a context doc)
- New voice selection UI or multiple voice profiles
- Strategic reserve (third output format) -- separate initiative

## Integration Points with Past Solutions

1. **Hybrid LLM-Deterministic Pattern** -- Voice rules follow the same split: LLM generates with voice awareness, code enforces hard constraints (pricing, JSON schema, character limits)
2. **Testable Constraints** -- Each voice rule should have a deletion test. "Delete the contractions. Does it still sound like Alex? If yes, it fails."
3. **Contrastive Pairs** -- Extend the proven cultural vocab pattern to voice rules. FAIL/PASS/WHY format for vocabulary that's high-quality but violates voice.
4. **Defense-in-Depth** -- Wrap voice rules in XML boundaries per the prompt injection hardening solution. Voice rules are system-level, not user-overridable.

## Prerequisite

**The 8 reference responses must exist before implementation.** The Spiral research report references them as the voice ceiling, but their current state needs verification:
- Are they already written in the Spiral research doc or a separate file?
- If not, they must be curated from real past responses Alex has sent (not AI-generated)
- The plan phase must confirm their location and readiness before scoping work

## Resolved Questions

- **Should verify gate be upgraded?** No -- YAGNI. Generate-only first, measure improvement, then decide.
- **How many references?** All 8. Token cost (~2-3K) is acceptable for maximum voice ceiling.
- **Should pricing knowledge be included as read-only context?** No. Hard wall. Even background pricing context risks LLM second-guessing.

## Open Questions

None -- all integration questions from HANDOFF.md addressed.

## Three Questions

1. **Hardest decision in this session?** Hard wall on pricing. Spiral's pricing framing language (how Alex talks about value) could genuinely improve response quality, but the risk of the LLM overriding deterministic prices is too high. If voice quality testing shows pricing presentation is the weak spot, revisit with a "framing only, no numbers" approach.
2. **What did you reject, and why?** Full 3-layer prompt restructure was tempting (most aligned with Spiral methodology) but would rewrite the entire generate prompt, risking regressions in 17 brainstorms' worth of proven prompt engineering. Incremental restructure (STYLE/VOICE separation) gets 80% of the benefit.
3. **Least confident about going into the next phase?** Whether 8 inline references will actually raise voice quality meaningfully without verify gate upgrades to catch regressions. The current single-boolean `sounds_like_alex` check may not be sensitive enough to detect when the voice ceiling drops. This is the first thing to measure after implementation.

## Feed-Forward

- **Hardest decision:** Hard wall on pricing (see Three Questions #1).
- **Rejected alternatives:** Full 3-layer restructure (see Three Questions #2).
- **Least confident:** Voice quality without verify gate upgrades (see Three Questions #3).
