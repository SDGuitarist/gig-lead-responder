# Codex CODE review, round 2: PF-Intel facts are not Alex's experience

**Code:** `feat/hub-phase0` at `1151400` (fix range `0abc484..1151400`; fix commit `15f521e`). **Prior Codex verdicts:**
round 1 run A GO, run B NO-GO P2 (`docs/reviews/2026-10-11-pf-intel-codex-round1.md`). **Reader and trigger:** the
compound solution doc; HANDOFF.

**Verdict: run A NO-GO (P2), run B GO. The stricter verdict is run A: the 2nd NO-GO, automatic iteration stopped.**
Both runs: the three voice-guide lines are fixed; F7 and its positive controls hold.

| # | Runs | Finding | Disposition |
|---|---|---|---|
| 1 | A P2 | `src/data/voice-references.ts:56` (the active Starikov reference, always in the generate prompt) says "I've played private events in La Jolla for years, including The Lodge at Torrey Pines, Estancia La Jolla, Village courtyards" | **SETTLED BY ALEX (2026-10-11), no code change.** It is Alex's real sent reply and its venues are true. Alex confirmed he has played Estancia La Jolla; it is now in the private venue file as a fact only (`~/Data` `4bc6b09`). Alex chose to keep the example as is (same decision as the Lodge lines), accepting that a draft may borrow it; every lead is reviewed before sending |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `1151400`)

```
NO-GO — P2 finding.

P2 — another always-loaded prompt example models unconfirmed venue experience

- `src/data/voice-references.ts:56`
- `src/prompts/generate.ts:203-210`
- Concrete input: a lead for `Estancia La Jolla`, a PF-Intel-only venue with no confirmed venue-history match.
- `buildGeneratePrompt(...)` always includes the active Starikov voice reference:

  `I've played private events in La Jolla for years, including ... Estancia La Jolla ...`

This remains a direct experience claim about the lead’s venue. F7 passes its three named mutations and both positive controls, but its inventory is incomplete: it checks only the repaired `LEAD_RESPONSE_VOICE.md` lines, not active `VOICE_REFERENCES`.

Focused test: 5 passed. TypeScript: clean. The alternate `tsx` runner hit the known sandbox `EPERM`; no network, model, PF-Intel, server, poller, or database was used. Worktree remains clean at the expected HEAD.

This is the second NO-GO, so automatic iteration stops. Round 3 requires Alejandro’s explicit authorization.

```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `1151400`)

```
GO — Round 2 closes the Round 1 finding.

Findings: none (no P1/P2/P3).

- All three previously unsafe voice-guide lines are replaced at `docs/LEAD_RESPONSE_VOICE.md:12,137,141`.
- F7 passes for PF-Intel-only and confirmed venue-history inputs.
- F7's positive controls prove vendor-policy and confirmed-claim paths remain present.
- Lodge examples remain intentionally unchanged.
- No other always-loaded text models experience at the unconfirmed lead venue.
- TypeScript passes.
- Relevant tests pass; broad run was 131/132, with the sole failure the known sandbox `listen EPERM` in `src/payment-terms-approve.test.ts`.
- Worktree remains clean at HEAD `115140090f298d04b6c6e732d65fe25b3b61391c`.

The OS process check was unavailable due environment permissions, so session liveness could not be independently confirmed.
```

**Alex, 2026-10-11: no round 3; code review closed** (the only finding is settled by his decision; nothing left to fix in code). Next: compound.
