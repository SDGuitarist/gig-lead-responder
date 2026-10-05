# Codex round 1 — GigSalad "Mark as unread" (`5ea6f8e..0e1bd78`)

**Verdict: NO-GO** (2 P1; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `0e1bd78`; tree clean after; no browser or GigSalad access by Codex). Verbatim:

---

## Verdict: NO-GO

P1 — `src/automation/portals/gigsalad-unread.ts:83-87`

Concrete failure: after clicking, GigSalad redirects `/promokit/inbox-unread` to another page, or the lead appears on page 2. `listGigIds()` collects links from whatever page is currently loaded, without checking the final URL or pagination. It can falsely report `restored`, or report failure after a successful restore.

Root cause: verification treats one DOM page as the complete Unread/Archived view.

Required fix: verify each destination URL, and explicitly traverse/validate pagination until the lead is found or the view is exhausted. Add tests for redirects, delayed loading, and page-2 placement.

P1 — `src/automation/portals/gigsalad-enrich.ts:39-40`

Concrete failure: `fetchGigSaladLead` opens the exact lead page, but parsing fails or the browser errors afterward. Enrichment returns `hold` before calling `restoreUnread`, leaving the opened lead marked read.

Root cause: restoration is gated on `page.status === "ok"` rather than on whether the target lead page was actually opened.

Required fix: make the fetch result preserve whether the requested lead page was successfully opened, then restore it for all such outcomes while still avoiding restoration for login redirects, inbox mismatches, and pages never opened. Add a regression test for an opened-but-unparseable page.

Checked clean:

- The pre-click guards reject wrong lead URLs, wrong form actions, zero/multiple matching buttons, and login redirects.
- Restore failures and thrown errors do not turn enrichment into a retried/failed lead.
- Unopened paths in the tested dependency flow are not restored.
- Tests do not launch a browser or reach GigSalad; the fake-page assertions are non-vacuous for the pure function, but do not cover the real adapter’s redirects, pagination, or loading behavior.
- `npm run test:match -- gigsalad`: 170 pass, 0 fail.
- Full `npm test` was sandbox-limited: 606 pass, 17 environment-related failures, 1 skip; failures were listen/sysctl permission errors.

No files were edited, and no browser, server, database, or GigSalad page was accessed.
