# Review Context — Gig Lead Responder

## Risk Chain

**Plan risk:** "The 2 dynamic `style="width:X%"` attributes use string concatenation to build HTML. The `data-width` + post-render JS approach requires hooking into every place these elements get inserted via innerHTML. If a render hook is missed, bars render at 0 width."

**Work resolution:** All 4 innerHTML call sites hooked with `applyDataWidths()`. Work phase flagged uncertainty about complete coverage.

**Review resolution:** 0 P1, 2 P2, 6 P3 from 7 agents. Security Sentinel independently verified all 4 call sites match all innerHTML assignments. Architecture Strategist recommends contract comment (062). Data Migration Expert found updateLead missing normalization (063).

**Compound resolution:** Solution doc written with 3 named patterns. Risk chain closed — applyDataWidths coverage confirmed complete.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `public/dashboard.html` | 14 inline styles → CSS classes, 2 dynamic widths → data-width + applyDataWidths (4 call sites) | Must call applyDataWidths after innerHTML with data-width elements |
| `public/dashboard.css` | New classes for extracted styles + mobile-card-muted | Cache-bust param (?v=2) must accompany class additions |
| `src/server.ts` | CSP unsafe-inline removed, Cache-Control 1h added | Complete — all inline styles extracted |
| `src/db/migrate.ts` | event_type normalization migration (guard-checked, idempotent) | Self-quenching after first run |
| `src/db/leads.ts` | `??` → `||` for event_type write path | updateLead still lacks normalization (063) |
| `src/db/queries.ts` | Removed LOWER(TRIM()) from Query 6 | Clean — data normalized at write time |

## Remaining Gaps (carried forward)

- `linked_expectations` field reserved but not enforced — Phase 2 work
- Analytics transaction error handling (8 queries, what if one throws?)
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- Pre-existing P1s: XSS unescaped LLM values (023), no input size guard (024), prompt injection chain (025)
- P2 follow-ups: applyDataWidths contract comment (062), updateLead event_type normalization (063)
- leads.ts structural split (brainstorm+plan exist)

## Plan Reference

`docs/plans/2026-03-08-fix-p3-bundle-061-plan.md`
