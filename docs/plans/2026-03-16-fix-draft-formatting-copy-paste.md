---
title: Fix draft formatting for copy-paste readiness
type: fix
scope: prompt + pipeline code
feed_forward:
  risk: "Client name extraction — classify prompt doesn't output client_name, generate prompt can't produce salutation without it"
  verify_first: true
linked_expectations:
  - file: src/prompts/generate.ts
    expect: "salutation instruction, simplified contact block, em dash reduction rule"
  - file: src/prompts/classify.ts
    expect: "client_first_name field added to JSON output"
  - file: src/types.ts
    expect: "client_first_name added to Classification interface"
  - file: src/prompts/verify.ts
    expect: "contact block check updated at BOTH locations — name only, no business/phone required"
  - file: src/pipeline/generate.ts
    expect: "CONTACT_BLOCK simplified to Alex Guillen only, ensureContactBlock checks for name not phone"
  - file: src/pipeline/classify.ts
    expect: "null fallback for client_first_name when LLM omits it"
  - file: src/utils/sanitize.ts
    expect: "client_first_name truncated in sanitizeClassification"
  - file: src/enrich-generate.test.ts
    expect: "client_first_name: null added to makeClassification fixture"
---

## Prior Phase Risk

Brainstorm skipped (user provided exact specs via screenshot). Risk: none — requirements are unambiguous visual comparison.

## Plan Review Findings (applied)

- **P1:** `src/pipeline/generate.ts` has hardcoded `CONTACT_BLOCK` constant and `ensureContactBlock()` that appends 3-line block in code — must update both
- **P2:** `sanitizeClassification()` must truncate `client_first_name` (untrusted free-text)
- **P2:** `verify.ts` has TWO locations referencing 3-part contact block (Section 8 + gate status summary line 84)
- **P3:** `pipeline/classify.ts` needs null fallback for `client_first_name` (like `venue_name` pattern)
- **P3:** `enrich-generate.test.ts` fixture needs `client_first_name: null`

## Problem

Drafts are not copy-paste ready. Three issues:

1. **No salutation** — draft jumps straight into the cinematic opening
2. **Sign-off too heavy** — includes "Pacific Flow Entertainment" and phone number; user wants just "Alex Guillen"
3. **Too many em dashes** — drafts use em dashes (—) extensively; they look awkward when pasted into messaging platforms

## What exactly is changing?

### Change 1: Add `client_first_name` to Classification

**File:** `src/types.ts`
- Add `client_first_name: string | null` to the `Classification` interface (after `venue_name`)

**File:** `src/prompts/classify.ts`
- Add extraction instruction: "Extract the client's first name from the lead. Use only the first name (e.g., 'Cristina' from 'Cristina C.'). Set to null if no name is present."
- Add `"client_first_name": string | null` to the JSON output schema

**File:** `src/pipeline/classify.ts`
- Add null fallback: `if (result.client_first_name === undefined) result.client_first_name = null;`
- Add empty string sanitization (like venue_name pattern)

**File:** `src/utils/sanitize.ts`
- Add `client_first_name: c.client_first_name ? truncate(c.client_first_name) : c.client_first_name` to `sanitizeClassification()`

### Change 2: Add salutation instruction to generate prompt

**File:** `src/prompts/generate.ts`
- Inject `classification.client_first_name` into the prompt
- Add salutation instruction before the 5-step sequence: "Start every draft with 'Hi [name],' on its own line, followed by a blank line. If no name is available, omit the salutation."

### Change 3: Simplify contact block (prompt + code)

**File:** `src/prompts/generate.ts`
- Change non-GigSalad contact block instruction from 3 lines to just `Alex Guillen`

**File:** `src/pipeline/generate.ts` (P1 fix)
- Change `CONTACT_BLOCK` from `"\nAlex Guillen\nPacific Flow Entertainment\n(619) 755-3246"` to `"\nAlex Guillen"`
- Change `ensureContactBlock()` to check for `"Alex Guillen"` instead of `"(619) 755-3246"`

### Change 4: Add em dash reduction rule

**File:** `src/prompts/generate.ts`
- Add to CRITICAL RULES: "Punctuation rule: Minimize em dashes (—). Use commas, semicolons, 'with', or 'and' instead. Em dashes are acceptable ONLY in the pricing line (e.g., 'Latin Duo — 2.5 hours: $1,100'). Elsewhere, rewrite to avoid them."

### Change 5: Update verify prompt contact block check

**File:** `src/prompts/verify.ts`
- Location 1 (Section 8, lines 74-77): Change from requiring name + business + phone to requiring only "Alex Guillen" as sign-off
- Location 2 (gate status summary, line 84): Change `"contact block present with name, business, phone"` to `"sign-off present"`
- Update fail message accordingly

### Change 6: Update test fixture

**File:** `src/enrich-generate.test.ts`
- Add `client_first_name: null` to `makeClassification()` fixture

## What must NOT change?

- GigSalad platform policy (no contact info at all) — unchanged
- Verify gate logic, gut checks, concern traceability — unchanged
- Pricing, classification, context assembly — unchanged
- Compressed draft rules — same changes apply (salutation, simplified sign-off, em dash rule)
- No changes to `run-pipeline.ts`, `pipeline/verify.ts`, or `pipeline/context.ts`

## How will we know it worked?

1. `npm test` passes (84 tests)
2. Run all 4 test leads through the pipeline
3. Each draft must:
   - Start with "Hi [Name]," on its own line (or no salutation if name is null)
   - End with just "Alex Guillen" (no PFE, no phone)
   - Have zero or at most one em dash (in the pricing line only)
4. Verify gate passes on all 4 leads

## What is the most likely way this plan is wrong?

The classify LLM might not reliably extract `client_first_name` from all lead formats. Some leads come from emails where the name is in a header, others from forms where it's labeled. Mitigation: the generate prompt handles `null` gracefully (omits salutation). Worst case is a missing salutation, not a broken draft.

## Steps

1. Add `client_first_name: string | null` to `Classification` in `src/types.ts`
2. Add extraction instruction + JSON field to `src/prompts/classify.ts`
3. Add null fallback + empty string sanitization to `src/pipeline/classify.ts`
4. Add truncation to `sanitizeClassification()` in `src/utils/sanitize.ts`
5. Update `src/prompts/generate.ts`: salutation, simplified contact block, em dash rule
6. Update `CONTACT_BLOCK` + `ensureContactBlock()` in `src/pipeline/generate.ts`
7. Update `src/prompts/verify.ts`: relax contact block check at both locations
8. Add `client_first_name: null` to test fixture in `src/enrich-generate.test.ts`
9. Run `npm test` — fix any failures
10. Run all 4 test leads — verify formatting

## Three Questions

1. **Hardest decision in this session?** Whether to extract client_first_name in classify (adding it to the Classification type) vs. parsing it separately. Chose classify because the LLM already reads the full lead text there and it's the natural extraction point.

2. **What did you reject, and why?** Rejected parsing the name in TypeScript code (regex on raw text) — too fragile across lead formats (email headers, form fields, "Cristina C." vs "cristina castillo"). The LLM handles name extraction naturally.

3. **Least confident about going into the next phase?** The `ensureContactBlock()` check changing from phone number to "Alex Guillen" — need to make sure the LLM doesn't sometimes write "Alex" or "- Alex Guillen" which would cause a double sign-off.
