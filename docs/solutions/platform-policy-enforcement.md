# Platform Policy Enforcement in LLM Pipelines

**Category:** Prompt engineering
**Tags:** platform-rules, conditional-prompts, two-layer-enforcement

## Problem

Different platforms have opposing rules. GigSalad prohibits contact info in
messages. The Bash requires it. A single generate prompt can't satisfy both.
LLMs skip instructions buried in long prompts, especially "don't include X."

## What Was Tried

1. **Appending rules at the bottom of the prompt** — Model ignores them when
   the prompt is long. Contact info leaks into GigSalad drafts ~30% of the time.
2. **Separate prompts per platform** — Massive duplication. 95% of the prompt
   is identical.

## What Worked

Two-layer enforcement with top-of-prompt placement:

### Layer 1: Hard constraint in the generate prompt

```
// Top of system prompt, before any data sections
if (platform === "gigsalad") {
  prompt = `HARD CONSTRAINT: Do NOT include any contact information...

  ${prompt}`;
}
```

**Kitchen-door-sign analogy:** A "NO DOGS ALLOWED" sign works on the kitchen
door (top of prompt, before you start cooking). The same rule buried in a recipe
card (inside the data section) gets ignored.

### Layer 2: Gate check in the verify prompt

```
// Section 8 of verify prompt — platform-conditional
if (platform === "gigsalad") {
  // "Platform Policy Check" — FAIL if contact info detected
} else {
  // "Contact Block Check" — FAIL if contact info MISSING
}
```

This is the inverse problem: must-not-have vs. must-have. Same section number,
different check direction.

### The if/else branch pattern

```ts
if (classification.platform === "gigsalad") {
  // suppress contact block
} else {
  // include contact block (The Bash, direct, undefined)
}
```

**Undefined-platform fallback:** When `platform` is undefined (CLI mode, direct
leads), fall through to the `else` branch. Direct behavior is the safe default
because it includes all information — suppression is the special case.

## Reusable Pattern

1. Hard constraints go at the TOP of system prompts (before data sections)
2. Enforcement goes in the verification/gate prompt (catch what generation missed)
3. Use if/else, not if/if — opposite rules need opposite branches
4. Default to the permissive branch (include everything) for unknown platforms
5. Stamp platform early (at intake), propagate through pipeline, re-stamp on
   edit paths from stored data
