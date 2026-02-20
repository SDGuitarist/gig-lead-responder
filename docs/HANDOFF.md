# Gig Lead Responder — Session Handoff

**Date:** 2026-02-20
**Session:** Brainstorm → Plan → Work (all 9 phases)
**Next:** Test live with API key → Review → Compound

---

## What Was Built

A TypeScript CLI tool that takes a raw music gig lead through a 5-stage AI pipeline and outputs two response drafts with a quality verification gate.

```
Raw Lead → [classify] → [price] → [context] → [generate] → [verify] → Output
```

**Project:** `~/projects/gig-lead-responder`
**Branch:** `feat/gig-lead-pipeline` (9 commits, all passing `tsc --noEmit`)

---

## What's Done

| Phase | Status | Commit |
|-------|--------|--------|
| 1. Scaffold + types + callClaude helper | Done | `48a6b63` |
| 2. Rate card + venue data tables | Done | `1a09a3e` |
| 3. Classification pipeline (PROTOCOL.md Steps 0-5) | Done | `9ca9631` |
| 4. Pricing lookup (pure function) | Done | `eced9d4` |
| 5. Context selection + assembly | Done | `1b5f80c` |
| 6. Response generation (dual drafts) | Done | `c64bd92` |
| 7. Verification gate + rewrite loop | Done | `5d16090` |
| 8. CLI entry point (full pipeline) | Done | `58be901` |
| 9. Demo fixture | Done | `80ac1a0` |

---

## What's NOT Done

1. **Live test** — Needs `ANTHROPIC_API_KEY` in `.env` to run `npm run demo`
2. **Review phase** — `/workflows:review` not yet run
3. **Compound phase** — No `docs/solutions/` captured yet
4. **Missing source file** — `Rate_Card_Solo_Duo.md` was never found (solo/duo rates were estimated from PRICING_TABLES.md ranges — may need correction)
5. **CLI color output** — Plan called for colored terminal output, not implemented
6. **No tests** — No automated tests exist

---

## Key Files

### Source Code
- `src/index.ts` — CLI entry point, reads stdin, runs pipeline, prints formatted output
- `src/types.ts` — All interfaces: Classification, PricingResult, Drafts, GateResult, PipelineOutput
- `src/claude.ts` — Shared `callClaude<T>()` helper with JSON parsing, code fence stripping, one retry
- `src/pipeline/classify.ts` — Stage 1: `classifyLead(rawText)` → Classification
- `src/pipeline/price.ts` — Stage 2: `lookupPrice(classification)` → PricingResult (pure function)
- `src/pipeline/context.ts` — Stage 3: `selectContext(classification)` → assembled context string
- `src/pipeline/generate.ts` — Stage 4: `generateResponse(classification, pricing, context, rewriteInstructions?)` → Drafts
- `src/pipeline/verify.ts` — Stage 5: `verifyGate()` + `runWithVerification()` with max 2 retries
- `src/data/rates.ts` — 7 format rate tables hardcoded from source .md files
- `src/data/venues.ts` — 29 venues with tier + stealth premium flags
- `src/prompts/classify.ts` — Classification prompt (PROTOCOL.md Steps 0-5)
- `src/prompts/generate.ts` — Generation prompt (RESPONSE_CRAFT.md 7-component framework)
- `src/prompts/verify.ts` — Verification gate prompt (evidence-based pass/fail)

### Business Logic Docs (in `docs/`)
All source docs were found in `~/Downloads/Manual Library/` (Sparkle moved them) and copied to the project. Key files:
- `PROTOCOL.md` — Classification steps
- `RESPONSE_CRAFT.md` — Drafting framework
- `PRICING_TABLES.md` — Price reference (solo, duo, flamenco, mariachi rates)
- `Rate_Card_Trio_Ensemble.md` — Flamenco trio, mariachi rates (anchor/floor by tier)
- `Rate_Card_Bolero_Trio.md` — Bolero trio rates
- `CULTURAL_SPANISH_LATIN.md` — Spanish/Latin cultural context
- `CULTURAL_CORE.md` — Universal cultural framework
- `PRINCIPLES.md` — Core philosophy
- `QUICK_REFERENCE.md` — All lookup tables

