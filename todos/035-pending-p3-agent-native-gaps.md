---
status: pending
priority: p3
issue_id: "035"
tags: [code-review, agent-native, api]
dependencies: []
unblocks: []
sub_priority: 1
---

# 035: Agent-native gaps -- missing GET endpoint, SSE-only analyze, no OpenAPI

## Problem Statement

The API was built dashboard-first. An AI agent cannot: (1) fetch a single lead by ID (must filter full list), (2) analyze text synchronously (SSE-only endpoint), (3) discover endpoints programmatically (no OpenAPI spec), (4) branch on error types (no machine-readable error codes).

**Found by:** Agent-Native Reviewer

## Findings

- Missing `GET /api/leads/:id` -- `getLead()` and `shapeLead()` exist, just needs a 5-line route
- `/api/analyze` returns `text/event-stream` only -- no JSON fallback for programmatic consumers
- No `openapi.yaml` or API documentation
- Errors return `{ error: "string" }` -- no `code` field for programmatic branching
- 10/13 dashboard capabilities are agent-accessible

## Proposed Solutions

### Solution A: Incremental improvements
1. Add `GET /api/leads/:id` (5 lines)
2. Add `?format=json` query param to analyze endpoint
3. Add `code` field to error responses
4. Hand-write minimal OpenAPI YAML for 11 endpoints

**Effort:** Medium (spread across multiple small changes) | **Risk:** Low

## Acceptance Criteria

- [ ] Single-lead GET endpoint exists
- [ ] Analyze endpoint supports JSON response mode
- [ ] Error responses include machine-readable code field
- [ ] OpenAPI spec covers all public endpoints

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Dashboard-first API is agent-hostile |
