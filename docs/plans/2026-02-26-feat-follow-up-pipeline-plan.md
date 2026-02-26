---
title: "feat: Follow-Up Pipeline"
type: feat
status: active
date: 2026-02-26
deepened: 2026-02-26
reviewed: 2026-02-26
origin: docs/brainstorms/2026-02-26-follow-up-pipeline-brainstorm.md
feed_forward:
  risk: "Follow-up prompt quality — if drafts consistently need heavy editing, SMS approval becomes a bottleneck instead of a safety net"
  verify_first: true
---

# feat: Follow-Up Pipeline

## Enhancement Summary

**Deepened on:** 2026-02-26
**Reviewed on:** 2026-02-26 (TypeScript reviewer, simplicity reviewer, architecture strategist, spec flow analyzer)

### Critical Fixes Applied

1. **Trigger timing fixed** — Schedule follow-ups after `handleApproval()` sets `status = "done"`, NOT after `postPipeline()` sets `status = "sent"`. "Sent" = Alex received draft, "done" = client received message.
2. **No delivery mechanism** — `sendSms()` is hardcoded to `ALEX_PHONE`. V1: ALL follow-ups are SMS drafts to Alex. Direct client sends are V2.
3. **Draft storage added** — New `follow_up_draft` column stores generated text between generation and SEND approval. Prevents draft loss on server restart.
4. **`sending` state removed** — With human-in-the-loop (Alex approves every follow-up), there is no concurrent race to guard against. Simplifies to 4 states.
5. **SEND handler fully defined** — Explicit action sequence after Alex replies SEND.
6. **Shared `completeApproval()`** — Both approval paths (Twilio webhook + dashboard API) use the same function. Prevents forgetting the schedule trigger.
7. **Phases 3+4 deploy together** — Can't send drafts without the SEND/SKIP commands.

### V1 Model (post-review)

| Aspect | V1 | Why |
|---|---|---|
| States | 4: `pending`, `sent`, `skipped`, `exhausted` | No `sending` (human-gated, no race). `exhausted` is terminal, distinct from NULL. |
| Columns | 4: `follow_up_status`, `follow_up_count`, `follow_up_due_at`, `follow_up_draft` | Swapped `follow_up_sent_at` (not needed) for `follow_up_draft` (stores generated text). |
| DB helpers | 2: `getLeadsDueForFollowUp()`, `scheduleFollowUp()` | All other mutations use `updateLead()` directly — no wrapper functions for one-line updates. |
| Verify gate | None | All drafts go to Alex via SMS. Add gate in V2 after 20+ successful approvals. |
| Timing | 1 band: 24h / 3d / 7d | Alex can SKIP if timing feels wrong. |
| Commands | SEND, SKIP (no ID suffix) | At ~1 follow-up in flight at a time, most-recent default handles 99% of cases. |
| Phases | 1-4 (deploy: 1, 2, 3+4) | Reply detection and dashboard tab deferred to V2. |
| Shared function | `completeApproval()` | Both Twilio and dashboard approval paths use this. |

---

## Prior Phase Risk

> **Least confident about going into the next phase?** Email parsing for reply
> detection — real email samples needed to validate subject line matching before
> building the parser. Also: verify gate may need adapted checks for follow-ups
> (different structure than initial pitches).

This plan addresses both risks:
1. Reply detection (Phase 5) is deferred to V2 — Phases 1-4 are independently shippable without it.
2. Verify gate is removed from V1 entirely — all follow-ups go through SMS approval. Add gate in V2 when prompt quality is proven.

## Overview

After sending the initial AI response, the system forgets about the lead. Leads that don't reply within 24 hours are effectively lost. This feature adds automatic follow-up scheduling, AI-drafted value-add nudges, and SMS-based approval to close the loop.

The approach: separate `follow_up_status` field (not merged into `status`), human-in-the-loop for every follow-up (V1), and incremental layers that are each independently shippable (see brainstorm: key decisions table).

## Proposed Solution

Four V1 phases (deploy order: 1, 2, 3+4):

1. **Schema + Types** — new columns, updated TypeScript types, shared `completeApproval()` function
2. **Scheduler** — `setTimeout` chaining loop that checks for due follow-ups
3. **Follow-Up Draft Generator + SMS Approval** — AI prompt, draft storage, SEND/SKIP commands *(deploy together)*

