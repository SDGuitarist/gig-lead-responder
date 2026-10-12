---
title: "Venue facts are not experience: a silent dependency hid an instruction that told drafts to claim venues"
category: architecture
tags: [pf-intel, venue-claims, prompt-instructions, silent-failure, voice-examples, pre-registration, real-model-runs, codex-review]
module: src/pipeline/format-venue-context.ts, src/pipeline/context.ts, docs/LEAD_RESPONSE_VOICE.md, .env (local), ~/Data/gig-lead-responder/venue-history.json
symptom: "Once PF-Intel became reachable (a wrong URL and a stale key had made every lookup fail silently), 2 of 3 made-up leads at venues not in Alex's venue file claimed familiarity: 'I know the Estancia courtyard', 'Tom Ham's is a venue I know'."
root_cause: "Our own prompt told the drafter to: 'Venue intel is your insider edge ... (e.g., \"I've played this room before\")'. It had never run, because the dependency it decorated was unreachable and a failed lookup reads the same as 'no venue notes'. The always-loaded voice guide carried the same instruction in three more lines."
date: 2026-10-11
model: claude-opus-5-5
predecessor: architecture/2026-10-11-payment-terms-by-lead-time-and-send-time-swap.md
related:
  - docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md
  - docs/reviews/2026-10-11-pf-intel-plan-codex-round1.md
  - docs/reviews/2026-10-11-pf-intel-plan-codex-round2.md
  - docs/reviews/2026-10-11-pf-intel-codex-round1.md
  - docs/reviews/2026-10-11-pf-intel-codex-round2.md
  - docs/reviews/2026-10-11-venue-history-local-runs.md
  - docs/solutions/architecture/2026-10-11-private-venue-claims-and-an-exact-leak-sentinel.md
---

# Venue facts are not experience, and a silent dependency hid the instruction that said otherwise

## Prior Phase Risk

> "Setup notes. They describe a load-in, and describing a load-in in first person is a claim. F5 counts it." (plan,
> Three Questions 3)

Measured. Setup notes alone did not produce claims after the fix; the claims that remained came from the model's own
general knowledge of the venues ("Tom Ham's has both interior and harbor-view spaces"), which Revision 3 addressed.

## Problem

Every local run before 2026-10-11 reached no PF-Intel data: `.env` pointed at a Railway-internal address and held a
key production rejects (401). A failed lookup returns the same prompt as "no venue notes", so nothing looked wrong.
Fixing `.env` (Alex's yes) turned on a code path that had never run in this repo's test history, and with it an
instruction in `context.ts`: "Venue intel is your insider edge ... (e.g., \"I've played this room before\")". Drafts did
what it said. The venue-history plan had even named that line as its likeliest failure, hours earlier; the runs could
not show it because PF-Intel was unreachable.

## Solution

1. **D1, fixed text inside the section** (`PF_INTEL_USAGE` in `format-venue-context.ts`, pinned byte for byte): public
   facts, not Alex's experience; use a policy to answer a logistics concern as a fact or a plan; never say or imply
   Alex knows or has played the venue; only the venue-history section allows that; describe the venue only with these
   facts and the client's words (Revision 3, Alex). It sits before the section's closing `---`, so it cannot read as
   applying to a later section.
2. **D2, never render past events or contacts**, populated or not. "N past events" invites "I've played here N
   times"; a name invites name-dropping. Venue experience comes only from Alex's private venue file.
3. **The voice guide** (code review round 1): three always-loaded lines told the model to claim the lead's venue
   (":12 Played the rooms he is quoting", ":137 Confident about: experience at this venue", ":141 I have played this room
   enough"). Alex approved replacement words; F7 drives `buildGeneratePrompt(selectContext(...))` with positive
   controls for a vendor policy and a confirmed venue-file claim.
4. **Estancia La Jolla** (code review round 2): a real sent reply among the voice examples names it. Alex confirmed it
   is true; it went into the private venue file as a fact only, and the example stays (his call, like the Lodge lines).

### Measurement, pre-registered

Lookups, matches and 13 lead texts were committed before any run (`bfb6ec1`), and the judging rule was written by
meaning with examples, borderline = fail.

| Run | Claims | Borderline | Positive control | Gate |
|---|---|---|---|---|
| before the fix | 2 of 3 leads | | | |
| round 1 (D1 + D2) | 3 | 3 | 9 of 12 | 11 of 12 |
| round 2 (+ Revision 3) | 0 | 1 | 7 of 12 | 11 of 12 |

Alex accepted round 2 with the one borderline line recorded as a fail ("The bay-side wind at Catamaran is real"). His
heads-up that Revision 3 might flatten openings was measured too: same gate rate, same scene rewrites, 11 of 12 openings
still name the venue. Afterwards, the Estancia judgments were corrected: Estancia was true and only missing from the file.

## What this does NOT fix

- **Borrowed claims from true examples.** The Lodge lines and the Starikov reply stay in every prompt (Alex's call); a
  draft at another venue can still borrow them. Alex reviews every lead before it sends.
- **Paraphrase.** "The bay-side wind at Catamaran is real" restates a PF-Intel fact as if witnessed. No detector (D3).
- **PF-Intel text is not sanitized** like lead text (low risk: Alex's own database). Logged in END-TO-END-STATUS.
- **The venue file is incomplete.** Any true venue missing from it makes a true claim look false, as Estancia did.

## Prevention

- **A dependency that fails silently hides every instruction attached to it.** When a lookup can fail without a
  trace, fixing it is a behavior change: re-run the made-up leads that touch it, and read the prompt text that rides on
  it, before trusting earlier results.
- **Instructions that grant a claim are themselves claims.** Grep the always-loaded docs and examples for what they
  tell the model it may say, not only for what the model said.
- **Pre-register the judging before the runs.** Facts, matches and lead texts committed first; borderline = fail; a
  disagreement can only turn a pass into a fail. It turned "the drafts look fine" into a count that failed twice and
  then told us exactly what kind of line remained.
- **A "false claim" judged against an incomplete truth file may be true.** Before counting, ask whether the venue file
  could be missing the venue.

## Feed-Forward

- **Hardest decision:** D3, no detector, twice: after F5 failed and after it failed again on one line. Prompt text was
  the root cause; a detector would be the price-block loop again.
- **Rejected:** removing PF-Intel from the prompt (loses real logistics facts); labelling past events instead of
  dropping them; editing Alex's real replies without his yes.
- **Least confident:** that borrowed claims from the kept examples stay rare. Two runs of 12 is a smoke test.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That three separate findings (the context line, the voice guide, the
   Starikov reply) were one class: text the model reads that grants it a claim.
2. **What did you consider documenting but left out, and why?** The full F5 tables; they are in the local-runs record.
3. **What might future sessions miss that this solution doesn't cover?** The venue-database work: a history that lands
   only in PF-Intel never reaches a draft (past events are not rendered); it has to reach the private venue file.
