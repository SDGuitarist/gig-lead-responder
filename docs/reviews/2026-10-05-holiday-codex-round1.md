# Codex round 1 — R292 holiday/peak hold (`f160d5d..aa82935`)

**Verdict: NO-GO** (1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `aa82935`; tree clean after). Verbatim:

---

## Verdict: NO-GO

P2 — `src/types.ts:8-10`

The new `holiday_peak:` warning is not included in `HOLD_NOTE_PREFIXES`. Therefore, holiday leads are held by the router, but the internal warning is still passed into generation/verification prompts and may leak into the client-facing draft or force inappropriate concern traceability.

Root cause: the new hold-note prefix was added without updating the shared hold-note filter.

Required fix: add `holiday_peak:` to `HOLD_NOTE_PREFIXES`, with a regression test proving it is removed from generation/verification inputs while remaining in `classification.flagged_concerns` for routing.

No P1 or P3 findings.

Checked clean:

- `npm run test:match -- "port manifest"` — 143 passed
- `npx tsc --noEmit` — passed
- Mother's Day arithmetic checked, including May 1 Sunday years
- Router, webhook, dashboard approval, auto-send, follow-up, residency, ceremony, wedding-adjacent, and travel paths reviewed
- No files edited; no server, poller, database, network, or browser used

