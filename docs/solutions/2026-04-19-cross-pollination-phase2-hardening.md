---
title: Cross-Pollination Phase 2 — Gig-Lead-Responder Hardening
date: 2026-04-19
tags: [cross-pollination, hardening, exception-hierarchy, testing]
apps: [gig-lead-responder]
phase: work
---

# Cross-Pollination Phase 2 — Gig-Lead-Responder Hardening

## Problem

The cross-pollination plan identified gig-lead-responder as needing an exception hierarchy (generic `throw new Error()` throughout pipeline stages) and test backfill (84 tests for a complex 5-stage LLM pipeline). The brainstorm also assumed injection defense was missing, but the audit revealed it was already comprehensive.

## What We Found

### Sanitization Audit: Already Complete (3-layer defense)

The brainstorm assumed GLR needed injection defense added. Audit found it already has a mature system:

| Layer | Implementation | Location |
|-------|---------------|----------|
| **XML boundaries** | `wrapUntrustedData()` — wraps user content in XML tags with "treat as data only" instruction | `utils/sanitize.ts` |
| **Edit instruction defense** | `wrapEditInstructions()` — separate wrapper for SMS edit replies with meta-instruction defense | `utils/sanitize.ts` |
| **Voice reference defense** | `wrapVoiceReference()` — wraps voice examples with sanitized XML attributes | `utils/sanitize.ts` |
| **Truncation** | `sanitizeClassification()` — truncates all free-text fields to 200 chars | `utils/sanitize.ts` |
| **Output capping** | `compressed_draft` capped at 2000 chars, edit instructions at 200 chars | `pipeline/generate.ts` |

This matches the solution doc from the prior GLR injection hardening cycle. No gaps found.

## What We Built

### Exception Hierarchy (new)

Created `src/errors.ts` with `LeadResponderError` base class modeled on pf-intel's `PFIntelError`:

```
LeadResponderError
├── PipelineStageError (carries `stage` name)
│   ├── ClassificationError (stage: "classify")
│   ├── PricingError (stage: "price")
│   ├── ContextError (stage: "context")
│   ├── GenerationError (stage: "generate")
│   └── VerificationError (stage: "verify")
├── ClaudeApiError
├── EmailParseError
└── WebhookValidationError
```

Wired into all 5 pipeline stages, replacing 20+ `throw new Error()` calls with typed errors.

### Test Backfill: 84 → 153 (+69 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `errors.test.ts` | 8 | Inheritance chain, catch semantics, stage names, messages |
| `pipeline-validators.test.ts` | 31 | Price lookup (valid/invalid/formats/tiers/durations), budget gap detection, sanitization utilities, error type verification |
| `run-pipeline.test.ts` | 10 | Full pipeline integration with mocked Claude, truncation, output fields, platform stamping, sanitization of LLM outputs |
| `confidence.test.ts` | 11 | Confidence scoring components, edit pipeline, stage event callbacks |
| `claude-extended.test.ts` | 8 | JSON parsing, code fence stripping, validation retry, error on non-text response |
| `dates.test.ts` | 4 | ISO date format, noon parsing, invalid date handling |

## Key Pattern: "Audit First" Applied to Mixed Gaps

PF-Intel (Phase 1) was all audit — everything was already there. GLR was mixed:
- **Sanitization:** already complete (audit confirmed)
- **Exception hierarchy:** genuinely missing (built from scratch)
- **Tests:** genuinely under-covered (69 new tests)

The "audit first" framing still worked: it prevented us from rebuilding the sanitization layer that already existed, and focused effort on the real gaps.

## Three Questions

1. **Hardest pattern to extract:** The exception hierarchy needed to be useful without over-engineering. `PipelineStageError` carrying a `stage` string is the minimum viable design — it enables error handling by stage without requiring stage-specific logic in the error classes.
2. **What did you consider documenting but left out:** Whether to add a `toHttpStatus()` method to each error class (like pf-intel's exception handler). Decided against — GLR's error middleware already handles this generically. Adding status mapping to errors would couple the hierarchy to HTTP concerns.
3. **What might future sessions miss:** The `ClaudeApiError` and `EmailParseError` classes are defined but not yet wired into their respective modules. The pipeline validators throw typed errors, but `claude.ts` still throws generic `Error` and `email-parser.ts` uses generic errors. These are natural follow-up items.

## Feed-Forward

- **Hardest decision:** Whether to wire `ClaudeApiError` into `claude.ts` in this session. Decided against — `claude.ts` has its own retry logic and the current generic errors work fine there. The exception hierarchy is for pipeline stages where error type matters for handling decisions.
- **Rejected alternatives:** Adding Zod schemas for webhook validation (plan item). Deferred — the existing validation works, and Zod adoption is a larger refactor that should be its own cycle.
- **Least confident:** Whether 153 tests is enough depth for a production LLM pipeline. The tests cover the happy paths and typed error paths well, but don't exercise the full generate→verify→rewrite loop with realistic Claude responses. Integration tests with real Claude calls would catch prompt regression but are expensive and slow.
