---
title: "Codex PLAN review, round 2: COI sentence owned by the app (the nine named fixes)"
date: 2026-10-12
plan: docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md (Revision 2)
reviewed_head: cd42184
prior_verdicts: docs/reviews/2026-10-12-coi-plan-codex-round1.md (NO-GO)
---

# Round 2 (plan): NO-GO (2 P1, 2 P2). The 2nd NO-GO: automatic iteration STOPS.

One run. Round 3 only with the literal `Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the hard cap.

## Verdict text (verbatim, the pre-check and the fix prompt summarised)

**Pre-check:** repo, branch and HEAD match (`cd421840…`); worktree clean; the diff is limited to the plan and the
round 1 record; no `src/` or `scripts/` changes. The venue-history check was attempted but blocked by sandbox `tsx`
IPC `EPERM` and remains UNEXECUTED (in Codex's sandbox; it exits 0 on Alex's machine).

**Nine prior findings**

1. **R1 P1-1 — FIXED BUT INTRODUCES a stale contradiction.** R2-1 correctly defines the mode matrix (`plan:97-122`).
   However, the Plan Quality Gate still says "one manifest/status note" (`plan:197-199`), and work step 3 only
   mentions the `quoteTermsOff` gate (`plan:246-250`). Update those stale sections. Platform replies should keep the
   COI sentence. Alex's rule applies to first replies; platform payment handling is unrelated.
2. **R1 P1-2 — NOT FIXED.** R2-2 correctly specifies whitespace collapse, exact-sentence removal, both drafts, and
   both pipelines (`plan:124-140`). But a draft with zero/repeated chosen sentences can also contain other COI
   wording, producing both a missing/repeated flag and `coi_other_wording`. That contradicts "one flag per draft"
   (`plan:129-134`). Define precedence: missing/repeated should be the sole sentence-count flag, or explicitly allow
   multiple flags.
3. **R1 P1-3 — FIXED.** Optional `coi_required`, strict `=== true`, stored compatibility, sanitization and edit-path
   tests are specified (`plan:142-148`). The existing copy paths spread classifications rather than rebuild them
   field-by-field (`src/pipeline/classify-verify.ts:197-203`, `src/pipeline/enrich.ts:119-121`).
4. **R1 P1-4 — FIXED.** The boundary question is correctly observation-only and expected false (`plan:150-156`,
   `269-270`).
5. **R1 P1-5 — FIXED.** The corrected premise is accurate: fixtures use stub context and do not contain `COI`;
   runtime docs are loaded by `selectContext` (`plan:158-171`, `src/fixtures/prompt-baseline-inputs.json:1-4`,
   `src/pipeline/context.ts:29-37`). The new COI Quote Terms line, rather than the doc edits, is what changes
   baseline assertions.
6. **R1 P1-6 — FIXED BUT INTRODUCES a stale execution-path contradiction.** R2-6 adds Node/npm/tsx, model access,
   PF-Intel variables, deterministic venue lookup and redaction (`plan:173-181`). But the original Execution Path
   still lists only model access, private venue file and `jq` (`plan:253-263`). The Plan Quality Gate also still
   repeats only "model access" (`plan:208-210`). Consolidate the prerequisites.
7. **R1 P2-1 — NOT FIXED.** Exact per-draft flag names are added (`plan:229-232`), but the single-flag ambiguity from
   finding 2 remains.
8. **R1 P2-2 — FIXED.** C12 makes the classifier wording deterministic and separates model runs as observational
   (`plan:183-187, 237-239`).
9. **R1 P2-3 — FIXED BUT INTRODUCES a stale contradiction.** R2-8 correctly withdraws manifest/status changes
   (`plan:189-193`), but the Plan Quality Gate still lists one such note (`plan:197-199`).

**New defects in Revision 2**

- **P1 — Internal plan contradictions remain** (`plan:197-210, 246-250, 253-263`). Revision 2 adds corrected mode,
  prerequisite and manifest decisions but leaves the older Quality Gate, work-step and Execution Path text unchanged.
  Claude Code could follow the stale text and omit graceful-decline handling, PF-Intel prerequisites, or the "no
  manifest change" decision.
- **P1 — Post-check can emit multiple conflicting flags** (`plan:129-134`). The contract says one flag per draft but
  does not define precedence when sentence count is wrong and other COI wording is present.
- **P2 — Mutation coverage is still not mapped to C8-C12** (`plan:241-242`). The generic mutation sentence names
  several mutation types but does not assign mutations to C8, C10, C11 or C12.
- **P2 — The remaining "most likely wrong" text is stale** (`plan:205-207`). It still describes "misses 'do you carry
  insurance?'" as a likely failure, although Revision 2 defines that case as false (`plan:152-155`).

**Runtime status:** still unexecuted: the six real-model runs, the mutation checks, and the venue-history check (in
Codex's sandbox).

**Verdict: NO-GO.** The major fixes are mostly correct, but the post-check flag precedence and stale duplicated plan
text must be resolved before implementation. This is the pre-registered second NO-GO; automatic iteration stops.
Round 3 requires explicit `Round 3 authorized by Alejandro: YES`.

(Codex also attached a Claude Code fix prompt: fix the post-check precedence with a regression test and positive
control; reconcile the stale Quality Gate, work step 3, Execution Path prerequisites and "most likely wrong" text;
map named mutations to C8-C12; do not change Alex's wording or trigger; stop after the plan revision.)

## Claude Code's check (2026-10-12, read-only; nothing edited after the verdict)

All four P1/P2 items on Revision 2 are **REAL, and all four are mine**: Revision 2 was written as an additive
section, and the older text it supersedes was left in place. Confirmed by reading `plan:195-265`:

| Finding | Confirmed | Note |
|---|---|---|
| Stale Quality Gate / work step 3 / Execution Path / "most likely wrong" | yes, each as quoted | pure text; the R2 sections are the intended truth |
| Mutations not mapped to C8-C12 | yes | one generic sentence |
| One flag per draft vs two possible flags | yes | the contract is ambiguous |

On the one logic item (the precedence), the repo already has the answer: `paymentViolations`
(`src/pipeline/payment-terms.ts`, case `sentence`) returns the single count flag and only inspects other wording
when the sentence occurs exactly once. The COI contract should do the same: **a wrong count returns the one
missing/repeated flag and stops; `coi_other_wording` is evaluated only when the count is exactly 1.**

## Per the pre-registered budget

Automatic iteration stops. No round 3 prompt was written. The options and a recommendation are in HANDOFF.
