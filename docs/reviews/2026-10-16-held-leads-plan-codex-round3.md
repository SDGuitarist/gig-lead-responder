# Codex plan review round 3: held leads show as Sent (todo 097), 2026-10-16

**Verdict: GO** (0 findings), pasted by Alex. **Reviewed:** `docs/plans/2026-10-16-fix-held-leads-show-as-sent-plan.md` Revision 2 plus the no-fade rule, at HEAD
`71611e7dacf7c6bc8945cfd06000eef8008f7d8b`. Authorization: Alex's literal line `Round 3 authorized by Alejandro: YES` (2026-10-16, with "push"). The reviewer reported
the checkout clean at that HEAD, no implementation changes, and all three spike scripts finishing ALL CHECKS PASS. No review record was written by the reviewer;
this file is mine, from the pasted response. **The plan-review loop closes here. No further plan review of this change.** Round counter: Codex plan reviews 3
(R1 NO-GO, R2 NO-GO, R3 GO); Claude plan fix attempts 2 (Revision 1, Revision 2); the no-fade rule was Alex's addition.

| Reviewer's statement | My check | Status |
|---|---|---|
| Router fixtures F-A to F-G reach the intended branches and give the exact ordered reasons; F-A, F-B, F-E discriminate against the old wording; F-F, F-G preserve auto-send | I re-ran `router-fixtures.ts` at `71611e7`: ALL CHECKS PASS (same fixtures; the old router leaks on F-A, F-B, F-E) | AGREES with my run |
| The dashboard harness specification and spike give a concrete implementation path; startup, escaping controls and all three mutations pass | Re-ran `dashboard-harness.mjs` at `71611e7`: ALL CHECKS PASS (3 startup fetches, S1 to S3, D1 to D6, three mutations caught) | AGREES with my run |
| The no-fade rule changes only held leads; "an additional 105 comparisons across table, mobile and detail output preserved non-held output byte-for-byte" | My own spike has 12 byte-identical comparisons for D2 plus the D4 detail check; I did NOT run the reviewer's 105 comparisons | The 105-comparison figure is the REVIEWER'S, not re-run by me |
| S1 to S5, S2b and A1, A2 are sufficiently specified using existing patterns; their implementation remains unverified | Matches my own plan: not spiked | AGREES (UNEXECUTED, work phase) |
| Migration scenarios | Re-ran `migration-scenarios.mjs` at `71611e7`: ALL CHECKS PASS (the rejected column placement fails the legacy fixture) | AGREES with my run |

Still UNEXECUTED (reviewer's table, all accepted, owners unchanged): storage/API tests, repo suite and typecheck (Claude, work phase); the migration on a COPY of the real database (Claude, work step 1, temp copy only); browser appearance, mobile layout and the un-faded row (Alex, after an approved restart); server restart and any optional paid ingest (Alex's approval).

Next: Work phase under Revision 2, one concern per commit in the plan's execution order, protected test runner (`npm run test:match -- "<name>"`), mutation check per fix, then a Codex code review (round 1 of the code loop; this is a different loop from the plan loop, so the counters start again). No paid call, no server restart, no push without Alex's say-so.

Remaining limitations the plan already names (unchanged): old held leads stay "Sent"; old lines in `logs/leads.jsonl` are not scrubbed; the harness stub's escaping is checked against hard-coded strings, not a browser; the 70% fade is read from the stylesheet, not seen in a browser.
