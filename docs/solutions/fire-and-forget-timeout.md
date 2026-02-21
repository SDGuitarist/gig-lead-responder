# Fire-and-Forget Pipeline Timeout

**Category:** Resilience
**Tags:** async, timeout, promise-race, webhook

## Problem

A webhook receives a request, kicks off an async pipeline, and returns 200
immediately (fire-and-forget). If the pipeline hangs — API timeout, network
issue, infinite retry loop — the promise holds memory forever. Multiple hung
pipelines cause unbounded memory growth. The lead stays in `received` status
with no alert.

## What Was Tried

1. **AbortController on fetch calls** — Only bounds individual API calls, not
   the total pipeline duration. Three 30-second calls back-to-back still take
   90 seconds with no overall limit.
2. **No timeout, rely on stuck-lead sweep** — The sweep only runs periodically
   and can't free the memory held by the hung promise.

## What Worked

`Promise.race` with a timeout wrapper:

```ts
const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Pipeline timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// In webhook handler:
withTimeout(runPipeline(rawText), PIPELINE_TIMEOUT_MS)
  .then((output) => postPipeline(leadId, output))
  .catch((err) => postPipelineError(leadId, err));
```

**Why 2 minutes:** The pipeline makes 3-5 Claude API calls. Each has a ~30s
timeout. Worst case: 5 x 30s = 150s. Add headroom → 120s (2 min). This is
tight enough to catch real hangs but loose enough to not kill slow-but-working
runs.

**What the timeout does:** Rejects the promise, which triggers `postPipelineError`
→ marks lead as `failed` → sends SMS alert. Memory is freed when the promise
chain settles.

## What It Does NOT Cover

- **Process crash between lead insert and pipeline start** — The lead is in the
  DB as `received`, but no promise exists to race against. No timeout fires.
- **OOM kill or Railway restart** — Same issue. The lead is orphaned in `received`.

**Fix for both:** A `setInterval` sweep that marks `received` leads older than
5 minutes as `failed`. This is the complement to `Promise.race` — one catches
hangs, the other catches crashes.

## Reusable Pattern

1. Wrap fire-and-forget promises in `Promise.race` with a timeout
2. Size the timeout as: (max API calls x per-call timeout) + 20% headroom
3. On timeout, run the same error handler as a normal failure (mark failed, alert)
4. For crash recovery, add a periodic sweep — `Promise.race` only works while
   the process is alive
5. These two mechanisms are complementary, not alternatives