Two V2 phases:

4. **Reply Detection** — extend Mailgun webhook to catch client replies
5. **Dashboard Tab** — follow-up queue, status badges, controls

## Technical Approach

### Phase 1: Schema + Types

**Files:** `src/types.ts`, `src/leads.ts`, `src/twilio-webhook.ts`, `src/api.ts`

Add columns to `leads` table via the existing migration pattern (`initDb()` column-addition, `src/leads.ts:58-78`):

```
follow_up_status    TEXT CHECK(follow_up_status IN ('pending','sent','skipped','exhausted'))
follow_up_count     INTEGER NOT NULL DEFAULT 0
follow_up_due_at    TEXT     -- ISO datetime, set by scheduler
follow_up_draft     TEXT     -- stores generated follow-up text until SEND approval
```

Default `NULL` for `follow_up_status` — existing leads unaffected, zero migration risk (see brainstorm: "Why This Approach" section).

> **V2 columns (add when needed):** `snoozed_until TEXT`, `follow_up_channel TEXT`, `client_email TEXT`, `client_phone TEXT`

**TypeScript changes:**

```ts
// src/types.ts
export const FOLLOW_UP_STATUSES = ["pending", "sent", "skipped", "exhausted"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
```

- Extend `LeadRecord` interface with new fields — use `T | null` (NOT `?:`) for nullable columns, `number` for `follow_up_count` (NOT NULL DEFAULT 0)
- Extend `LeadApiResponse` with follow-up fields and update `shapeLead()` in `src/api.ts` to include them
- Add ALL new columns to `UPDATE_ALLOWED_COLUMNS` set in `src/leads.ts:158` — forgetting one causes runtime crash

**New DB helper functions in `src/leads.ts`:**
- `getLeadsDueForFollowUp(): LeadRecord[]` — query: `follow_up_status = 'pending' AND follow_up_due_at <= datetime('now') LIMIT 10`
- `scheduleFollowUp(leadId: number, dueAt: string): void` — sets `follow_up_status = 'pending'`, `follow_up_due_at`

All other mutations (skip, mark exhausted) use `updateLead()` directly — no wrapper functions for one-line updates called from one place.

**Shared approval function in `src/leads.ts`:**

```ts
// Called by BOTH handleApproval() in twilio-webhook.ts AND POST /api/leads/:id/approve in api.ts
export function completeApproval(leadId: number, doneReason: string): LeadRecord | undefined {
  return runTransaction(() => {
    const lead = updateLead(leadId, { status: "done", done_reason: doneReason });
    if (lead) {
      const delay = computeFollowUpDelay(0); // first follow-up delay
      const dueAt = new Date(Date.now() + delay).toISOString();
      scheduleFollowUp(leadId, dueAt);
    }
    return lead;
  });
}
```

This ensures `status = "done"` and `scheduleFollowUp()` happen atomically. Both `handleApproval()` and the dashboard approve endpoint call `completeApproval()` instead of calling `updateLead()` and `scheduleFollowUp()` separately.

If `scheduleFollowUp()` fails inside the transaction, the entire transaction rolls back — the lead stays in its previous state. No silent drops.

**State machine (4 states, 6 transitions):**

| From | To | Trigger | Notes |
|---|---|---|---|
| NULL | pending | `completeApproval()` | After initial response approved, `status = "done"` |
| pending | sent | scheduler | Generates draft, stores in `follow_up_draft`, sends SMS to Alex |
| pending | skipped | SKIP command | `WHERE follow_up_status = 'pending'` |
| sent | pending | SEND command | Alex approves. Count++, schedule next (if count < 3) |
| sent | exhausted | SEND command | Alex approves 3rd follow-up. Count = 3, terminal. |
| sent | skipped | SKIP command | `WHERE follow_up_status = 'sent'` |

