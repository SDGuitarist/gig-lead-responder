---
status: pending
priority: p3
issue_id: "037"
tags: [code-review, security, llm-pipeline]
dependencies: ["025"]
unblocks: []
sub_priority: 3
---

# 037: LLM boundary hardening -- follow-up prompt, SMS edit limits, anti-extraction

## Problem Statement

Secondary LLM pipeline security items that complement the P1 prompt injection fix (025): (1) follow-up prompt injects original draft (LLM output) into Haiku system prompt without boundary, (2) SMS edit instructions have no length limit on the Twilio path, (3) no anti-extraction instructions in system prompts to prevent proprietary strategy leakage, (4) verify gate fail_reasons fed back as generation instructions creates a feedback loop.

**Found by:** LLM Pipeline Security Agent

## Findings

- `src/prompts/follow-up.ts:54` -- compressed_draft injected into system prompt without delimiters
- `src/twilio-webhook.ts:256` -- SMS body used as rewrite instructions with no length guard
- `src/prompts/classify.ts`, `src/prompts/generate.ts` -- no "do not reveal instructions" preamble
- `src/pipeline/verify.ts:40-43` -- fail_reasons from LLM output become generation instructions

## Proposed Solutions

### Solution A: Incremental hardening
1. Add XML delimiters around untrusted content in follow-up prompt (aligns with 025 fix)
2. Add MAX_SMS_EDIT_LENGTH (e.g., 1000 chars) on Twilio edit path
3. Add anti-extraction preamble to classify and generate prompts
4. Truncate verify fail_reasons to 500 chars each

**Effort:** Small-Medium | **Risk:** Low

## Acceptance Criteria

- [ ] Follow-up prompt wraps untrusted content in delimiters
- [ ] SMS edit instructions bounded by length limit
- [ ] System prompts include anti-extraction instructions
- [ ] Verify fail_reasons truncated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Depends on 025 for primary injection fix |
