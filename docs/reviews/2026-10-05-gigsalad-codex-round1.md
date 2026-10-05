# Codex round 1 — GigSalad portal reading (`a86b7f4..ec8649b`)

**Verdict: NO-GO** (5 P1 + 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `ec8649b`; tree clean after). Codex sandbox: gigsalad tests 35/0; full suite 571 pass / 16 sandbox-blocked; Mac 587/0/1/0. Prompt: session scratchpad `codex-round1-gigsalad.md`. Verbatim final report below.

---

## Verdict: NO-GO

### P1 — Contact data leaks from page title and non-US phone formats

File: `src/automation/parsers/gigsalad-page.ts:29,51,93-100`

Failing input:

```text
title: "Gig Lead from alice@example.com | GigSalad"
field: "Contact: +44 20 7946 0958"
```

Observed: the email reaches `clientFirstName`, and the international phone reaches `fields` and `rawText`, then can reach the DB, prompt, logs, or alerts.

Root cause: sanitization only recognizes common US phone formats and does not sanitize the title-derived client name.

Required fix: apply one fail-closed contact sanitizer to title names and all field/raw-text values; add tests for title emails, international phones, and multiline fields.

### P1 — Wrong page can be accepted as the requested lead

File: `src/automation/portals/gigsalad-fetch.ts:28-38`

Failing input: request lead `8`, but the opener returns:

```text
url: https://www.gigsalad.com/promokit/gig/999
title: "Gig Lead from Other | GigSalad"
```

Observed: `readFetchedPage()` returns `status: "ok"` and enrichment proceeds.

Root cause: the final URL and page identity are never checked against the requested `gigId`.

Required fix: validate the final URL’s host, path, and exact lead ID before parsing; otherwise hold as `not_a_lead`.

### P1 — Matching can select an unrelated lead

File: `src/automation/portals/gigsalad-match.ts:27-33,55-60`

Failing input:

```text
Email: "Alex would like a quote for a Wedding on August 1, 2026"
Inbox: one unrelated Alex, Wedding, August 1, 2026
```

Observed: the unrelated inbox row is returned as `matched`.

Root cause: first name + event type + date is not a unique identity key.

Required fix: require a stable shared identifier, or hold when the available key cannot prove identity. Add a regression test for the single-collision case.

### P1 — GigSalad `portalUrl` remains armed

Files: `src/automation/parsers/gigsalad.ts:24-38,125`; `src/automation/orchestrator.ts:121-139`

Failing input: an email containing:

```html
<a href="https://www.gigsalad.com/leads/respond/123">View</a>
```

Observed: the initial parser stores the URL. GigSalad enrichment does not clear it, so routing can reach `gigsaladClient.submitReply()`.

Root cause: the new enrichment path assumes `portalUrl` is unset but never explicitly clears or prevents the legacy parser from setting it.

Required fix: make GigSalad `portalUrl` unavailable/empty throughout this path and add a test asserting dispatch is never called.

### P1 — `not_a_lead_email` can fall through with near-empty text

Files: `src/automation/orchestrator.ts:121-163`; `src/automation/parsers/gigsalad.ts:31-38`

Failing input:

```text
Event Type: Wedding
```

with enrichment result `{ status: "not_a_lead_email" }`.

Observed: the old parser returns medium confidence, and only `low` confidence is held; the pipeline receives the near-empty text.

Root cause: `not_a_lead_email` is silently treated as successful legacy parsing.

Required fix: explicitly hold unless the legacy parser produces sufficient validated content. Add an orchestrator test proving the pipeline is not called.

### P2 — Parser validation and resource limits are incomplete

Files: `src/automation/parsers/gigsalad-page.ts:55-101`; `src/automation/portals/gigsalad-match.ts:22-50`

Issues:

- `parseGigSaladLeadPage` has no input-size bound.
- `isoDate()` accepts impossible dates such as `2026-02-31`.
- `parseInboxRow()` accepts arbitrarily large row text.
- The page parser accepts any page containing `Event info`, without validating the expected GigSalad URL.