**Why no `sending` state:** With human-in-the-loop (Alex approves every follow-up via SMS), there is no concurrent race to guard against. The scheduler processes sequentially. The only "in-flight" period is the Claude API call, and if the server crashes during it, the status is still `pending` (it hasn't been changed yet). On restart, the scheduler picks it up again. No stale recovery needed.

**V1 limitation: SKIP cancels ALL remaining follow-ups.** There is no "skip this one, continue the sequence." V2 could add a NEXT command. Alex should be aware of this behavior.

**Institutional learnings to apply:**
- `docs/solutions/logic-errors/constants-at-the-boundary.md` — Define `FOLLOW_UP_STATUSES` array once, import everywhere
- `docs/solutions/logic-errors/required-nullable-vs-optional-types.md` — `T | null` for DB columns, never `?:`
- `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md` — Use conditional WHERE on all transitions

---

### Phase 2: Scheduler

**Files:** `src/server.ts`, new file `src/follow-up-scheduler.ts`

In-process chained `setTimeout` that runs every 15 minutes (see brainstorm: "In-process scheduler for V1"). Simpler than cron, resets on deploy but Railway deploys are fast — at most one missed cycle.

```
src/follow-up-scheduler.ts:
  - startFollowUpScheduler() — called from server.ts inside app.listen() callback
  - stopFollowUpScheduler() — called on SIGTERM
  - checkDueFollowUps() — the timeout callback
    1. Run once immediately on startup (catch up from downtime)
    2. Query getLeadsDueForFollowUp()
    3. For each lead: generate draft, store in DB, send SMS to Alex, set status = 'sent'
    4. If any step fails for a lead: leave as 'pending', log error, continue to next lead
    5. Schedule next check via setTimeout (NOT setInterval — prevents overlap)
```

**Scheduler loop:**

```ts
const INTERVAL_MS = 15 * 60 * 1_000; // 15 minutes
let schedulerHandle: ReturnType<typeof setTimeout> | null = null;

async function schedulerLoop(): Promise<void> {
  if (process.env.DISABLE_FOLLOW_UPS === "true") {
    console.log("[scheduler] disabled via DISABLE_FOLLOW_UPS");
    schedulerHandle = setTimeout(schedulerLoop, INTERVAL_MS);
    return;
  }
  console.log("[scheduler] heartbeat");
  try {
    await checkDueFollowUps();
  } catch (err) {
    console.error("[scheduler] error:", err);
    await sendSms(`Follow-up scheduler error: ${(err as Error).message}`).catch(console.error);
  }
  schedulerHandle = setTimeout(schedulerLoop, INTERVAL_MS);
}

export function startFollowUpScheduler(): void {
  console.log("[scheduler] started — checking every 15 minutes");
  schedulerLoop(); // run immediately, then chain
}

export function stopFollowUpScheduler(): void {
  if (schedulerHandle) { clearTimeout(schedulerHandle); schedulerHandle = null; }
}
```

**Why `setTimeout` over `setInterval`:** setInterval fires even if the previous callback is still running. If 8 follow-ups each take 2 min, the cycle runs 16 min — overlapping the next 15-min interval. setTimeout chains guarantee no overlap by design.

**Graceful shutdown:**

```ts
process.on("SIGTERM", () => {
  console.log("SIGTERM received, stopping scheduler...");
  stopFollowUpScheduler();
});
```

No 5-second delay needed — better-sqlite3 writes are synchronous, and the setTimeout chain simply never fires again.

**Fixed timing for V1** (single band):

| Follow-up # | Delay |
|---|---|
| 1st | 24 hours |
| 2nd | 3 days |
| 3rd (last) | 7 days |

> **V2 upgrade:** Add 3 urgency bands based on event date proximity.

`computeFollowUpDelay(followUpCount: number): number` — pure function, returns milliseconds. Trivial array lookup:

```ts
const FOLLOW_UP_DELAYS_MS = [
  24 * 60 * 60 * 1_000,      // 1st: 24 hours
  3 * 24 * 60 * 60 * 1_000,  // 2nd: 3 days
  7 * 24 * 60 * 60 * 1_000,  // 3rd: 7 days
];

export function computeFollowUpDelay(followUpCount: number): number {
  return FOLLOW_UP_DELAYS_MS[followUpCount] ?? FOLLOW_UP_DELAYS_MS[2];
}
```

Max 3 follow-ups per lead. After 3rd SEND: set `follow_up_status = 'exhausted'`.

**Scheduler processing per lead:**

```ts
async function checkDueFollowUps(): Promise<void> {
  const leads = getLeadsDueForFollowUp(); // LIMIT 10, sequential
  for (const lead of leads) {
    try {
      // 1. Generate follow-up draft via Claude API
      const draft = await generateFollowUpDraft(lead);
      // 2. Store draft in DB (survives restarts)
      updateLead(lead.id, { follow_up_draft: draft });
      // 3. Send SMS to Alex for approval
      await sendSms(formatFollowUpSms(lead, draft));
      // 4. Mark as sent (waiting for SEND/SKIP from Alex)
      updateLead(lead.id, { follow_up_status: "sent" });
    } catch (err) {
      // Leave as 'pending' — retry next cycle
      console.error(`[scheduler] follow-up failed for lead #${lead.id}:`, err);
    }
  }
}
```

If any step fails, the lead stays `pending` and is retried next cycle. No stale recovery needed because there is no intermediate `sending` state.

**Institutional learnings:**
- `docs/solutions/architecture/fire-and-forget-timeout.md` — Consider Claude SDK timeout; no additional `Promise.race` wrapper needed in V1
- `docs/solutions/logic-errors/rate-limiting-race-condition-and-cleanup.md` — Overlap impossible with setTimeout chaining

---

### Phase 3+4: Follow-Up Draft Generator + SMS Approval *(deploy together)*

**Files:** new `src/prompts/follow-up.ts`, new `src/pipeline/follow-up-generate.ts`, `src/twilio-webhook.ts`

**Why deploy together:** Phase 3 sends follow-up drafts to Alex with "Reply SEND to send, SKIP to cancel." Without Phase 4's SEND/SKIP commands, Alex receives drafts with no way to act on them.

#### Draft Generator (Phase 3)

**Prompt design:** Each follow-up adds something new — not "just checking in" (see brainstorm: "Value-add nudge tone"). The prompt receives:
- Original lead classification (format, event type, date, cultural context)
- Original compressed draft (for context continuity)
- Follow-up number (1st, 2nd, 3rd) — tone escalates
- Value-add type rotation: song suggestion → testimonial → availability/urgency

```
Follow-up 1: "I was thinking about your [event_type] — here's a song that always works for [context]..."
Follow-up 2: "Just finished a [similar event] last weekend — [brief testimonial]..."
Follow-up 3: "Wanted to make sure you saw my message. I'm holding [date] open but have another inquiry..."
```

**Follow-up SMS format** (must be visually distinct from initial draft SMS):

```
📋 Follow-up #1 for Lead #42
Wedding @ Hilton La Jolla — 2026-03-15

