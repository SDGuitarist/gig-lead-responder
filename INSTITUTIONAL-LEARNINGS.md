# Institutional Learnings

Living document of patterns and lessons learned across features. Each feature gets its own H2 section. New features append below using the [template](#template-for-new-features) at the bottom.

**Source:** `docs/solutions/` — patterns extracted from documented solutions.

---

## Top 10 Patterns

Patterns that recur across features or prevent entire categories of bugs. Search these first when starting a new feature.

| # | Pattern | Source | Solution File |
|---|---------|--------|---------------|
| 1 | Atomic claim for concurrent state transitions — conditional UPDATE with WHERE clause, not read-check-write | Follow-Up Pipeline | `atomic-claim-for-concurrent-state-transitions.md` |
| 2 | Fire-and-forget timeout — `Promise.race` wraps any async work that could hang | Follow-Up Pipeline | `fire-and-forget-timeout.md` |
| 3 | No-op gut checks — conditional checks return "Always true" when inactive, never omitted | Follow-Up Pipeline | `noop-gut-checks-conditional-features.md` |
| 4 | Async work before DB write — Twilio/Mailgun call first, single `updateLead()` after | Follow-Up Pipeline | `async-sqlite-transaction-boundary.md` |
| 5 | Guard inside the function, not at call site — `if (btn.disabled) return` at top of handler | Follow-Up Pipeline | `rate-limiting-race-condition-and-cleanup.md` |
| 6 | Constants at module boundaries — `FOLLOW_UP_STATUSES` array in `src/types.ts`, import everywhere | Follow-Up Pipeline | `constants-at-the-boundary.md` |
| 7 | Align derived-stat queries on same WHERE scope — CTE for base population | Follow-Up Pipeline | `align-derived-stat-queries.md` |
| 8 | Hybrid LLM + deterministic computation — LLM writes message, code chooses channel/urgency | Follow-Up Pipeline | `hybrid-llm-deterministic-computation.md` |
| 9 | Silent failure escape hatches — `DISABLE_{SERVICE}_VALIDATION` env var for first-deploy debugging | Follow-Up Pipeline | `silent-failure-escape-hatches.md` |
| 10 | `today` injected as parameter, never `new Date()` inside functions — makes functions pure/testable, prevents timezone bugs | Follow-Up Pipeline | `today-as-parameter-timezone.md` |

---

## Follow-Up Pipeline

**Date:** 2026-02-26
**Feature:** Follow-up pipeline with state machine, scheduler, AI-generated drafts, SMS commands, email reply detection, and dashboard
**Search scope:** `docs/solutions/` — all 22 documented files scanned, 8 highly relevant matches found

### Search Context

**Feature Overview:**
- SQLite schema columns with state machine (`follow_up_status` with 7 states)
- `setInterval` scheduler (every 15 min)
- AI-generated follow-up drafts with a verify gate
- Twilio SMS command parsing (`SKIP`/`SNOOZE`/`YES-FU`)
- Mailgun email reply detection
- Express dashboard tab with follow-up queue

**Key Technologies:**
- TypeScript, SQLite (better-sqlite3), Express, Twilio, Mailgun, Claude API

**Key Patterns Used:**
- Atomic claim for concurrent state transitions
- Fire-and-forget timeout with `Promise.race`
- No-op gut checks for conditional features
- Async work outside SQLite transactions
- Guard-inside-function (not at call site) for reentrancy
- Constants at module boundaries for state enums
- Derived stat queries aligned on same WHERE scope

---

### Quick Reference: Learning to Implementation Phase Mapping

| Learning | Applies To Phases | Key Action | File |
|----------|-------------------|------------|------|
| Atomic Claim for Concurrent State Transitions | 1-4 (all phases with status updates) | Use conditional UPDATE with WHERE clause to prevent double-sends | atomic-claim-for-concurrent-state-transitions.md |
| Fire-and-Forget Pipeline Timeout | 2-3 (scheduler + generation) | Wrap `generateFollowUp()` in `Promise.race` with 2-min timeout | fire-and-forget-timeout.md |
| No-Op Gut Checks for Conditional Features | 3 (follow-up verify gate) | Design smaller gate (~10-12 checks), always present, conditionally true | noop-gut-checks-conditional-features.md |
| Async Work Inside SQLite Transactions | 4 (SMS send + status update) | Do Twilio send first, then single atomic `updateLead()` call | async-sqlite-transaction-boundary.md |
| Reentrancy Guard (Keyboard Re-entry) | 6 (dashboard buttons) | Add `if (btn.disabled) return` inside snooze/skip/approve handlers | rate-limiting-race-condition-and-cleanup.md |
| Constants at Module Boundaries | 1 (schema + types) | Define `FOLLOW_UP_STATUSES` array once in `src/types.ts`, import everywhere | constants-at-the-boundary.md |
| Align Derived-Stat Queries | 6 (dashboard analytics) | Define base WHERE clause once (e.g., `follow_up_status IS NOT NULL`), reference in all queries | align-derived-stat-queries.md |
| Hybrid LLM + Deterministic Computation | 3 (follow-up generation) | LLM writes message, code chooses channel/urgency/retry-date | hybrid-llm-deterministic-computation.md |

---

### Highly Relevant Learnings

### 1. Atomic Claim for Concurrent State Transitions
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`

**Module:** leads
**Problem Type:** race-condition, concurrency, state-machine
**Severity:** critical
**Relevance:** The follow-up state machine will have 7 states (`pending`, `due`, `sending`, `sent`, `replied`, `skipped`, `snoozed`). The scheduler and dashboard may attempt concurrent transitions (e.g., scheduler marks a lead `due` while the user is manually snooping). This pattern prevents double-sends of follow-up SMS and ensures state coherence.

**Key Insight:**
Replace read-check-write sequences with a **single atomic SQL UPDATE with WHERE clause**. The `claimFollowUpForSending()` function must use the same approach:
```ts
function claimFollowUpForSending(id: number): boolean {
  const result = db.prepare(
    "UPDATE leads SET follow_up_status = 'sending' WHERE id = ? AND follow_up_status IN ('due', 'pending')"
  ).run(id);
  return result.changes > 0;
}
```

**Design Lessons:**
- Transitional statuses (`sending`) make concurrent claims visible in the UI (dashboard badge shows "Sending follow-up...")
- Dedicated function `claimFollowUpForSending()` instead of bolting a conditional WHERE onto generic `updateLead()` — the atomic guard is specific to the follow-up flow
- Revert to previous status on failure: `updateLead(id, { follow_up_status: lead.follow_up_status })`
- Name the pattern explicitly: `claim*` communicates intent better than `updateIf*`

**Prevention for This Build:**
- Any time a status check guards a side effect (send SMS, send email, trigger generation), the check and the status change must be atomic
- Use conditional UPDATE with WHERE clause, or wrap in SQLite transaction with `SELECT ... FOR UPDATE` (better-sqlite3 is single-writer, so conditional UPDATE is simpler)

---

### 2. Fire-and-Forget Pipeline Timeout
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/fire-and-forget-timeout.md`

**Module:** scheduler, generation
**Problem Type:** resilience, async, timeout
**Severity:** high
**Relevance:** The follow-up scheduler kicks off async follow-up draft generation (Claude API calls) without waiting for the result. If the generation hangs, the promise holds memory forever. Multiple hung pipelines cause unbounded memory growth.

**Key Insight:**
Wrap fire-and-forget promises in `Promise.race` with a timeout:
```ts
const FOLLOW_UP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Follow-up generation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// In scheduler:
withTimeout(generateFollowUp(lead), FOLLOW_UP_TIMEOUT_MS)
  .then((draft) => updateLeadWithFollowUp(draft))
  .catch((err) => markFollowUpFailed(leadId, err));
```

**Timeout Sizing:**
- Follow-up generation makes 2-3 Claude API calls (fewer than initial generation)
- Each call has ~30s timeout
- Worst case: 3 x 30s = 90s
- Add 20% headroom → 108s ≈ 2 minutes
- **This is tight enough to catch real hangs but loose enough to not kill slow-but-working runs.**

**What the Timeout Does:**
- Rejects promise → triggers `markFollowUpFailed()` → sets `follow_up_status = 'failed'` → sends alert SMS
- Memory is freed when promise chain settles

**What It Does NOT Cover:**
- **Process crash between follow-up schedule insert and generation start** — the lead is in DB with `follow_up_status = 'due'`, but no promise exists to race. **Fix:** The scheduler's main loop is a `setInterval` that runs every 15 minutes. If the process crashes and restarts, the next cycle will catch the orphaned follow-up and retry.
- **OOM kill or Railway restart** — Similar issue. **Same fix:** The periodic scheduler loop is the safety net.

**Complementary Pattern:**
`Promise.race` (timeout) catches hangs while the process is alive. The `setInterval` scheduler (Phase 2) catches crashes. These are not alternatives — use both.

---

### 3. No-Op Gut Checks for Conditional Verification Features
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/noop-gut-checks-conditional-features.md`

**Module:** src/prompts/verify.ts, src/types.ts
**Problem Type:** verification-design, conditional-features, type-stability
**Severity:** high
**Relevance:** The follow-up pipeline will use a **separate verify gate for follow-up drafts** (per brainstorm: they have different structure than initial pitches). The verify gate may have conditional checks that only apply to certain leads: some follow-ups target budget concerns, others target timing objections, others validate cultural fit. This pattern prevents threshold math breakage and type proliferation.

**Key Insight:**
When a check only applies to certain leads (e.g., `budget_rebuttal_specific` only when budget was a concern), do NOT omit it from the check list. Instead, return `"Always true — [reason]."` when the feature is inactive:

```ts
function buildBudgetRebuttalInstruction(classification: Classification): string {
  if (!classification.is_budget_concern) {
    return "Always true — budget was not a stated concern.";
  }
  return "Follow-up must address the specific price point mentioned...";
}
```

**Why This Works:**
1. **Check count stays stable** — `Object.keys(checks).length` always returns the same number (e.g., 12 for follow-up gate). Results are comparable across leads.
2. **Threshold math is simple** — One threshold works for all leads. Adding a new feature adds one number to update (`GUT_CHECK_TOTAL`, `GUT_CHECK_THRESHOLD`), not a matrix of combinations.
3. **`GateResult` interface stays fixed** — All keys always present with no optional fields. No null checks at call sites.
4. **LLM always sees 14 checks** — A consistent JSON schema produces more consistent JSON. Variable-length check lists are a source of parse failures.

**Follow-Up Specific Application:**
- Design a separate `FollowUpGateResult` with ~10-12 checks (smaller than initial generate gate's 14)
- Make the threshold `FOLLOW_UP_THRESHOLD = FOLLOW_UP_TOTAL - 2` (same margin as initial gate)
- When a follow-up is targeted (e.g., for a budget lead), some checks activate, others become no-ops
- **Never make a check optional in the interface.** Always present, always evaluated, sometimes trivially true.

---

### 4. Async Work Inside SQLite Transactions
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/database-issues/async-sqlite-transaction-boundary.md`

**Module:** database, async, transactions
**Problem Type:** data-integrity
**Severity:** high
**Relevance:** The follow-up pipeline needs to send SMS (async Twilio API) and update the lead's `follow_up_status` atomically. The natural instinct is to wrap both in a `better-sqlite3` transaction. But `better-sqlite3` is synchronous; you can't `await` inside `db.transaction()`.

**Key Insight:**
Do the async work first, then do all DB writes in one call:

```ts
async function sendFollowUpAndUpdate(leadId: number, draftText: string) {
  // 1. Async work FIRST (outside any transaction)
  await sendSms(draftText);

  // 2. ALL DB writes in one synchronous updateLead call
  updateLead(leadId, {
    follow_up_status: "sent",
    follow_up_sent_at: new Date().toISOString(),
    follow_up_draft: draftText,
  });
}
```

**Why This Works:**
A single `UPDATE ... SET col1=?, col2=?, ...` statement is inherently atomic in SQLite. No transaction wrapper needed.

**Failure Modes (Safe):**
- SMS fails → no DB write → `follow_up_status` stays `'sending'` → stuck-lead sweep (or scheduler retry loop) catches it
- SMS succeeds, DB fails → SMS sent but status not marked → sweep re-processes (idempotent if dedup is in place)
- Both succeed → happy path

**Reusable Pattern:**
1. Do all async/external calls first (HTTP, SMS, email)
2. Collect results in memory
3. Write everything to the DB in a single statement or synchronous transaction
4. A single SQL UPDATE is atomic — you don't need `BEGIN/COMMIT` for one statement
5. Design failure recovery around the gap between steps 1 and 3 (async succeeded, DB write hasn't happened yet)

---

### 5. Rate Limiting: Keyboard Re-entry Race + Code Cleanup
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/logic-errors/rate-limiting-race-condition-and-cleanup.md`

**Module:** reentrancy, race-condition, state-management
**Problem Type:** race-condition, logic-error
**Severity:** P1
**Relevance:** The dashboard will have snooze/skip buttons for follow-ups. Users may click multiple times rapidly or use keyboard shortcuts. The action handlers must guard against reentrancy **inside the function**, not at the call site. This pattern prevents double-sends when multiple entry paths exist.

**Key Insight:**
**Guard Inside the Function, Not at the Call Site.**

If a function can be called from multiple paths (button click, keyboard event, future programmatic calls), the function must be its own gatekeeper:

```js
function snoozeFollowUp() {
  var leadId = document.getElementById('selectedLeadId').value.trim();
  if (!leadId) return;

  var btn = document.getElementById('snoozeBtn');
  if (btn.disabled) return;  // GUARD INSIDE THE FUNCTION
  btn.disabled = true;

  // ... make the request
}
```

All entry paths (click, keyboard, future programmatic) now respect the in-flight flag. Without this, a Ctrl+S keyboard shortcut could bypass the button's disabled state.

**Prevention Strategies:**
1. **Guard inside the function** — Use existing state (disabled flag, lock variable) as the guard
2. **Verify handler signatures** — When using a handler callback with an external library, check the `.d.ts` file for the exact parameter count
3. **Use `.finally()` for unconditional cleanup** — If cleanup must run regardless of success or failure, never use `.then()` after `.catch()`. Use `.finally()` instead.
4. **Delete dead code** — If a handler always returns one content type, remove the fallback branch for other types. Dead code misleads future readers and causes variable shadowing.

**For Follow-Up Dashboard:**
- `snoozeFollowUp()`, `skipFollowUp()`, `approveFollowUp()` must all check `if (button.disabled) return` at the start
- These buttons may be triggered by click, keyboard shortcut (Ctrl+S), or future voice command
- The button's disabled state is the guard. The function respects it.

---

### 6. Extract Constants at Module Boundaries
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/logic-errors/constants-at-the-boundary.md`

**Module:** types
**Problem Type:** constants, magic-strings, threshold-drift
**Severity:** medium
**Relevance:** The follow-up state machine has 7 states: `'pending'`, `'due'`, `'sending'`, `'sent'`, `'replied'`, `'skipped'`, `'snoozed'`. These strings will appear in TypeScript types, SQL CHECK constraints, runtime validation sets, and dashboard logic. A typo in any one place silently breaks matching.

**Key Insight:**
Export named constants from `src/types.ts` where the enum values originate:

```ts
// src/types.ts
export const FOLLOW_UP_STATUSES = [
  "pending", "due", "sending", "sent", "replied", "skipped", "snoozed"
] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

// Derived runtime validation set:
export const VALID_FOLLOW_UP_STATUSES = new Set<FollowUpStatus>(FOLLOW_UP_STATUSES);
```

Every file that references follow-up status now imports from `src/types.ts`:

```ts
// src/leads.ts
if (!VALID_FOLLOW_UP_STATUSES.has(newStatus)) {
  throw new Error(`Invalid follow-up status: ${newStatus}`);
}

// src/follow-up-scheduler.ts
db.prepare(`
  UPDATE leads
  SET follow_up_status = 'due'
  WHERE follow_up_status = 'pending' AND follow_up_due_at <= ?
`).run(now);
```

**One Gap Remains:**
SQL CHECK constraints are string literals in migrations:
```sql
CHECK(follow_up_status IN ('pending','due','sending','sent','replied','skipped','snoozed'))
```

These can't import from TypeScript. Mark the dependency with a SYNC comment:
```sql
-- SYNC: FOLLOW_UP_STATUSES in src/types.ts
CHECK(follow_up_status IN ('pending','due','sending','sent','replied','skipped','snoozed'))
```

Human-enforced, not compiler-enforced. When adding a state, update both the TypeScript array AND the CHECK constraint.

**Prevention:**
- **Grep for repeated string literals** during code review: if the same string appears in 3+ files, extract it to a constant in `src/types.ts`
- **Co-locate counts with their source:** If a threshold depends on the length of a list, define both in the same file and derive arithmetically
- **Prompt text is code:** Numbers and identifiers inside template strings are just as susceptible to drift as any other hardcoded value

---

### 7. Align Derived-Stat Queries on the Same WHERE Scope
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/database-issues/align-derived-stat-queries.md`

**Module:** analytics, dashboard
**Problem Type:** database-issues, data-integrity
**Severity:** medium
**Relevance:** The follow-up pipeline dashboard will display follow-up queue stats: total pending, total due today, breakdown by channel, breakdown by urgency. If each query uses a different WHERE filter (`follow_up_status = 'due'` vs. `follow_up_status IN ('due', 'pending')`), the parts won't add up to the whole. Percentages will exceed 100% or show negative totals.

**Key Insight:**
When multiple queries feed derived stats in the same UI (totals, breakdowns, percentages), they must share the exact same base population:

```sql
-- Query 1: totals
SELECT COUNT(*) as total_leads,
       COUNT(CASE WHEN follow_up_status = 'sent' THEN 1 END) as sent,
       COUNT(CASE WHEN follow_up_status = 'replied' THEN 1 END) as replied
FROM leads WHERE follow_up_status IS NOT NULL;

-- Query 2: by channel
SELECT follow_up_channel, follow_up_status, COUNT(*) as count
FROM leads
WHERE follow_up_status IS NOT NULL
GROUP BY follow_up_channel, follow_up_status;

-- Query 3: by urgency
SELECT urgency_tier, follow_up_status, COUNT(*) as count
FROM leads
WHERE follow_up_status IS NOT NULL
GROUP BY urgency_tier, follow_up_status;
```

All three use `WHERE follow_up_status IS NOT NULL` as the base filter. Now `total_untracked = total_leads - total_sent - total_replied` is accurate.

**For Dashboard Implementation:**
Use a CTE (Common Table Expression) to define the base filter once:
```sql
WITH active_follow_ups AS (
  SELECT * FROM leads WHERE follow_up_status IS NOT NULL
)
SELECT COUNT(*) as total FROM active_follow_ups;
```

Then reference `active_follow_ups` in every derived-stat query.

---

### 8. Hybrid LLM Extraction with Deterministic Computation
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/hybrid-llm-deterministic-computation.md`

**Module:** pipeline, enrichment
**Problem Type:** llm, architecture
**Severity:** high
**Relevance:** The follow-up draft generation will use Claude to compose the message (fuzzy NLP) but must route urgency, channels, and retry count deterministically. E.g., "This is a 2nd follow-up via SMS" must be enforced by code, not by trusting the LLM to count correctly.

**Key Insight:**
**Division of labor:** LLM does fuzzy extraction (NLP, intent parsing). Deterministic code does precise computation (date math, enumerations, hard constraints).

Example for follow-ups:

```ts
// LLM extracts: the value-add message body
// Code computes: which channel, which urgency tier, how many retries

async function generateFollowUp(lead: LeadRecord): Promise<FollowUpDraft> {
  // 1. LLM extracts the message body (fuzzy)
  const classifier = await classifyFollowUp(lead);

  // 2. Code computes routing (deterministic)
  const urgency = computeUrgency(lead.event_date, today); // <2 weeks = "urgent"
  const channel = selectChannel(lead.client_phone, lead.client_email, lead.follow_up_count); // SMS if available, else email
  const nextRetryDate = computeNextRetryDate(lead.event_date, lead.follow_up_count, urgency);

  // 3. Enrichment layer applies deterministic overrides
  return enrichFollowUpDraft({
    message: classifier.draft_body,
    urgency,
    channel,
    nextRetryDate,
    followUpCount: lead.follow_up_count + 1,
  });
}
```

**Architecture Boundary:**
An `enrichFollowUpDraft()` function takes raw LLM output and applies deterministic overrides before anything downstream sees the draft.

**Key Design Properties:**
- Enrichment is a **pure function** — signature: `(draft, urgency, channel, today)`. Fully unit-testable.
- The `today` parameter is injected from the call site, never read from `new Date()` inside the function.
- Enrichment runs **after** classify/generate and **before** verification/sending.
- Downstream functions see only the enriched draft — they never know what the raw LLM output was.

**Pattern Checklist:**
1. Add an extraction field to the **follow-up prompt** — LLM normalizes the value
2. Add deterministic logic to **`enrichFollowUpDraft()`** — code computes the derived fact
3. Never put the computation in the prompt (e.g., "count how many follow-ups to send")
4. If enrichment changes a value that routing depends on, re-apply routing after enrichment

---

### 9. Silent Failure Escape Hatches
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/silent-failure-escape-hatches.md`

**Module:** webhooks, validation
**Problem Type:** deployment, debugging
**Severity:** medium
**Relevance:** The follow-up pipeline integrates with Mailgun (email reply detection) and Twilio (SMS commands). Both require webhook signature validation. On first deploy, you often have the wrong key or wrong URL. You need to debug, but signature validation returns 401 silently with no error body.

**Key Insight:**
A `DISABLE_{SERVICE}_VALIDATION` env var pattern with three guardrails:

```ts
// 1. Check the bypass BEFORE checking for missing fields
if (process.env.DISABLE_MAILGUN_VALIDATION === "true") {
  console.warn("[WARN] Mailgun validation disabled");
  // Proceed to handler (skip signature check, keep business logic)
}
// 2. Missing fields still rejected (partial security)
if (!timestamp || !token || !signature) return res.status(401).end();
// 3. Normal HMAC check
```

**Key Details:**
- The bypass skips cryptographic verification but does NOT skip the handler's business logic (dedup, parsing, DB write). You're testing the real path, just without the signature gate.
- Log a warning on every bypassed request AND once at startup so it's visible in deployment logs.
- Only check `=== "true"` (not truthy — avoid accidental activation)
- Don't set the var in `.env.example` production defaults
- Consider a `DISABLE_UNTIL` timestamp variant for auto-revert:
  ```ts
  const until = process.env.DISABLE_MAILGUN_VALIDATION_UNTIL;
  if (until && Date.now() < new Date(until).getTime()) { /* bypass */ }
  ```

**When NOT to Use:**
Don't use for auth endpoints (login, API keys). A bypass on an auth endpoint is a backdoor. This pattern is only safe for third-party webhook signature validation where the only risk is fabricated inbound payloads, not unauthorized access.

**For Follow-Up Pipeline:**
Add `DISABLE_TWILIO_VALIDATION` and `DISABLE_MAILGUN_VALIDATION` to `src/webhooks/twilio.ts` and `src/webhooks/mailgun.ts` for first-deploy debugging.

---

### Recommendations

### Must-Do Before Implementation

1. **Define `FOLLOW_UP_STATUSES` constant array in `src/types.ts`** (Learning #6)
   - All 7 states: `pending`, `due`, `sending`, `sent`, `replied`, `skipped`, `snoozed`
   - Derive runtime validation set from this single source
   - Add SYNC comment to SQL CHECK constraint

2. **Design the follow-up verify gate as a separate, smaller gate** (Learning #3)
   - Estimate 10-12 checks (smaller than initial generate's 14)
   - Add all checks unconditionally (no optional fields)
   - Make conditional checks return `"Always true — [reason]."` when inactive
   - Set threshold as `FOLLOW_UP_THRESHOLD = FOLLOW_UP_TOTAL - 2`

3. **Plan for atomic follow-up status transitions** (Learning #1)
   - Create `claimFollowUpForSending(leadId)` function
   - Uses conditional UPDATE: `UPDATE leads SET follow_up_status = 'sending' WHERE id = ? AND follow_up_status IN ('due', 'pending')`
   - Check `result.changes > 0` to detect concurrent claims

4. **Implement `Promise.race` timeout wrapper** (Learning #2)
   - 2-minute timeout for follow-up generation (3 Claude API calls max)
   - Wrap scheduler's `generateFollowUp()` call
   - On timeout, mark `follow_up_status = 'failed'` and alert

5. **Verify async-DB boundary in follow-up send flow** (Learning #4)
   - Do Twilio SMS send first (outside any transaction)
   - Then update all DB fields in one synchronous `updateLead()` call
   - Design recovery around the gap: if SMS succeeds but DB fails, the scheduler's next cycle will retry

### Patterns to Follow Throughout

- **Reentrancy guards inside functions, not at call sites** (Learning #5) — Dashboard buttons for snooze/skip/approve must check their own disabled state
- **All dashboard queries on same WHERE scope** (Learning #7) — If showing follow-up totals and breakdowns, define the base population once (e.g., `follow_up_status IS NOT NULL`), then reference it in all derived-stat queries
- **Deterministic code for enumerations and routing** (Learning #8) — Let Claude write the message body, let code choose the channel, retry count, and urgency tier
- **Debug escapes for webhook validation** (Learning #9) — Add `DISABLE_TWILIO_VALIDATION` and `DISABLE_MAILGUN_VALIDATION` env vars for first-deploy iteration

---

### Risk Areas to Watch

1. **Scheduler + Dashboard Race:** The scheduler marks leads `due`, the dashboard may display them concurrently. The atomic claim pattern prevents double-send, but the dashboard UI should reflect in-flight status with a transitional `'sending'` badge.

2. **Follow-Up Verify Gate Threshold:** If the gate is too strict (e.g., 11/12), follow-ups fail frequently and fall back to manual mode. If too loose (e.g., 9/12), low-quality follow-ups are sent. No perfect threshold — starts at `FOLLOW_UP_TOTAL - 2`, adjust based on production metrics.

3. **Email Reply Detection Edge Cases:** The Mailgun webhook must handle reply-to-reply chains, forwarded messages, and out-of-office auto-responses. Real email samples from GigSalad and The Bash needed before writing the parser (per plan's feed-forward risk).

4. **Snooze Timeout Logic:** A snoozed follow-up stays in `'snoozed'` status until `snoozed_until <= now`. The scheduler's `checkDueFollowUps()` must explicitly query for snoozed leads and un-snooze them (set `follow_up_status = 'pending'`, `follow_up_due_at = next-urgent-date`), or they remain invisible forever.

5. **SMS Rate Limiting:** The existing rate limiting (Learning #5 origin story) limits the main `/analyze` endpoint. Follow-ups send via Twilio on a background schedule — they bypass the rate limit. Consider adding a per-lead follow-up rate limit (e.g., max 3 follow-ups per 7 days) to avoid SMS spam.

---

### Files Searched

**Total files scanned:** 22
**Highly relevant matches:** 8
**Moderate matches (not detailed above):** 0
**No-match categories:** UI bugs (3), workflow (1)

### All Files in docs/solutions/

**Architecture (9 files):**
- atomic-claim-for-concurrent-state-transitions.md ✓ (HIGHLY RELEVANT)
- fire-and-forget-timeout.md ✓ (HIGHLY RELEVANT)
- noop-gut-checks-conditional-features.md ✓ (HIGHLY RELEVANT)
- escape-at-interpolation-site.md (XSS prevention — not directly relevant to follow-up pipeline)
- environment-aware-fatal-guards.md (Build-time validation — not relevant)
- hybrid-llm-deterministic-computation.md ✓ (HIGHLY RELEVANT)
- platform-policy-enforcement.md (Policy constraints — not relevant)
- silent-failure-escape-hatches.md ✓ (HIGHLY RELEVANT)

**Database Issues (2 files):**
- async-sqlite-transaction-boundary.md ✓ (HIGHLY RELEVANT)
- align-derived-stat-queries.md ✓ (HIGHLY RELEVANT)

**Logic Errors (5 files):**
- rate-limiting-race-condition-and-cleanup.md ✓ (HIGHLY RELEVANT)
- constants-at-the-boundary.md ✓ (HIGHLY RELEVANT)
- required-nullable-vs-optional-types.md (Type design — related to no-op checks learning but redundant)
- reprice-after-enrichment-override.md (Pricing — not relevant)
- today-as-parameter-timezone.md (Date handling — mentioned in hybrid LLM learning, not separately critical)

**Prompt Engineering (4 files):**
- contrastive-pair-vocabulary-enforcement.md (Vocabulary blocking — not relevant)
- sparse-lead-type-classification.md (Lead classification — not relevant to follow-ups)
- testable-constraints-for-prompt-compliance.md (Prompt testing — general pattern, covered by verify gate learning)
- prompt-placement-for-hard-constraints.md (Hard constraints in prompts — general pattern, covered by hybrid LLM learning)

**UI Bugs (2 files):**
- shallow-copy-for-preview-state.md (React state — not relevant)
- targeted-dom-toggle-data-attributes.md (DOM manipulation — not relevant)

**Workflow (1 file):**
- dead-code-env-var-collision.md (Env var management — not relevant)

---

### Summary

The follow-up pipeline is a multi-layer feature with concurrent state transitions, async work, verification gates, and webhook integrations. Eight documented solutions directly apply:

**Critical Patterns:**
1. **Atomic claims** prevent double-sends in concurrent state machines
2. **Promise.race timeouts** catch hangs in fire-and-forget scheduler pipelines
3. **No-op checks** prevent threshold math breakage in conditional gates

**Essential Data Integrity:**
4. **Async-before-DB** pattern guarantees correctness when mixing SQLite (sync) with external APIs (async)
5. **Derived-stat query alignment** ensures dashboard totals are accurate

**Code Reliability:**
6. **Constants at boundaries** prevent state enum typos across files
7. **Guard-inside-function** prevents reentrancy races in dashboard UI
8. **Debug escapes** enable first-deploy webhook validation without security holes

All eight learnings are directly applicable to Phases 1-6 of the plan. Implementing them early prevents silent data corruption, memory leaks, and concurrent state chaos.

---

## Template for New Features

Copy this template when adding learnings for a new feature. Paste it as a new H2 section above this template.

```markdown
## [Feature Name]

**Date:** YYYY-MM-DD
**Feature:** [One-line description]
**Search scope:** `docs/solutions/` — [N] files scanned, [M] highly relevant matches

### Search Context

**Feature Overview:**
- [Key components]

**Key Technologies:**
- [Languages, libraries, services]

**Key Patterns Used:**
- [List of patterns from docs/solutions/ that apply]

### Quick Reference: Learning to Implementation Phase Mapping

| Learning | Applies To | Key Action | File |
|----------|-----------|------------|------|
| [Pattern name] | [Which phases] | [What to do] | [solution file] |

### Highly Relevant Learnings

#### 1. [Pattern Name]
**File:** `docs/solutions/[category]/[filename].md`
**Relevance:** [Why this pattern matters for this feature]
**Key Insight:** [The actionable takeaway]

### Recommendations

1. [Must-do items before implementation]

### Risk Areas to Watch

1. [Known risks and edge cases]

### Summary

[2-3 sentence wrap-up of how learnings apply to this feature]
```

**When to add a new section:** Before implementing any feature that touches 3+ modules, involves concurrency, or integrates with external services. Run the `learnings-researcher` agent first, then capture the results here.
