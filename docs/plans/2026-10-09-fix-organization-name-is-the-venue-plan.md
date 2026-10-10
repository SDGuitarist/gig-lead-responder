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

## Revision 1 (after Codex PLAN round 1 = NO-GO on both runs)

Record: `docs/reviews/2026-10-09-org-venue-plan-codex-round1.md`. Seven findings accepted: empty venues never match;
accents and `&`/`and` are folded; one-word containment no longer drops ("The Rock" vs "Rock the Vote"); `St.` vs
`Saint` is a documented, pinned miss; O6 goes through `classifyLead`; the SMS edit path applies the same guard; the
Execution Path is concrete with a three-way reading.

## Decision (Claude Code proposal; Alex chose "fix org = venue" next, 2026-10-09)

1. **Deterministic guard (the fix).** `normalizeOrganizationName(value, nonprofitBuyer, venueName)` in
   `src/pipeline/classify.ts` returns `null` when the organization and the venue **match**:
   - **Normalise** each name: Unicode NFD and remove combining marks (é → e, ã → a); lower-case; `&` → ` and `;
     every non-letter/non-digit → space; collapse spaces; drop ONE leading word `the`. Result: a word list.
   - **Never comparable:** an empty word list on either side (`""`, `"   "`, `null`, `undefined`, punctuation only)
     → no match, the organization is kept.
   - **Match** = the two word lists are identical (any length), OR the shorter list appears as a contiguous run of
     whole words inside the longer one AND the shorter list has **at least 2 words**.
   With `null`, the existing path holds the draft (`[organization]`, `in_kind_org_missing`; unchanged code).
2. **The SMS edit path.** `runEditPipeline` (`src/run-pipeline.ts`) reuses a stored classification and never
   re-runs `validateClassification`. At its entry, next to the existing `venue_name` backfill, it sets
   `classification.organization_name = normalizeOrganizationName(classification.organization_name,
   classification.nonprofit_buyer === true, classification.venue_name)`.
3. **Prompt line (secondary).** The `organization_name` definition in `src/prompts/classify.ts` gains: "Never the
   venue or the place the event is held."

**Accepted false drops (bounded):** a real organization whose name contains the venue's name of 2+ words, or equals
it ("Hotel del Coronado Foundation" at "Hotel del Coronado"). Cost: one hold for Alex to type the name.
**Accepted misses (pinned by tests, so a change is deliberate):** `St.` vs `Saint`, and other abbreviations or
synonyms ("Hotel" vs "Resort"); a venue the classifier left empty or worded differently. In those cases the wrong
name still reaches the draft, and Alex's review is the only check.

## Plan Quality Gate

### 1. What exactly is changing?

| # | File | Change |
|---|---|---|
| A | `src/pipeline/classify.ts` | `normalizeOrganizationName` gains the `venueName` argument and the guard (rule above), via two small helpers: `nameWords(s): string[]` and `namesMatch(a, b): boolean`. The call in `validateClassification` passes `obj.venue_name`. |
| B | `src/run-pipeline.ts` | `runEditPipeline` applies the same normalization at entry (decision 2). One line plus the import. |
| C | `src/prompts/classify.ts` | One sentence added to the `organization_name` definition. |
| D | `src/port-manifest-np2.test.ts` | New tests (below); the existing organization-name tests stay green unchanged. |

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

- **O1** WHEN a nonprofit classification has organization "Example Grand Hotel" and venue "Example Grand Hotel" THE
  SYSTEM SHALL return `organization_name: null`. *Mutation:* drop the venue check; O1 fails.
