# Prompt Placement for Hard Constraints

**Category:** Prompt engineering
**Tags:** llm, system-prompt, constraint-placement, prompt-structure

## Problem

An LLM must follow a hard rule (e.g., "never include contact information in
the response"). You add the rule to the system prompt, but the model ignores
it ~30% of the time. The rule is correct — the placement is wrong.

## What Was Tried

1. **Rule embedded in the data section** — e.g., inside the "Contact Block
   Instructions" section of a long prompt. The model treats it as one of many
   formatting notes and skips it when the output is complex.
2. **Rule at the bottom of the prompt** — Lost in the noise. LLMs attend most
   strongly to the beginning and end of the system prompt, but a long prompt's
   "end" is often a data dump, not instructions.

## What Worked

Place the hard constraint at the very top of the system prompt, before any data
sections:

```ts
function buildSystemPrompt(data, platform) {
  const parts: string[] = [];

  // HARD CONSTRAINTS FIRST (the "kitchen door sign")
  if (platform === "gigsalad") {
    parts.push(
      "HARD CONSTRAINT: Do NOT include phone numbers, email addresses, " +
      "URLs, social media handles, or 'call me'/'text me' phrasing anywhere " +
      "in the response. This is a platform policy violation."
    );
  }

  // Then the role and task description
  parts.push("You are a music booking specialist...");

  // Then data sections (pricing, context, examples)
  parts.push(pricingData);
  parts.push(contextData);

  return parts.join("\n\n");
}
```

**Kitchen-door-sign analogy:** A "NO DOGS ALLOWED" sign works on the kitchen
door — you see it before you start cooking. The same rule written on a recipe
card (inside the instructions) gets overlooked because you're focused on the
recipe.

## Two-Layer Reinforcement

Hard constraints should appear in two places:

1. **Generation prompt** (top of system prompt) — prevents the model from
   generating the forbidden content
2. **Verification prompt** (gate/judge) — catches violations that slipped through
   generation and triggers a rewrite

Neither layer alone is reliable enough. Together they catch ~99% of violations.

## Reusable Pattern

1. System prompt structure: **constraints → role → task → data → examples**
2. Use "HARD CONSTRAINT:" prefix — signals priority to the model
3. Be specific about what's forbidden (list the exact types: phone, email, URL,
   social handles, "call me" phrasing)
4. Add a verification gate that checks for the same constraint independently
5. If the constraint is conditional (per-platform), use the if/else branch
   pattern rather than a single prompt with conditional language
