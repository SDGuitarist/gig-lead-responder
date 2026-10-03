# Booking Hub Learnings Research

**Date:** 2026-10-02
**Query:** Auto-send safety, LLM verification gates, Gmail polling, Playwright automation, SMS/Twilio, SQLite/Postgres concurrency, schedulers, payment state machines, hold ladders, token portals, health checks, prompt injection, money handling

**Search Scope:** docs/solutions/ across 6 projects
- gig-lead-responder
- sandbox
- pacific-flow-hub
- pf-intel
- gigprep

---

## CRITICAL PATTERNS & ARCHITECTURE FOUNDATIONS

### 1. Atomic State Transitions for Payment & Lead Approval (CRITICAL)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`

**Key Insight:**
Race conditions in concurrent approval flows (SMS, payment confirmation) are TOCTOU (time-of-check-to-time-of-use) vulnerabilities. Multiple requests can both read status, both pass validation, and both execute side effects (double SMS, double invoice). Frontend button disabling is NOT sufficient.

**Solution Pattern:**
Use atomic database updates with conditional clauses:
```ts
// WRONG: three-step read-check-write
const lead = getLead(id);
if (lead.status !== "received" && lead.status !== "sent") return 409;
await sendSms(lead.compressed_draft);
updateLead(id, { status: "done" });

// RIGHT: atomic single UPDATE with status guard
const result = updateLead(id, 
  { status: "done" }, 
  { where: { id, status: ["received", "sent"] } }
);
if (result.rowsAffected === 0) return 409; // Another request won
```

**Applies To:** Deposit confirmation, payment matching, invoice finalization, SMS approval loop

---

### 2. Auto-Send Via Atomic Completion + Transaction Atomicity (CRITICAL)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/2026-05-31-gmail-intake-phase2-auto-send-done-reason.md`

