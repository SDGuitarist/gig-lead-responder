---
title: "feat: Gig Lead Response Pipeline"
type: feat
date: 2026-02-20
brainstorm: docs/brainstorms/2026-02-20-gig-lead-responder-brainstorm.md
---

# feat: Gig Lead Response Pipeline

## Overview

Build a TypeScript CLI tool that takes a raw music gig lead, runs it through a 5-stage AI pipeline (classify → price → context → generate → verify), and outputs two ready-to-send response drafts — a full draft and a competition-compressed draft — with an evidence-based quality gate.

Demo target: one quinceañera lead that fires every interesting system behavior (stealth premium, genre correction, cultural activation, gift-giver frame, budget reframe, platform competition).

## Problem Statement

Responding to gig leads manually is slow and inconsistent. A pipeline codifies expert reasoning: detecting stealth premium signals, correcting genre assumptions, activating cultural context, calibrating pricing to competition, and producing responses that no competitor will match — all in seconds.

## Proposed Solution

A discrete pipeline (not a single monolithic prompt) where each step is inspectable and improvable independently:

```
Raw Lead → [classify] → [price] → [context] → [generate] → [verify] → Output
                                                    ↑           |
                                                    └───────────┘
                                                   (rewrite if gate fails, max 2)
```

## Technical Approach

### Stack
- Runtime: Node.js + TypeScript (strict mode)
- API: `@anthropic-ai/sdk` direct
- Model: `claude-sonnet-4-5` for all calls
- Interface: CLI via `tsx` (no compile step needed for demo)

### Key Design Rules (from SpecFlow analysis)

**Format detection:** Classification must output one of these exact format strings: `solo`, `duo`, `flamenco_duo`, `flamenco_trio`, `mariachi_4piece`, `mariachi_full`, `bolero_trio`. The classification prompt includes explicit routing rules:
- Mexican heritage event → `mariachi_4piece` (default) or `mariachi_full` (if 150+ guests or client explicitly requests large ensemble)
- Flamenco request without cultural override → `flamenco_duo` or `flamenco_trio`
- The `format_recommended` field on Classification is the corrected format. `format_requested` is the client's original ask. Pricing uses `format_recommended`.

**Duration extraction:** Classification must extract `duration_hours` as a number field. The classification prompt maps raw text to the nearest valid duration key: `1`, `1.5`, `2`, `3`, `4`.

**Lead source mapping:** `lead_source_column` is always `"P"` (platform) or `"D"` (direct). GigSalad, TheBash, Thumbtack → `"P"`. Everything else → `"D"`. This is set in classification.

**Rewrite loop mechanism:** `generateResponse()` accepts an optional 4th parameter `rewriteInstructions?: string[]`. On retries, the fail_reasons from the gate are passed here and appended to the user message as "REWRITE INSTRUCTIONS: fix these specific issues: [...]".

**JSON parsing strategy:** All Claude calls use a shared `callClaude()` helper that: (a) strips markdown code fences from responses, (b) calls `JSON.parse()`, (c) on failure retries once with "return only valid JSON, no markdown fences" appended. If retry also fails, throws with the raw response attached for debugging.

**"Best attempt" on loop exhaustion:** Always return the last attempt (simplest, avoids comparison logic). Mark `verified: false`.

**Required vs optional context files:** `RESPONSE_CRAFT.md` and `PRICING.md` are required — throw if missing. All others are optional — skip with console.warn.

### Architecture

```
src/
├── index.ts              # CLI entry point: read input → run pipeline → print output
├── types.ts              # All shared interfaces (LeadInput, Classification, Pricing, etc.)
├── claude.ts             # Shared callClaude() helper with JSON parsing + retry
├── pipeline/
│   ├── classify.ts       # classifyLead(rawText) → Classification
│   ├── price.ts          # lookupPrice(classification) → PricingResult
│   ├── context.ts        # selectContext(classification) → string (assembled context)
│   ├── generate.ts       # generateResponse(classification, pricing, context) → Drafts
│   └── verify.ts         # verifyGate(drafts, classification) → GateResult; rewrite loop
├── data/
│   ├── rates.ts          # Hardcoded rate card lookup tables
│   └── venues.ts         # Venue tier classifications + stealth premium signals
└── prompts/
    ├── classify.ts       # Builds the classification system prompt
    ├── generate.ts       # Builds the generation system prompt with injected context
    └── verify.ts         # Builds the verification gate prompt
```

---

## Implementation Phases

### Phase 1: Project Scaffold

Set up the project skeleton so everything compiles and runs.

