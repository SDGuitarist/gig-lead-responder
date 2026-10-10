# org-venue fix, real-model runs (plan Execution Path), 2026-10-09

**Reader and trigger:** the Codex CODE review round-1 prompt for this fix (cites this file), and
`docs/END-TO-END-STATUS.md` (risk row). **Code under test:** `bef0bf2` (steps 1-3 built).
**Command:** `T=$(mktemp -d)`; lead texts verbatim from the plan; per run
`DATABASE_PATH="$T/runs.db" npx tsx src/index.ts --json < "$T/lead-X.txt" | sed -n '/^{/,$p' | jq -c '.classification | {organization_name, venue_name, nonprofit_buyer, np_tier}'`.
Nothing sent; `data/leads.db` untouched (Oct 3 09:20 before and after). The CLI copies each draft to the clipboard.

| Run | organization_name | venue_name | nonprofit / np_tier | Reading |
|---|---|---|---|---|
| c1 | null | Example Grand Hotel | true / NP2 | (i) or (ii) |
| c2 | null | Example Grand Hotel | true / NP2 | (i) or (ii) |
| c3 | null | Example Grand Hotel | true / NP2 | (i) or (ii) |
| a1 (control) | Example Arts Foundation | Example Grand Hotel | true / NP2 | kept, as expected |

**Result: PASS, 3 of 3 lead (c) runs end null; the control keeps the real organization.** Before the fix the same
text returned "Example Grand Hotel" as the organization on 2 of 2 runs.
**Limit, stated plainly:** the plan's three-way reading wanted (i) "the model returned null itself (prompt line)"
told apart from (ii) "the model returned the venue and the guard fired". The CLI prints only the normalized
classification, so (i) and (ii) look the same here; this record does not claim which. Outcome (iii), the venue kept
because `venue_name` was empty or different, did not occur (venue_name was the hotel on every run).
