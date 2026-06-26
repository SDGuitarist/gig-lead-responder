---
title: "Gmail Intake Phase 2: Auto-Send via Atomic Completion + Dashboard done_reason"
category: architecture
tags: [auto-send, completeApproval, atomic-state-transition, done_reason, dashboard, render-surfaces, escape-at-interpolation, env-var-staleness, review-only]
module: orchestrator.ts, poller.ts, dashboard.html, dashboard.css, types.ts, shape-lead.ts
symptom: "Auto-send path bypassed follow-up scheduling; done_reason invisible on dashboard; stale Railway env could silently disable auto-send"
root_cause: "The orchestrator's auto-send branch called updateLead() directly instead of the atomic completeApproval(), so auto-sent leads never entered the follow-up lifecycle. The done_reason column existed but was never surfaced in the API or UI."
date: 2026-05-31
predecessor: 2026-05-22-p3-batch-gmail-intake-phase1-hardening.md
---

> **Written retroactively 2026-06-25** from verified git history. The
> implementation shipped 2026-05-31 via PR #19 (commits `db82c9f`, `2d0dd3e`,
> `f4eb6bb`, `9c97fd5`); the compound phase was skipped at the time and this doc
> reconciles it. **Scope:** build/review-time hardening lessons only.
> Production-behavior lessons are **pending** — see the final section — because
> `AUTO_SEND_ENABLED` was never flipped to `true`, so auto-send has not yet run
> against real leads.

## Problem

Phase 1 shipped Gmail intake in **review-only** mode (`autoSendEnabled: false`):
auto-send-eligible leads were stored as `"sent"` with a `done_reason` of
`"review-only: would-auto-send via {platform}"`, and `dispatchReply()` was
unreachable. Phase 2 was meant to make auto-send safe to actually enable. The
plan deepening (6 research agents + Codex plan review) surfaced that the naive
version of "just flip the flag" had a latent data-integrity bug and an
incomplete UI:

1. **P0 — auto-send bypassed the atomic completion path.** The orchestrator's
   auto-send branch called `updateLead()` directly to set status. But manual
   approvals go through `completeApproval()`, which **atomically** sets status
   *and* schedules follow-ups in one transaction. Auto-sent leads would have
   silently received **no follow-ups** — the exact lifecycle the business runs
   on — with no error to signal it. (Spec flow analyzer)

2. **`done_reason` existed but was invisible.** The column was written in Phase 1
   but never added to `LeadApiResponse`/`shapeLead()`, so neither the API nor the
   dashboard ever showed *why* a lead was held or auto-sent.

3. **Incomplete render surfaces.** The initial plan rendered `done_reason` on the
   desktop detail panel and table row but **forgot the mobile card** — and Alex
   reads the dashboard from his phone after SMS alerts. (Spec flow analyzer)

4. **Stale-env-var blind spot.** Flipping `AUTO_SEND_ENABLED` is a Railway env
   change. With no startup log, a stale or missing env var would silently keep
   the system in review-only mode with no way to notice. (Spec flow analyzer +
   MEMORY.md pitfall)

## Solution

### Pattern 1: A second path to a terminal state must reuse the canonical atomic transition

**The headline lesson.** There are two ways a lead reaches "replied + scheduled":
manual approval and auto-send. Manual approval already had the correct primitive
— `completeApproval()`, which sets status and schedules the follow-up in one
atomic operation. The auto-send path was reconstructing the transition by hand
with a bare `updateLead()`, getting the status right but dropping the follow-up.

The fix (`f4eb6bb`, `orchestrator.ts:295`) routes auto-send through the same
function:

```ts
// Update DB with send result + schedule follow-up atomically
if (sendResult.status === "sent") {
  deps.completeApproval(leadId, `auto-sent via ${platform}`, new Date().toISOString());
}
```

**General rule:** when a system has more than one trigger for the same terminal
state, every trigger must go through the *same* state-transition function — never
re-implement "set status (+ side effects)" inline in the new path. The side
effect that the inline version forgets (here: follow-up scheduling) fails
**silently**, which is the worst kind. Pairs with
[`atomic-claim-for-concurrent-state-transitions.md`](atomic-claim-for-concurrent-state-transitions.md)
and [`follow-up-pipeline-human-in-the-loop-lifecycle.md`](follow-up-pipeline-human-in-the-loop-lifecycle.md).

### Pattern 2: When adding a field to the UI, enumerate ALL render surfaces and gate them with one shared helper

The dashboard renders a lead in three places: the **detail panel**, the
**desktop table row**, and the **mobile card**. The plan's first draft covered
two and missed the mobile card — a partial rollout that would have looked
"done" in desktop testing.

The fix surfaces `done_reason` in all three (`2d0dd3e`, `dashboard.html:530`,
`:650`, `:675`), and — critically — gates all three behind **one shared guard**
rather than three copies of the condition:

```js
function shouldShowDoneReason(l) {
  return l.done_reason && (l.status === 'done' || l.status === 'failed' || l.status === 'sent');
}
```

