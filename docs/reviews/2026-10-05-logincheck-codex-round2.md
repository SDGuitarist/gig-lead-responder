# Codex round 2 — GigSalad startup login check fixes (`1200dc9..ccc821b`)

**Verdict: NO-GO** (2 P1 + 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `ccc821b`; tree clean after). Prior: R1 NO-GO (`2026-10-05-logincheck-codex-round1.md`). R1 P1 (startup waits) confirmed fixed. **Second NO-GO in this loop: automatic iteration STOPPED.** Verbatim:

---

## Verdict: NO-GO

- **P1 — Timeout releases the queue before the browser job has stopped.**  
  **File:** `src/automation/portals/gigsalad-accounts.ts:34-43`; cleanup in `src/automation/portals/gigsalad-match.ts:103-105` and `src/automation/portals/gigsalad-fetch.ts:60-62`  
  **Input:** A browser job, or its `context.close()`, never resolves.  
  **Root cause:** `Promise.race` rejects after 60 seconds, but does not cancel or await the underlying job. The queue is released immediately, so a later job can open the same profile concurrently while the old browser remains active.  
  **Required fix:** Make timeout cleanup/cancellation complete before releasing the profile, or otherwise guarantee that a timed-out browser cannot overlap a later job. Add a regression test proving no overlap when the original job resolves after timeout.

- **P1 — A GigSalad lead can still block the poller for multiple bounds.**  
  **File:** `src/automation/portals/gigsalad-enrich.ts:24-37`; `src/automation/orchestrator.ts:121-124`  
  **Input:** A valid GigSalad lead where both inbox reads and the lead-page read each consume the 60-second timeout.  
  **Root cause:** `findGigSaladLead` reads two accounts sequentially, then enrichment reads the page. `processLead` has no aggregate deadline, so this can take roughly 180 seconds and block the poller.  
  **Required fix:** Add an explicit end-to-end GigSalad enrichment deadline, with cancellation/cleanup coordinated with the profile lock.

- **P2 — The timeout regression assertion is incomplete for what it claims.**  
  **File:** `src/gigsalad-accounts.test.ts:42-47`  
  **Input:** A job that ignores timeout and finishes later.  
  **Root cause:** The test only proves that a later job eventually starts; it does not prove the timed-out browser stopped, closed, or did not overlap.  
  **Required fix:** Add a deterministic overlap/cleanup assertion, or rename the test to reflect only queue release and separately test browser cleanup.

Question 1: the direct startup wait is fixed, but profile contention can still delay first/later GigSalad lead processing.  
Question 2: not clean; timeout can cause overlap. The old result itself cannot overwrite the later result, but concurrent profile use can make later verification unreliable.  
Question 3: not clean; aggregate `processLead` time can exceed 60 seconds.  
Question 4: the new timeout assertion is vacuous for cleanup/non-overlap.

Verification: focused GigSalad tests passed **55/55**. Full suite: **591 passed, 17 sandbox-restricted failures, 1 skipped**; failures were listener `EPERM`/`sysctl` environment restrictions.

---

**Round 3 authorized by Alejandro: YES** (2026-10-05, Alex chose B over Claude's recommended simplification). Plan: force-close a timed-out browser before its profile is released (and never start a job while that profile's browser still runs), cap a GigSalad lead at 90 s end to end, real overlap test. Pre-registered: round 3 is the last; a NO-GO fires the hard cap.
