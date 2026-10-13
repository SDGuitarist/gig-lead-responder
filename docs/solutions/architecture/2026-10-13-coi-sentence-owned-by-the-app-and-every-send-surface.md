---
title: "COI: the app writes the exact sentence and checks it on every path a stored draft can be sent"
category: architecture
tags: [coi, post-check, approval-path, send-surface, prompt, payment-pattern, plan-review, codex-review]
module: src/pipeline/coi.ts, src/api.ts, src/pipeline/post-check.ts, src/prompts/generate.ts, src/pipeline/classify.ts
symptom: "The model improvised a COI timeline in drafts ('a day', 'within 24 hours', 'within a few days') that drifted run to run, and one COI promise was not Alex's rule."
root_cause: "No code owned the COI sentence: five injected docs and the T4 example each taught the model their own wording, and no check confirmed what a draft said."
date: 2026-10-13
model: claude-sonnet-5-5
predecessor: architecture/2026-10-12-t4-reference-lead-example-structure-not-copy.md
related:
  - docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md
  - docs/reviews/2026-10-12-coi-plan-codex-round1.md
  - docs/reviews/2026-10-12-coi-plan-codex-round2.md
  - docs/reviews/2026-10-12-coi-plan-codex-round3.md
  - docs/reviews/2026-10-12-coi-local-runs.md
  - docs/reviews/2026-10-13-coi-code-codex-round1.md
  - docs/reviews/2026-10-13-coi-code-codex-round2.md
  - docs/solutions/architecture/2026-10-11-payment-terms-by-lead-time-and-send-time-swap.md
---

# COI: the app owns the sentence and checks it everywhere a draft can leave

## Prior Phase Risk

> "the `coi_required` classification on indirect phrasings ('do you carry insurance?', 'the venue is strict about
> vendors'). The six runs sample it; they do not settle it." (plan Feed-Forward, least confident)

Accepted, not closed. The trigger was written down as Alex's words, the boundary question was made observation-only
and expected false, and the classifier's definition is pinned as literal prompt lines. Five real-model runs behaved as
set (true for "needs a certificate", "venue needs proof"; false for the capability question and for no mention), at
one run per lead. Indirect phrasings beyond those were not sampled.

## Problem

Alex's rule (2026-10-12): the first reply always says COI is available upon request; a timeline sentence only when
the client says they require a COI. Nothing in the code enforced it. The model wrote its own COI promise from five
injected doc lines and the approved T4 example, and the wording drifted. A prompt instruction had not held it still
across four T4 smoke sets.

## Solution (what ships)

| Piece | What it does |
|---|---|
| `coi_required?: boolean` on `Classification` | only a real `true` counts; absent is false; defined in the classify prompt (requires/needs/asks for a COI or proof of insurance; a question whether Alex carries insurance is false) |
| `src/pipeline/coi.ts` | `coiTermsFor` picks `{kind:"none"}` or the exact sentence; `coiLine` writes the Quote Terms line; `coiViolations` checks one draft |
| Mode matrix | none for clarification, `no_viable_scope`, residency (`quoteTermsOff`) and graceful decline; a sentence for every other quoted reply, including platform leads and past dates |
| Post-check contract | whitespace-collapse; a wrong count returns the one `coi_sentence_missing_*` / `coi_sentence_repeated_*` flag and stops; other COI wording is scanned only at count 1, after the exact sentence is removed |
| Prompt | the Quote Terms block carries the line and "do not restate a venue's COI policy"; `buildGeneratePrompt` calls `coiTermsFor` itself, so the prompt and the check cannot disagree |
| Both pipelines | `runPipeline` and `runEditPipeline` pass `coiTerms` to `postCheckDrafts` |
| **Approve route** | `POST /api/leads/:id/approve` refuses (409 `coi_sentence_unverifiable`) a stored draft that violates the contract, before the claim and before anything is saved |
| Docs and T4 | four injected doc lines stop teaching a timeline; T4 step 6 drops the COI; the approved example's sentence is the default one |

Evidence: 902 pass / 0 fail / 1 skip; about 40 mutations (one doc revert survives: that file is not injected) each fail a named test; 5 of 5 quoted real-model leads held the
sentence once per draft with no other COI wording.

## How it got there (what each step taught)

1. **Reuse the payment pattern, including its precedence.** The app writes a fixed sentence and the post-check
   confirms the exact text. The one ambiguity the plan had ("one flag per draft" against two conditions) was settled
   by copying `paymentViolations`: a wrong count returns that flag and stops.
