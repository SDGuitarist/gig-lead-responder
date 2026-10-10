---
title: "A classifier field that copies another field: guard it at every entry, and stop at what a check can know"
category: logic-errors
tags: [classifier, organization-name, venue, name-matching, unicode-folding, stored-classification, edit-path, np2, in-kind, fail-closed]
module: src/pipeline/classify.ts, src/run-pipeline.ts, src/prompts/classify.ts
symptom: "A nonprofit lead that named no organization ('Our foundation is hosting a donor reception at the Example Grand Hotel') came back with organization_name = 'Example Grand Hotel' on 2 of 2 real-model runs. The NP2 draft would thank the hotel for the in-kind contribution, and the [organization] hold never fired because a name was present."
root_cause: "The classifier filled an empty field with the nearest proper noun in the lead: the venue. Nothing compared organization_name with venue_name, and the SMS edit path reused stored classifications without re-running validation, so any guard placed only in validateClassification would have missed edits."
date: 2026-10-10
model: claude-opus-5-5
predecessor: architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md
related:
  - docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md
  - docs/reviews/2026-10-09-price-block-local-runs.md
  - docs/reviews/2026-10-09-org-venue-plan-codex-round1.md
  - docs/reviews/2026-10-09-org-venue-plan-codex-round2.md
  - docs/reviews/2026-10-09-org-venue-local-runs.md
  - docs/reviews/2026-10-09-org-venue-codex-round1.md
---

# A classifier field that copies another field: guard it at every entry

## Prior Phase Risk

> "The venue-empty case (above) and every non-venue wrong name, which no deterministic check can catch."
> (plan, Three Questions 3)

Accepted, not closed. The real-model runs never produced an empty `venue_name` (3 of 3 named the hotel), and a
wrong name that is not the venue stays outside every check. Alex's review of every nonprofit draft remains the
only defence there. There was no fix-batch phase (the code review had no findings), so this is the nearest prior
"least confident" answer.

## Problem

The price-block work made the NP2 in-kind line exact: the app writes it, using `organization_name`. That moved
the risk from the wording to the name. On lead (c), which named no organization, the classifier returned the
venue as the organization on 2 of 2 runs. The draft would then read "...my in-kind contribution to the Example
Grand Hotel". The fallback that exists for exactly this case (`[organization]` placeholder plus the
`in_kind_org_missing` hold) never fired, because the field was not empty. It was wrong.

## Solution (3 code commits, `e0ab871` `eb56333` `bef0bf2`)

1. **Deterministic guard** in `normalizeOrganizationName(value, nonprofitBuyer, venueName)`
   (`src/pipeline/classify.ts`). When the organization and venue match, it returns `null`, which sends the draft
   into the existing hold.
   - Normalise each name to a word list: NFD and strip combining marks (é → e), lower-case, `&` → `and`,
     non-letters/digits → spaces, drop one leading `the`.
   - An empty list never matches (empty venue, whitespace, punctuation only): the organization is kept.
   - Match = identical lists, OR the shorter list (at least 2 words) appears as whole words, in order, inside
     the longer one.

   ```ts
   function namesMatch(a: unknown, b: unknown): boolean {
     const [x, y] = [nameWords(a), nameWords(b)];
     if (!x.length || !y.length) return false;
     const [short, long] = x.length <= y.length ? [x, y] : [y, x];
     if (short.length === long.length) return short.every((w, i) => w === long[i]);
     if (short.length < 2) return false;
     return long.some((_, i) => short.every((w, j) => long[i + j] === w));
   }
   ```
2. **The second entry point.** `runEditPipeline` (`src/run-pipeline.ts`) loads a stored classification and
   skips `validateClassification`, so it re-applies the same normalization at entry, next to the existing
   `venue_name` backfill. Without this line, every SMS edit of a lead classified before the fix would keep the
   venue as the organization.
3. **Prompt line (secondary):** the `organization_name` definition ends "Never the venue or the place the event
   is held."

