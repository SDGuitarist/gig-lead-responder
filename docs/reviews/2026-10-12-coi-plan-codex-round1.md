---
title: "Codex PLAN review, round 1: COI sentence owned by the app"
date: 2026-10-12
plan: docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md (Revision 1 reviewed; Revision 2 answers it)
reviewed_head: 60a6185
---

# Round 1 (plan): NO-GO, 6 P1 + 3 P2

One run. Alex's rule and answers were declared fixed in the prompt; no finding re-opens them.

## Verdict text (verbatim)

(Findings, in Codex's order. Line numbers are those of Revision 1 of the plan.)

**P1 — COI off-switch behavior is underspecified** (`plan:63-71, 108-114`). The plan only covers `quoteTermsOff`
(clarification, `no_viable_scope`, residency; `src/pipeline/payment-terms.ts:53-57`). It does not define behavior for
graceful declines, past dates, or large budget gaps. The T4 block has additional gates for graceful decline and past
dates (`src/prompts/generate.ts:216-221`), but Quote Terms does not. Specify a complete mode matrix and ensure
post-check receives an explicit "COI expected / disabled" value.

**P1 — Post-check exemption could falsely flag the required sentence** (`plan:68-71`). The required sentence itself
contains both `COI` and `liability insurance`. A naive scan will flag the valid sentence. The plan must require:
whitespace-normalized matching, like payment checks; removal/exemption of the chosen exact sentence before scanning;
separate full/compressed results; no COI flags when COI is disabled. This must be wired through both `runPipeline` and
`runEditPipeline` (`src/run-pipeline.ts:270-287, 340-358`).

**P1 — Stored classifications and missing-field compatibility are not fully planned** (`plan:60-62, 124-131`). Older
stored classifications lack the new field. The plan says `Classification.coi_required: boolean`, but does not specify
whether the field is optional, normalized to `false`, or backfilled. Add explicit coverage for: validator output when
the field is absent; `coiSentence()` treating absent as false; stored-classification edit runs;
`sanitizeClassification`; representative fixtures and mock classifications.

**P1 — The boundary example conflicts with Alex's fixed trigger** (`plan:145-150`). "Do you carry liability
insurance?" asks about capability; it does not explicitly say the client requires a COI. The plan currently expects
`true`, while the approved rule says the timeline sentence is used only when the client says they require one. Keep the
lead as an observation-only boundary case, or change the expected result to match the fixed trigger. Do not let the
implementation silently broaden the rule.

**P1 — Updating the five injected docs will break prompt-baseline tests** (`plan:72-76, 91-98, 115-116`). The cited
doc lines are accurate, and the COI grep found no additional hidden injected COI source beyond the five listed docs,
`src/data/t4-reference.ts`, and `src/pipeline/format-venue-context.ts:36-38`. However, those docs are part of generated
prompts. The three baseline fixtures and tests explicitly require byte identity except for the payment line
(`src/payment-terms-prompt.test.ts:18-23`, `src/t4-reference.test.ts:227-232`). The plan must include
recapturing/updating all affected fixtures and a deterministic diff procedure.

**P1 — Execution path is not concrete enough for PF-Intel lead 5** (`plan:133-155`). The plan omits PF-Intel
API/key/network prerequisites, Node/npm/`tsx` prerequisites, and the concrete method for finding a venue whose policy
is `coi_required: true`. `lookupVenueContext()` only works when `PF_INTEL_API_URL` and `PF_INTEL_SERVER_API_KEY` are
configured (`src/venue-lookup.ts:4-21`). Also, recording "which" venue in a committed review document could expose
private venue information. Record only a redacted identifier and policy boolean; never copy `coi_details` or private
claims into the repo.

**P2 — C4 and mutation tests need exact per-draft contracts** (`plan:112-122`). The plan names flags but not their
exact full/compressed suffixes or behavior when one draft passes and the other fails. Define exact violation strings
and add independent tests for: missing full; missing compressed; repeated full; repeated compressed; other wording in
each draft; valid required sentence containing `COI` and `liability insurance`.

**P2 — C6 is not fully mechanically checkable** (`plan:117-122`). Real-model classification runs are hypotheses, not
deterministic acceptance tests. Keep them as observational evidence, but add deterministic prompt/validator tests for
explicit requirement, no requirement, venue-name-only, and the boundary question. Include `npm test`,
`npm run typecheck`, and `npx tsx scripts/check-venue-history.ts` in verification commands.

**P2 — "One manifest/status note" is unspecified and may be scope creep** (`plan:91-93`). No exact manifest row or
status entry is named. Current references are generic COI documentation rows, not a clearly new COI requirement.
Specify the exact row to update, or state that no `END-TO-END-STATUS.md` or port-manifest change is required.

Reference checks: all cited source line references are current and accurate, including the five docs, T4 step 6 and
the example, and the venue-context lines. The T4 structural anonymization pins should remain stable because `COI`
remains present in the replacement sentence.

**Verdict: NO-GO for implementation.** The plan has the right overall architecture, but the off-switch matrix,
post-check contract, stored-classification compatibility, baseline-fixture update procedure, and PF-Intel/privacy
execution path must be made explicit first. No runtime findings were claimed.

## Claude Code's check of each finding (2026-10-12, before revising)

| # | Finding | Check | Result |
|---|---|---|---|
| P1-1 | off-switch matrix | `quoteTermsOff` covers three modes; the Quote Terms block (and the payment line) is emitted in graceful decline, past date and large gap today; `GRACEFUL_DECLINE_BLOCK` says "No pitch after" the exit line | **REAL.** Revision 2 R2-1: a `CoiTerms` object and a mode matrix; none also in graceful decline |
| P1-2 | exemption | the required sentence contains `COI` and `liability insurance`; both pipelines build `paymentTerms` and call `postCheckDrafts` (`run-pipeline.ts:262-270`, `339-347`) | **REAL.** R2-2: exact contract, sentence removed before the scan, both pipelines. Probe: the required sentence's `$1M/$2M` raises no existing price flag at the quoted price |
| P1-3 | stored classification | `price_asked` is optional and read as `=== true`; `sanitizeClassification` spreads `...c` | **REAL (spec gap, not a defect in the mechanism).** R2-3 |
| P1-4 | boundary lead | the plan expected `true` for a capability question; Alex's trigger is "they require" | **REAL, my error.** R2-4: expected false, observation only |
| P1-5 | docs break baselines | the three fixtures carry a 28-character stub context, no "COI" in any baseline file, the docs are read at run time by `selectContext` | **PREMISE WRONG for the doc edits; the COI Quote Terms line IS real.** Doc edits change no baseline; the new COI line changes the two baseline-equality tests. R2-5 states exactly that and the diff procedure |
| P1-6 | execution path | `.env` has `PF_INTEL_API_URL` and `PF_INTEL_SERVER_API_KEY` set (lengths 42 and 43, values not printed) | **REAL gap in the plan text; prerequisites exist.** R2-6, plus redaction |
| P2-1 | exact strings | no flag suffixes were specified | **REAL.** R2-2 and C9 |
| P2-2 | C6 | model runs are not deterministic | **REAL.** R2-7, C12 |
| P2-3 | manifest note | no COI row in the manifest or END-TO-END-STATUS | **REAL.** R2-8: no change; the note is withdrawn |

One question Revision 2 hands back to the reviewer: whether a platform reply (GigSalad, The Bash) should carry the
COI sentence (the plan says yes; it is not a payment term).
