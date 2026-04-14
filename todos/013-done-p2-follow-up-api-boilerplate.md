---
status: done
priority: p2
issue_id: "013"
tags: [code-review, code-quality]
dependencies: []
unblocks: []
sub_priority: 6
---

# 013: Follow-up API has 4 copy-pasted handler boilerplate

## Problem Statement

All four POST handlers in `follow-up-api.ts` repeat the same pattern: parse ID, validate, fetch lead, check null, call action, shape lead, return. The only differences are the action function called and (for snooze) the body validation. This is ~130 lines that could be ~50 with a shared handler helper.

**Found by:** Code Simplicity Reviewer, Architecture Strategist

## Proposed Solutions

### Option A: Extract handleAction helper (Recommended)
```typescript
function handleAction(req, res, actionFn) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid lead ID" });
  if (!getLead(id)) return res.status(404).json({ error: "Lead not found" });
  const updated = actionFn(id);
  if (!updated) return res.status(409).json({ error: "Invalid state" });
  const shaped = shapeLead(updated);
  if (!shaped) return res.status(500).json({ error: "Failed to shape lead" });
  res.json({ success: true, lead: shaped });
}
```
Snooze handler adds its own body validation before calling the helper.
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files:** `src/follow-up-api.ts`

## Acceptance Criteria

- [ ] Shared handler helper eliminates copy-paste
- [ ] All 4 endpoints still work identically

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
