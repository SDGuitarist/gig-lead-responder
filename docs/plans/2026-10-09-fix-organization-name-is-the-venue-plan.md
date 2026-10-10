---
title: "organization_name must never be the venue"
date: 2026-10-09
type: fix
phase: plan
branch: feat/hub-phase0
input: docs/reviews/2026-10-09-price-block-local-runs.md (finding, 2/2 runs)
brainstorm: skipped (the finding names the field, the failing input and the risk; CLAUDE.md skip gate)
feed_forward:
  risk: "The guard is deterministic, but it only catches the venue. The classifier can still invent another wrong name, and no check sees that."
  verify_first: true
---

# organization_name must never be the venue

### Prior Phase Risk

> "The marker on real, varied leads: 6 runs on 3 texts, and the classifier's T2/T3 call decides whether NP2 fires
> at all; plus organization_name filled with the venue, which no check sees." (HANDOFF, price-block work session,
> Three Questions 3.)

This plan addresses the second half: the venue-as-organization case. The marker-rate half is measured during the
Module 1 ramp and is not addressed here.

## The finding

Lead (c) in the price-block real-model runs named no organization ("Our foundation is hosting a donor reception
at the Example Grand Hotel..."). The classifier returned `organization_name: "Example Grand Hotel"` on **2 of 2**
runs. On a priced NP2 lead, the app would write "...my in-kind contribution to the Example Grand Hotel." The
`[organization]` hold (`in_kind_org_missing`) never fires, because a name is present, and the post-check confirms
only that the block is the app's, not that the name is right. Every nonprofit lead is held for Alex, so nothing
sends unreviewed. But a wrong name is easy to miss when the rest of the block is exact.

## Decision (Claude Code proposal; Alex chose "fix org = venue" next, 2026-10-09)

1. **Deterministic guard (the fix).** In `normalizeOrganizationName` (`src/pipeline/classify.ts`), return `null`
   when the organization name and the classifier's `venue_name` **match**: after lower-casing, dropping a leading
   "the", replacing every non-letter/non-digit with a space and collapsing spaces, one name's word sequence appears
   inside the other's as whole words. With `null`, the existing path holds the draft: `inKindSentence` writes
   `[organization]` and the post-check adds `in_kind_org_missing` (unchanged code).
2. **Prompt line (secondary).** The `organization_name` definition in `src/prompts/classify.ts` gains: "Never the
   venue or the place the event is held." This lowers how often the guard has to fire; the guard is what is relied
   on.

**Why whole-word containment, not equality:** the classifier may return "Example Grand Hotel" for a venue
"Example Grand Hotel La Jolla" (or the reverse). **Why not plain substring:** "the Park" must not drop
"Parkview Foundation". **Accepted cost:** a real foundation named after its venue ("Hotel del Coronado Foundation"
at "Hotel del Coronado") is dropped, so that lead is held for Alex to type the name (`[organization]`). That is a
hold, never a wrong name.

## Plan Quality Gate

### 1. What exactly is changing?

| # | File | Change |
|---|---|---|
| A | `src/pipeline/classify.ts` | `normalizeOrganizationName(value, nonprofitBuyer, venueName?)` gains a third argument; returns `null` on a venue match (rule above). The call in `validateClassification` passes `obj.venue_name`. A small helper `nameWords(s)` (normalise → word array) and `containsWords(a, b)` (contiguous whole-word match either way). |
| B | `src/prompts/classify.ts` | One sentence added to the `organization_name` definition (above). |
| C | `src/port-manifest-np2.test.ts` | New tests (below); the existing organization-name tests stay green unchanged. |

### 2. What must not change?

- Prices, `inKindSentence`, `inKindName`, `nonprofitPriceNote`, the post-check, the price block: untouched.
- A nonprofit lead whose organization differs from the venue keeps its name exactly as today.
- Non-nonprofit leads: `organization_name` stays `null` (unchanged rule).
- `venue_name` itself is not changed by this guard.
- Files not to touch: `src/pipeline/price.ts`, `src/pipeline/post-check.ts`, `src/pipeline/price-block.ts`,
  `src/prompts/generate.ts`, `.env`, `data/leads.db`, `public/`.

### 3. How will we know it worked?

The EARS tests below (unit, mutation-checked), a green suite + tsc, and the real-model run in the Execution Path:
lead (c) from the price-block runs returns `organization_name: null` (3 runs).

### 4. What is the most likely way this plan is wrong?

**The classifier invents a different wrong name** (the event title, the planner's company, a city), which the venue
guard cannot see. This plan does not close that: no deterministic check can know a correct organization name. It is
recorded as a known gap. Second: **the venue name itself is missing or different** (venue_name null while the
organization is the hotel). Then the guard cannot fire. The prompt line is the only defence there; the real-model run
measures whether it helps on lead (c).

### 5. How will a human RUN this, and when?

See **Execution Path**.

## Acceptance Tests (EARS)

All in `src/port-manifest-np2.test.ts`; run with `npm test` and `npm run test:match -- "<name>"`.

- **O1** WHEN a nonprofit classification has `organization_name: "Example Grand Hotel"` and `venue_name: "Example
  Grand Hotel"` THE SYSTEM SHALL return `organization_name: null`. *Mutation:* drop the venue check; O1 fails.
- **O2** WHEN the names differ only by case, a leading "the", or punctuation ("The Example Grand Hotel" vs "example
  grand hotel.") THE SYSTEM SHALL return null.
- **O3** WHEN one name contains the other as whole words ("Example Grand Hotel" vs "Example Grand Hotel La
  Jolla", both directions) THE SYSTEM SHALL return null.
- **O4 (positive)** WHEN the venue is "the Park" and the organization "Parkview Foundation" THE SYSTEM SHALL keep
  "Parkview Foundation". *Mutation:* plain substring match; O4 fails.
- **O5 (positive)** WHEN the organization differs from the venue ("Example Arts Foundation" at "Example Grand
  Hotel"), or `venue_name` is null, THE SYSTEM SHALL keep the organization name unchanged.
- **O6 (end to end, pure)** WHEN a priced NP2 classification has the organization equal to the venue THE SYSTEM
  SHALL produce an in-kind sentence ending "to [organization]." and `nonprofitPriceNote` SHALL say the lead names
  no organization. *Mutation:* pass `undefined` for venueName at the call site; O6 fails.
- **O7** WHEN the classify prompt is built THE SYSTEM SHALL say the organization is never the venue.

Verification: `npm test` (0 fail), `npx tsc --noEmit`,
`git diff <base>..HEAD --stat -- src/pipeline/price.ts src/pipeline/post-check.ts src/pipeline/price-block.ts src/prompts/generate.ts public/` (empty).

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. Guard + O1–O6 (A, C). ~60 lines.
2. Prompt line + O7 (B). ~15 lines.
3. Real-model run (Execution Path), recorded in `docs/reviews/<date>-org-venue-local-runs.md`.
4. Update `docs/END-TO-END-STATUS.md` (risk row) and HANDOFF in the same commit as step 3.

## Execution Path

- **Target:** this Mac, the local CLI. Nothing sent; no server or poller; `data/leads.db` never opened.
- **Mechanism:** `DATABASE_PATH=<scratchpad>/runs.db npx tsx src/index.ts --json < lead-c.txt`, 3 times, with the
  verbatim lead (c) text from `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md`. Read
  `classification.organization_name` and `classification.venue_name`. Expected: `organization_name: null` on 3 of 3
  (the guard fires whenever venue_name is the hotel; with the prompt line the model may return null itself).
  Also re-run lead (a) once: `organization_name` stays "Example Arts Foundation" (positive control).
- **Prerequisites:** ALREADY HAVE: Node, `npx tsx`, the Anthropic key in `.env` (read only), network. Nothing to
  obtain. The CLI overwrites the clipboard.
- **Who / Trigger:** Claude Code, after steps 1–2 are committed and green, before the Codex code review.

## Codex review

Plan review round 1, then code review round 1, each run twice (Alex + Claude Code), recorded in `docs/reviews/`.
Stops pre-registered: a 2nd NO-GO on the same change stops automatic iteration; round 3 needs Alex's explicit YES.

## Feed-Forward

- **Hardest decision:** how wide "match" is. Equality misses "…Hotel" vs "…Hotel La Jolla"; plain substring drops
  "Parkview Foundation" for "the Park". Whole-word containment sits between them, and its false drops cost only a
  hold.
- **Rejected alternatives:** checking the name against the lead text (the app has no reliable way to know which
  phrase is the organization); a second LLM call to verify the name (cost and a new judge, outside a fix); dropping
  `organization_name` and always using `[organization]` (undoes the 2026-10-09 fix that made 2 of 2 drafts exact).
- **Least confident:** whether the classifier puts the venue in `organization_name` while ALSO leaving
  `venue_name` empty or different. Then the guard cannot fire, and only the prompt line helps.

## Three Questions

1. **Hardest decision in this session?** The match rule (above).
2. **What did you reject, and why?** A verifier model call and lead-text matching: both are new subsystems for a
   field whose wrong values are always held for Alex anyway.
3. **Least confident about going into the next phase?** The venue-empty case (above) and every non-venue wrong
   name, which no deterministic check can catch.