**Key Insight:**
Auto-send replies must go through the SAME atomic completion path as manual approvals. If auto-send calls `updateLead()` while manual approvals call `completeApproval()`, auto-sent leads will silently miss the entire follow-up lifecycle — the business-critical feature — with no alert. Found during deployment (Phase 1 shipped review-only mode, Phase 2's naive flip of a flag revealed latent data-integrity bug).

**Solution Pattern:**
- Single entrypoint (`completeApproval()`) for all approval paths: manual SMS, auto-send, webhook-triggered
- Inside the function: atomically set status AND schedule follow-ups in one transaction
- Auto-send does NOT get a separate path with fewer guardrails
- `done_reason` column for audit trail: `"review-only: would-auto-send"` vs `"auto-sent via GigSalad"` vs `"approved via SMS"`

**Applies To:** All approval flows (confidence gate, SMS approval, Playwright auto-send from portals)

---

### 3. Async Pipeline Timeouts (Fire-and-Forget Safety)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/fire-and-forget-timeout.md`

**Key Insight:**
Webhook handlers that kick off async work and return 200 immediately can hang forever if the pipeline stalls (API timeout, network issue, infinite retry). Multiple hung promises = unbounded memory growth. The lead stays in `received` status with no alert.

**Solution Pattern:**
```ts
const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// In webhook handler:
withTimeout(runPipeline(payload), PIPELINE_TIMEOUT_MS)
  .then((output) => postPipeline(leadId, output))
  .catch((err) => {
    logger.error(`Pipeline failed: ${err.message}`);
    updateLead(leadId, { status: "failed_pipeline", error_log: err.message });
  });
```

**Applies To:** 
- Playwright portal auto-send (if browser navigation hangs)
- Payment matching from email parsing
- SMS polling timeouts
- Gmail polling with exponential backoff

---

### 4. Silent Failure Escape Hatches (Webhook & Validation Bypass)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/silent-failure-escape-hatches.md`

**Key Insight:**
Webhook signature validation (HMAC, Twilio, Gmail) is pass/fail with no error body. On first deploy, you often have the wrong key, wrong URL, or wrong header. You can't debug what you can't see. Removing validation entirely works for debugging but you forget to re-enable it.

**Solution Pattern:**
Use `DISABLE_*_VALIDATION` env var with three guardrails:
1. Check bypass BEFORE checking missing fields (so you still reject obviously malformed requests)
2. Log a startup warning when ANY `DISABLE_*` is active
3. The bypass skips cryptographic verification but DOES NOT skip handler logic (you're testing the real path, just without the signature gate)

**Applies To:** 
- Gmail webhook (for testing real polling against mock leads)
- Playwright form submission validation
- Twilio SMS callbacks

---

## AUTO-SEND & VERIFICATION GATES

### 5. LLM Pipeline Prompt Injection Hardening (HIGH SEVERITY)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/prompt-engineering/2026-03-15-llm-pipeline-prompt-injection-hardening.md`

**Key Insight:**
Three injection vectors in LLM reply generation:
1. **SMS edit instructions unwrapped:** User sends `#42: make it shorter` via SMS → text goes into Claude's prompt with no XML wrapping. Attacker could inject meta-instructions.
2. **Unbounded `compressed_draft`:** LLM can return unexpectedly large response, gets stored and sent as SMS without truncation.
3. **Email parser regexes untested for ReDoS:** Six patterns process external email without catastrophic-backtracking regression tests.

**Solution Pattern:**
- Wrap SMS instructions in XML delimiters: `<edit_instruction max_length="200">{{instruction}}</edit_instruction>`
- Cap `compressed_draft` at 160 chars (SMS limit)
- Test all email regexes for ReDoS with `regex-dos` tool before deploy
- Never interpolate untrusted email fields directly into LLM prompts

**Applies To:**
- Lead text extraction from GigSalad/Yelp forms
- Auto-reply drafting from lead content
- SMS approval commands

---

### 6. Express Handler Boundary Validation (Input Guard Pattern)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/express-handler-boundary-validation.md`

**Key Insight:**
Unvalidated or unconstrained input reaching business logic is the root cause of multiple failure classes. Handlers should fail-fast at entry with consistent validation.

**Solution Pattern:**
```ts
app.post('/approve', (req, res) => {
  // 1. Schema validation
  if (typeof req.body.lead_id !== 'string' || !req.body.lead_id.match(/^\d+$/)) {
    return res.status(400).json({ error: 'Invalid lead_id' });
  }
  
  // 2. Size guard
  if (req.body.edit_instruction?.length > 200) {
    return res.status(400).json({ error: 'Instruction too long' });
  }
  
  // 3. CSRF check
  if (!req.session?.csrf_token || req.body.csrf !== req.session.csrf_token) {
    return res.status(403).end();
  }
  
  // NOW proceed to business logic
  return completeApproval(req.body.lead_id, req.body.edit_instruction);
});
```

**Applies To:**
- Playwright form submissions
- SMS callback handlers
- Payment webhook handlers
- Dashboard API routes

---

### 7. Review-Fix Cycle 3: Security Hardening (XSS, XSL, DoS)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/review-fix-cycle-3-security-hardening.md`

**Key Insight:**
Three P1 vulnerabilities that standard agents miss:
1. Untrusted LLM output rendered as raw HTML in dashboard via `innerHTML`
2. No upper bound on pipeline input size (memory/cost DoS vector)
3. Classification fields from untrusted email injected raw into LLM prompts

**Solution Pattern:**
- Never use `innerHTML` for untrusted content; use `textContent` or DOMPurify
- Cap all text field inputs at boundary: `if (input.length > MAX) return 400`
- Run `sanitizeClassification()` BEFORE the hard gate, not after

**Applies To:**
- Dashboard rendering of lead metadata
- Invoice generation from form data
- Calendar event titles from lead fields

---

## SCHEDULER & BACKGROUND JOB PATTERNS

### 8. Distributed Task Scheduler with SQLite (State Machine)
**File:** `/Users/alejandroguillen/Projects/sandbox/docs/solutions/2026-04-05-distributed-task-scheduler.md`

**Key Insight:**
Recurring jobs (send follow-up SMS, invoice reminders) need atomic claim logic. **CRITICAL:** `next_run_at` must be computed INSIDE the `BEGIN IMMEDIATE` transaction, not before it. If it's computed before, stale clock snapshots will set `next_run_at` in the past and cause immediate duplicate fires.

**Solution Pattern:**
```python
# Scheduler process (separate from Flask app):
def poll_schedules():
    while True:
        db.execute("BEGIN IMMEDIATE")
        try:
            now = datetime.utcnow()  # INSIDE the transaction
            due = db.execute(
                "SELECT * FROM schedules WHERE next_run_at <= ? AND active=1",
                (now,)
            ).fetchall()
            
            for sched in due:
                db.execute(
                    "INSERT INTO job_runs (...) VALUES (...)"
                )
                # Compute INSIDE transaction
                next_run_at = compute_next_run(sched.cron, now)
                db.execute(
                    "UPDATE schedules SET next_run_at=? WHERE id=?",
                    (next_run_at, sched.id)
                )
            db.commit()
        except Exception:
            db.rollback()
            raise
        time.sleep(10)
```

**Applies To:**
- Follow-up SMS reminders (48-hour follow-up)
- Invoice send scheduler
- Deposit reminders before event date
- Calendar sync scheduler

---

### 9. Flask Job Queue System (Atomic Claim + Timeout Recovery)
**File:** `/Users/alejandroguillen/Projects/sandbox/docs/solutions/2026-04-05-job-queue-system.md`

**Key Insight:**
Worker processes claim jobs atomically with conditional UPDATE. Timeout detection happens at claim time, not via a background reaper. Retry boundary check: `attempt_count + 1 < max_attempts`.

**Solution Pattern:**
```python
# At claim time (before worker timeout could happen):
db.execute("""
  UPDATE jobs SET
    status = CASE WHEN retry_count < max_retries THEN 'pending' ELSE 'failed' END,
    retry_count = CASE WHEN retry_count < max_retries THEN retry_count + 1 ELSE retry_count END,
    started_at = NULL, completed_at = NULL, worker_id = NULL,
    error = CASE WHEN retry_count < max_retries THEN 'job timed out' ELSE error END
  WHERE status='running' AND updated_at < datetime('now', '-30 seconds')
""")

# Then claim a job:
pending = db.execute("SELECT id FROM jobs WHERE status='pending' ORDER BY created_at ASC LIMIT 1").fetchone()
if pending:
    db.execute("UPDATE jobs SET status='running', worker_id=? WHERE id=? AND status='pending'",
               (worker_id, pending['id']))
    if cursor.rowcount == 0:  # Another worker beat us
        return None
```

**Applies To:**
- Email sending (Gmail API calls)
- Payment confirmation emails
- SMS sending (Twilio)
- Invoice PDF generation

---

## CONCURRENT STATE & RACE CONDITIONS

### 10. Rate Limiting: Keyboard Re-entry Race + Promise Cleanup
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/logic-errors/rate-limiting-race-condition-and-cleanup.md`

**Key Insight:**
Keyboard shortcuts can re-enter handlers by bypassing UI button disabling. Cleanup after `.catch()` must use `.finally()`, not `.then()`, or the button stays disabled forever if the catch itself throws.

**Solution Pattern:**
```ts
let isRunning = false;

async function runApproval() {
  if (isRunning) return;  // Guard at function entry, not just UI
  isRunning = true;
  
  try {
    const result = await approveAndSendSms();
    showSuccess(result);
  } catch (err) {
    showError(err);
    logError(err);
  } finally {  // ALWAYS runs, even if catch throws
    isRunning = false;
    button.disabled = false;
  }
}

// Keyboard shortcut:
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') runApproval();
});
```

**Applies To:**
- SMS approval button (prevent double-approve)
- Auto-send trigger on Playwright
- Manual invoice send button

---

### 11. Follow-Up Pipeline: State Machine with Human-in-the-Loop
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md`