- **O2** WHEN the names differ only by case, a leading "the", punctuation, accents or `&`/`and` ("The Example Grand
  Hotel" vs "example grand hotel."; "Café São Paulo" vs "Cafe Sao Paulo"; "Arts & Culture Center" vs "Arts and
  Culture Center") THE SYSTEM SHALL return null. *Mutation:* remove the accent fold; the Café case fails.
- **O3** WHEN one name contains the other as 2+ whole words ("Example Grand Hotel" vs "Example Grand Hotel La Jolla",
  both directions) THE SYSTEM SHALL return null.
- **O4 (overshoot controls)** WHEN venue/organization are "the Park"/"Parkview Foundation", "The Grand"/"Grand Avenue
  Foundation", "The Rock"/"Rock the Vote", "The Center"/"Center for Community Arts" THE SYSTEM SHALL keep the
  organization. *Mutation:* allow 1-word containment; three cases fail. *Mutation 2:* plain substring; "Parkview"
  fails.
- **O4b** WHEN both names are the same single word ("Example" / "The Example") THE SYSTEM SHALL return null
  (identical lists match at any length).
- **O5** WHEN the organization differs from the venue ("Example Arts Foundation" at "Example Grand Hotel") THE SYSTEM
  SHALL keep it unchanged.
- **O5b** WHEN `venue_name` is null, undefined, `""`, `"   "` or `"..."` THE SYSTEM SHALL keep the organization.
  *Mutation:* let an empty list match; O5b fails.
- **O6 (through the real call site)** WHEN `classifyLead` runs with a stubbed model returning a nonprofit NP2
  classification whose organization equals its venue THE SYSTEM SHALL return `organization_name === null`, and the
  priced in-kind sentence built from that result SHALL end "to [organization]." and `nonprofitPriceNote` SHALL say
  the lead names no organization. *Mutation:* pass `undefined` as venueName in `validateClassification`; O6 fails.
- **O7** WHEN the classify prompt is built THE SYSTEM SHALL say the organization is never the venue.
- **O8** WHEN a NON-nonprofit classification has organization = venue THE SYSTEM SHALL return null (existing rule,
  unchanged).
- **O9 (edit path)** WHEN `runEditPipeline` (stubbed model) receives a stored nonprofit classification with
  organization = venue THE SYSTEM SHALL draft with `[organization]` and report `in_kind_org_missing`. *Mutation:*
  remove the entry normalization; O9 fails.
- **O10 (known miss, pinned)** WHEN the names are "St. Mary's Hotel" and "Saint Marys Hotel" THE SYSTEM SHALL KEEP the
  organization (documented miss). A future change that closes it updates this test on purpose.

Verification: `npm test` (0 fail), `npx tsc --noEmit`,
`git diff 8e4fcdf..HEAD --stat -- src/pipeline/price.ts src/pipeline/post-check.ts src/pipeline/price-block.ts src/prompts/generate.ts public/` (empty).

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. Guard + helpers + O1–O6, O8, O10 (A, D). ~90 lines.
2. Edit-path normalization + O9 (B). ~40 lines.
3. Prompt line + O7 (C). ~15 lines.
4. Real-model run (Execution Path), recorded in `docs/reviews/2026-10-09-org-venue-local-runs.md` (or the run's date).
5. Update `docs/END-TO-END-STATUS.md` (risk row) and HANDOFF in the same commit as step 4.

## Execution Path

- **Target:** this Mac, the local CLI. Nothing sent; no server or poller; `data/leads.db` never opened.
- **Lead (c), verbatim** (same text as the price-block runs; save as `$T/lead-c.txt`): "Our foundation is hosting a
  donor reception at the Example Grand Hotel in La Jolla and we'd like a solo guitarist for one hour. We've been
  supporting the arts for over 15 years. About 100 guests. Event date: 2026-12-03."
- **Lead (a), positive control** (save as `$T/lead-a.txt`): "Hi! I'm planning a donor appreciation reception for
  the Example Arts Foundation, a 20-year-old arts foundation that funds youth music programs. It's on a Thursday
  evening in the ballroom at the Example Grand Hotel in La Jolla, about 120 guests. We'd love one hour of solo
  guitar during cocktails. Event date: 2026-12-10."
- **Mechanism:** `T="$(mktemp -d)"`, write both files, then for lead (c) three times and lead (a) once:
  `DATABASE_PATH="$T/runs.db" npx tsx src/index.ts --json < "$T/lead-c.txt" | sed -n '/^{/,$p' | jq '.classification | {organization_name, venue_name}'`
  (the CLI prints one log line before the JSON; `sed` drops it).
- **Reading each lead (c) run (three-way):** (i) `organization_name` null from the model itself (the prompt line
  worked); (ii) the model returned the venue AND `venue_name` matches: the guard fired, result null; (iii) result is
  the venue while `venue_name` is null or different: the KNOWN LIMITATION occurred, record it. Pass = 3 of 3 runs
  end null (i or ii). Any (iii) is recorded and shown to Alex, not tuned around.
- **Lead (a) expected:** `organization_name` "Example Arts Foundation", `venue_name` "Example Grand Hotel".
- **Prerequisites:** ALREADY HAVE: Node, `npx tsx`, `jq`, the Anthropic key in `.env` (read only), network. Nothing
  to obtain. The CLI overwrites the clipboard.
- **Who / Trigger:** Claude Code, after steps 1–3 are committed and green, before the Codex code review.

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
