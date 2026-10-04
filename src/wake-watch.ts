// Detects that the Mac slept (plan 0.3): timers stop while asleep, so a
// 30-second check that finds far more time has passed means we just woke.

const TICK_MS = 30_000;
const JUMP_MS = 2 * 60_000;

export function createWakeCheck(now: () => number, onWake: (gapMs: number) => void) {
  let last = now();
  return {
    tick(): void {
      const t = now();
      const gap = t - last;
      last = t;
      // Gap minus the normal tick = time asleep; the plan's rule is "more than 2 minutes asleep".
      if (gap <= TICK_MS + JUMP_MS) return;
      // A throwing callback must not escape the timer (Codex round 1, Phase 0 runtime).
      try {
        onWake(gap);
      } catch (err) {
        console.error(`[wake] catch-up failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

/** Starts the 30-second check; returns a stop function. */
export function startWakeWatch(onWake: (gapMs: number) => void): () => void {
  const check = createWakeCheck(() => Date.now(), onWake);
  const handle = setInterval(() => check.tick(), TICK_MS);
  handle.unref();
  return () => clearInterval(handle);
}
