# Codex CODE review, round 3 (final): payment terms by lead time

**Code:** `feat/hub-phase0` at `b354b54` (fix range `df6b2b0..b354b54`; fix commit `53f9f59`). **Plan:**
`docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` (Revision 4). **Prior Codex verdicts:** round 1 NO-GO
(both runs), round 2 NO-GO (run A). Round 3 authorized by Alejandro: YES (2026-10-11). Hard cap: no round 4.
**Reader and trigger:** the compound solution doc; HANDOFF.

**Verdict: GO on BOTH runs. No P1, P2 or P3.** Code review for payment terms is closed.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `b354b54`)

```
GO — no P1, P2, or P3 findings.

The approve route closes the reviewed class:

- `src/api.ts:99-102`: `compressed_draft` null/empty is refused before claim.
- `src/api.ts:117-124`: both drafts are refreshed; null `full_draft` is absent, but `""` is present and fails with 409 when terms require a sentence.
- `src/api.ts:127-129`: both draft fields are saved together.
- `src/api.ts:137-144`: claim/send occurs only after both validations succeed.
- All `PaymentTerms` kinds preserve their intended behavior; non-sentence kinds leave drafts unchanged.

The named truthiness mutation (`lead.full_draft ?`) fails the added empty-string test. `npx tsc --noEmit` passed. Existing evidence reports 791 tests passing, 0 failing, 1 skipped; server/IPC execution was not repeated because this review forbade starting a server.

No files were changed.

```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `b354b54`)

```
GO — no P1/P2/P3 findings.

The "present draft skipped" class is closed:

- `src/api.ts:118` now refreshes every non-null `full_draft`, including `""`.
- Any zero/two-sentence `full_draft` under `kind: "sentence"` returns 409 before `claimLeadForSending`.
- Both refreshed drafts are persisted together at `src/api.ts:127-128`; failures persist neither.
- `null` remains intentionally absent; `compressed_draft` null/empty is rejected at `src/api.ts:99`.
- The truthy mutant (`lead.full_draft ?`) fails the added `""` case at `src/payment-terms-approve.test.ts:56-64`.
- `none`, `platform`, and `unknown_platform` intentionally bypass sentence refresh per the settled plan rules.

No server, poller, database, network, or send was used. Round 3 is clean; the hard cap applies, so there is no Round 4.
```
