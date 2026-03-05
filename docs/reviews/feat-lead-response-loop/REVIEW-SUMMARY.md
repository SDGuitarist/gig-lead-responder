# Review Summary: feat/lead-response-loop (Cycle 2)

**Date:** 2026-03-04
**Branch:** `feat/lead-response-loop`
**Commits reviewed:** 33 (from `8c0e02b` to `f1df698`)
**Files changed:** 29 (+2,474 / -177 lines)

### Prior Phase Risk

> "Main branch divergence — 5 deploy-fix commits on main create merge conflict potential in server.ts."

The feature branch's `server.ts` is well-structured. Merge conflicts will be mechanical (line-by-line), not architectural. The healthcheck-before-routers pattern is correctly implemented on both branches.

---

## Severity Snapshot

| Priority | Count | Action |
|----------|-------|--------|
| P1 Critical | 2 | BLOCKS MERGE |
| P2 Important | 6 | Should fix |
| P3 Nice-to-have | ~18 | Can defer |

## Review Agents Used

| Agent | Findings | Duration |
|-------|----------|----------|
| TypeScript Reviewer | 13 (2 P1, 6 P2, 5 P3) | 136s |
| Security Sentinel | 12 (1 P1, 4 P2, 5 P3, 2 P4) | 170s |
| Performance Oracle | 14 (3 P1, 6 P2, 5 P3) | 134s |
| Architecture Strategist | 15 (3 P1, 6 P2, 6 P3) | 119s |
| Code Simplicity Reviewer | 9 (0 P1, 2 P2, 7 P3) | 92s |
| Agent-Native Reviewer | 3 (0 P1, 3 P2, 0 P3) | 85s |
| Learnings Researcher | 7 relevant solutions | 66s |

**Raw findings:** 66 total across 7 agents
**After dedup:** 26 unique findings (many overlapping across agents)
**Todo files created:** 8 (2 P1 + 6 P2)

## Learnings Researcher Cross-References

| Past Solution | Relevant Finding | Status |
|--------------|-----------------|--------|
| environment-aware-fatal-guards.md | 006 (prod guard) | Pattern violated — fix needed |
| express-handler-boundary-validation.md | 007 (CSRF header) | Pattern violated — fix needed |
| atomic-claim-for-concurrent-state-transitions.md | 011 (raw SQL) | Correctly applied in leads.ts, violated in scheduler |
| railway-healthcheck-auth-middleware-ordering.md | N/A | Correctly implemented |
| follow-up-pipeline-human-in-the-loop-lifecycle.md | N/A | Correctly implemented |
| rate-limiting-race-condition-and-cleanup.md | N/A | Correctly applied |
| constants-at-the-boundary.md | N/A | Mostly followed |

---

## Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | 006 - Production guard missing RAILWAY_ENVIRONMENT | P1 | Security — webhook bypass undetected in prod | 008 |
| 2 | 007 - Analyze missing X-Requested-With CSRF header | P1 | Functional bug — analyze broken for cookie-only sessions | -- |
| 3 | 008 - Mailgun no inline production guard | P2 | Defense-in-depth gap, depends on 006 fix | -- |
| 4 | 009 - process.exit in middleware instead of startup | P2 | Reliability — per-request crash risk | -- |
| 5 | 010 - Missing HSTS + security headers | P2 | Transport security gap | -- |
| 6 | 011 - Raw SQL in scheduler bypasses updateLead | P2 | Architecture — two code paths for same table | -- |
| 7 | 012 - Unsafe double cast `null as unknown as string` | P2 | Type safety escape hatch | -- |
| 8 | 013 - Follow-up API boilerplate duplication | P2 | Code quality — 4x copy-paste drift risk | -- |

## Created Todo Files

**P1 - Critical (BLOCKS MERGE):**
- `006-pending-p1-production-guard-missing-railway-env.md` — Startup guard only checks NODE_ENV, misses RAILWAY_ENVIRONMENT
- `007-pending-p1-analyze-missing-csrf-header.md` — Analyze endpoint sends POST without X-Requested-With

**P2 - Important:**
- `008-pending-p2-mailgun-no-inline-production-guard.md` — Defense-in-depth gap vs. Twilio
- `009-pending-p2-process-exit-in-middleware.md` — Auth middleware crashes app instead of startup check
- `010-pending-p2-missing-hsts-header.md` — Missing HSTS, Referrer-Policy, Permissions-Policy
- `011-pending-p2-raw-sql-in-scheduler.md` — Scheduler bypasses leads.ts abstraction
- `012-pending-p2-unsafe-double-cast.md` — `null as unknown as string` type escape
- `013-pending-p2-follow-up-api-boilerplate.md` — 4 copy-pasted handlers (~80 LOC saveable)