[follow-up draft text]

Reply SEND to send, SKIP to cancel all follow-ups.
```

The `📋 Follow-up #N` header distinguishes this from initial drafts (which have no emoji prefix). Alex can never confuse a follow-up with an initial draft.

**Error handling:** Inline in the scheduler's `catch` block (3 lines — log, leave as pending, continue). No dedicated `postFollowUpError()` function needed for V1 since the scheduler already handles errors per-lead.

**Consider Haiku model** for follow-ups — shorter messages, ~10x cheaper. Test quality first; use Sonnet if insufficient.

**Institutional learnings:**
- `docs/solutions/prompt-engineering/testable-constraints-for-prompt-compliance.md` — Test follow-up prompt against 4 existing test leads BEFORE building the send flow
- `docs/solutions/architecture/hybrid-llm-deterministic-computation.md` — LLM writes the message; code picks timing and retry logic
- `docs/solutions/prompt-engineering/prompt-placement-for-hard-constraints.md` — "Value-add, not checking in" must be a system prompt constraint

#### SMS Approval Flow (Phase 4)

Extend existing Twilio webhook command parsing (`src/twilio-webhook.ts:12-15`) with new commands:

```
SKIP    → cancel all follow-ups for most recent follow-up lead
SEND    → approve pending follow-up draft (most recent)
```

> **V2 commands:** `SKIP-42`, `SEND-42` (with lead ID), `SNOOZE N`

**New regex patterns:**

```ts
const SKIP_PATTERN = /^skip$/i;
const FOLLOWUP_SEND_PATTERN = /^send$/i;
```

**Routing order** (critical — check new commands BEFORE the edit catch-all):

