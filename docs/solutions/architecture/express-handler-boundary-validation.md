---
title: "Guard at the Boundary: Fail-Fast Input Validation at Express Handler Entry"
category: architecture
tags: [input-validation, csrf-protection, http-handlers, error-handling, security, fail-fast, express]
module: src/api.ts, src/follow-up-api.ts
symptoms:
  - Missing CSRF tokens on POST routes
  - Unvalidated or unconstrained user input reaching business logic
  - Null/undefined values propagating through handler chain
  - Malformed request bodies accepted without schema validation
  - Error messages leaking internal state to clients
  - 500 errors that should have been 400s
date_documented: 2026-03-02
related:
  - docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md
  - docs/solutions/architecture/environment-aware-fatal-guards.md
  - docs/solutions/architecture/escape-at-interpolation-site.md
  - docs/solutions/logic-errors/constants-at-the-boundary.md
  - docs/solutions/architecture/platform-policy-enforcement.md
---

# Guard at the Boundary: Fail-Fast Input Validation at Express Handler Entry

## Problem

A developer adding a new POST route to `src/api.ts` or `src/follow-up-api.ts` would observe no consistent pattern at handler entry points. Some routes had CSRF protection, some did not. Some routes trusted `req.body` fields without checking length or shape. One route non-null asserted a nullable return value with `!`. Another destructured `req.body` directly without confirming it was an object first.

The symptoms:

- POST routes accept arbitrarily large payloads — a 500MB `full_draft` string passes straight through to the database.
- A missing CSRF token causes no rejection on `/api/leads/:id/edit`, `/api/leads/:id/outcome`, and `/api/analyze`, exposing all three to cross-site request forgery.
- `shapeLead(updated)!` throws a runtime exception if `shapeLead` returns `null`, crashing the handler and leaking a 500 with no useful message.
- `const { until } = req.body as SnoozeRequestBody` panics if `req.body` is `null` or a primitive.

There is no failure at startup or lint time — everything compiles. The bugs only surface at runtime under specific request conditions or adversarial input.

## Root Cause

The routes in `src/api.ts` and `src/follow-up-api.ts` grew organically. `follow-up-api.ts` was written later and included a `csrfGuard` call on its own POST routes, but the earlier routes in `api.ts` never received the same treatment. There was no validation checklist applied at PR time and no shared handler template that enforced "CSRF first, body-shape second, length third" before the business logic ran.

The non-null assertion (`shapeLead(updated)!`) and the unsafe cast (`req.body as SnoozeRequestBody` without a type guard) both reflect the same root pattern: trusting return values and inputs that have not been explicitly verified.

## Solution

The fix pattern is "guard at the boundary": validate the request fully before any business logic runs, and fail fast with a 4xx. The guards group into four types.

### Type 1 — CSRF middleware on every mutating route

Add `csrfGuard` as a route-level middleware argument immediately after any rate limiter, before the async handler.

```typescript
// Before
router.post("/api/leads/:id/approve", approveLimiter, async (req, res) => { ... });
router.post("/api/leads/:id/edit", async (req, res) => { ... });

// After
router.post("/api/leads/:id/approve", approveLimiter, csrfGuard, async (req, res) => { ... });
router.post("/api/leads/:id/edit", csrfGuard, async (req, res) => { ... });
```

The rule: every `router.post` that mutates state gets `csrfGuard`. Rate limiter (if present) comes before it; the handler comes after.

### Type 2 — Body-shape guard before destructuring

Before destructuring `req.body`, confirm it is a non-null object.

```typescript
// Before
const { until } = req.body as SnoozeRequestBody;

// After
if (!req.body || typeof req.body !== "object") {
  res.status(400).json({ error: "Invalid request body" });
  return;
}
const { until } = req.body as SnoozeRequestBody;
```

### Type 3 — Per-field length limits on free-text inputs

Any field that accepts user-authored text must have an explicit maximum length before it is passed to the database or downstream services.

```typescript
// src/api.ts — edit endpoint
const { full_draft } = req.body;
if (full_draft.length > 50000) {
  res.status(400).json({ error: "Draft too long" });
  return;
}
```

50,000 characters was chosen as a pragmatic ceiling — large enough that no legitimate lead or draft would exceed it, small enough to prevent database bloat and runaway LLM token consumption.

### Type 4 — Explicit null check on nullable return values

Replace non-null assertions (`!`) on functions that can legitimately return `null` with an explicit check and a 500 response.

```typescript
// Before
res.json({ success: true, lead: shapeLead(updated)! });

// After
const shaped = shapeLead(updated);
if (!shaped) {
  res.status(500).json({ error: "Failed to shape lead response" });
  return;
}
res.json({ success: true, lead: shaped });
```

## Extended Pattern: Atomic State Transitions