2. **"A flag, not a rewrite" hid that a flag FAILS the draft.** Every `postCheckDrafts` violation sets `gate_status`
   fail and `verified` false (`run-pipeline.ts`), which holds auto-send. A heads-up found it; the plan said "flag"
   for four sections. A draft that restates a venue's own COI policy therefore fails: Alex decided that, and the
   prompt tells the model not to restate it.
3. **Verify a reviewer's premise before building on it.** Plan review claimed the injected docs sit in the baseline
   fixtures and would break them. The fixtures use a 28-character stub context with no "COI"; the docs are read at
   run time. The part that was real: the new Quote Terms line changes two baseline-equality tests.
4. **Check what is injected before editing "injected docs".** `DRAFT_METHOD.md` is named only by manifest tests and is
   injected nowhere; its edit was documentation. Four docs were injected.
5. **Revising by appending breeds contradictions.** Revision 2 added sections and left the older text in place;
   round 2 found four stale statements, round 3 two more. Revision 3 rewrote D1-D4 and the gate items in place.
6. **"Wired in both pipelines" is not "checked wherever a draft leaves".** Code review found the dashboard approve
   route sent a stored draft with no check at all. The approve route refreshes payment at send time and ignores
   `gate_passed`; auto-send is held by `routeLead`; edit nulls the compressed draft. The inventory of send paths is
   the deliverable, not the one fix.
7. **A new mandatory line costs fixtures.** Mock drafts in `confidence.test.ts` and `run-pipeline.test.ts` and the
   payment approval helper needed the default sentence; the P8 and T4 baseline tests now expect the payment line plus
   the COI line.
8. **The real run found something the plan did not ask about.** A vague lead raised "Clarification mode must not
   include pricing language" 17 of 18 times (the word "quote"), reproduced on pre-COI code in a temp worktree and
   given its own item and plan.

## What this does NOT fix

- **The model may still write other COI wording.** The post-check fails it; it does not rewrite. A draft that
  restates a venue policy was not seen in the one run at a COI-policy venue, so the fail path is untested with a real
  model.
- **A real send is unexecuted.** The alert channel always throws today, so the approve tests stop at the sender.
- **Stored drafts made before this branch are refused at Approve** until re-run. Nothing is deployed or pending.
- **The classifier's indirect phrasings** are sampled at one run per lead.
- **A first message that already says "we require a COI"** gets the timeline sentence (Alex's choice); there is no
  reply-stage input.

## Prevention

- **A rule the model should follow and the app can write belongs in code with a check.** Instruction wording did not
  hold a COI timeline still; an exact sentence and an exact-text check did.
- **When a pure function decides what the prompt says and what the check expects, call it from both.** It removes the
  "prompt says one thing, check expects another" class and keeps 65 call sites unchanged.
- **Before saying a check "flags", read what a flag does downstream.** In this app it fails the draft and holds
  auto-send.
- **Inventory every place a stored draft can be sent when a rule is "every reply".** Grep `sendSms(`,
  `completeApproval(`, `dispatchReply`, and read each caller's gate.
- **Verify a premise in the repo before accepting it from a review**, in both directions: Codex's was wrong about the
  docs and right about the approve route.
- **Rewrite superseded plan text in place.** Appended revisions cost two plan-review rounds.
- **Tests that make many requests through a rate-limited route must count the limiter** (`approveLimiter`: 10 per
  window per process); split files rather than touch the limiter.
- **Never write a heredoc with backticks unquoted.** The shell runs them as commands and silently blanks the word;
  three times this cycle. Use a quoted heredoc (`<<'EOF'`) or write the file with the editor tool.

## Feed-Forward

- **Hardest decision:** whether the approve route should hard-refuse a draft whose COI sentence is wrong. It makes
  COI the second rule enforced at send (with payment) and removes an override Alex had for every other post-check
  rule. Alex chose to refuse; the cost today is zero because nothing is deployed.
- **Rejected:** a prose detector that rewrites COI promises; PF-Intel's venue flag as the trigger; a reply-stage input
  (a flag and a dashboard control); leaving approval as is.
- **Least confident:** the fail path of a restated venue policy and the classifier's indirect phrasings, both
  sampled at one run. The first real leads at COI-policy venues are the test: read the flags.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That three separate defects were the same shape: a rule stated for
   one surface (the pipelines) and trusted for all (the approve route; "flag" read as advisory; docs "injected").
   Each fix named the surface explicitly.
2. **What did you consider documenting but left out, and why?** The clarification-validator measurement (its own
   record and plan) and the invented "run every prompt twice" correction (already in the T4 solution doc).
3. **What might future sessions miss that this solution doesn't cover?** Any new place that sends or marks a draft
   sent: the Module 1 send paths. They must apply `coiViolations` and refresh payment, or this guarantee silently
   ends at the dashboard.
