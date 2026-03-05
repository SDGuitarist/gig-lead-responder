# HANDOFF -- Gig Lead Responder

**Date:** 2026-03-05
**Branch:** `main` (commit 44ca4b3)
**Phase:** Fix-batched complete — Cycle 13 P1s + P2s applied. Ready for Compound.

## Current State

All 8 security findings (3 P1 + 5 P2) from the email-parser.ts security review (Cycle 13) are fixed, committed, pushed, and `tsc --noEmit` clean.

### Commits (7 — fixes 003+004 merged into one)

| Commit | Finding | What changed |
|--------|---------|-------------|
| `a05e471` | 001 (P1) | ReDoS regex: `.*?` → `[^<]*` in EVENT DATE pattern |
| `2683ca0` | 002 (P1) | `wrapUntrustedData("lead_email", rawText)` in classify.ts |
| `b1ea37f` | 003+004 (P1+P2) | `String(field ?? "")` casts + explicit empty Message-Id check |
| `8850d76` | 005 (P2) | 200K `.slice()` on body-plain/body-html before regex |
| `60bb022` | 006 (P2) | `limit: "100kb"` on `express.urlencoded()` |
| `6ec2b9f` | 007 (P2) | `isValidTokenUrl()` — HTTPS + gigsalad.com/thebash.com domain |
| `44ca4b3` | 008 (P2) | `DEV_WEBHOOK_KEY` required when Mailgun validation disabled |

### Files changed

- `src/email-parser.ts` — fixes 001, 005, 007 (ReDoS, length limits, URL validation)
- `src/webhook.ts` — fixes 003, 004, 008 (type safety, Message-Id, dev auth)
- `src/pipeline/classify.ts` — fix 002 (prompt injection defense)
- `src/server.ts` — fix 006 (urlencoded body limit)

### Prior Phase Risk

> "What might this review have missed? (a) The full prompt injection surface beyond classify.ts... (b) Whether token_url is used anywhere beyond the immediate webhook handler... (c) Behavior when Express receives multipart/form-data instead of urlencoded."
> -- REVIEW-SUMMARY.md, Three Questions #3

This fix-batched phase addressed (a) for classify.ts specifically and (b) by adding URL validation at extraction time. Item (c) remains unaddressed — Mailgun multipart support is a separate concern for a future review.

### Breaking change for local dev

If you use `DISABLE_MAILGUN_VALIDATION=true`, you now need:
- `DEV_WEBHOOK_KEY=<some-secret>` in `.env`
- `dev_key=<same-secret>` in test POST body

## Previous Sessions

### Cycle 13 review (commit 7379fce)

email-parser.ts dedicated security review. 13 findings (3 P1, 5 P2, 5 P3). Review artifacts in `docs/reviews/email-parser-security/`.

### leads.ts structural split (commits d0cdcb3..05f762d)

751-line God Module split into 4 focused modules under `src/db/`.

### Cycle 12 fixes (commits 8e09ce5..475bd12)

8 fixes: CSP nonce, POST logout, replay protection, typeof guard, dynamic SQL, inlined validator, dead types, dead re-export.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Review (Cycle 13) | `docs/reviews/email-parser-security/REVIEW-SUMMARY.md` |
| Solution (Cycle 12) | `docs/solutions/architecture/review-fix-cycle-4-hardening-and-cleanup.md` |
| Solution (Cycle 11) | `docs/solutions/architecture/review-fix-cycle-3-security-hardening.md` |
| Solution (Cycle 10) | `docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md` |

## Deferred Items

**Structural debt:**
- dashboard.html 2,474 lines JS extraction at 3,000 threshold

**Known security gaps (from security-sentinel reviews):**
- verify.ts flagged_concerns injected outside XML delimiters
- follow-up.ts classification fields skip `sanitizeClassification()`
- `compressed_draft` has no independent length limit
- `index.html` and `mockup-hybrid.html` not covered by CSP nonce injection (verify if actively served)
- `csrfGuard` Basic Auth bypass path undocumented
- Mailgun multipart/form-data behavior untested
- P3s from Cycle 13 (009-013) deferred — redundant from-checking, silent undefined location, trailing-period regex, test `as any`

## Three Questions

1. **Hardest fix in this batch?** Fix 003+004 — the `as string` casts and empty Message-Id logic overlapped on the same lines. Merging them into one commit was cleaner than splitting a 3-line window into two commits, but it blurs the P1/P2 boundary.

2. **What did you consider fixing differently, and why didn't you?** Considered making `isValidTokenUrl()` accept a configurable allowlist of domains instead of hardcoding gigsalad.com and thebash.com. Didn't because YAGNI — there are only two lead platforms and adding a third would require parser changes anyway, at which point the domain list would naturally expand.

3. **Least confident about going into compound phase?** The `DEV_WEBHOOK_KEY` fix (008) changes the local dev workflow — any existing curl scripts or test tooling that sends to `/webhook/mailgun` without `dev_key` will break silently with a 401. Should document in README or .env.example.

## Prompt for Next Session

```
Read docs/HANDOFF.md. This is Gig Lead Responder on branch main.
Fix-batched phase complete for Cycle 13 (email-parser security).
Run compound phase: write solution doc in docs/solutions/, then
run /update-learnings, then ask about code-explainer.

Review: docs/reviews/email-parser-security/REVIEW-SUMMARY.md
Fixes: 7 commits (a05e471..44ca4b3) — 3 P1s + 5 P2s across 4 files.
Key patterns: ReDoS prevention, prompt injection defense, boundary type safety,
URL validation, dev auth hardening.
```
