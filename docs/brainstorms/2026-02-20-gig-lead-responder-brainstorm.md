# Gig Lead Response System — Brainstorm

**Date:** 2026-02-20
**Status:** Complete
**Next:** `/workflows:plan`

---

## What We're Building

A CLI tool that takes a raw event lead (pasted text or JSON), runs it through a multi-stage AI pipeline, and produces two ready-to-send responses: a full draft and a competition-calibrated compressed draft — with a quality verification gate in between.

**Context:** This is also a demo project for an AI user group presentation showcasing the compound engineering workflow (Brainstorm → Plan → Work → Review → Compound).

---

## Key Decisions

### Tech Stack
- **Runtime:** Node.js with TypeScript
- **API:** `@anthropic-ai/sdk` direct (no framework wrapper)
- **Model:** `claude-sonnet-4-5` for all calls
- **Interface:** CLI (stdin or file input → stdout)

### Architecture: Pipeline with Discrete Steps (Option B)
Chosen over single agentic call because each step is inspectable, debuggable, and improvable independently. Mirrors exactly how the source documents are structured.

```
Input (raw lead text)
    ↓
[1] classifyLead()        → Classification JSON
    ↓
[2] lookupPrice()         → Anchor / Floor / Quote price
    ↓
[3] selectContext()       → Which files to inject (cultural, venue, etc.)
    ↓
[4] generateResponse()    → Full draft + Compressed draft
    ↓
[5] verifyGate()          → Pass/Fail with evidence
    ↓ (if fail, loop back to 4 with fail_reasons, max 2 retries)
[6] Output
```

### Demo Scope: One Happy Path
- One polished quinceañera lead that fires every interesting behavior
- Full pipeline working end-to-end for this lead
- Other lead types are stretch goals, not requirements

### Source Documents
All business logic docs already exist and will be read at runtime:
- `PROTOCOL.md` — Classification steps 0-5
- `RESPONSE_CRAFT.md` — Drafting steps 6-11 + Verification Gate format
- `PRICING.md` — Tier bridge, quote formatting rules
- `Rate_Card_Solo_Duo.md` — Solo, duo, flamenco duo rates
- `Rate_Card_Trio_Ensemble.md` — Flamenco trio, mariachi rates
- `Rate_Card_Bolero_Trio.md` — Bolero trio rates
- `Bolero_Trio_Negotiation_Playbook.md` — Negotiation logic
- `CULTURAL_CORE.md` — Universal cultural framework
- `CULTURAL_SPANISH_LATIN.md` — Spanish/Latin terminology + room-painting patterns
- `VENUE_INTEL.md` — Venue tier classification + stealth premium signals
- `PRINCIPLES.md` — Core philosophy (referenced, not executed)
- `QUICK_REFERENCE.md` — All lookup tables in one place

---

## Demo Lead (Happy Path)

```
Event Type: Quinceañera
Date: Saturday, April 26, 2025
Time: 6:00 PM – 9:00 PM (3 hours)
Location: Estancia La Jolla
Guest Count: 120
Budget: $800
Genre Request: Spanish guitar / flamenco
Equipment: Not sure
Additional Notes: This is for my daughter's quinceañera. We want
something elegant and special. She loves Latin music. We are a Mexican
family and want the music to feel authentic and meaningful for this
milestone.
Lead Source: GigSalad
Quotes received: 4
```

### Why This Lead Is the Demo

Every interesting system behavior fires simultaneously:

1. **Stealth premium override** — Estancia La Jolla (Tier A venue) + 120 guests + La Jolla zip = T3 pricing despite $800 stated budget
2. **Genre correction** — Client asked for flamenco; system routes to mariachi for Mexican heritage quinceañera
3. **Cultural full activation** — "Mexican family," "authentic and meaningful," milestone birthday → CULTURAL_SPANISH_LATIN.md fully engaged
4. **Gift-giver frame** — Parent booking for daughter's once-in-a-lifetime celebration
5. **Budget mismatch reframe** — Qualification tier logic, never say "that's outside your budget"
6. **Platform competition** — 4 GigSalad quotes = medium competition, compressed word count target 80-100

---

## Key Behaviors to Preserve

- **Validation survives every compression** — even the 80-word compressed draft needs one sentence validating the parent, not the event
- **Concern traceability is mechanical** — every flagged concern from classification must map to an exact quoted sentence in the draft; empty = gate fail
- **Scene test is cinematic, not structural** — "I shape the music in phases" = FAIL; "the mariachi appears at her table and the room goes quiet" = PASS
- **Genre correction is the wedge** — the insight that this is a mariachi moment, not a flamenco moment, delivered with cultural confidence, is what no competitor will write
- **Dual output always** — full draft + compressed draft, every run

---

## Project Structure

```
gig-lead-responder/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── pipeline/
│   │   ├── classify.ts       # Stage 1: lead → classification JSON
│   │   ├── price.ts          # Stage 2: classification → pricing
│   │   ├── context.ts        # Stage 3: select files to inject
│   │   ├── generate.ts       # Stage 4: drafts
│   │   └── verify.ts         # Stage 5: gate + rewrite loop
│   ├── data/
│   │   ├── rates.ts          # All rate card data as typed objects
│   │   └── venues.ts         # Venue tier classifications
│   └── prompts/
│       ├── classify.ts       # Classification prompt builder
│       ├── generate.ts       # Generation prompt builder
│       └── verify.ts         # Verification gate prompt builder
├── docs/                     # Source .md files live here (read at runtime)
├── .env
├── package.json
└── tsconfig.json
```

---

## Contact Block (Always Appended to Responses)

```
Alex Guillen
Pacific Flow Entertainment
(619) 755-3246
```

---

## Resolved Questions

1. **Rate cards → hardcoded TypeScript objects** in `src/data/rates.ts`. The .md files are human-readable business docs, not data sources. Parsing markdown at runtime is fragile. When rates change, update `rates.ts` manually.
2. **Cost per run: ~$0.04–0.08**, worst case ~$0.15 with rewrite loop. Classification is cheap (~500 tokens). Generation is the expensive call (~2000 tokens with injected context). Not a concern at this scale.
3. **Error handling — three explicit modes:**
   - JSON parse failure on classification → retry with "return only valid JSON" reinforcement
   - Gate returning unparseable evidence → treat as gate fail, trigger rewrite
   - Rewrite loop exhausted (2 retries) → return best attempt with `verified: false` flag — never silently pass a failed gate
4. **Output format** — TBD in plan phase (stdout for demo)
