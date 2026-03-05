# HANDOFF — Gig Lead Responder

**Date:** 2026-03-04
**Branch:** `feat/lead-response-loop` (pushed to origin), `main` (deploy fixes)
**Phase:** Work (Phase C complete, Phase D deploy blocker resolved)

## Prior Phase Risk

> "Whether Stage 1's LLM will reliably extract venue names."

Addressed in C1 with pass/fail examples at the TOP of the classify prompt, empty-string sanitization, and backward compat for old records. Worst case: false misses logged to `venue_misses` table, not broken drafts. The miss log (C4) makes this observable.

## What Was Done

6 commits on `feat/lead-response-loop`:

| Commit | Phase | What |
|--------|-------|------|
| `6820ac2` | C1 | `venue_name: string \| null` on Classification, prompt extraction rule, sanitization |
| `a357d98` | C1 | Test fixture fix — added `venue_name: null` to makeClassification |
| `d631b7f` | — | HANDOFF.md update |
| `0d01ff7` | C2 | VenueContext types, constants.ts, venue-lookup.ts client, .env.example |
| `14b884b` | C3+C4 | format-venue-context.ts, context.ts update, run-pipeline.ts wiring, venue_misses table + logVenueMiss |

### Files Changed (C2-C4, this session)

- `src/types.ts` — added `VenueContext`, `VenueLookupResponse`, `VenueLookupResult` types
- `src/constants.ts` — **new** — `PF_INTEL_TIMEOUT_MS` (3000), `VENUE_CONTEXT_HEADER`
- `src/venue-lookup.ts` — **new** — `lookupVenueContext()` with 3s timeout, input validation, discriminated hit/miss/error
- `src/pipeline/format-venue-context.ts` — **new** — pure markdown formatter for LLM context injection
- `src/pipeline/context.ts` — `selectContext()` now accepts optional `VenueContext`, always includes venue section
- `src/run-pipeline.ts` — both `runPipeline()` and `runEditPipeline()` call venue lookup between Stage 2-3
- `src/leads.ts` — `venue_misses` table creation in `initDb()`, `logVenueMiss()` upsert function
- `.env.example` — added `PF_INTEL_API_URL` and `PF_INTEL_SERVER_API_KEY`

### Tests

All 40 passing tests still pass. 8 pre-existing failures in `detectBudgetGap` tests (unrelated — budget gap tolerance logic).

## What Remains

### This repo (gig-lead-responder) — DONE for now
Phase C is complete. No more Lead Responder code changes until PF-Intel is deployed and the endpoint is live.

### PF-Intel repo — NEXT
- [ ] **Phase A:** Deploy PF-Intel FastAPI to Railway (Dockerfile PORT fix, env vars, health check, cold start test)
- [ ] **Phase B1:** `venue_aliases` table + migration
- [ ] **Phase B2:** `vendor_policies` table + migration
- [ ] **Phase B3:** Server-to-server API key auth (`verify_api_key` dependency)
- [ ] **Phase B4:** `GET /api/v1/lead-context` endpoint + Pydantic schemas

### After PF-Intel is live
- [ ] **Phase D1:** Seed venue aliases from VENUE_MAP (cross-reference query first)
- [ ] **Phase D2:** Seed vendor policies for top 10 venues (manual data from Alex)
- [ ] **Phase D3:** Delete dead venue code (DEFERRED — 1 week after production)

### Then
- [ ] **Review** — run `/workflows:review` on the full PR across both repos

## Three Questions

1. **Hardest implementation decision?** Combining C3 and C4 into one commit. The plan separates them, but `run-pipeline.ts` imports `logVenueMiss` from `leads.ts` — splitting would mean either a broken intermediate commit or a stub function. One commit with clear separation in the message is cleaner.

2. **What did you consider changing but left alone?** `runPipeline()` doesn't pass lead ID to `logVenueMiss()` because it doesn't have access to it (receives raw text only). The caller (`webhook.ts`) could thread it through, but that's scope creep. The `last_lead_id` column is nullable and the miss log's primary value is the deduped venue name + hit count.

3. **Least confident about going into review?** The `venue_misses` table uses `UNIQUE` on `venue_name` for deduplication, but venue names from LLM extraction may have inconsistent casing/spacing (e.g., "Gaylord Pacific" vs "gaylord pacific"). The upsert deduplicates on exact match only. PF-Intel normalizes on its side, but the miss log could accumulate near-duplicates. Low risk — it's a diagnostic table, not a business-critical one.

### Prompt for Next Session

```
Read ~/Projects/pacific-flow-hub/docs/plans/2026-03-03-feat-lead-response-loop-plan.md, Phases A and B.
Implement PF-Intel deployment + lead-context endpoint (Dockerfile PORT fix, venue_aliases + vendor_policies migrations, API key auth, lead-context router).
Repo: ~/Projects/pf-intel/. Relevant files: server/Dockerfile, server/pf_intel/config.py, server/pf_intel/dependencies.py, server/pf_intel/main.py, supabase/migrations/.
```