```
1. APPROVAL_PATTERN (YES/Y/APPROVE/OK)   → handleApproval()
2. EDIT_ID_PATTERN (#42: instructions)    → handleEdit(id, body)
3. SKIP_PATTERN                           → handleFollowUpSkip()
4. FOLLOWUP_SEND_PATTERN                  → handleFollowUpSend()
5. Catch-all: treat as edit instructions  → handleEdit(null, body)
```

SKIP and SEND must come after EDIT_ID but before the catch-all. The `$` anchors prevent "skip this one" or "send me details" from matching.

**Lead resolver for follow-up commands:** Query `WHERE follow_up_status = 'sent' ORDER BY updated_at DESC LIMIT 1` to find the most recent lead awaiting Alex's response. Inline the query — no separate `resolveFollowUpLead()` function needed.

**SEND handler — explicit action sequence:**

```ts
async function handleFollowUpSend(): Promise<void> {
  // 1. Find most recent lead with follow_up_status = 'sent'
  const lead = /* inline query */;
  if (!lead) { await sendSms("No follow-up awaiting approval."); return; }

  // 2. Increment count and transition state
  const newCount = lead.follow_up_count + 1;
  if (newCount >= 3) {
    // Terminal — all 3 follow-ups done
    updateLead(lead.id, { follow_up_status: "exhausted", follow_up_count: newCount, follow_up_due_at: null });
    await sendSms(`✅ Follow-up #${newCount} for Lead #${lead.id} marked as sent. All 3 follow-ups complete.`);
  } else {
    // Schedule next follow-up
    const delay = computeFollowUpDelay(newCount);
    const dueAt = new Date(Date.now() + delay).toISOString();
    runTransaction(() => {
      updateLead(lead.id, { follow_up_status: "pending", follow_up_count: newCount, follow_up_due_at: dueAt });
    });
    await sendSms(`✅ Follow-up #${newCount} for Lead #${lead.id} marked as sent. Next follow-up scheduled.`);
  }
}
```

**SKIP handler:**

```ts
async function handleFollowUpSkip(): Promise<void> {
  // Find most recent lead with active follow-up
  const lead = /* inline query: follow_up_status IN ('pending', 'sent') ORDER BY updated_at DESC LIMIT 1 */;
  if (!lead) { await sendSms("No active follow-up to skip."); return; }

  updateLead(lead.id, { follow_up_status: "skipped", follow_up_due_at: null });
  await sendSms(`⏭ Follow-ups cancelled for Lead #${lead.id}.`);
}
```

SKIP is idempotent — if the lead is already skipped, silently succeed (per `docs/solutions/architecture/silent-failure-escape-hatches.md`).

**Collision scenario resolved:** A lead cannot simultaneously have `status = "sent"` (initial draft pending) AND active follow-ups. Follow-ups trigger on `status = "done"`, so `YES` (initial approve) and `SEND` (follow-up approve) are unambiguous.

---

### Phase 5: Reply Detection *(V2 — defer until real email samples collected)*

**Files:** `src/email-parser.ts`, `src/webhook.ts`

This is the riskiest layer (see brainstorm Feed-Forward). Implementation requires real email samples.

**Step 1: Collect real email samples (BEFORE writing code).**

Manually trigger replies on GigSalad and The Bash test accounts. Forward reply notification emails to a test Mailgun route. Save raw email bodies as test fixtures in `tests/fixtures/`.

**Step 2: Extend email parser.**

Add a `kind` discriminant to `ParseResult`:

```ts
export type ParseResult =
  | { ok: true; kind: "lead"; lead: ParsedLead }
  | { ok: true; kind: "reply"; reply: ParsedReply }
  | { ok: false; reason: "skip" | "parse_error"; detail: string };
