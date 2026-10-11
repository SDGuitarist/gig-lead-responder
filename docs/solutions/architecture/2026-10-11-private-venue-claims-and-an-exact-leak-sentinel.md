---
title: "Private claims in a public repo: keep them in a private file, and make the leak check's exemptions exact"
category: architecture
tags: [venue-history, private-data, public-repo, leak-sentinel, exemptions, fingerprints, test-override, matcher, false-claim, codex-review]
module: src/venue-history.ts, src/pipeline/context.ts, scripts/check-venue-history.ts, scripts/venue-leak-scan.ts
symptom: "Drafts could not say Alex had played a venue (9 port-manifest rows), but his venue sentences could not go in the public repo. The first leak check exempted every piece of a venue's sentence in 4 files and stopped at the first match per file; the fix for that added a test setting that could switch the check off on the real repo, and 'known' still meant anything in an old file version."
root_cause: "Each exemption was wider than the fact it rested on: 'part of this sentence was public in this file' became 'this sentence may appear in this file', then 'anything this file held at that commit'. The test setting was configuration that the real gate also obeyed."
date: 2026-10-11
model: claude-opus-5-5
predecessor: logic-errors/2026-10-10-organization-name-is-never-the-venue.md
related:
  - docs/plans/2026-10-11-feat-venue-history-private-file-plan.md
  - docs/reviews/2026-10-11-venues-plan-codex-round1.md
  - docs/reviews/2026-10-11-venues-plan-codex-round2.md
  - docs/reviews/2026-10-11-venues-plan-codex-round3.md
  - docs/reviews/2026-10-11-venue-history-local-runs.md
  - docs/reviews/2026-10-11-venues-codex-round1.md
  - docs/reviews/2026-10-11-venues-codex-round2.md
  - docs/reviews/2026-10-11-venues-codex-round3.md
---

# Private claims in a public repo: a private file, a one-way matcher, and an exact leak check

## Prior Phase Risk

> "The baseline: if the model already claims experience at unknown venues, this plan adds true claims but does not
> stop false ones." (plan, Three Questions 3)

Measured, not closed. The baseline run (u0, before wiring) and 7 later runs on unknown, near-miss and no-venue leads
produced 0 false venue claims (`docs/reviews/2026-10-11-venue-history-local-runs.md`). Alex then noticed that the
always-loaded drafting guide and voice examples model "I've performed at..." lines; the 6 borrowed-claim runs were the
test of that, also 0. Eight runs bound the risk; they do not remove it. There was no fix-batch phase (fixes were made
inside the Codex loop), so this is the nearest prior "least confident" answer.

## Problem

Nine port-manifest rows (R081-R089, R405) say which venues Alex has played. A draft that can say "I've performed at
the Del" is stronger; a draft that says it about a venue he has not played is a false statement to a client. Two
constraints shaped everything: the repo is public, so his own sentences cannot be committed; and a false match is
worse than a miss.

## Solution