**Verified:** 733 pass / 0 fail / 1 skip, `tsc` clean, each new test mutation-checked; real model 3 of 3 runs of
lead (c) end `null`, and the control (a lead that names "Example Arts Foundation" at the same hotel) keeps the
organization. Codex code review round 1: GO on both runs, no findings.

## Why the match rule is shaped this way

Equality alone misses "Example Grand Hotel" vs "The Example Grand Hotel La Jolla". Plain substring drops real
names: "Parkview Foundation" contains "park". Codex plan round 1 found the middle cases: "The Rock" vs "Rock the
Vote" (one shared word, different things) and "The Center" vs "Center for the Arts". Requiring at least 2 shared
words in order removes those false drops while still catching a hotel name inside a longer hotel name.

Two kinds of error remain, and both are pinned by tests so that changing them is a deliberate decision:

| Kind | Example | Cost |
|---|---|---|
| False drop (kept by design) | "Hotel del Coronado Foundation" at "Hotel del Coronado" | One hold; Alex types the name |
| Known miss (O10) | "St. Paul's Cathedral" vs "Saint Paul's Cathedral" | The venue reaches the draft; Alex's review catches it |

A false drop costs a hold. A miss costs a wrong name in a reviewed draft. Both are bounded because every
nonprofit draft is held for Alex before sending, which is why a lexical rule was enough and a verifier model was
rejected.

## What this does NOT fix

- **A different wrong name** (the event title, the planner's company, a city). No deterministic check can know
  the right organization name; the app never sees which phrase in the lead is the organization.
- **The venue missing from `venue_name`** while it sits in `organization_name`. The guard has nothing to compare
  against; only the prompt line helps. Not observed in the runs, and not measured either.
- **Which part worked.** The CLI prints only the normalized classification, so the runs cannot tell "the model
  returned null itself (prompt line)" from "the model returned the venue and the guard removed it". The local-runs
  record says so rather than claiming either.

## Prevention

- **When a model field is used to write customer-facing text, list every path that produces that field.** Here
  there were two: fresh classification and stored classification reused by edits. A guard in one is a guard in
  half. Codex plan round 1 found the second path (P2 #6); grep for every caller that reads a stored classification
  before trusting a validator.
- **An empty field that triggers a hold is safer than a filled wrong one.** The fallback only works if wrong
  values become empty. When a field has a safe empty state, prefer a check that empties it over one that tries to
  correct it.
- **Pin known misses in tests.** O10 asserts that `St.`/`Saint` is NOT matched. If someone later adds
  abbreviation folding, the test fails and the change has to be stated.
- **Run the made-up lead before review, with a positive control.** Without the control lead, "3 of 3 null" would
  also be the output of a guard that drops every organization.

## Feed-Forward

- **Hardest decision:** how wide "match" is: equality misses the longer hotel name, substring drops real
  organizations; whole-word containment with 2+ words sits between them.
- **Rejected alternatives:** a verifier model call (a new judge for a field that is always reviewed); matching
  against the lead text (the app cannot tell which phrase is the organization); dropping the field for an
  always-`[organization]` placeholder (undoes the fix that made 2 of 2 drafts exact).
- **Least confident:** the venue sitting in `organization_name` while `venue_name` is empty or worded
  differently. Not observed in 3 runs, and nothing measures it.

## Three Questions

1. **Hardest pattern to extract from the fixes?** Whether the lesson is the match rule or the second entry
   point. The rule is specific to names; the entry point applies to any field a validator cleans and an edit path
   reuses, so that is the one written as prevention.
2. **What did you consider documenting but left out, and why?** The full EARS list (O1-O10) and the plan-review
   NO-GO findings table: both live in the plan and the review record, linked above, and copying them here would
   create a second copy to drift.
3. **What might future sessions miss that this solution doesn't cover?** A new path that builds a draft from a
   stored classification. Today every reader of `organization_name` (`nonprofitPriceNote`, `inKindSentence` via
   `priceBlockFor`) is reached only from `runPipeline` (validated) or `runEditPipeline` (re-normalized at entry);
   checked by grep 2026-10-10. A third path, such as a follow-up draft or a re-run from the dashboard, must apply
   `normalizeOrganizationName` too, or it brings the venue back.