```

**Breaking change:** Adding `kind: "lead"` requires updating `parseGigSalad()`, `parseTheBash()`, `webhook.ts` (line 92: `result.lead` → narrow by `result.kind === 'lead'`), and `src/email-parser.test.ts` (all `result.lead` accesses). Ship atomically.

**Prerequisite:** `client_name` must be populated first. Currently never stored. Cheapest fix: add regex extraction to email parsers in Phase 1 (GigSalad: `(.+?) would like a quote for`). Unblocks Phase 5 without schema changes.

> **Warning:** Current parser skips ALL `noreply@gigsalad.com` emails (`email-parser.ts:19-21`). If reply notifications come from that address, they will be silently dropped. Verify with real samples.

**Reply-to-lead matching:** Prefer `external_id` (exact match) when available. Fall back to `(client_name + source_platform)` with recency bias + 30-day window.

---

### Phase 6: Dashboard Tab *(V2 — SMS controls are sufficient for V1)*

**Files:** `public/dashboard.html`, `src/api.ts`

**V1:** Follow-up status visible in existing leads table (no new tab). The `LeadApiResponse` already includes follow-up fields (added in Phase 1).

> **V2:** New "Follow-Ups" tab with status badges, SNOOZE/SKIP controls. Rate limiters on new mutation endpoints (match `approveLimiter` pattern).

---

## System-Wide Impact

- **Interaction graph**: Scheduler fires every 15 min → picks up `pending` leads → generates AI draft → stores draft in DB → SMS to Alex → Alex replies SEND → count++, schedule next (or exhausted). Alex replies SKIP → cancelled.
- **Error propagation**: Follow-up failures stay within the scheduler's per-lead catch block. They do NOT affect the main pipeline. `follow_up_status` and `status` are independent fields that never cross-contaminate.
- **State lifecycle risks**: With no `sending` state, there are no stuck leads. If the server crashes mid-generation, the lead is still `pending` and retries next cycle. The only state that "waits" is `sent` (awaiting Alex's SEND/SKIP). If Alex never responds, the lead stays `sent` indefinitely — acceptable for V1 (Alex monitors his SMS).
- **API surface parity**: `completeApproval()` handles both Twilio and dashboard approval paths. SKIP/SEND mutations are direct `updateLead()` calls in the webhook handler.
- **Kill switch**: `DISABLE_FOLLOW_UPS=true` env var skips scheduler processing. Settable in Railway dashboard without code deploy. Note: when re-enabling, overdue `pending` leads will process in the next cycle (burst). Consider clearing stale leads if disabled for extended periods.

## Acceptance Criteria

### Phase 1: Schema + Types
- [x] 4 new columns added via existing migration pattern in `initDb()`: `follow_up_status`, `follow_up_count`, `follow_up_due_at`, `follow_up_draft`
- [x] CHECK constraint: `follow_up_status IN ('pending','sent','skipped','exhausted')`
- [x] `FOLLOW_UP_STATUSES` const array + `FollowUpStatus` union type in `src/types.ts`
- [x] `LeadRecord` extended with new fields using `T | null` (not `?:`)
- [x] `LeadApiResponse` extended and `shapeLead()` updated to include follow-up fields
- [x] ALL new columns in `UPDATE_ALLOWED_COLUMNS` whitelist
- [x] `getLeadsDueForFollowUp(): LeadRecord[]` helper in `src/leads.ts`
- [x] `scheduleFollowUp(leadId: number, dueAt: string): void` helper in `src/leads.ts`
- [x] `completeApproval(leadId, doneReason)` shared function wrapping `updateLead(status: "done")` + `scheduleFollowUp()` in a transaction
- [x] `handleApproval()` in `twilio-webhook.ts` refactored to use `completeApproval()`
- [x] `POST /api/leads/:id/approve` in `api.ts` refactored to use `completeApproval()`
- [x] `computeFollowUpDelay(followUpCount: number): number` pure function returning milliseconds
- [x] Follow-up timing starts from the moment of approval, regardless of approval channel
- [x] State transition table documented as code comment in `src/leads.ts`

### Phase 2: Scheduler
- [ ] `setTimeout` chaining (NOT `setInterval`) runs every 15 minutes
- [ ] Runs once immediately on startup (catch up from downtime)
- [ ] `DISABLE_FOLLOW_UPS` env var check (kill switch)
- [ ] Sequential processing with `LIMIT 10` query
- [ ] Per-lead error handling: if generation fails, leave as `pending`, log, continue
- [ ] Max 3 follow-ups enforced (via `follow_up_count` check)
- [ ] Graceful shutdown: `process.on("SIGTERM")` clears timeout
- [ ] Heartbeat logging: `[scheduler] heartbeat` every cycle
- [ ] Draft stored in `follow_up_draft` column BEFORE sending SMS to Alex
- [ ] Status set to `sent` AFTER SMS sent to Alex

### Phase 3+4: Draft Generator + SMS Commands *(deploy together)*
- [ ] `buildFollowUpPrompt()` generates value-add nudges (not "checking in")
- [ ] Each follow-up adds something new (song, testimonial, urgency)
- [ ] Follow-up prompt tested against 4 existing test leads BEFORE building SMS flow
- [ ] Follow-up SMS format has `📋 Follow-up #N` header (distinct from initial drafts)
- [ ] Follow-up SMS includes "Reply SEND to send, SKIP to cancel all follow-ups."
- [ ] SEND handler: increments count, schedules next follow-up (or sets exhausted), sends confirmation SMS
- [ ] SKIP handler: sets `follow_up_status = 'skipped'`, `follow_up_due_at = null`, sends confirmation SMS
- [ ] SKIP is idempotent (already-skipped leads silently succeed)
- [ ] Regex routing order: APPROVAL → EDIT_ID → SKIP → SEND → catch-all edit
- [ ] Existing YES/edit commands unaffected