**Key Insight:**
Follow-up lifecycle is distinct from lead approval lifecycle. Use separate status field. Four states: `pending` → `scheduled` → `sent` → `completed`/`skipped`. Human-in-the-loop V1 (user approves each follow-up SMS before send) → automation when trust established. Kill switch (`DISABLE_FOLLOW_UPS`) decouples deployment from scheduler availability.

**Solution Pattern:**
- Status field separate from lead approval status
- Explicit retry limits (e.g., 3 failed SMS = poison lead, skip)
- `skip_reason` for analytics (user-initiated vs system-initiated)
- Poison lead detection: same lead fails 3 times → move to `skipped` with reason

**Applies To:**
- 48-hour follow-up after initial response
- Invoice payment reminders
- Calendar event reminders (when approaching event date)

---

## EMAIL & GMAIL AUTOMATION

### 12. P3 Batch + Gmail Intake Phase 1 (Capabilities Unification & Review-Only Mode)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/2026-05-22-p3-batch-gmail-intake-phase1-hardening.md`

**Key Insight:**
Gmail intake needs a review-only mode before auto-send can be safely enabled. Dual data sources (`ALEX_ALIAS_MAP` and `guessFormatFamily()`) create drift risk. SPF/DKIM validation must be MANDATORY, not optional.