**Files to create:**
- `package.json` — name, typescript + tsx + @anthropic-ai/sdk + dotenv dependencies
- `tsconfig.json` — strict mode, ES2022 target, NodeNext module resolution
- `.env` — `ANTHROPIC_API_KEY` placeholder
- `.gitignore` — node_modules, .env, dist
- `src/types.ts` — all interfaces (canonical definitions below)
- `src/claude.ts` — shared `callClaude()` helper with JSON parsing + retry
- `src/index.ts` — stub that reads stdin and prints "pipeline not yet implemented"

#### Complete Type Definitions for `src/types.ts`

```typescript
// Valid format strings — must match rate table keys exactly
export type Format = "solo" | "duo" | "flamenco_duo" | "flamenco_trio"
  | "mariachi_4piece" | "mariachi_full" | "bolero_trio";

export interface Classification {
  // Mode & action
  mode: "confirmation" | "evaluation";
  action: "quote" | "assume_and_quote" | "one_question";
  vagueness: "clear" | "vague";

  // Competition
  competition_level: "low" | "medium" | "high" | "extreme";
  competition_quote_count: number;

  // Stealth premium
  stealth_premium: boolean;
  stealth_premium_signals: string[];

  // Pricing
  tier: "premium" | "standard" | "qualification";
  rate_card_tier: "T1" | "T2" | "T3";
  lead_source_column: "P" | "D";
  price_point: "full_premium" | "slight_premium" | "at_market" | "below_market";

  // Format — BOTH the client's request AND the corrected recommendation
  format_requested: string;           // What the client asked for (raw)
  format_recommended: Format;         // Corrected format for pricing lookup

  // Duration — extracted from lead text
  duration_hours: 1 | 1.5 | 2 | 3 | 4;

  // Timeline & urgency
  timeline_band: "comfortable" | "short" | "urgent";
  close_type: "direct" | "soft_hold" | "hesitant";

  // Cultural
  cultural_context_active: boolean;
  cultural_tradition: "spanish_latin" | null;

  // Context modifiers
  planner_effort_active: boolean;
  social_proof_active: boolean;
  context_modifiers: string[];
  flagged_concerns: string[];
}

export interface PricingResult {
  format: Format;
  duration_hours: number;
  tier_key: string;             // e.g., "T3P"
  anchor: number;
  floor: number;
  quote_price: number;
  competition_position: string; // e.g., "at anchor, willing to flex"
}

export interface Drafts {
  full_draft: string;
  compressed_draft: string;
  compressed_word_count: number;
}

export interface GateResult {
  validation_line: string;
  best_line: string;
  concern_traceability: Array<{
    concern: string;
    draft_sentence: string;     // Empty string = FAIL
  }>;
  scene_quote: string;
  scene_type: "cinematic" | "structural";
  competitor_test: boolean;     // false = rewrite
  gut_checks: {
    can_see_it: boolean;
    validated_them: boolean;
    named_fear: boolean;
    differentiated: boolean;
    preempted_questions: boolean;
    creates_relief: boolean;
    best_line_present: boolean;
    prose_flows: boolean;
    competitor_test: boolean;
  };
  gate_status: "pass" | "fail";
  fail_reasons: string[];
}

export interface PipelineOutput {
  classification: Classification;
  pricing: PricingResult;
  drafts: Drafts;
  gate: GateResult;
  verified: boolean;
  timing: Record<string, number>;  // stage name → milliseconds
}
```

**Acceptance criteria:**
- [ ] `npx tsx src/index.ts` runs without errors
- [ ] All type interfaces defined and exported (Classification, PricingResult, Drafts, GateResult, PipelineOutput)
- [ ] `callClaude()` helper handles JSON parsing, code fence stripping, and one retry
- [ ] `.env` is in `.gitignore`
- [ ] `ANTHROPIC_API_KEY` validated on startup (throw if missing)

**Commit:** `feat: scaffold project with types and CLI entry point`

---

### Phase 2: Data Layer

Hardcode rate cards and venue intelligence as typed TypeScript objects.

**Files to create:**

#### `src/data/rates.ts`

Rate card lookup tables extracted from Rate_Card_Solo_Duo.md, Rate_Card_Trio_Ensemble.md, Rate_Card_Bolero_Trio.md. Structure:

```typescript
export interface RateEntry {
  anchor: number;
  floor: number;
}

export interface FormatRates {
  [durationKey: string]: {
    T1: RateEntry;
    T2P: RateEntry;  // Tier 2, Platform
    T2D: RateEntry;  // Tier 2, Direct
    T3P: RateEntry;  // Tier 3, Platform
    T3D: RateEntry;  // Tier 3, Direct
  };
}

// Example: MARIACHI_4PIECE_RATES, SOLO_RATES, DUO_RATES, etc.
```

