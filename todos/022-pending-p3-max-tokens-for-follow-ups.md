---
status: done
priority: p3
issue_id: "022"
tags: [code-review, performance, follow-up-pipeline]
dependencies: []
---

# Add maxTokens parameter to callClaudeText for follow-ups

## Problem Statement

`callClaudeText()` hardcodes `max_tokens: 4096`. Follow-up messages are 2-3 sentences (~50-80 tokens). If the model malfunctions, a runaway generation at 4096 tokens costs real money and takes ~8 seconds instead of ~1 second.

## Findings

- **Source:** Performance oracle (OPT-2)
- **File:** `src/claude.ts:82`, `src/pipeline/follow-up-generate.ts:14-17`

## Proposed Solutions

### Option A: Add optional maxTokens parameter to callClaudeText

```typescript
export async function callClaudeText(
  systemPrompt: string,
  userMessage: string,
  model: string = "claude-sonnet-4-6",
  maxTokens: number = 4096,
): Promise<string> {
```

Then call with `256` from follow-up-generate.ts.

- **Effort:** Small (5 min)

## Acceptance Criteria

- [ ] `callClaudeText` accepts optional `maxTokens` parameter
- [ ] Follow-up generator passes `256` as maxTokens
- [ ] Existing callers unaffected (default 4096)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | |
