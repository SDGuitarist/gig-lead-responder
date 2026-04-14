---
status: pending
priority: p2
issue_id: "081"
tags: [pipeline, generate, verify, cost, quality, advisor]
dependencies: []
unblocks: ["065"]
sub_priority: 1
---

# Add Opus Advisor Tool to Generate and Verify Stages

## Problem

The pipeline uses the same Claude model for classify, generate, and verify.
This creates native bias: the verifier shares the same blind spots, phrasing
tendencies, and aesthetic standards as the generator. The gate can pass drafts
that "sound right to Claude" but don't sound right to a human.

Specific blind spots:
- Voice drift (Claude's default phrasing passes Claude's voice check)
- Hallucinated quality (verifier grades by the same aesthetics that generated)
- Shared failure modes (if Claude misunderstands "cinematic," both stages share
  that misunderstanding)
- The `sounds_like_alex` check is the weakest link (no voice references in
  verify, and even with them, same model evaluating its own output is circular)

## Proposed Solution: Advisor Tool (Option C — Both Stages)

Use Anthropic's advisor tool (beta: `advisor-tool-2026-03-01`) to run the
pipeline with **Sonnet as executor** and **Opus as advisor** on both the
generate and verify stages.

### Stage 4 (Generate): Opus advises on strategy
- Sonnet generates the draft
- Opus advises on: wedge selection, voice calibration, concern resolution
  strategy, cinematic opening quality
- Sonnet executes the draft informed by Opus guidance
- Result: close to Opus-quality drafts at Sonnet token rates

### Stage 5 (Verify): Opus advises on judgment
- Sonnet runs the rubric evaluation
- Opus advises on: `sounds_like_alex` judgment, gate pass/fail decision,
  whether fail_reasons are specific enough for rewrite
- This is where the bias-breaking matters most — Opus is a separate inference
  pass with different reasoning patterns than the executor
- Result: verification that isn't self-grading

### Why 2 advisor calls fits the pattern
The advisor tool docs say it works best with 2-3 calls per task. Two calls
(generate + verify) fits perfectly. Advisor caching can be enabled since the
system prompt + context docs would cache across both calls.

## Implementation

### API Integration
```typescript
// In callClaude() or a new callClaudeWithAdvisor()
const response = await client.beta.messages.create({
  model: "claude-sonnet-4-6",        // executor
  max_tokens: 4096,
  betas: ["advisor-tool-2026-03-01"],
  tools: [
    {
      type: "advisor_20260301",
      name: "advisor",
      model: "claude-opus-4-6",       // advisor
      caching: { type: "ephemeral", ttl: "5m" },
    }
  ],
  messages: [{ role: "user", content: userMessage }],
});
```

### Key decisions
1. **Caching:** Enable advisor-side caching (`ttl: "5m"`) since we make 2
   calls per pipeline run. The docs say caching breaks even at ~3 calls, but
   with the shared context docs prefix it should help at 2.
2. **max_uses:** Set to 1 per stage call (advisor consults once per stage, not
   in a loop).
3. **Fallback:** If advisor returns an error (overloaded, rate limited), fall
   back to executor-only mode. The pipeline should degrade gracefully, not
   crash.
4. **Stage 1 (Classify):** Keep as-is. Classification is structured JSON
   extraction — mechanical work where the advisor adds less value. Save the
   advisor budget for stages where judgment matters.

### Cost estimate
- Current: all tokens at Opus rates
- Proposed: bulk generation at Sonnet rates, ~1,400-1,800 advisor tokens per
  call at Opus rates (2 calls = ~2,800-3,600 Opus tokens total)
- Net: significant cost reduction with quality maintained or improved on the
  judgment calls

### Files to change
- `src/claude.ts` — add `callClaudeWithAdvisor()` function or modify existing
  `callClaude()` to accept advisor config
- `src/pipeline/generate.ts` — use advisor-enabled call
- `src/pipeline/verify.ts` — use advisor-enabled call
- `src/constants.ts` — add advisor model config, beta header
- `.env` — no change needed (same API key)

### System prompt addition for advisor timing
Per the advisor docs best practices, add to the executor system prompt:
```
The advisor should respond in under 100 words and use enumerated steps,
not explanations.
```
This cuts advisor output tokens by 35-45% without changing quality.

## Also addresses
- Todo 065 (verify prompt missing voice references) — Opus advisor sees the
  full transcript including voice references from the generate stage, so it
  has voice context when advising on verification
- The native bias concern — different model inference breaks the self-grading
  loop

## Origin

Discussion about structural bias in the verify gate (2026-04-13). The same
model writing and grading drafts creates blind spots that no amount of prompt
engineering can fix. A separate model inference is required to break the loop.
The Anthropic advisor tool provides this without the complexity of integrating
a different provider's API.