### Phase 5: Reply Detection *(V2)*
- [ ] Real email samples collected and saved as test fixtures BEFORE coding
- [ ] `client_name` extraction added to email parsers
- [ ] `ParseResult` uses `kind: "lead" | "reply"` discriminant
- [ ] Callers updated atomically: `webhook.ts` (line 92), `email-parser.test.ts`
- [ ] Reply matched to lead by `external_id` first, then `(client_name + platform)` with 30-day window
- [ ] Unmatched replies logged but don't cancel anything (safe default)

### Phase 6: Dashboard *(V2)*
- [ ] V1: follow_up_status visible in existing leads table via updated `shapeLead()`
- [ ] V2: Follow-Ups tab with SNOOZE/SKIP controls, rate limiters on new endpoints

## Dependencies & Risks

| Risk | Mitigation | Source |
|---|---|---|
| **Follow-up trigger on wrong status** | `completeApproval()` schedules after `status = "done"`, NOT in `postPipeline()` | Spec flow analyzer |
| **No delivery mechanism** | V1: ALL follow-ups are SMS drafts to Alex. Direct sends are V2. | Architecture strategist |
| **Prompt quality unproven** | V1: No auto-send. All follow-ups go through SMS approval. | Plan Feed-Forward |
| **Draft lost on restart** | `follow_up_draft` column stores text. Re-generation is harmless (lead still `pending`). | Architecture strategist, spec flow analyzer |
| **Overlapping scheduler cycles** | `setTimeout` chaining — impossible to overlap by design | Pattern recognition |
| **Alex never responds to SEND/SKIP** | Lead stays `sent` indefinitely. Acceptable for V1 — Alex monitors SMS. V2 could add auto-SKIP after 48h. | Spec flow analyzer |
| **`client_name` not populated** | Add regex extraction to email parsers in Phase 1 (cheap). Required for Phase 5. | Spec flow analyzer |
| **Email reply patterns ambiguous** | Collect real samples first (Phase 5 Step 1). Ship V1 without reply detection. | Plan Feed-Forward |
| **GigSalad `noreply@` skip conflict** | Current parser skips all `noreply@gigsalad.com`. Verify with real samples before Phase 5. | Deployment verification |
| **SKIP cancels ALL follow-ups** | V1 limitation documented. V2 could add NEXT command. | Spec flow analyzer |
| **Follow-up annoys client** | Max 3 hard cap. SKIP command. Value-add tone. Alex reviews every message. | Best practices researcher |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-26-follow-up-pipeline-brainstorm.md](docs/brainstorms/2026-02-26-follow-up-pipeline-brainstorm.md) — Key decisions: separate `follow_up_status` field, in-process scheduler for V1, value-add nudge tone

### Internal References

