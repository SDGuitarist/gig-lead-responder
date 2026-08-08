---
status: done
priority: p2
issue_id: "086"
tags: [deploy, observability, ambiguous-output, railway]
dependencies: []
unblocks: []
sub_priority: 1
---

# 086: /health exposes no build identifier, so deploys cannot be verified

## Problem Statement

`GET /health` returns:

```json
{"status":"ok","rejectedEmails":0}
```

There is no commit SHA, no build time, no version. Railway auto-deploys from
`main`, so after every merge the only available check is that `/health`
returns `200` — which it also returned *before* the merge.

**"The new build is live and healthy" and "the old build is still serving"
produce byte-identical output.** The check cannot distinguish them, and it
reports success either way.

**Found by:** PR #28 deploy verification, 2026-08-08.

## Why it surfaced when it did

PRs #23 through #27 were type-only changes and documentation. For those, the
inability to confirm the deploy barely mattered — an adversarial review had
already proven the emitted JavaScript was byte-identical to `main`'s, so
"deployed" and "not deployed" were the same program.

PR #28 was different. It moved `tsx` `4.21.0 -> 4.23.11`, and `npm start` is
`tsx src/index.ts` — the interpreter running the production app was upgraded.
That is a real runtime change, and it is exactly the case where you want to
confirm the new build is actually serving. It could not be confirmed.

Fallbacks were also unavailable: the Railway CLI token was expired
(`Warning: failed to refresh OAuth token ... Unauthorized`), and there is no
deploy workflow in `.github/workflows/` to read a status from.

So the deploy is **inferred, not verified** — and the todo exists so that
distinction is recorded rather than quietly rounded up to "verified".

## Proposed fix

Add a build identifier to the `/health` payload:

```json
{"status":"ok","rejectedEmails":0,"commit":"a8389e5","startedAt":"2026-08-08T17:40:00Z"}
```

Railway exposes the deployed commit as `RAILWAY_GIT_COMMIT_SHA`. Read it at
startup, default to `"unknown"` when absent (local dev), and include it in the
health response. `startedAt` captured at process boot is a useful second
signal: it distinguishes a fresh deploy from a long-running old process even
if the SHA is somehow missing.

Then post-deploy verification becomes a real check:

```
curl -s $URL/health | jq -r .commit   # must equal the merged SHA
```

## Why p2

Nothing is broken and nothing is exposed. The cost is that every deploy
verification from here on is weaker than it appears, and the weakness is
invisible — which is the property that makes this class of defect worth
fixing rather than tolerating. Compare `083`: same shape, different surface.

## Acceptance criteria

- WHEN `/health` is requested on a deployed instance, THE SYSTEM SHALL include
  the commit SHA of the running build.
- WHEN the SHA is unavailable (local dev, missing env var), THE SYSTEM SHALL
  return an explicit `"unknown"` rather than omitting the field — a missing
  field and an unknown build must not read the same.
- WHEN a deploy is verified after a merge, THE SYSTEM SHALL compare the
  returned SHA against the merged commit, not merely assert a `200`.
- THE SYSTEM SHALL NOT expose branch names, build logs, or environment values
  through this endpoint — it is unauthenticated. A short SHA and a timestamp
  are sufficient.

## Resolution — 2026-08-08, PR #30 (`2550b96`)

`/health` now returns:

```json
{"status":"ok","rejectedEmails":0,"commit":"2550b96","startedAt":"2026-08-08T17:48:52.020Z"}
```

Implemented in `src/build-info.ts`, wired in at `src/app.ts:51`. 9 new tests;
suite 342 -> 351.

**Verified end to end, and this is the part that matters.** The merge commit
was `2550b96`; production `/health` returned `"commit":"2550b96"`. That is the
first deploy in this repo confirmed rather than inferred -- previously the only
signal was a `200` that was equally true before the merge.

It also settled the open assumption: `RAILWAY_GIT_COMMIT_SHA` **is** the
correct variable name. Had it been wrong, the endpoint would have returned
`"unknown"` -- which is exactly why the field returns a literal `"unknown"`
instead of being omitted. A wrong guess would have been visible rather than
silent.

Controls re-checked at the same time: `/dashboard.html` 401, `/dashboard.css`
200, `/no-such-file.html` 401.

**Deploy verification from here on:**

```
curl -s $URL/health | jq -r .commit   # must equal the merged SHA
```
