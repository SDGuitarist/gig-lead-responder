# Gig Lead Responder — Session Handoff

**Last updated:** 2026-02-26 (v55)
**Current phase:** Fix-batched complete — PR merged to main
**Branch:** `main` (PR #8 merged from `feat/follow-up-pipeline`)
**Next session:** Compound phase

### Fix Session: P3 Review Findings 019-022 (2026-02-26)

**Review doc:** `docs/reviews/feat-follow-up-pipeline/REVIEW-SUMMARY.md`

**What was done:**

- Commit `142c124`: All 4 P3 findings fixed in one commit (+13/-6, 5 files)
  - 019: Typed `JSON.parse` of `classification_json` as `Classification` in follow-up prompt
  - 020: Narrowed `computeFollowUpDelay` param from `number` to `0 | 1 | 2`
  - 021: Added exhaustive `default: never` case in `getValueAddInstructions` — compile-time guard against adding a 4th type without handling it
  - 022: Added optional `maxTokens` param to `callClaudeText` (default 4096 preserved), set 256 for follow-up generation

- Pre-commit check confirmed all changes safe, no regressions
- TypeScript build clean

### Fix Session: P2 Review Findings 012-018 (2026-02-26)

**What was done:**

- Commit `08f289b`: All 7 P2 findings fixed in one commit (+54/-29, 4 files)
  - 012: Extracted `getLeadAwaitingFollowUp()` and `getLeadWithActiveFollowUp()` into leads.ts — SEND/SKIP handlers now use `normalizeRow()` like all other queries
  - 013: Removed unnecessary `runTransaction()` wrapper around single `updateLead` call
  - 014: Added `server.close()` on SIGTERM so in-flight HTTP requests complete
  - 015: Added in-memory retry tracking (`retryFailures` Map) — poison leads auto-skip after 3 failures, Alex notified via SMS
  - 016: Exported `MAX_FOLLOW_UPS = 3` from leads.ts, replaced magic number in SEND handler
  - 017: Redacted `err.message` from all SMS error notifications — errors still logged to console
  - 018: Scheduler reuses existing `follow_up_draft` on retry instead of regenerating (saves API $)

- Pre-commit check caught `MAX_RETRIES` naming collision with `MAX_FOLLOW_UPS` — renamed to `MAX_SCHEDULER_RETRIES`

**Decisions made:**
- Used in-memory Map for retry tracking (not a DB column) — resets on restart, which is fine (lead gets fresh chances)
- Poison leads marked as "skipped" (not a new status) since the existing status set covers the need
- Error SMS says "Check server logs" — Alex is the only user, so this is actionable without exposing internals
- `as 0 | 1 | 2` cast in SEND handler is safe — only reached when `newCount < MAX_FOLLOW_UPS` (3)

## Three Questions

1. **Hardest fix in this batch?** 015 (poison lead retry limit). Had to choose between in-memory tracking vs. a DB column. In-memory is simpler and doesn't require a schema migration, but resets on restart. Accepted this tradeoff because a restart gives the lead fresh chances, which is actually desirable — the failure may have been transient (e.g., Claude API outage).

2. **What did you consider fixing differently, and why didn't you?** Considered adding a dedicated `follow_up_error_count` column for 015 so retry state survives restarts. Rejected because it adds migration complexity for a V1 edge case — if a lead consistently fails across restarts, the in-memory limit will still catch it within 3 cycles (45 minutes). Not worth a schema change.

3. **Least confident about going into the next batch or compound phase?** Whether "skipped" is the right status for poison leads that hit the retry limit. It conflates user-initiated skips (Alex texted SKIP) with system-initiated skips (3 failures). In V1 this is fine since Alex gets an SMS explaining the reason, but if V2 adds analytics on skip reasons, we'd need to distinguish them.

### Prompt for Next Session

```
Read docs/HANDOFF.md. Follow-up pipeline feature is merged to main (PR #8). All review findings resolved. Run /workflows:compound to document learnings in docs/solutions/. Key risk to document: "skipped" status conflates user-initiated and system-initiated skips (Three Questions #3).
```