#### `src/data/venues.ts`

Venue tier map extracted from VENUE_INTEL.md. Structure:

```typescript
export interface VenueEntry {
  tier: "A" | "B" | "C";
  stealthPremium: boolean;
  notes?: string;
}

export const VENUE_MAP: Record<string, VenueEntry> = {
  "estancia la jolla": { tier: "A", stealthPremium: true },
  // ...
};
```

**Acceptance criteria:**
- [ ] `rates.ts` exports typed rate tables for all formats (solo, duo, flamenco duo, flamenco trio, mariachi 4-piece, mariachi full, bolero trio)
- [ ] `venues.ts` exports venue map with tier and stealth premium flag
- [ ] Both files import cleanly — `npx tsx -e "import './src/data/rates'; import './src/data/venues';"` succeeds

**Commit:** `feat: add rate card and venue data tables`

---

### Phase 3: Pipeline — Classification (`classify.ts`)

The classification engine: takes raw lead text, returns structured JSON with mode, competition, pricing tier, cultural flags, and more.

**Files to create:**

#### `src/prompts/classify.ts`

Builds the system prompt for classification. Key elements:
- The full Classification output schema as the expected JSON format
- Rules for detecting stealth premium signals (venue tier, guest count, zip code)
- Rules for genre correction (Mexican heritage + flamenco request → mariachi)
- Cultural context detection triggers
- Competition level mapping (quote count → low/medium/high/extreme)
- Timeline band calculation (date vs today)

The prompt should reference logic from: PROTOCOL.md Steps 0-5, VENUE_INTEL.md stealth premium rules, CULTURAL_SPANISH_LATIN.md activation triggers.

#### `src/pipeline/classify.ts`

```typescript
export async function classifyLead(rawText: string): Promise<Classification> {
  // 1. Build system prompt from prompts/classify.ts
  // 2. Call Claude with rawText as user message
  // 3. Parse JSON response
  // 4. Validate required fields exist
  // 5. Return Classification object
  // Error: retry once with "return only valid JSON" reinforcement
}
```

**Acceptance criteria:**
- [ ] Given the demo lead, returns classification with:
  - `cultural_context_active: true`
  - `cultural_tradition: "spanish_latin"`
  - `stealth_premium: true` with signals including venue + guest count
  - `competition_level: "medium"` (4 quotes)
  - `tier: "qualification"` (budget mismatch)
  - `rate_card_tier: "T3"` (stealth premium override)
  - Genre correction flagged in `context_modifiers` or `flagged_concerns`
- [ ] Returns valid JSON (not wrapped in markdown code fences)
- [ ] Retries once on JSON parse failure

**Commit:** `feat: add classification pipeline stage with prompt`

---

### Phase 4: Pipeline — Pricing (`price.ts`)

Pure function: takes classification (which includes `format_recommended` and `duration_hours`), looks up rate card, applies competition-level positioning.

#### `src/pipeline/price.ts`

```typescript
export function lookupPrice(classification: Classification): PricingResult {
  // 1. Map classification.format_recommended to rate table
  //    e.g., "mariachi_4piece" → MARIACHI_4PIECE_RATES
  //    Throw if format not in RATE_TABLES map
  // 2. Map classification.duration_hours to duration key
  //    e.g., 3 → "3hr". Throw if no matching key
  // 3. Build tier+source key from classification.rate_card_tier + classification.lead_source_column
  //    e.g., "T3" + "P" → "T3P". Special case: T1 has no P/D split → just "T1"
  // 4. Look up anchor and floor from rate table
  // 5. Apply competition positioning based on classification.competition_level:
  //    - low → quote_price = anchor
  //    - medium → quote_price = anchor (competition_position = "at anchor, willing to flex")
  //    - high → quote_price = floor + (anchor - floor) * 0.25
  //    - extreme → quote_price = floor
  // 6. Return PricingResult
}
```

**Acceptance criteria:**
- [ ] Given T3 + Platform + mariachi_4piece + 3hr → returns correct anchor/floor from rate card
- [ ] Competition level "medium" → quote_price equals anchor
- [ ] No API calls — this is a pure data lookup

**Commit:** `feat: add pricing lookup function`

---

### Phase 5: Pipeline — Context Selection (`context.ts`)

Reads source .md files from `docs/` and assembles the context string to inject into the generation prompt.

#### `src/pipeline/context.ts`

