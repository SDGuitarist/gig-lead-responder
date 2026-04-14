---
status: done
priority: p1
issue_id: "024"
tags: [code-review, security, llm-pipeline]
dependencies: []
unblocks: []
sub_priority: 2
---

# 024: No input size guard on webhook path before LLM calls

## Problem Statement

The `/api/analyze` endpoint has a 50K character guard (`api.ts:305`), but the webhook path (`webhook.ts:125` -> `runPipeline`) has **no size limit** on `rawText` before sending it to the Anthropic API. A large email (forwarded thread, 100K+ chars) is passed untruncated through classify -> generate -> verify, each embedding the full text. With the verify retry loop (up to 3 generate + 3 verify), a single oversized lead triggers up to 6 expensive LLM calls.

**Found by:** LLM Pipeline Security Agent

## Findings

- `src/pipeline/classify.ts:11` -- `const userMessage = "Classify this lead:\n\n" + rawText` with no length check
- `src/run-pipeline.ts:77` -- passes rawText straight from webhook with no truncation
- `src/claude.ts:30-31` -- `max_tokens: 4096` limits output but no input token guard
- `src/api.ts:305` -- the analyze endpoint correctly has `if (text.length > 50000)` but webhook path lacks it

## Proposed Solutions

### Solution A: Add MAX_RAW_TEXT_LENGTH constant in runPipeline (Recommended)
**Pros:** Single guard point, consistent with analyze endpoint pattern
**Cons:** None
**Effort:** Small (5 lines)
**Risk:** Low

```typescript
const MAX_RAW_TEXT_LENGTH = 50_000;

export async function runPipeline(rawText: string, ...): PipelineResult {
  if (rawText.length > MAX_RAW_TEXT_LENGTH) {
    rawText = rawText.slice(0, MAX_RAW_TEXT_LENGTH);
    console.warn(`Truncated lead text from ${rawText.length} to ${MAX_RAW_TEXT_LENGTH} chars`);
  }
  // ... existing code
}
```

### Solution B: Reject oversized leads at webhook entry
**Pros:** Fails fast before any processing
**Cons:** Loses potential leads (better to truncate than reject)
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] `runPipeline()` truncates or rejects input exceeding MAX_RAW_TEXT_LENGTH
- [ ] Truncation is logged with original and truncated length
- [ ] Unit test: verify oversized input is handled without error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Webhook path missing guard that analyze endpoint already has |
