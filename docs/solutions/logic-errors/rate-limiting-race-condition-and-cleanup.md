---
title: "Fix rate limiting review findings — keyboard re-entry race + cleanup"
date: 2026-02-26
category: "logic-errors"
tags:
  - rate-limiting
  - race-condition
  - keyboard-shortcut
  - typescript-types
  - promise-cleanup
  - dead-code
severity: "p1"
components:
  - src/rate-limit.ts
  - public/dashboard.html
root_cause: "Reentrancy guard at call site instead of inside function; factory YAGNI; .then() instead of .finally() for cleanup; dead content-type sniffing branch"
commit_refs:
  - cb7e3f3
  - ae57fbd
  - 6c441fb
---

# Rate Limiting: Keyboard Re-entry Race + Code Cleanup

## Prior Phase Risk

> "Whether todo 002 (handler type fix) will surface new TypeScript errors when importing `Options` from express-rate-limit."

Verified: `Options` type is bundled in express-rate-limit v8's own `dist/index.d.ts`. No separate `@types` package needed. `tsc --noEmit` passes clean.

## Problem

Five review findings from the per-route rate limiting PR (`cb7e3f3`):

1. **P1 — Keyboard re-entry race:** Ctrl+Enter shortcut called `runAnalyze()` directly, bypassing the button-disabled guard. Two concurrent SSE `readChunk()` loops fought over the same DOM nodes — flickering stages, interleaved results.
2. **P2 — Factory YAGNI + type mismatch:** `createLimitHandler(msg)` was a higher-order function where both call sites passed the identical message. Handler returned 2-arg signature but express-rate-limit v8 expects 4 args.
3. **P2 — `.then()` instead of `.finally()`:** Button cleanup after `.catch()` used `.then()`. If `.catch()` itself throws, cleanup is skipped and button stays disabled forever.
4. **P2 — Dead code:** Content-type sniffing on 429 response checked JSON vs text, but the custom handler always returns JSON. The text branch (7 lines) could never execute.
5. **P2 — Variable shadowing:** Inner callback `text` shadowed outer user input `text`. Auto-resolved by removing the dead code in #4.

## Root Cause

**Guard-at-call-site antipattern.** The button click handler owned the disabled check, but `runAnalyze()` didn't protect itself. A second entry path (keyboard shortcut) skipped it entirely. The function didn't own its own reentrancy protection.

The remaining issues were code quality: a factory abstracting nothing, a cleanup mechanism that could fail silently, and dead code from belt-and-suspenders thinking.

## Solution

### Fix 1: Keyboard Re-entry Guard (commit `ae57fbd`)

Move the reentrancy check **inside** `runAnalyze()`:

```javascript
function runAnalyze() {
    var text = document.getElementById('analyzeInput').value.trim();
    if (!text) return;
    var btn = document.getElementById('analyzeBtn');
    if (btn.disabled) return;  // guard against keyboard re-entry
    btn.disabled = true;
    // ...
}
```

All entry paths (click, keyboard, future programmatic calls) now respect the in-flight flag.

### Fix 2: Shared Handler with Correct Types (commit `6c441fb`)

Replace factory with flat handler matching express-rate-limit v8's `RateLimitExceededEventHandler`:

```typescript
import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

const handler = (
  req: Request,
  res: Response,
  _next: NextFunction,
  _options: Options,
) => {
  console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
  res.status(429).json({
    error: "Too many requests. Please wait before trying again.",
  });
};
```

### Fix 3: `.finally()` for Guaranteed Cleanup (commit `6c441fb`)

```javascript
}).catch(function (err) {
    var errBox = document.getElementById('analyzeError');
    if (errBox) {
        errBox.textContent = 'Network error: ' + err.message;
        errBox.style.display = 'block';
    }
}).finally(function () {
    btn.disabled = false;
    btn.textContent = 'Analyze';
});
```

### Fix 4: Remove Dead Code (commit `6c441fb`)

