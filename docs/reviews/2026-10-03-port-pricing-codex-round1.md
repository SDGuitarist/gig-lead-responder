# Codex round 1 — Phase 0.5 port, pricing and draft rules (`e1fb163..198d94d`)

**Verdict: NO-GO** (pasted into session 33bddb35 on 2026-10-03). Separate change set from the poller/lease/wake review.
Gate: STEP 1 passed (no reviewed file moved after `198d94d`), STEP 2 control matched; frozen poller files unchanged.

## Findings (as reported)

1. **P1 — Outside-SD budget alternatives use the wrong table.** `lookupPrice()` picks `MARIACHI_FULL_OUTSIDE_SD_RATES`,
   but `detectBudgetGap()` / `findMinFloor()` read `RATE_TABLES`. 40-mile mariachi, budget $2,500 → scoped alternative
   "2 hours, $1,650", which the outside-SD table doesn't offer. Root cause: table selection lives only in `lookupPrice`.
2. **P1 — Gate result trusted without element validation.** `src/pipeline/verify.ts` checks `fail_reasons` and
   `concern_traceability` are arrays, then casts. A non-string reason can keep `gate_status: "pass"`. Inventory:
   `verify.ts`, `classify.ts` validators.
3. **P1 — Always-loaded `RESPONSE_CRAFT.md` still shows price ranges** (`$1,100 – $2,695+` ×5 in the Category vs. Format
   table) while generate/post-check require one number. The range test covered only PRICING_TABLES; the example-line
   test scans only `>` lines, not tables.
4. **P2 — Some PORTED manifest rows miss the §0.5 contract** (marker + runtime test + meeting/non-meeting fixtures):
   R035, R040, R094, R097. The manifest test checks only statuses and cited files.

Not found: frozen-file changes, client names/contact data/credentials, battery mentions, "investment" in loaded docs.
Codex's sandbox could not run the full suite (localhost + `sysctl`): 454 pass, 15 environment failures, 4 skips.

Fix prompt: the pasted verdict's "Claude Code fix prompt" (narrow fix pass; a second NO-GO stops automatic iteration).

## Fixes (session 33bddb35, 2026-10-03) — round 2 prompt sent to Alex

| Finding | Root cause | Fix | Test |
|---|---|---|---|
| 1 Outside-SD budget | table chosen only inside `lookupPrice` | `2c24998`: `rateTableFor()` + `budgetGapFor()`; `findMinFloor` reads the same table | `outside-SD budget` |
| 2 Gate trusted | arrays checked, elements cast | `70edbb5`: field-by-field parse or reject | `gate result parse` |
| 2 (second instance) Classify cast | 8 checks then cast | `666d616`: branch-driving fields parse or reject | `classify parse` |
| 3 Ranges in loaded docs | range check covered one doc; example scan skipped tables | `711f101`: price column removed; every loaded line scanned | `loaded docs model no price ranges` |
| 3 sweep: post-check gap | pattern needed `$` on both numbers | `07c71ab` | `post-check catches every price range form` |
| 4 Manifest contract | test checked statuses + files only | `68af85b`: marker must exist, named test must exist; R035/R040/R094/R097 fixed | `port manifest PORTED rows name a marker and a real test`; `voice self-check` |

Also in the range (Alex): `e0e11fd` quoted hours = priced hours; `6a89523` stale PRICING_TABLES prices removed.
Full suite after fixes: 488 pass, 0 fail, 4 skip; `tsc` clean.