**Solution Pattern:**
1. **Single source of truth** (`CAPABILITIES` array): aliases, capability status (KNOWN/ESCALATE), format family, all in one place
2. **Review-only mode:** Flag in settings; eligible leads are stored as `"sent"` with `done_reason: "review-only: would-auto-send via GigSalad"`; `dispatchReply()` unreachable
3. **Email auth hardening:** SPF/DKIM validation BEFORE lead enters the pipeline

**Applies To:**
- Playwright form auto-submission testing (review-only mode first)
- Gmail polling for replies (don't respond until confidence gate passes)

---

## PAYMENT & INVOICE PATTERNS

### 13. Webhook Delivery System with SQLite (Exponential Backoff)
**File:** `/Users/alejandroguillen/Projects/sandbox/docs/solutions/2026-04-05-webhook-delivery-system.md`

**Key Insight:**
Webhook delivery needs its own queue table with exponential backoff, not just re-calling an event. Per-webhook `max_attempts` is stored in the `webhooks` table and copied into each delivery row at fan-out time (never hardcoded). Retry boundary: `attempt_count + 1 < max_attempts`.

**Solution Pattern:**
```python
# Register webhook with max_attempts
db.execute("INSERT INTO webhooks (..., max_attempts) VALUES (?, ?, ?, 5)", ...)

# Fan out: copy max_attempts from webhook row
webhook = db.execute("SELECT * FROM webhooks WHERE id=?", (webhook_id,)).fetchone()
db.execute("INSERT INTO deliveries (..., max_attempts) VALUES (?, ?, ?, ?, ?)",
           (..., webhook['max_attempts']))  # Copy, don't hardcode

# Retry check:
if attempt_count + 1 < max_attempts:
    next_attempt_at = datetime.utcnow() + timedelta(seconds=60 * (2 ** attempt_count))
    db.execute("UPDATE deliveries SET status='pending', next_attempt_at=? WHERE id=?",
               (next_attempt_at, delivery_id))
```

**Applies To:**
- Payment confirmation webhook delivery (if using an external service)
- Invoice delivery notifications
- Calendar sync confirmations

---

## HEALTH CHECKS & MONITORING

### 14. Execution-as-the-Only-Gate (Health Check Anti-Pattern)
**File:** `/Users/alejandroguillen/Projects/pf-intel/docs/solutions/process/2026-08-03-execution-as-the-only-gate.md`

**Key Insight:**
Static gates (type checks, linting, schema validation) cannot detect their own inability to run the artifact. A health check that cannot distinguish "never started" from "healthy" is decoration, not a gate. Example: all verification commands passed (683 tests, migrations, prohibition scans) on an app that could not be installed on any device.

**Solution Pattern:**
- Every "how will we know it worked?" gate must include an actual execution step
- Health check must distinguish three states clearly: STARTED, HEALTHY, FAILED
- If it reads the same for both "never started" and "passed", it's not a gate
- Document the Execution Path in the plan with concrete device/host, install mechanism, and who performs it

**Applies To:**
- SMS approval flow testing (must actually send a test SMS)
- Payment webhook simulation (must hit real endpoint)
- Gmail polling (must authenticate and receive real email)

---

## BROWSER AUTOMATION & FORMS

### 15. Express Handler Boundary Validation + CSRF (Secure Forms)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/architecture/express-handler-boundary-validation.md`

**Key Insight:**
Playwright submitting forms needs CSRF protection even on localhost. Every POST/PUT/PATCH route must validate:
- CSRF token presence and match
- Input schema (type, length, format)
- Request size (no 500MB payloads)
- All fields required before business logic

**Solution Pattern:**
```ts
// On form load:
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

// On form submit via Playwright:
await page.evaluate(() => {
  document.querySelector('input[name="csrf"]').value = csrfToken;
});

// On server:
if (!req.session?.csrf_token || req.body.csrf !== req.session.csrf_token) {
  return res.status(403).end();
}
```

**Applies To:**
- GigSalad auto-reply form submission
- Yelp message portal submissions
- The Bash contact form auto-fill

---

## DATA INTEGRITY & CONSTANTS

### 16. Constants at the Boundary (Magic Strings & Enums)
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/docs/solutions/logic-errors/constants-at-the-boundary.md`

**Key Insight:**
Magic strings in API responses or database queries drift from frontend assumptions. Use shared constants file or enum for all lead statuses, approval reasons, payment states.

**Applies To:**
- Lead status values: `"received" | "sent" | "review-only" | "approved" | "scheduled" | "done" | "failed" | "skipped"`
- Payment status: `"pending" | "received" | "verified" | "failed" | "refunded"`
- Approval reason: `"auto-send: gigasalad" | "sms-approved" | "webhook" | "manual"`

---

## CRITICAL DESIGN FOUNDATIONS

### 17. Atomic Claim Logic (Foundation Pattern)
**Applies To:** Every background job, scheduler, payment confirmation, SMS approval

**Core Pattern:**
```
1. SELECT ... WHERE status='available' LIMIT 1
2. UPDATE ... WHERE id=<selected_id> AND status='available'
3. Check cursor.rowcount == 1 (if 0, another worker won)
4. Proceed only if you won the claim
```

This pattern appears in scheduler (#8), job queue (#9), and payment matching (implicit). Every background operation must use it.

---

### 18. Transactional Boundaries (SQLite Specific)
**Applies To:** Every `BEGIN IMMEDIATE` operation

**Lessons:**
- Compute values that affect row state INSIDE the transaction, not before
- Use WAL mode + `busy_timeout=5000ms` on every connection
- Test actual concurrent writes, not just serial correctness
- Never leave cursor state checking to connection pooling

---

### 19. Defense in Depth (Security Layering)
**Applies To:** Prompt injection, XSS, webhook validation

**Pattern:**
1. Input validation at boundary (size, schema, format)
2. Transformation/wrapping (XML delimiters for SMS instructions)
3. Business logic (LLM drafting, database writes)
4. Output escaping (never innerHTML for untrusted content)
5. Monitoring (error logs, alert on failed validation)

---

## GOTCHAS & EDGE CASES

### 20. Stale Env Variables in Auto-Send
From solution #2: `AUTO_SEND_ENABLED` env var was left as review-only in production. Without a startup verification, auto-send silently stays disabled even after redeployment. Solution: flag verification at boot, not just `.env` reading.

### 21. XSS via innerHTML + LLM Output
From solution #7: Dashboard renders LLM-generated `compressed_draft` via `innerHTML`. If Claude returns HTML tags in a reply draft, they execute in the browser.

### 22. ReDoS in Email Parser
From solution #5: Email regex patterns can hang on malicious input. Every external-input regex needs `regex-dos` validation before merge.

### 23. TOCTOU in Concurrent Approvals
From solution #1: Frontend button disabling is not sufficient. Server must use atomic updates with status guards.

### 24. Next Run At in the Past
From solution #8: If `next_run_at` is computed before the transaction, a stale clock snapshot can set it to a past time, causing immediate duplicate fires on next poll.

---

## RANKING BY IMMEDIATE RELEVANCE TO BOOKING HUB

**P0 (MUST implement before auto-send):**
1. Atomic State Transitions (solution #1) — prevents double-SMS, double-invoice
2. Auto-Send Via Atomic Completion (solution #2) — prevents silent follow-up loss
3. Express Handler Boundary Validation (solution #6) — input guard
4. Fire-and-Forget Timeouts (solution #3) — prevents hung pipelines

**P1 (Implement with Phase 1):**
5. Distributed Task Scheduler (solution #8) — follow-up scheduling
6. LLM Prompt Injection Hardening (solution #5) — security
7. Silent Failure Escape Hatches (solution #4) — debugging
8. Review-Only Mode (solution #12) — safe ramp-up

**P2 (Implement before payments live):**
9. Job Queue System (solution #9) — payment processing
10. Webhook Delivery (solution #13) — invoice & confirmation emails
11. Rate Limiting Race Condition (solution #10) — SMS approval safety
12. Security Hardening Review (solution #7) — XSS/DoS

**P3 (Operational & Monitoring):**
13. Follow-Up Pipeline State Machine (solution #11) — lifecycle
14. Execution as the Only Gate (solution #14) — testing strategy
15. Constants at Boundary (solution #16) — maintainability

---

## ANTI-PATTERNS TO AVOID

1. ❌ Separate auto-send path with fewer guardrails than manual approval
2. ❌ Computing `next_run_at` before the transaction lock
3. ❌ Using `.then()` instead of `.finally()` for cleanup code
4. ❌ Rendering untrusted LLM output via `innerHTML`
5. ❌ Hardcoding max_attempts instead of copying from webhook config
6. ❌ Checking CSRF/input validation AFTER loading business logic
7. ❌ Email parser regexes without ReDoS testing
8. ❌ Frontend-only protection against double-click (button disable)
9. ❌ Ignoring stale clock snapshots in scheduler
10. ❌ SMS instructions injected raw into LLM prompts without XML wrapping