```javascript
if (!response.ok) {
    return response.json().then(function (body) {
        throw new Error(body.error || 'API error ' + response.status);
    });
}
```

4 lines instead of 11. Also eliminates the shadowed `text` variable (fix 5).

## Verification

- `tsc --noEmit` passes clean with the new 4-arg handler signature
- Manual trace: Ctrl+Enter → `runAnalyze()` → `btn.disabled` is `true` → early return
- `.finally()` runs on both success and catch paths
- Content-type sniffing branch confirmed unreachable — handler always calls `res.json()`

## Prevention Strategies

### 1. Guard Inside the Function, Not at the Call Site

If a function can be called from multiple paths (button click, keyboard event, programmatic), the function must be its own gatekeeper. Use existing state (disabled flag, lock variable) as the guard.

### 2. Verify Handler Signatures Against Library Types

When using a handler callback with an external library, check the `.d.ts` file for the exact parameter count. TypeScript won't catch extra-arg mismatches at runtime (JS ignores extra args), but strict mode will.

### 3. `.finally()` for Unconditional Cleanup

If cleanup must run regardless of success or failure, use `.finally()`. The question to ask: "If `.catch()` throws, does the next `.then()` still need to run?" If yes, it should be `.finally()`.

### 4. Dead Code = Delete It

If a handler always returns one content type, remove the fallback branch for other types. Dead code misleads future readers, causes variable shadowing, and adds maintenance burden.

## Code Review Checklist

- [ ] Are defensive checks inside the handler function, or only at the call site?
- [ ] For exported handlers, does the signature match the library's expected type?
- [ ] Is each factory call site passing the same arguments? If yes, inline it.
- [ ] If `.catch()` is followed by `.then()`, can `.catch()` throw? Use `.finally()` if cleanup is unconditional.
- [ ] Can all branches execute? Remove unreachable code.

## Risk Resolution

| Phase | Flagged Risk | What Happened | Lesson |
|-------|-------------|---------------|--------|
| Work | "throw inside .then() to trigger .catch() — indirect control flow" | Pattern confirmed correct by 2 review agents. Real issue was downstream: `.then()` cleanup after `.catch()` should be `.finally()` | When flagging indirect control flow, check the cleanup path, not just the throw path |
| Review | "Options import from express-rate-limit may need @types package" | Verified: `Options` is bundled in v8's own `.d.ts` | express-rate-limit v8 ships its own types — no separate `@types` needed |
| Fix | "Simplified .json() parse may fail if reverse proxy sends non-JSON 429" | Untested but safe: `.catch()` would show "Network error" on JSON parse failure | Acceptable risk — Railway's edge doesn't send custom 429s before Express |

## Cross-References

- **Brainstorm:** `docs/brainstorms/2026-02-26-rate-limiting-brainstorm.md`
- **Plan:** `docs/plans/2026-02-26-feat-api-rate-limiting-plan.md`
- **Review:** `docs/reviews/2026-02-26-rate-limiting-REVIEW-SUMMARY.md`
- **Related:** `docs/solutions/architecture/escape-at-interpolation-site.md` (XSS prevention — 429 error rendering uses `.textContent`, not `.innerHTML`)

## Three Questions

1. **Hardest pattern to extract from the fixes?** The "guard-at-call-site" antipattern. It's tempting to frame it as "add a guard to the keyboard listener" — but the real lesson is that the function should own its own protection. The bouncer belongs inside the door, not at each entrance.

2. **What did you consider documenting but left out, and why?** The SSE `readChunk()` loop behavior during concurrent streams — what actually happens to DOM nodes when two loops interleave. Left it out because the fix prevents it entirely, so documenting the broken behavior adds complexity without prevention value.

3. **What might future sessions miss that this solution doesn't cover?** The interaction between rate limiting and SSE abort/close. If a user navigates away mid-stream, does the SSE connection close cleanly? The review flagged this as untested, and it's still untested. Not a bug yet, but a gap in coverage.