### Planning Docs
- `docs/brainstorms/2026-02-20-gig-lead-responder-brainstorm.md`
- `docs/plans/2026-02-20-feat-gig-lead-response-pipeline-plan.md`

---

## Demo Lead (Happy Path)

File: `examples/quinceanera-lead.txt`

```
Event Type: Quinceañera
Date: Saturday, April 26, 2025
Location: Estancia La Jolla
Guest Count: 120
Budget: $800
Genre Request: Spanish guitar / flamenco
Lead Source: GigSalad
Quotes received: 4
```

**Why this lead:** Fires every interesting behavior simultaneously:
- **Stealth premium** — Estancia La Jolla (La Jolla zip) + 120 guests = T3 pricing despite $800 stated budget
- **Genre correction** — Client asked for flamenco, system should route to mariachi_4piece (Mexican heritage quinceañera)
- **Cultural full activation** — "Mexican family," "authentic and meaningful," milestone birthday
- **Gift-giver frame** — Parent booking for daughter's celebration
- **Budget mismatch** — $800 vs. mariachi_4piece 3hr T3P anchor of $2,050
- **Platform competition** — 4 GigSalad quotes = medium competition

Expected pricing output: `mariachi_4piece | 3hr | T3P | anchor $2,050 | floor $1,900 | quote $2,050`

---

## How to Run

```bash
cd ~/projects/gig-lead-responder

# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key" > .env

# Run demo
npm run demo

# Verbose (shows classification JSON at each stage)
npm run demo -- --verbose

# JSON output (full pipeline output as single JSON blob)
npm run demo -- --json
```

---

## How to Resume Work

### To test and fix issues:
```
Read docs/HANDOFF.md. Run `npm run demo` and fix any issues. API key should be in .env.
```

### To run review:
```
Read docs/HANDOFF.md. Run /workflows:review on the feat/gig-lead-pipeline branch.
```

### To add missing features:
```
Read docs/plans/2026-02-20-feat-gig-lead-response-pipeline-plan.md.
Remaining work: CLI color output, --verbose flag polish, Rate_Card_Solo_Duo.md rates verification, automated tests.
```

### To compound (document learnings):
```
Read docs/HANDOFF.md. Run /workflows:compound to capture solved problems in docs/solutions/.
```

---

## Architecture Decisions

1. **Pipeline, not monolith** — Each stage is a separate function so you can inspect, debug, and improve independently
2. **Hardcoded rate tables** — Rates in TypeScript, not parsed from .md at runtime (fragile)
3. **Shared callClaude() helper** — Strips code fences, retries once on JSON parse failure
4. **Rewrite loop** — Failed gate feeds specific fail_reasons back to generator, max 2 retries, returns `verified: false` if all fail (never silently passes)
5. **Required vs optional docs** — RESPONSE_CRAFT.md and PRICING_TABLES.md throw if missing; everything else skips with warning
6. **format_requested vs format_recommended** — Classification outputs both the client's original ask AND the corrected format; pricing uses the corrected one

---

## Context for Presentation

This project is a demo for an AI user group presentation showcasing the **compound engineering** workflow:

1. **Brainstorm** — Explored requirements, chose tech stack, picked demo lead
2. **Plan** — 9-phase implementation plan with SpecFlow analysis (found 10 gaps, fixed 6 critical/important ones)
3. **Work** — Built all 9 phases with incremental commits (~50-100 lines each)
4. **Review** — Not yet done
5. **Compound** — Not yet done

The quinceañera lead was chosen because it's the stress test that generic tools fail — requires cultural context detection, genre correction, stealth premium override, and gift-giver framing all at once.