## Deferred Findings (P3 — documented but no todo created)

**Security (defer):**
- `analyzeKvHTML` passes some values without escaping (low risk — LLM-controlled data)
- Mailgun timestamp replay window unbounded (add 5min freshness check eventually)
- 90-day cookie maxAge is long (reduce to 14-30 days when adding logout)
- CSP `unsafe-inline` (known, fix when dashboard JS is extracted)
- Missing cookie revocation/logout (add when reducing session lifetime)
- Static files served without auth (acceptable for single-user app — API requires auth)

**Performance (defer to performance pass):**
- Prepared statements never cached — recreated on every call
- updateLead does double SELECT (before + after UPDATE)
- SELECT * on list endpoints includes large text blobs
- Context docs read from filesystem every pipeline run (cache at startup)
- json_extract full scan in analytics (extract to columns)
- Sequential scheduler processing (parallelize with concurrency limit)
- shapeLead parses 3 JSON blobs per lead in list loops
- Dashboard tab switch triggers full reload (add client-side TTL cache)

**Code Quality (defer):**
- leads.ts 757 lines, 4 responsibilities (planned split: db/migrate, db/leads, db/follow-ups)
- baseUrl() duplicated in twilio-webhook.ts and follow-up-scheduler.ts
- Rate limiter definitions repetitive (extract factory)
- Dead types: FollowUpActionSuccess, FollowUpActionError, FollowUpActionResponse
- COOKIE_MAX_AGE_S unused constant
- "No venue intelligence" injected into LLM context (wasted tokens)
- normalizeRow creates unnecessary object copy via spread

**Agent-Native (defer to agent-native pass):**
- No single-lead GET endpoint (`GET /api/leads/:id`)
- No capability discovery / OpenAPI spec
- SSE-only analyze endpoint (no JSON fallback for programmatic clients)

**Architecture (defer):**
- In-memory retry map lost on process restart (store in DB column)
- Implicit auth boundary in server.ts (add comments or structural grouping)
- Scheduler error SMS has no cooldown/dedup
- DOCS_DIR uses process.cwd() instead of import.meta.dirname
- Table rebuild migration check runs on every startup

## What's Working Well

Multiple agents independently praised these patterns:

1. **Atomic claim pattern** — WHERE-guarded UPDATEs for all state transitions prevent double-sends
2. **Auth design** — HMAC-signed cookies with timing-safe comparison, Basic Auth fallback with CSRF bypass for API clients
3. **Discriminated union** — VenueLookupResult (hit/miss/error) forces callers to handle all cases
4. **Column whitelist** — `UPDATE_ALLOWED_COLUMNS` in updateLead prevents SQL key injection
5. **Rate limiting** — Separate limiters per operation class
6. **Venue context formatter** — Pure function, no side effects
7. **Agent-native parity** — All 12 UI actions have API equivalents

## Three Questions

1. **Hardest judgment call in this review?** Deciding severity for "static files served without auth" (Arch rated P1, TS rated P3). The dashboard HTML exposes API structure and business logic, but the API itself requires auth. For a single-user app where the attacker already knows the URL, I rated it P3 — the HTML reveals endpoint names but not credentials or data. If this were multi-tenant, it would be P1.

2. **What did you consider flagging but chose not to, and why?** The performance findings (uncached prepared statements, SELECT *, double reads). These are valid at scale but this app has <100 leads on SQLite. Creating P1 todos for perf in a <100-row app would be premature optimization noise. Documented as deferred findings instead.

3. **What might this review have missed?** The LLM prompt/response pipeline (`generate.ts`, `verify.ts`, `enrich.ts`) was not deeply reviewed by any agent — only the `callClaude<T>` unsafe cast was flagged. Prompt injection via lead text, LLM output validation, and token budget management were not examined. The `dashboard.html` client-side JS (2,474 lines) also received limited scrutiny for DOM-based XSS or state management bugs.

## Next Steps

1. Fix P1 findings (2 items, both one-line fixes)
2. Fix P2 findings (6 items, all small effort)
3. Merge to main after P1s resolved
4. Track deferred findings for future sessions
