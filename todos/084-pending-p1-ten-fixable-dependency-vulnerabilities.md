---
status: pending
priority: p1
issue_id: "084"
tags: [security, dependencies, production, ci]
dependencies: []
unblocks: []
sub_priority: 1
---

# 084: 10 dependency vulnerabilities, all with fixes available

## Problem Statement

`npm audit` on `main` (2026-08-08, commit `2df70df`) reports **10
vulnerabilities: 1 low, 5 moderate, 4 high**. Every single one reports
`fixAvailable: true`.

Four of them sit in the dependency chain of the **live Express server** that
handles public webhook traffic (Mailgun and Twilio endpoints).

| Severity | Package | Issue |
|---|---|---|
| high | `axios` | `NO_PROXY` hostname normalization bypass |
| high | `form-data` | CRLF injection via unescaped multipart boundary |
| high | `ip-address` | XSS in `Address6` HTML-emitting methods |
| high | `path-to-regexp` | Regular Expression Denial of Service |
| moderate | `body-parser` | DoS on invalid limit |
| moderate | `express` | via `qs` |
| moderate | `express-rate-limit` | via `ip-address` |
| moderate | `follow-redirects` | leaks custom auth headers cross-domain |
| moderate | `qs` | remotely triggerable DoS — `qs.stringify` crashes |
| low | `esbuild` | arbitrary file read via the dev server |

`path-to-regexp` (ReDoS) and `qs` (remote DoS) are reachable through Express's
own routing and query parsing on a publicly-addressable service. `follow-redirects`
leaking auth headers matters because outbound calls carry API credentials.

**Found by:** `npm audit --json` during the CI-gate session, 2026-08-08.

## Correction to an earlier claim

When the CI workflow was designed (PR #24), `npm audit` was deliberately left
out of the gate, justified in part as: "an audit gate that fires on transitive
deps you cannot fix is exactly the check people learn to ignore."

**That justification was wrong on the facts.** All 10 have fixes available.
The reasoning would have been sound for unfixable advisories; it does not apply
here. This todo exists partly to make sure that error does not get inherited by
the next person who reads the CI file's comments.

## Findings

- Counts and per-package data captured from `npm audit --json`, not from the
  summary line — the summary alone cannot tell you whether a fix exists.
- `npm audit fix` is offered by npm as sufficient for all 10. Whether it is
  actually safe depends on whether any resolve to a semver-major bump; that was
  **not** checked at filing time and must be verified before running it.
- The repo has `package-lock.json` (lockfileVersion 3), so changes are
  reproducible and reviewable as a diff.
- CI (`.github/workflows/ci.yml`, added `316aab7`) runs typecheck + test only.
  It would catch a breakage introduced by the upgrade, which makes this a
  comparatively safe change to attempt: 342 tests currently pass.

## Proposed fix

1. Run `npm audit fix --dry-run` first and read the diff. Do **not** run
   `npm audit fix --force` — that is the one that pulls semver-major bumps.
2. Apply the non-breaking subset, run `npm run typecheck` and `npm test`, and
   confirm 342 passing.
3. For anything requiring a major bump (likely `express` 4 → 5 if it comes to
   that), file it separately rather than folding it in. An Express major is a
   migration, not a patch.
4. Deploy and re-verify production `/health` returns `200` and
   `/dashboard.html` returns `401`, with `/no-such-file.html` as the control.
5. Only after the count is at or near zero, decide whether to add `npm audit`
   to CI. Adding a gate while 10 findings are outstanding makes it red on day
   one, which is how gates get ignored.

## Acceptance criteria

- WHEN `npm audit` runs on `main` after the fix, THE SYSTEM SHALL report zero
  high-severity vulnerabilities.
- WHEN the dependency upgrade lands, THE SYSTEM SHALL still pass `npm run
  typecheck` (0 errors) and `npm test` (342 passing) in CI.
- WHEN any advisory is deliberately not fixed, THE SYSTEM SHALL record which
  one and why in this file, so "not fixed" is distinguishable from "not looked
  at".
