---
status: pending
priority: p3
issue_id: "061"
tags: [code-review, cleanup, deferred]
dependencies: []
unblocks: []
sub_priority: 1
---

# 061: Cycle 15 review — deferred P3 items

## Items

### A: CSS trailing newline
`public/dashboard.css` line 1084 — no trailing newline at EOF. POSIX convention. Cosmetic.

### B: Cache-Control for static assets
`src/server.ts` line 77 — `express.static()` relies on ETags only. Could add `maxAge: '1h'` to eliminate 304 round-trips for repeat visits. Not blocking.

### C: fillMonthlyGaps location
`src/db/queries.ts` lines 12-27 — pure function co-located with its single caller. If a second caller ever needs gap-filling, extract to `src/utils/date-helpers.ts`. Not now.

### D: Stale event_type data
Existing rows have mixed-case event_type values (e.g., "Wedding" vs "wedding"). Query 6 handles this with LOWER(TRIM()) at read time. A one-time migration to normalize existing rows would allow removing the read-time normalization. Backlog item — depends on #058 being done first.

### E: CSP unsafe-inline removal opportunity
`src/server.ts` line 53 — CSS is now external, so `'unsafe-inline'` in `style-src` might be removable. Need to verify no other inline styles remain in HTML. Related to pre-existing todo 029.

**Found by:** TypeScript Reviewer, Performance Oracle, Architecture Strategist, Security Sentinel
