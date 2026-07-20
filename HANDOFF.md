# HANDOFF -- Gig Lead Responder

**Date:** 2026-07-18
**Branch:** `main`
**Phase:** Real-lead intake completed locally; partial analysis complete and the remaining backlog is blocked by exhausted Anthropic API credits.

> **Reconciliation note (2026-06-25):** Phase 2 was implemented and merged on
> 2026-05-31 but the HANDOFF/plan/compound all drifted, leaving a false
> impression that Phase 2 hadn't started. Reconciled from verified git history:
> HANDOFF + plan status corrected (PR #20), and the skipped compound doc written
> + learnings propagated (this cycle). No production code changed.

## Current State

### 2026-07-18 real-lead intake session

- Imported **16 genuine, future-dated gig inquiries** from the authenticated Gmail account into `data/leads.db`: 13 Squarespace inquiries and 3 GigSalad inquiries.
- Excluded reminders, duplicates, tests, obvious spam, and past events. Every imported record has a dated event between 2026-07-20 and 2027-02-13.
- Imported records as raw `received` leads only. No AI analysis or draft generation ran, and no email or SMS was sent.
- Kept `DRY_RUN=true` and `AUTO_SEND_ENABLED=false` throughout the import. The one-time import payload and helper were removed after verification.
- Verified the database contains exactly 16 leads and `git diff --check` passes.
- Investigated the dashboard's long-running “Pipeline running” state. All 16 imported records have `pipeline_completed_at = NULL` and no draft, confirming that no analysis job was active. A sending-disabled test of one lead returned Anthropic HTTP 401 (`API key is invalid`). The test record was restored exactly to its pre-test `received` state and the temporary diagnostic helper was removed.
- Re-tested after the user replaced the `.env` value on 2026-07-20. The file has exactly one well-formed `ANTHROPIC_API_KEY` entry with the expected prefix and no whitespace or placeholder text, but Anthropic still returns HTTP 401. No lead was modified. The credential itself is invalid or revoked and must be regenerated in Anthropic Console.
- After a new key was generated, found that an older inherited shell variable was overriding `.env`; running with that stale value removed validated the new key successfully.
- Saved three no-send analyses: Sydney Lukasezck (confidence 90, gate passed), Samantha V (confidence 70, gate passed), and Lali (confidence 0, gate failed and requires manual review). Johnny Martinez and Jennifer hit clarification-draft validation errors without record changes. The account then returned `credit balance is too low`, leaving the other 11 records untouched.
- All 16 leads remain in `received` status. The three saved drafts have `pipeline_completed_at = NULL` intentionally so startup recovery cannot interpret them as interrupted SMS deliveries. No email, platform reply, or SMS was sent.

### 2026-07-18 dashboard UI/UX session

Completed the full ten-item operational pass in priority order:

- Clarified approval scope and destination; **Approve draft** explicitly sends the phone-ready copy to Alex’s phone, not to the client.
- Rebuilt expanded leads as a focused review workspace with a primary draft, collapsible phone copy, confidence explanation, decision brief, and persistent actions.
- Added urgency-based queue ordering and visible reasons, Follow-Up badges/banner, guided Analyze first use and progress, actionable Insights, retry/loading/error states, keyboard row expansion, and populated mobile layouts.
- Used a temporary, isolated fictional fixture database for visual verification, then stopped the fixture server, detached the database from the project, and removed the generator after confirming the product must display real gigs only.
- Verified fictional populated Queue, expanded lead, Follow-Ups, Insights, Analyze validation, and 390px mobile states in the in-app browser. No live record was touched and no message was successfully sent.
- Saved final evidence in `docs/audits/2026-07-18-ui-ux/` and updated the audit.
- Verification: dashboard script syntax passed; `git diff --check` passed; `npm test` **315 passed, 0 failed**. `npx tsc --noEmit` still reports pre-existing errors in automation/router/Claude typing files not changed in this pass.

Completed a combined desktop/mobile audit and implemented the highest-priority fixes in `public/dashboard.html` and `public/dashboard.css`:

- Fixed document-level horizontal overflow caused by the five-tab mobile navigation.
- Added compact 2×2 mobile metrics, task-oriented empty states, and direct next actions.
- Added a persistent Analyze label and clearer helper copy.
- Added tab semantics, roving focus, arrow-key navigation, visible focus, and reduced-motion support.
- Bumped the dashboard stylesheet URL through `v=5` so the responsive and operational corrections are not masked by the one-hour static cache.
- Saved before/after evidence and the audit at `docs/audits/2026-07-18-ui-ux/`.
- Verified 390px and 1280px layouts in the local dashboard. `npm test`: **315 passed, 0 failed**.

The original empty-state gap was checked with temporary isolated fictional fixtures that are no longer connected to the app. Real approval/follow-up mutations and live AI streaming remain intentionally unexecuted until an inert staging adapter is available.

**Phase 1** (P3 Batch + Gmail Intake) — complete: brainstorm → plan → work → review → compound. 293 tests passing at that baseline.

**Phase 2** (Gmail Intake: Enable Auto-Send + Dashboard done_reason) — **implemented, Codex-reviewed, and merged to `main` via PR #19 on 2026-05-31.** Delivered:
- **P0 fix:** auto-send path calls `completeApproval()` (`src/automation/orchestrator.ts:295`) so auto-sent leads schedule follow-ups atomically.
- **P1:** `autoSendEnabled` mode logged at startup (`9c97fd5`); guards against stale Railway env vars.
- **done_reason** rendered on lead cards (`2d0dd3e`, `public/dashboard.html`) and threaded through orchestrator + DB layer.

`main` is up to date with `origin/main` (pushed). Test count not re-verified in this reconciliation pass.

**Auto-send is NOT live.** `autoSendEnabled` defaults to `false` (review-only). Enabling is a one-way operational change via Railway env `AUTO_SEND_ENABLED=true` — deliberately gated behind a draft-quality monitoring period per the Phase 2 plan's `feed_forward.risk`. This is an operational decision for Alex, not unfinished code.

## Outstanding

| Item | Notes |
|------|-------|
| **Enable auto-send in production** | Operational call: flip Railway `AUTO_SEND_ENABLED=true` after the review-only monitoring period confirms draft quality. |
| **Production-lessons addendum** | Once auto-send runs live, add an addendum to the Phase 2 solution doc (reply quality, false-auto-send rate, follow-up behavior). The solution doc marks production validation as PENDING. |

## Key Artifacts

| Phase | Location |
|-------|----------|
| Phase 1 Plan | `docs/plans/2026-05-22-feat-p3-batch-gmail-intake-plan.md` |
| Phase 1 Solution | `docs/solutions/architecture/2026-05-22-p3-batch-gmail-intake-phase1-hardening.md` |
| Phase 2 Plan | `docs/plans/2026-05-31-feat-gmail-intake-phase2-auto-send-plan.md` (status: completed) |
| Phase 2 Solution | `docs/solutions/architecture/2026-05-31-gmail-intake-phase2-auto-send-done-reason.md` (production lessons PENDING) |
| Dashboard UI/UX Audit | `docs/audits/2026-07-18-ui-ux/AUDIT.md` |

## Deferred Items (still open from Phase 1)

| Item | Reason |
|------|--------|
| Extract shared esc() to public/shared.js | Two-file duplication (index.html + dashboard.html) |
| Levenshtein fuzzy matching | Not justified by production data |
| OAuth token refresh persistence on Railway | Accepted for Phase 1 |
| full_draft length cap | Pre-existing from Cycle 11 |
| Dual parser unification | Pre-existing |
| Broader soft-refusal patterns | No production data yet |
| Unicode normalization in normalizeFormatText | No production data yet |

_(done_reason in dashboard — completed in Phase 2, removed from this list.)_

## Cross-project reference — FilmCon dashboard patterns (2026-07-18)

The archived FilmCon dashboard (`~/Projects/filmcon/docs/solutions/2026-07-18-filmcon-dashboard-unshipped-patterns.md`, code at git tag `filmcon-dashboard-archived`) generalized two patterns that came *from here* and loop back to open work here:

- **Audit-first, success-only atomic write** is the generalized form of *this project's own* Phase 2 P0 fix — the auto-send path calling `completeApproval()` (`src/automation/orchestrator.ts:295`) so the state change and its follow-up/audit land atomically. When adding any **new state-changing path**, route it through the one canonical atomic function; never re-implement inline (that was the original bug).
- **Deploy fail-open + unenforced-gate + stale-env** lessons speak directly to the **`AUTO_SEND_ENABLED` Railway gating**. Before flipping auto-send live: enforce the safety gate *in code/CI*, not by remembering to check it; log the resolved flag at startup (already done — keep it); and verify the live Railway env with a real check, not an assumption (the "guards against stale Railway env vars" note here is the same class as FilmCon's fail-open-because-ENVIRONMENT-never-wired P0).

## Prompt for Next Session

```
Read HANDOFF.md. After Anthropic API credits are added, process only the 13 real
received leads whose `full_draft` is NULL. Unset the inherited
ANTHROPIC_API_KEY so dotenv loads the current `.env` value, and keep DRY_RUN=true
and AUTO_SEND_ENABLED=false. Isolate clarification-mode generation failures and
do not send email or SMS. Relevant files: data/leads.db, .env,
src/run-pipeline.ts, public/dashboard.html.
```

## Three Questions

1. **Hardest implementation decision in this session?** Treating Gmail notifications as real only when the message contained a concrete future event date and recognizable marketplace or form provenance, while rejecting reminders and ambiguous mail.
2. **What did you consider changing but leave alone, and why?** I left AI analysis, draft generation, approval state, and all outbound delivery untouched because importing real inquiries did not authorize contacting prospects or consuming their records through the response pipeline.
3. **Least confident about going into review?** Lali's saved draft failed the gate at confidence 0, while 13 leads still need analysis after API credits are replenished; clarification-mode generation also failed on two sparse inquiries.