**General rule:** a new display field is not "rendered" until every surface
renders it. Enumerate surfaces explicitly (detail / table / mobile), and put the
visibility predicate in one function all surfaces call — three inline copies
drift the moment one is edited.

### Pattern 3: Escape at the interpolation site, not inside the formatter

Codex's plan review (the P3 finding) caught a double-escaping trap: the first
draft put `esc()` *inside* `formatDoneReason()`. That breaks the moment any
caller also escapes, and it couples a pure formatting function to an HTML
concern.

Shipped version keeps `formatDoneReason()` pure and escapes at each call site:

```js
esc(formatDoneReason(l.done_reason))   // dashboard.html:650, :675
esc(l.done_reason)                     // detail panel, full provenance, :531
```

This matches the project's existing
[`escape-at-interpolation-site.md`](escape-at-interpolation-site.md) convention
established by the Phase 1 XSS fix. **General rule:** formatters return plain
text; escaping happens once, at the point of HTML interpolation.

### Pattern 4: Startup-log every one-way operational flag

`AUTO_SEND_ENABLED` is a one-way, env-controlled switch whose *silent* failure
mode (stale var → stuck in review-only) is invisible. The fix (`9c97fd5`) adds
its state to the poller's startup log, so every Railway boot announces which mode
it's in.

**General rule:** any flag that (a) changes behavior materially and (b) is set
outside the codebase (env var, remote config) must be logged at startup. The log
line is the only cheap defense against env-var staleness — a documented pitfall
in this project's MEMORY.

### Confirmed safe (verified, not assumed)

- `done_reason` is **server-generated** (no user input) — but still escaped at
  render per Pattern 3, defense in depth.
- No schema/migration: the `done_reason` column already existed from Phase 1.
- Reused the existing `"sent"` status — no new status value, no dashboard filter
  or API contract change.

## Files Changed

Implementation commits (merged via PR #19, 2026-05-31):

- `db82c9f feat(api): add done_reason to LeadApiResponse and shapeLead` — `src/types.ts`, `src/utils/shape-lead.ts`
- `2d0dd3e feat(dashboard): render done_reason on lead cards` — `public/dashboard.html` (+`formatDoneReason`/`shouldShowDoneReason`), `public/dashboard.css` (`.done-reason*` + overflow-wrap)
- `f4eb6bb feat(orchestrator): use completeApproval for auto-sent leads` — `src/automation/orchestrator.ts` (the P0 fix)
- `9c97fd5 feat(poller): log autoSendEnabled mode at startup` — `src/automation/poller.ts`

Tests added: `src/done-reason.test.ts` (100 lines), `src/shape-lead.test.ts` (73 lines), `src/orchestrator.test.ts` (+19 lines for the completeApproval path).

## Related Patterns

- **Predecessor:** [`2026-05-22-p3-batch-gmail-intake-phase1-hardening.md`](2026-05-22-p3-batch-gmail-intake-phase1-hardening.md) — Phase 1 created review-only mode and deferred `done_reason` dashboard rendering to Phase 2 (now done).
- [`atomic-claim-for-concurrent-state-transitions.md`](atomic-claim-for-concurrent-state-transitions.md) — Pattern 1 is the same principle applied to a second trigger of a terminal state.
- [`escape-at-interpolation-site.md`](escape-at-interpolation-site.md) — Pattern 3 follows it directly.
- [`follow-up-pipeline-human-in-the-loop-lifecycle.md`](follow-up-pipeline-human-in-the-loop-lifecycle.md) — the lifecycle that the P0 bug would have silently skipped.

## Production lessons — PENDING

This doc covers only build/review-time hardening. The lessons the Phase 2 plan
was *actually* worried about — does auto-send produce good replies in
production? — **cannot be written yet**, because `AUTO_SEND_ENABLED` was never
set to `true`. Auto-send has never run against a real lead. When it is enabled
(after the review-only draft-quality monitoring period the plan requires), add an
addendum here covering: auto-sent reply quality, false-auto-send rate, and
whether `completeApproval()`-scheduled follow-ups behaved correctly in the wild.
Until then, treat this cycle's *production* validation as open.

## Three Questions

1. **Hardest pattern to extract from the fixes?** Pattern 1. On the surface it's
   a one-line change (`updateLead` → `completeApproval`), which makes it easy to
   log as trivial. The reusable insight is the opposite: the triviality is the
   danger — a second code path that "looks right" because the status is correct,
   while a transactional side effect (follow-up scheduling) vanishes with no
   error. The lesson is about *recognizing* duplicated terminal-state transitions,
   not about the diff.

2. **What did you consider documenting but left out?** The `dryRun ×
   autoSendEnabled` 4-way interaction matrix. It's the same call the Phase 1 doc
   made: it's a runtime behavior table best kept in `config.ts` comments where
   it's consumed, not an architectural pattern. Documenting it here would repeat
   Phase 1 without adding reuse.

3. **What might future sessions miss that this solution doesn't cover?** That this
   cycle is **not production-validated**. The code is correct and tested, but
   "Phase 2 complete" could be misread as "auto-send is proven in production."
   It is not — it has never been switched on. The PENDING section above exists
   precisely so a future session doesn't assume the risky part is settled.