**The data (private).** `~/Data/gig-lead-responder/venue-history.json`, outside the repo. Each entry: `name`,
optional `aliases`, optional `claim` (Alex's own sentence) with a `confirmed` date. A claim without a real calendar
date is dropped (blank and half-finished sentences never reach a draft); the date is only a label, and the gate is
Alex's yes on the exact words in chat (project `CLAUDE.md` rule).

**The matcher (one direction).** `findVenueHistory` in `src/venue-history.ts`: the lead's venue equals the name or an
alias, or the entry's canonical name (2+ words) sits inside the lead's venue as whole words. Never the reverse, and
aliases never use containment: "Rancho Santa Fe" does not claim the Rancho Santa Fe Inn, "Del Coronado Yacht Club" does
not claim the Del. Lomas Santa Fe was added as "Lomas Santa Fe Country Club" with alias "Lomas Santa Fe" so the
Executive Golf Course does not match.

**Placement.** `selectContext` adds the "ALEX HAS PERFORMED HERE" section, so both `runPipeline` and
`runEditPipeline` get it (the FC45 lesson: one entry point covers every path). The section allows the claim, quotes
the sentence for "use as written or shorten; add nothing", and forbids invented rooms, counts and dates.

**The leak check (`scripts/check-venue-history.ts`, run by hand; CI has no private file).** Exit 0 PASS, 1 FAIL,
2 cannot check. It prints every sentence that reaches drafts, checks known must-hit / must-miss venues, and scans
every tracked file for any 30-character window of any sentence (whitespace collapsed). The scan lives in
`scripts/venue-leak-scan.ts` as a pure function so tests run it on made-up text.

## The exemption took three rounds to get exact

Parts of two sentences were public long before this work: Alex's voice examples carried them since February. The
check had to accept those and still catch everything else.

| Version | "Known" meant | Hole (Codex) |
|---|---|---|
| `bc267e0` | this venue's sentence in this file | any later piece of the sentence passed; the per-file `break` let a known match hide a real leak after it (R1) |
| `233eb1e` | any window the file held at its first-public commit | the env override for test repos also worked on the real repo (point it at `HEAD`); unrelated text in the old file was exempt too (R2) |
| `dca2aab` | one of 67 fixed fingerprints: SHA-256 of `file\nwindow`, first 16 hex | none (R3 GO, both runs) |

The `break` was not hypothetical: removing it surfaced a second already-public match (part of the Del sentence in
`RESPONSE_CRAFT.md`) that the first version had never reported.

Fingerprints solve two problems at once: the list is exact (one window, one file), and the public script can carry it
without quoting the sentence (which would also make the script flag itself). A run against any other repo
(`CHECK_REPO_ROOT`) applies no exemptions and says its PASS is for the control repo only; the script finds its own
repo from its location, not the working directory.

## What this does NOT fix

- **Paraphrases and copies under 30 characters** pass the check. The gate for them is reading every staged diff
  before a commit; the check is a bounded backstop.
- **Added detail.** "Add nothing" held in 2 of 3 matched runs (d1), and b5 added "I know how the room carries sound".
  True claim, invented detail. Recorded, not fixed: detecting a claim in prose is the problem the price-block work
  retired.
- **Borrowed claims** from the voice examples: 0 in 8 runs, one run per lead. A bound, not a guarantee.
- **Same name in another city** matches by containment (accepted: leads are San Diego area).

## Prevention

1. **An exemption is as wide as its key.** Write down the fact that justifies it ("these exact words were public
   then"), then key the exemption on exactly that. "File + venue" and "file + commit" were each wider than the fact.
2. **A safety check never stops at its first match.** A known or benign hit must not end the scan of that input.
3. **A test-only setting on a safety gate is a way to turn the gate off.** Prefer removing it (test the pure function
   instead) over guarding it; if a control mode is needed, it must apply no exemptions and say so in its PASS line.
4. **To list private text in public code, list fingerprints.** Bind each to its file so the same words elsewhere
   still fail.
5. **Prove the check on real data without writing the data down.** The 39/39 in-memory overshoot (unapproved real
   windows appended to a real file, scanned, never saved) was the only test of the real fingerprint list.

## Feed-Forward

- **Hardest decision:** fingerprints versus deleting the exemption. Deleting it would fail on text public since
  February; editing Alex's voice examples to remove it is his call, not a check's.
- **Rejected alternatives:** a guard on the env override (more logic to get wrong than removing it); quoting the
  public windows in the script (the script would flag itself, and the next edit could quote a private window);
  a prose claim detector for added detail (rejected in the plan).
- **Least confident:** the fingerprint list goes stale silently. If Alex edits the Lodge or Del sentence, old
  fingerprints just stop matching (safe); if a voice example is edited to carry more of a sentence, the check fails
  and someone must decide whether the new words are public. That decision has no owner except this doc.

## Three Questions

1. **Hardest pattern to extract from the fixes?** Whether three rounds on one exemption were three bugs or one. One:
   each version keyed the exemption on something easier to name than the fact behind it.
2. **What did you consider documenting but left out, and why?** The EARS list (V1-V15) and the plan-review findings:
   they live in the plan and the review records linked above; a copy here would drift.
3. **What might future sessions miss that this solution doesn't cover?** A new venue sentence that shares 30+
   characters with existing public text fails the check on its first run. That is correct, and the fix is not to add
   a fingerprint: show Alex, and only fingerprint words that were already public before his sentence existed.