```typescript
export async function selectContext(
  classification: Classification
): Promise<string> {
  // Always include: RESPONSE_CRAFT.md core framework, PRINCIPLES.md excerpt
  // Conditional:
  //   if cultural_context_active → include CULTURAL_SPANISH_LATIN.md
  //   if venue in VENUE_MAP → include relevant VENUE_INTEL.md section
  //   if planner_effort_active → include planner context
  // Read files from docs/ directory using fs.readFile
  // Concatenate with section headers
  // Return assembled context string
}
```

**Acceptance criteria:**
- [ ] For demo lead: includes RESPONSE_CRAFT.md + CULTURAL_SPANISH_LATIN.md + VENUE_INTEL.md
- [ ] Context string has clear section headers for each included document
- [ ] Files that don't exist are skipped with a warning, not a crash

**Commit:** `feat: add context selection and assembly`

---

### Phase 6: Pipeline — Response Generation (`generate.ts`)

The expensive call: takes all inputs and produces two drafts.

**Files to create:**

#### `src/prompts/generate.ts`

Builds the generation system prompt. Key elements:
- 7-component response framework from RESPONSE_CRAFT.md (wedge, validation, scene, format, logistics, close, contact)
- Compressed draft instructions with word count target based on competition level
- Contact block (always appended): Alex Guillen, Pacific Flow Entertainment, (619) 755-3246
- Injected context from selectContext()
- Classification JSON for reference
- Pricing info (quote price, anchor, floor)

#### `src/pipeline/generate.ts`

```typescript
export async function generateResponse(
  classification: Classification,
  pricing: PricingResult,
  context: string,
  rewriteInstructions?: string[]  // From failed gate — targeted fixes
): Promise<Drafts> {
  // 1. Build system prompt from prompts/generate.ts
  // 2. Build user message with classification + pricing + "produce full draft and compressed draft"
  // 3. If rewriteInstructions present, append:
  //    "REWRITE INSTRUCTIONS: Fix these specific issues: [list]"
  // 4. Call Claude — ask for JSON with { full_draft, compressed_draft } keys
  // 5. Parse JSON response using callClaude() helper
  // 6. Count words in compressed_draft, attach as compressed_word_count
  // 7. Append contact block to both drafts
  // 8. Return Drafts
}
```

**Acceptance criteria:**
- [ ] Full draft opens with genre correction wedge (mariachi, not flamenco)
- [ ] Full draft includes validation line specific to the parent/daughter milestone
- [ ] Full draft includes cinematic scene (not structural)
- [ ] Compressed draft is 80-100 words (medium competition target)
- [ ] Compressed draft still contains a validation sentence
- [ ] Contact block appended to both drafts
- [ ] Cultural terminology present (Las Mañanitas, serenata, generational thread)

**Commit:** `feat: add response generation with dual draft output`

---

### Phase 7: Pipeline — Verification Gate (`verify.ts`)

The quality gate: validates drafts against classification, returns evidence-based pass/fail.

**Files to create:**

#### `src/prompts/verify.ts`

Builds the verification prompt. Requires Claude to extract exact quotes from the draft as evidence:
- validation_line: exact sentence that validates the client
- best_line: strongest sentence in the draft
- concern_traceability: each flagged concern → exact draft sentence addressing it
- scene_quote: exact cinematic sentence
- scene_type: "cinematic" or "structural" (structural = auto-FAIL)
- competitor_test: would a competitor write this? (true = fail)
- 9 gut checks (boolean)
- gate_status: "pass" or "fail"
- fail_reasons: specific items to fix

#### `src/pipeline/verify.ts`

```typescript
export async function verifyGate(
  drafts: Drafts,
  classification: Classification
): Promise<GateResult> {
  // 1. Build verification prompt
  // 2. Call Claude with drafts + classification
  // 3. Parse GateResult JSON
  // 4. Return result
}

export async function runWithVerification(
  classification: Classification,
  pricing: PricingResult,
  context: string,
  maxRetries: number = 2
): Promise<{ drafts: Drafts; gate: GateResult; verified: boolean }> {
  // 1. Generate initial drafts
  // 2. Run verification gate
  // 3. If pass → return { drafts, gate, verified: true }
  // 4. If fail → pass fail_reasons back to generateResponse as rewrite instructions
  // 5. Repeat up to maxRetries
  // 6. If still failing → return best attempt with verified: false
}
```

**Acceptance criteria:**
- [ ] Gate returns structured JSON with all evidence fields
- [ ] Gate correctly identifies cinematic vs structural scene descriptions
- [ ] Concern traceability check catches missing concern mappings
- [ ] Rewrite loop passes fail_reasons as targeted instructions
- [ ] After max retries, returns best attempt with `verified: false` (never silently passes)

