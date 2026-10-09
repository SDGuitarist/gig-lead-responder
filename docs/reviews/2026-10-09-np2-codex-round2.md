# Codex round 2 — NP2 round-1 fixes + execution fix (`67fc89a`..`3072e6d`)

**Verdict: NO-GO** (run A, Claude Code: NO-GO, 4 P2). Run B (Alex): SKIPPED (Alex, 2026-10-09). This is the SECOND NO-GO: automatic iteration stopped. Alex 2026-10-09 chose option **B**
(fix all four, then round 3, which he runs inside Codex himself) over A (fix and ship) and C (accept as is).
Claude Code recommended A (findings are post-check regex edges on drafts that are always held for Alex).

## Run A (Claude Code, 2026-10-09): NO-GO (4 P2)

**Claude Code check:** all four REAL; none changes a price or lets a nonprofit lead send unreviewed.
- P2 prose amount counted as the price line — fixed `5e954d4` (price line = NP price AND priced hours; `statesHours`
  shared with the priced-hours check, which 5 existing tests still guard under mutation).
- P2 "our standard sound check, and the rate is $800" false hold — fixed `083d8ca` ("my ... standard ... rate is $").
- P2 unhyphenated "in kind" figure passed — fixed `e33902e` (`\bin[-\s]?kind\b`).
- P2 "the The American Red Cross" — fixed `a14821b` (a leading "The" is dropped before the app's "the").
- Re-check against the saved real drafts (docs/reviews/2026-10-09-np2-local-runs.md): 0 new violations.

**Claude Code second review (remaining risks):** a price line split across two lines is held; "thank you in kind"
would count as an in-kind mention (held); a contradicting figure with neither "my standard" nor "in-kind" ("my rate
is normally $800") is the accepted residual.

Verbatim (final message; Codex's own fix prompt omitted):

```
NO-GO

P2

- `src/pipeline/post-check.ts:232-234` — Placement can falsely pass when the quote amount appears only in prose.  
  Input: `The client's budget is $695.\nMy standard rate is $795, ...`  
  The budget sentence is treated as the price line, so the in-kind line passes without an actual structured quote line.

- `src/pipeline/post-check.ts:228-243` — Ordinary prose can trigger a false hold.  
  Input: correct NP2 line plus `Our standard sound check, and the rate is $800.`  
  `STANDARD_RATE_STATEMENT` counts this as a second standard-rate statement, despite referring to sound-check services rather than Alex’s quote.

- `src/pipeline/post-check.ts:228-243` — An unhyphenated contradictory in-kind figure passes.  
  Input: correct line plus `That is a $800 in kind contribution to the foundation.`  
  `IN_KIND_MENTION` only matches `in-kind`, so the extra figure is not rejected.

- `src/pipeline/price.ts:491-493` — Organization names beginning with “The” produce malformed wording.  
  Input: `organization_name = "The American Red Cross"`  
  Output: `... contribution to the The American Red Cross.` Acronyms such as `YMCA` correctly become `the YMCA`.

Areas checked clean: NP2 eligibility and exclusions, pricing threshold, travel totals, budget modes, clarification handling, pipeline and SMS-edit wiring, organization-name newline/control-character filtering, venue sanitization, comma-formatted prices, missing-organization holds, T4/residency/duo paths, and round-1 regressions.

Verification: `npm run test:match -- "port manifest R403"` passed 153/153; `npx tsc --noEmit` passed. No server, poller, database, or network sends used. `git fetch origin` was sandbox-blocked at `.git/FETCH_HEAD`; local origin matched HEAD exactly.
```

## Run B (Alex)

Skipped (Alex, 2026-10-09).
