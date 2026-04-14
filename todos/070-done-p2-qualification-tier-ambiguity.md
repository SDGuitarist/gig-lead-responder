---
status: done
priority: p2
issue_id: "070"
tags: [prompts, classify, context-docs, conflict]
dependencies: []
unblocks: []
sub_priority: 1
---

# Qualification Tier Defined Differently in Classify vs QUICK_REFERENCE

## Problem

Classify prompt: "Budget mismatch (low budget + big request), vague + key
details missing **(and low competition)**, placeholder numbers"

QUICK_REFERENCE.md: "Budget mismatch (low budget + big request), vague request
+ low competition, placeholder numbers"

The classify prompt adds "(and low competition)" as a qualifier for the vague
lead trigger. QUICK_REFERENCE doesn't scope it the same way. A vague lead with
HIGH competition could be classified as qualification by one definition but not
the other.

## Proposed Fix

Align the definitions. The classify prompt's version is more nuanced (vague +
low competition = qualification makes sense because high competition vague
leads should assume and quote, not downgrade to qualification). Make
QUICK_REFERENCE match.

## Files

- `src/prompts/classify.ts` (lines 86-87)
- `docs/QUICK_REFERENCE.md` (lines 65-69)
