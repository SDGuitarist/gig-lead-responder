# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None — **no brainstorm** (skip gate: a measured defect with exact files). Input: once PF-Intel was
reachable (local `.env` fixed 2026-10-11 with Alex's yes), 2 of 3 made-up leads at venues not in Alex's venue file
claimed familiarity. The venue-history plan had named the cause as its likeliest failure the same morning.

**Plan mitigation:** `docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md` (Revisions 1-3). D1:
fixed usage text inside the PF-Intel section (public facts, never Alex's experience; Revision 3, Alex: describe the
venue only with these facts and the client's words). D2: never render past events or contacts. D3: no prose detector
while every lead is held. Pre-registered real-model runs (F5: 12 runs, 24 drafts; borderline = fail). Plan R1-R2 NO-GO
(both runs), all fixed; Alex skipped R3.

**Work risk (from Feed-Forward):** setup notes read as first-person experience. Measured: F5 round 1 3 claims + 3
borderline (general-knowledge venue details) → Revision 3 → round 2 0 claims + 1 borderline; Alex accepted. Estancia
judgments later corrected (Alex has played it; added to the venue file as a fact only).

**Review resolution:** code R1 A GO / B NO-GO (P2: the always-loaded voice guide modeled "I have played this room") →
three lines reworded with Alex's words + F7 (`15f521e`). R2 A NO-GO (P2: the Starikov example names Estancia) / B GO →
settled by Alex (true venue; example kept). Alex closed review (no R3).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/format-venue-context.ts` | `PF_INTEL_USAGE` inside the section; past events and contacts never rendered | the only renderer of PF-Intel data; any new field can reintroduce a claim source |
| `src/pipeline/context.ts` | pushes the formatter's string unchanged | the old appended line must not come back |
| `docs/LEAD_RESPONSE_VOICE.md` | :12, :137, :141 reworded (Alex's words) | always loaded; any example that grants a venue claim leaks to every lead |
| `src/data/voice-references.ts` | unchanged on purpose (Lodge, Starikov kept) | borrowed claims at other venues |
| `src/pf-intel-context.test.ts` | F1-F4, F7 | the pins and section bounds |
| `.env` (local, not in git) | production PF-Intel URL + key | key rotation in Railway breaks lookups silently again |

## Plan Reference

`docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md`