Three additional findings (#4, #5, #22) extend the existing solution documented at `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`. They do not introduce a new pattern — they are new scenarios where the atomic-claim discipline applies.

**Finding #4 — Scheduler revert on partial failure.** The catch block in the scheduler logged errors but did not revert `status` from `sent` back to `pending` when `failures < maxRetries`. A missing `else` branch left leads permanently stuck. Fix: add the revert in the `else` branch of the retry check.

**Finding #5 — Transaction folding for approval.** The `completeApproval` function made three separate writes (status update, `sms_sent_at` update, and a follow-up record insert). A crash between any two writes left the lead in an inconsistent state. Fix: fold the `sms_sent_at` update into the existing `runTransaction` call alongside the other writes.

**Finding #22 — WHERE-guarded draft overwrite.** The scheduler's draft UPDATE had no guard on `follow_up_status`, so it could overwrite a draft after the user had already called `skipFollowUp`. Fix: add `WHERE follow_up_status = 'sent'` to the UPDATE so it is a no-op if the lead has moved past the `sent` state.

The common thread: every write to a state field must be conditional on the state the record is currently in. Unconditional writes are the failure mode; guarded writes are the fix.

## What Was Rejected

**Middleware-only validation (global body-size limit).** Express's `express.json({ limit: '50kb' })` can enforce a global payload ceiling. Rejected because a global limit applies to the entire JSON body, not individual fields — a lead record with many short fields would be rejected at the same threshold as one with a single very long `full_draft`. Per-field limits are more precise and produce better error messages.

**A custom validation library (Zod, Joi, express-validator).** Introducing a schema-validation library would allow declarative validation for every route. Rejected because it would change every handler in both API files, expanding the diff well beyond the scoped findings. The existing codebase has no validation library dependency, and introducing one is an architectural decision that belongs in a planning phase, not a fix batch.

**Centralizing CSRF into a router-level `use()` call.** Adding `router.use(csrfGuard)` before all route definitions would apply CSRF automatically. Rejected because the router also handles GET routes that do not need CSRF protection, and a blanket `use()` would add unnecessary overhead and debugging confusion.

## Prevention

### New Express POST Route Checklist

When adding a POST handler to this project, follow this sequence before merging:

**Middleware & Transport**
- [ ] CSRF protection via `csrfGuard` middleware on the route
- [ ] Rate limiter added if the route triggers external API calls or expensive operations

**Input Validation**
- [ ] Validate `req.body` exists and is an object before destructuring
- [ ] For each user-editable field: check presence, enforce length limit, enforce type
- [ ] Do not cast `req.body as SomeType` without a shape guard first

**State & Responses**
- [ ] For any function that can return `null`: add a guard before using the value
- [ ] Error messages sent to client are generic — log details server-side
- [ ] If the handler performs multiple writes: wrap in a transaction with WHERE guards

**Quick smoke tests**
- [ ] Test with empty body
- [ ] Test with oversized fields
- [ ] Test with missing CSRF token

## Risk Resolution

### Review Phase Risk

**Flagged:** "What might this review have missed? Accessibility, timezone handling, SMS content validation, logging consistency, browser compatibility."

**What happened:** None addressed in this fix batch — all are orthogonal to handler-boundary validation. Logged as separate concerns, not review failures. The fix focused on high-blast-radius items (CSRF, input validation, atomicity).

**Lesson:** Reviews surface concerns beyond the narrow scope of findings. Distinguish "this PR should fix it" from "this is a separate initiative." Document the latter as future work rather than treating them as missed fixes.

### Fix Phase Risk

**Flagged:** "Whether the 3 patterns flagged above are genuinely reusable or too specific to this PR."

**What happened:** The guard-at-the-boundary pattern is genuinely reusable — it applies to every Express POST route, not just these four. The atomic state transition pattern also proved reusable, appearing in three independent fixes across the scheduler and API. The structural cluster (leads.ts split) is project-specific but the assessment criteria (when to split a file) are transferable.

**Lesson:** Patterns that emerge independently across 3+ findings in the same review are almost certainly reusable. Document them even when they feel "obvious" — the checklist above prevents the same organic drift that caused these findings in the first place.

## Related

- **`docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`** — Guards at the state-transition boundary using atomic WHERE clauses. Complementary: that doc handles guards at the business logic boundary; this doc handles guards at the HTTP handler entry point.
- **`docs/solutions/architecture/environment-aware-fatal-guards.md`** — Fail-closed env var checks in production. Same defense-in-depth principle applied to configuration instead of request validation.
- **`docs/solutions/architecture/escape-at-interpolation-site.md`** — Output escaping at the interpolation site. Inverse problem: input validation guards entry points, escaping guards exit points. Both are "last responsible moment" patterns.
- **`docs/solutions/logic-errors/constants-at-the-boundary.md`** — Values that cross module boundaries need explicit definition. The "boundary" there is the module export surface; here it is the HTTP handler entry point.
- **`docs/solutions/architecture/platform-policy-enforcement.md`** — Hard constraints placed at system edges. Related defense-in-depth: constraints that must hold are stated at entry (validation) and verified at exit (gate check).

## Three Questions

### 1. Hardest pattern to extract from the fixes?

Deciding whether the "guard at the boundary" pattern was distinct enough from the existing `atomic-claim-for-concurrent-state-transitions.md` doc. Both are about "validate before acting." The distinction: this doc covers HTTP-layer guards (CSRF, body shape, field length, null checks) that happen *before* any database write. The atomic-claim doc covers SQL-layer guards (WHERE clauses, transactions) that happen *during* the write. They're complementary layers of the same defense-in-depth principle, not duplicates.

### 2. What did you consider documenting but left out, and why?

The deferred structural cluster (#13 leads.ts split, #14 boilerplate, #15 terminal-state, #18 coupling, #20 double-read). These five findings share a root cause but the "solution" is a planned refactor, not a completed fix. Documenting an unexecuted plan as a solution doc would be premature — it belongs in a plan doc for the refactoring PR, not in `docs/solutions/`.

### 3. What might future sessions miss that this solution doesn't cover?

The checklist covers POST routes but not other mutation vectors. WebSocket handlers, scheduled job callbacks, and webhook endpoints all have their own boundary-validation needs. If the project adds real-time features (SSE upgrades to WebSockets) or more webhook consumers, the checklist should be extended to cover those entry points.