**Commit:** `feat: add verification gate with rewrite loop`

---

### Phase 8: Wire Up CLI (`index.ts`)

Connect all pipeline stages into the CLI entry point.

#### `src/index.ts`

```typescript
// 1. Read lead from stdin (piped) or from a file path argument
// 2. Parse into raw text string
// 3. Run pipeline:
//    const classification = await classifyLead(rawText)
//    const pricing = lookupPrice(classification)
//    const context = await selectContext(classification)
//    const { drafts, gate, verified } = await runWithVerification(classification, pricing, context)
// 4. Print output:
//    - Classification summary (key fields)
//    - Pricing summary
//    - Full draft
//    - Compressed draft
//    - Gate status + evidence
//    - If !verified: warning banner
```

**Acceptance criteria:**
- [ ] `echo "<demo lead>" | npx tsx src/index.ts` produces full pipeline output
- [ ] Output clearly separates classification, pricing, full draft, compressed draft, gate results
- [ ] Pipeline errors are caught and reported clearly (not raw stack traces)
- [ ] Total run time logged at end

**Commit:** `feat: wire up CLI entry point with full pipeline`

---

### Phase 9: Demo Polish

Add the demo lead as a fixture and make the output presentation-ready.

**Files to create:**
- `examples/quinceanera-lead.txt` — the demo lead text
- Update `package.json` scripts: `"demo": "tsx src/index.ts < examples/quinceanera-lead.txt"`

**Polish:**
- [ ] Add color to CLI output (classification = cyan, pricing = yellow, drafts = white, gate = green/red)
- [ ] Add a `--verbose` flag that shows intermediate JSON at each stage
- [ ] Add a `--json` flag that outputs everything as a single JSON blob

**Acceptance criteria:**
- [ ] `npm run demo` runs the full pipeline on the quinceañera lead
- [ ] Output is visually clear and presentation-ready
- [ ] Verbose mode shows the pipeline thinking at each stage

**Commit:** `feat: add demo fixture and CLI polish`

---

## Acceptance Criteria

### Functional Requirements
- [ ] CLI accepts raw lead text from stdin or file
- [ ] Classification correctly detects: cultural context, stealth premium, competition level, tier, genre mismatch
- [ ] Pricing returns correct anchor/floor for the detected format + tier + source
- [ ] Full draft opens with wedge (genre correction for demo lead)
- [ ] Full draft contains validation, cinematic scene, cultural terminology
- [ ] Compressed draft meets word count target (80-100 for medium competition)
- [ ] Compressed draft retains validation sentence
- [ ] Verification gate returns evidence-based pass/fail
- [ ] Failed gate triggers rewrite with targeted instructions
- [ ] After max retries, returns best attempt with `verified: false`
- [ ] Contact block appended to all drafts

### Non-Functional Requirements
- [ ] Total pipeline runs in under 30 seconds
- [ ] Cost per run under $0.15 even with rewrite loop
- [ ] No API key in source code (read from .env)

---

## Dependencies & Prerequisites

- Node.js 18+ installed
- `ANTHROPIC_API_KEY` in `.env`
- Source business logic docs copied to `docs/` directory before Phase 5
  - PROTOCOL.md, RESPONSE_CRAFT.md, PRICING.md, CULTURAL_SPANISH_LATIN.md, CULTURAL_CORE.md, VENUE_INTEL.md, PRINCIPLES.md, QUICK_REFERENCE.md, all rate cards

---

## Risk Analysis

| Risk | Impact | Mitigation |
|---|---|---|
| Claude returns non-JSON from classification | Pipeline breaks | Retry with reinforced prompt; validate before proceeding |
| Verification gate too strict | Always fails, rewrite loop exhausts | Tune gate prompt; ensure `verified: false` fallback works |
| Source docs not available at demo time | Context assembly fails | Graceful skip with warning; hardcode critical context as fallback |
| Demo takes >30s | Awkward silence | Log each stage timing; parallelize where possible |
| API transport error (429, 500, timeout) | Pipeline crashes | Crash with clear error message — no retry for transport errors in demo. Production would add exponential backoff. |
| Rate table lookup miss (unknown format/duration) | Pricing returns undefined | Throw with descriptive error showing what key was attempted and what keys exist |

---

## References

- Brainstorm: `docs/brainstorms/2026-02-20-gig-lead-responder-brainstorm.md`
- Anthropic SDK: `@anthropic-ai/sdk` — `client.messages.create()` with structured output
- Source docs: PROTOCOL.md, RESPONSE_CRAFT.md, PRICING.md, CULTURAL_SPANISH_LATIN.md, VENUE_INTEL.md, rate cards
