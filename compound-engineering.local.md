# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (skip gate: Alex's T4 protocol already existed as six TO PORT manifest
rows R020-R025).

**Plan mitigation:** `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md` (Revisions 1-1d). One anonymized example
reply placed before the rules; the order as seven steps; a NO INVENTED FACTS rule; a mechanical copy check (30-character
windows after cutting mandated text) run on real-model drafts; the bracketed fill-in template deliberately NOT shipped.
Plan review R1 and R2 NO-GO (R2's finding was introduced by Revision 1's own T5 wording); Alex closed review and built.

**Work risk (from Feed-Forward):** whether one example teaches structure or gets copied when the lead sits in the
example's own setting. Four real-model sets: set 1 and 2 failed (t1), t1 was replaced at Alex's decision, sets 3 and 4
had 0 copied windows in every T4 draft; the clock-time rule closed set 3's "5:15".

**Review resolution:** code R1 NO-GO (P1 gate still on in large-gap, graceful-decline and past-date modes; P2 T7
status-only; P2 T5 anonymization), all fixed. R2 run 1 GO, run 2 NO-GO (P2 T7 matched by title prefix: R020 and R025
had two matching bodies), fixed in `8536db1`. R3 NO-GO class (c): `assertsPositively` accepts a marker in a trailing
comment on an assert line; **Alex accepted the residue** and the limit is named in the test's comment. Cap fired; no
round 4.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/data/t4-reference.ts` | the T4 block: example reply, seven steps, rule lines | a rewording can reintroduce copying or an invented fact; the example still says "I can send the Del a COI." |
| `src/prompts/generate.ts` | `buildT4ReferenceSection` gate: quote-off, large gap, graceful decline, past date withhold it | a new response mode with its own mandatory shape must be added to the gate |
| `src/t4-reference.test.ts` | T1-T6, incl. the structural anonymization pin (every capitalised word) | a lowercase private name or a name inside the approved set would pass |
| `src/port-manifest.test.ts` | T7 binds R020-R025 to exact titles and a positive assertion | known limit: text scan, a marker in a comment on an assert line passes |
| `docs/reviews/2026-10-12-t4-reference-local-runs.md` | real-model runs, venue statements described not quoted | the 30-character leak check misses short fragments; never quote a venue claim |

## Plan Reference

`docs/plans/2026-10-11-feat-t4-reference-lead-plan.md`
