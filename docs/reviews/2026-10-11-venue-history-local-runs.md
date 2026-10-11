# Venue history, real-model runs (plan Execution Path), 2026-10-11

**Reader and trigger:** the Codex CODE review round-1 prompt for this work (cites this file), and
`docs/END-TO-END-STATUS.md`. **Code under test:** baseline u0 at `111f47b` (loader only, not wired); d1-u2 at
`bc267e0` (steps 1-4 built). **Data:** Alex's real `~/Data/gig-lead-responder/venue-history.json` (8 venues, 3 with
his confirmed sentences). **Command:** the plan's `run()` (scratch `DATABASE_PATH`, `src/index.ts --json`). Nothing
sent; `data/leads.db` untouched (Oct 3 09:20 before and after). The CLI copies each draft to the clipboard.
**This record never quotes Alex's sentences** (public repo); "verbatim" and "paraphrase" describe them.

| Run | Lead | `venue_name` | Credibility line (full / compressed) | Invented detail beyond his sentence |
|---|---|---|---|---|
| u0 (baseline, before wiring) | unknown venue | Example Grand Hotel | none / none | none |
| d1 | Hotel del Coronado | Hotel del Coronado | paraphrase / paraphrase | **yes:** "I know how the outdoor acoustic character of that lawn works"; "June 2027 fills earlier than you'd expect for a Saturday at the Del" |
| d2 | Hotel del Coronado | Hotel del Coronado | verbatim / shortened | none |
| k1 | Coasterra | Coasterra | verbatim / shortened | none |
| u1 | unknown venue | Example Grand Hotel | none / none | none |
| u2 | unknown venue | Example Grand Hotel | none / none | none |

**Result:**
- **True claims reach the draft: 3 of 3** matched runs (d1, d2, k1).
- **No false claim for an unknown venue: 3 of 3** (u0 before the change, u1 and u2 after). The baseline answers the
  plan's "least confident" question for this lead: the model did not invent experience at an unknown venue, with or
  without the change. One lead text only.
- **"Add nothing" held in 2 of 3** matched runs. d1 added two details Alex never wrote (above). Both are plausible,
  not false on their face, but neither is his. Every draft is reviewed by Alex today (auto-send off), so this reaches
  him, not a client. A deterministic check for added detail would be a claim detector in prose, rejected in the plan.
- `venue_name` was the canonical name in every run, so the k1 "Coasterra San Diego" miss case did not occur.

**Side observations (pre-existing, not this work):** every draft shows the em-dash fixer's " , " spacing defect
(already in HANDOFF). `docs/RESPONSE_CRAFT.md` (always loaded) has carried the opening clause of the Lodge sentence
as a voice example since 2026-02-20 (found by `scripts/check-venue-history.ts`); it did not surface in any draft here.