- Atomic claim pattern: `src/leads.ts:212-219` (`claimLeadForSending`)
- Constants at boundary: `docs/solutions/logic-errors/constants-at-the-boundary.md`
- Nullable types: `docs/solutions/logic-errors/required-nullable-vs-optional-types.md`
- Fire-and-forget timeout: `docs/solutions/architecture/fire-and-forget-timeout.md`
- Silent failure escape hatches: `docs/solutions/architecture/silent-failure-escape-hatches.md`
- Hybrid LLM + deterministic: `docs/solutions/architecture/hybrid-llm-deterministic-computation.md`
- Testable constraints: `docs/solutions/prompt-engineering/testable-constraints-for-prompt-compliance.md`
- Migration pattern: `src/leads.ts:58-78`
- Twilio webhook commands: `src/twilio-webhook.ts:12-15`
- Approval handler: `src/twilio-webhook.ts` `handleApproval()`
- Dashboard approve: `src/api.ts` `POST /api/leads/:id/approve`
- Server startup: `src/server.ts:54` (scheduler starts here)

### Review Agents

| Agent | Key Findings |
|---|---|
| TypeScript reviewer | `as const` pattern correct; return types needed on helpers; routing order critical; `ParseResult` callers must be enumerated for Phase 5 |
| Code simplicity reviewer | Remove `sending` state; drop `follow_up_sent_at`; 2 helpers not 5; no business-hours gate V1; no ID suffix V1 |
| Architecture strategist | Draft needs storage column; `completeApproval()` shared function; `sent` state was phantom in transaction; Phases 3+4 deploy together |
| Spec flow analyzer | SEND action undefined (now fixed); draft not stored (now fixed); timing delta from brainstorm (24h vs 48h); SKIP is all-or-nothing |

## Deploy Order

| Deploy | Phases | Risk | Post-deploy check |
|---|---|---|---|
| 1 | Phase 1: Schema + Types | Low | Verify columns exist, existing pipeline still works, both approval paths use `completeApproval()` |
| 2 | Phase 2: Scheduler | Medium | Watch 24h. Verify `[scheduler] heartbeat` logs every 15 min. Check `DISABLE_FOLLOW_UPS` works. |
| 3 | Phase 3+4: Generator + SMS commands | Medium | Monitor first few drafts via SMS. Test SEND + SKIP. Verify existing YES/edit commands unaffected. |
| Later | Phase 5: Reply detection | High | Requires real email samples first |
| Later | Phase 6: Dashboard tab | Low | UI only |

**Rollback:** Set `DISABLE_FOLLOW_UPS=true` in Railway env vars (no deploy needed, ~30 seconds). For full rollback: redeploy previous commit from Railway dashboard. New columns stay in SQLite (harmless — old code ignores them).

## Three Questions

1. **Hardest decision in this session?** Whether to keep the `sending` state and atomic claim pattern, or remove them based on the simplicity reviewer's insight that human-in-the-loop eliminates the race condition they protect against. Decided to remove `sending` — with Alex approving every follow-up, there is no concurrent race. This cut the state machine from 5 states / 8 transitions to 4 states / 6 transitions, eliminated stale recovery, and removed 3 unnecessary DB helper functions.

2. **What did you reject, and why?** Rejected the simplicity reviewer's suggestion to also remove `exhausted` (using `follow_up_count >= 3` instead). For a beginner developer, having to check multiple columns to determine terminal state is MORE complex than a single `exhausted` state. Also rejected removing `follow_up_draft` column (simplicity reviewer didn't flag this, but the architecture and spec flow reviewers both identified it as a gap). Draft storage is essential — without it, the SEND handler can't verify what was approved.

3. **Least confident about going into the next phase?** Follow-up prompt quality — same as the previous plan iteration. The simplified V1 (no verify gate, all-SMS-approval) is the correct safety net, but if the prompt consistently produces generic or tone-deaf follow-ups, Alex will SKIP most of them and the feature delivers no value. The work phase should test the follow-up prompt against the 4 existing test leads early in Phase 3 before building the SMS flow.

## Feed-Forward

- **Hardest decision:** Removing `sending` state + atomic claim infrastructure — defensive patterns that protect against problems that can't happen with human-in-the-loop
- **Rejected alternatives:** Removing `exhausted` state (multi-column checks harder for beginners), keeping 5 helper functions (4 were one-line wrappers)
- **Least confident:** Follow-up prompt quality — if drafts consistently need heavy editing, SMS approval becomes a bottleneck instead of a safety net
