# HANDOFF -- Gig Lead Responder

**Date:** 2026-07-18
**Branch:** `main`
**Phase:** Real-lead intake completed locally; partial analysis complete and the remaining backlog is blocked by exhausted Anthropic API credits.

## First 60 Seconds: Peer-Session Check

Sessions run in parallel here. On 2026-08-08 one cut a branch at `e339340` while another
landed `197f118` + `4ff91c6` (Yelp credential-leak fix) on `main`; it found out at merge time.

1. **Before cutting a branch:** `git fetch origin && git log --oneline HEAD..origin/main`.
   Fetch first — without it, "up to date" and "stale" both print nothing. Any line = a peer landed work.
2. **Before editing:** `git status --short`. A dirty tree you did not dirty is a live peer; read
   every diff before touching it (global CLAUDE.md → "Parallel Sessions on One Repo").
3. **After merging `main` into your branch:** re-run `npm run typecheck && npm test` locally — a
   clean merge means no textual conflict, not that the combination works. CI only runs once you push.

> **Reconciliation note (2026-06-25):** Phase 2 was implemented and merged on
> 2026-05-31 but the HANDOFF/plan/compound all drifted, leaving a false
> impression that Phase 2 hadn't started. Reconciled from verified git history:
> HANDOFF + plan status corrected (PR #20), and the skipped compound doc written
> + learnings propagated (this cycle). No production code changed.

## Current State

### 2026-07-18 real-lead intake session

- Imported **16 genuine, future-dated gig inquiries** from the authenticated Gmail account into `data/leads.db`: 13 Squarespace inquiries and 3 GigSalad inquiries.
- Excluded reminders, duplicates, tests, obvious spam, and past events. Every imported record has a dated event between 2026-07-20 and 2027-02-13.
- Imported records as raw `received` leads only. No AI analysis or draft generation ran, and no email or SMS was sent.
- Kept `DRY_RUN=true` and `AUTO_SEND_ENABLED=false` throughout the import. The one-time import payload and helper were removed after verification.
- Verified the database contains exactly 16 leads and `git diff --check` passes.
- Investigated the dashboard's long-running “Pipeline running” state. All 16 imported records have `pipeline_completed_at = NULL` and no draft, confirming that no analysis job was active. A sending-disabled test of one lead returned Anthropic HTTP 401 (`API key is invalid`). The test record was restored exactly to its pre-test `received` state and the temporary diagnostic helper was removed.
- Re-tested after the user replaced the `.env` value on 2026-07-20. The file has exactly one well-formed `ANTHROPIC_API_KEY` entry with the expected prefix and no whitespace or placeholder text, but Anthropic still returns HTTP 401. No lead was modified. The credential itself is invalid or revoked and must be regenerated in Anthropic Console.
- After a new key was generated, found that an older inherited shell variable was overriding `.env`; running with that stale value removed validated the new key successfully.
- Saved three no-send analyses: Sydney Lukasezck (confidence 90, gate passed), Samantha V (confidence 70, gate passed), and Lali (confidence 0, gate failed and requires manual review). Johnny Martinez and Jennifer hit clarification-draft validation errors without record changes. The account then returned `credit balance is too low`, leaving the other 11 records untouched.
- All 16 leads remain in `received` status. The three saved drafts have `pipeline_completed_at = NULL` intentionally so startup recovery cannot interpret them as interrupted SMS deliveries. No email, platform reply, or SMS was sent.

### 2026-07-18 dashboard UI/UX session

Completed the full ten-item operational pass in priority order:

- Clarified approval scope and destination; **Approve draft** explicitly sends the phone-ready copy to Alex’s phone, not to the client.
- Rebuilt expanded leads as a focused review workspace with a primary draft, collapsible phone copy, confidence explanation, decision brief, and persistent actions.
- Added urgency-based queue ordering and visible reasons, Follow-Up badges/banner, guided Analyze first use and progress, actionable Insights, retry/loading/error states, keyboard row expansion, and populated mobile layouts.
- Used a temporary, isolated fictional fixture database for visual verification, then stopped the fixture server, detached the database from the project, and removed the generator after confirming the product must display real gigs only.
- Verified fictional populated Queue, expanded lead, Follow-Ups, Insights, Analyze validation, and 390px mobile states in the in-app browser. No live record was touched and no message was successfully sent.
- Saved final evidence in `docs/audits/2026-07-18-ui-ux/` and updated the audit.
- Verification: dashboard script syntax passed; `git diff --check` passed; `npm test` **315 passed, 0 failed**. `npx tsc --noEmit` still reports pre-existing errors in automation/router/Claude typing files not changed in this pass.

Completed a combined desktop/mobile audit and implemented the highest-priority fixes in `public/dashboard.html` and `public/dashboard.css`:

- Fixed document-level horizontal overflow caused by the five-tab mobile navigation.
- Added compact 2×2 mobile metrics, task-oriented empty states, and direct next actions.
- Added a persistent Analyze label and clearer helper copy.
- Added tab semantics, roving focus, arrow-key navigation, visible focus, and reduced-motion support.
- Bumped the dashboard stylesheet URL through `v=5` so the responsive and operational corrections are not masked by the one-hour static cache.
- Saved before/after evidence and the audit at `docs/audits/2026-07-18-ui-ux/`.
- Verified 390px and 1280px layouts in the local dashboard. `npm test`: **315 passed, 0 failed**.

The original empty-state gap was checked with temporary isolated fictional fixtures that are no longer connected to the app. Real approval/follow-up mutations and live AI streaming remain intentionally unexecuted until an inert staging adapter is available.

**Phase 1** (P3 Batch + Gmail Intake) — complete: brainstorm → plan → work → review → compound. 293 tests passing at that baseline.

**Phase 2** (Gmail Intake: Enable Auto-Send + Dashboard done_reason) — **implemented, Codex-reviewed, and merged to `main` via PR #19 on 2026-05-31.** Delivered:
- **P0 fix:** auto-send path calls `completeApproval()` (`src/automation/orchestrator.ts:295`) so auto-sent leads schedule follow-ups atomically.
- **P1:** `autoSendEnabled` mode logged at startup (`9c97fd5`); guards against stale Railway env vars.
- **done_reason** rendered on lead cards (`2d0dd3e`, `public/dashboard.html`) and threaded through orchestrator + DB layer.

`main` is up to date with `origin/main` (pushed). Test count not re-verified in this reconciliation pass.

**Auto-send is NOT live.** `autoSendEnabled` defaults to `false` (review-only). Enabling is a one-way operational change via Railway env `AUTO_SEND_ENABLED=true` — deliberately gated behind a draft-quality monitoring period per the Phase 2 plan's `feed_forward.risk`. This is an operational decision for Alex, not unfinished code.

## Outstanding

| Item | Notes |
|------|-------|
| **Enable auto-send in production** | Operational call: flip Railway `AUTO_SEND_ENABLED=true` after the review-only monitoring period confirms draft quality. |
| **Production-lessons addendum** | Once auto-send runs live, add an addendum to the Phase 2 solution doc (reply quality, false-auto-send rate, follow-up behavior). The solution doc marks production validation as PENDING. |
| **TODO — replace stale Twilio Auth Token** | Dashboard **Approve** (SMS phone-copy to Alex) fails with **500 → Twilio 401 (code 20003)**. Root cause: `TWILIO_AUTH_TOKEN` in `.env` is **31 chars, should be 32** (truncated on paste). Fix: copy the full token from console.twilio.com → Account Info into `.env` line ~20, then verify live before retrying: `curl -s -o /dev/null -w '%{http_code}' https://api.twilio.com/2010-04-01/Accounts/$SID.json -u "$SID:$TOKEN"` must return **200** (per key-rotation rule: verify with a real auth call, not a string match). Until fixed, drafts are still fully usable — copy them from the dashboard directly. Twilio creds live only in `.env` (not `~/.zshrc`), so no shell fix needed. |

## Key Artifacts

| Phase | Location |
|-------|----------|
| Phase 1 Plan | `docs/plans/2026-05-22-feat-p3-batch-gmail-intake-plan.md` |
| Phase 1 Solution | `docs/solutions/architecture/2026-05-22-p3-batch-gmail-intake-phase1-hardening.md` |
| Phase 2 Plan | `docs/plans/2026-05-31-feat-gmail-intake-phase2-auto-send-plan.md` (status: completed) |
| Phase 2 Solution | `docs/solutions/architecture/2026-05-31-gmail-intake-phase2-auto-send-done-reason.md` (production lessons PENDING) |
| Dashboard UI/UX Audit | `docs/audits/2026-07-18-ui-ux/AUDIT.md` |

## Deferred Items (still open from Phase 1)

| Item | Reason |
|------|--------|
| Extract shared esc() to public/shared.js | Two-file duplication (index.html + dashboard.html) |
| Levenshtein fuzzy matching | Not justified by production data |
| OAuth token refresh persistence on Railway | Accepted for Phase 1 |
| full_draft length cap | Pre-existing from Cycle 11 |
| Dual parser unification | Pre-existing |
| Broader soft-refusal patterns | No production data yet |
| Unicode normalization in normalizeFormatText | No production data yet |

_(done_reason in dashboard — completed in Phase 2, removed from this list.)_

## Cross-project reference — FilmCon dashboard patterns (2026-07-18)

The archived FilmCon dashboard (`~/Projects/filmcon/docs/solutions/2026-07-18-filmcon-dashboard-unshipped-patterns.md`, code at git tag `filmcon-dashboard-archived`) generalized two patterns that came *from here* and loop back to open work here:

- **Audit-first, success-only atomic write** is the generalized form of *this project's own* Phase 2 P0 fix — the auto-send path calling `completeApproval()` (`src/automation/orchestrator.ts:295`) so the state change and its follow-up/audit land atomically. When adding any **new state-changing path**, route it through the one canonical atomic function; never re-implement inline (that was the original bug).
- **Deploy fail-open + unenforced-gate + stale-env** lessons speak directly to the **`AUTO_SEND_ENABLED` Railway gating**. Before flipping auto-send live: enforce the safety gate *in code/CI*, not by remembering to check it; log the resolved flag at startup (already done — keep it); and verify the live Railway env with a real check, not an assumption (the "guards against stale Railway env vars" note here is the same class as FilmCon's fail-open-because-ENVIRONMENT-never-wired P0).

### 2026-08-07 security fix + typecheck diagnosis session

**Shipped and verified live.** `public/mockup-hybrid.html` was served **without
authentication** on production. `src/app.ts:68` registers `express.static` *after*
the three `sessionAuth`-protected routes (`/dashboard.html`, `/`, `/index.html`),
so every other real file in `public/` was public. The exposed file publishes quote
figures verbatim ($250–$850).

Moved to `docs/design/` rather than deleted — seven references across
`AGENT_EPISODES.md`, the redesign plan, and the brainstorm cite it as the approved
design reference, and deleting it would have left dangling citations. All
references updated in the same commit. PR #22, squash-merged as `e339340`.

Verified against production with a control, before and after:

| Path | Before | After |
|---|---|---|
| `/mockup-hybrid.html` | **200** (56,506 bytes) | **401** |
| `/health` | 200 | 200 |
| `/dashboard.html` | 401 | 401 |
| `/no-such-file.html` | 401 | 401 |
| `/dashboard.css` | 200 | 200 |

The 401 on a **nonexistent** path is the control that makes the reading
interpretable: it proves the 200 was a genuine static serve of a real file, not a
blanket allow. Scope is limited to files that actually exist in `public/` — this
was not directory traversal. Railway auto-deployed from `main` ~40s after merge.

**Diagnosed, not fixed: `npx tsc --noEmit` fails with 10 errors.** Pre-existing;
this session touched no `.ts`. They are 4 root causes:

| Group | Errors | Root cause | Fix |
|---|---|---|---|
| **A** | 6 | `src/claude.ts:4` — `Awaited<ReturnType<Anthropic["messages"]["create"]>>` resolves to `Message \| Stream` because `create` is overloaded and no literal `stream: false` narrows it. `Stream` has no `.content`. Hits `claude.ts:59,110` + three test mocks. | `type ClaudeMessageResponse = Anthropic.Message;` then add `citations: null` to the three mocks' text blocks (SDK `TextBlock` requires it). |
| **B** | 3 | `types.ts:24` `RecommendedFormat = Format \| "unresolved"` passed where a plain `Format` is required: `router.ts:79`, `generate.ts:429`, and `:434` as a downstream consequence. | Narrowing guard before each lookup so `"unresolved"` is handled explicitly. |
| **C** | 1 | `orchestrator.ts:264` — `AutoSendDeps.sendSms` typed `=> Promise<void>`, real `sendSms` returns `Promise<{success, error?}>`. | Widen the dep type. |
| **D** | 1 | `shape-lead.test.ts:62` — `@ts-expect-error` above `delete (lead as any).done_reason`; the `as any` makes the line legal, so the directive expects an error that no longer occurs. | Delete the directive line. |

**Group B is the only correctness risk** — `"unresolved"` reaching the pricing
lookup returns `undefined` and propagates into a quote. A, C, D are hygiene.

**Why these accumulated: there is no typecheck gate.** No `tsc` in
`package.json` scripts, no `.github/workflows`, no git hooks. `tsx` strips types
without checking them, so the 315-test suite (all passing) has never looked at
them. "Tests pass" and "the code typechecks" are different claims and only one
was being measured.

**Tracker correction found, not applied:** `todos/052-pending-p2-extract-css-from-dashboard.md`
is still `status: pending` but the work is **done** — verified: `public/dashboard.css`
exists (1358 lines), `dashboard.html` has **0** inline `<style>` blocks and links
the stylesheet. Landed in `6baf6cd`. (Its filename says `052`; the heading inside
says `# 047:`.) Flip the status and reconcile the number.

**RESOLVED 2026-08-07** in `54d90bf` — status flipped, file renamed to
`todos/052-done-p2-extract-css-from-dashboard.md`. The sha above was also wrong
(`8641f3b` → `6baf6cd`, corrected in `aa93fa0`).

## Prompt for Next Session — SUPERSEDED, DO NOT RUN

> Completed 2026-08-07 on branch `fix/typecheck-errors` (pushed, head `54d90bf`).
> All 10 errors are fixed. Kept verbatim for the record — the live instructions are
> in **Prompt for Next Session** at the bottom of this file.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Read HANDOFF.md, section "2026-08-07 security fix + typecheck diagnosis session".
Fix all 10 `npx tsc --noEmit` errors, in this order, each as its own commit on a
branch off main (do NOT commit to main):

1. Group B first — it is the only correctness risk. Add narrowing guards so
   "unresolved" is handled explicitly before the Record<Format, FormatRates>
   lookup. Files: src/types.ts:24, src/automation/router.ts:79,
   src/prompts/generate.ts:429 and :434.
2. Group A — change src/claude.ts:4 to `type ClaudeMessageResponse =
   Anthropic.Message;` then add `citations: null` to the text blocks in
   src/claude-extended.test.ts:10, src/confidence.test.ts:60,
   src/run-pipeline.test.ts:70.
3. Group C — widen AutoSendDeps.sendSms in src/automation/orchestrator.ts to
   match the real sendSms return type.
4. Group D — delete the dead @ts-expect-error at src/shape-lead.test.ts:62.

Then add "typecheck": "tsc --noEmit" to package.json scripts and confirm BOTH
`npm run typecheck` (0 errors) and `npm test` (315 pass) are green before the
final commit. Do not touch data/leads.db or .env.

Also flip todos/052-pending-p2-extract-css-from-dashboard.md to status: resolved
and rename the file — the work landed in 6baf6cd (verified: dashboard.css exists,
0 inline <style> blocks in dashboard.html).
```

### Three Questions — security fix + typecheck diagnosis session

1. **Hardest implementation decision in this session?** Whether to delete `mockup-hybrid.html` (which is what was authorized) or move it. Seven docs cite it as the approved design reference, so deleting would have closed the exposure while creating seven dangling citations — trading one failure class for a worse one. Moving it out of the served directory and updating every reference in the same commit achieves the same security outcome with no collateral damage, so I deviated and said so explicitly rather than executing the literal instruction.
2. **What did you consider changing but leave alone, and why?** The 10 typecheck errors — diagnosed and grouped but not fixed, because Alex drew the line at a fresh session. Also `.claude/agent-memory/` (gitignored this session rather than committed: it is another agent's scratch state, and committing it would make a stale April note about `ukulele_solo` authoritative for future sessions — that specific claim is now false, `ukulele` routes to `sourced_cultural_solo` per `docs/Sourced_Format_Definitions.md:22`). And `todos/052`, left for the next session with the verification already done.
3. **Least confident about going into review?** Group B's fix shape. I know the three sites and the mechanism, but not what the *correct* behavior is when a format is genuinely `"unresolved"` at a pricing lookup — throw, return a clarification-mode sentinel, or fall back to a default tier is a product decision, not a type-system one. Whoever fixes it should decide that deliberately rather than picking whatever silences `tsc`. Separately: `src/error-middleware.test.ts:155-156` asserts a 200 on `/dashboard.html` as proof auth is intact, but the test runs with `DASHBOARD_USER`/`PASS` unset, which takes the dev bypass at `src/auth.ts:118-126` — "auth passed" and "auth was disabled" produce the same 200. Not a live hole (`src/server.ts:18-21` hard-fails in production without those vars), but that test cannot detect its own bypass.

### 2026-08-07 typecheck fix session (10 `tsc` errors → 0)

#### Prior Phase Risk

Previous phase's "Least confident about" answer, verbatim:

> Group B's fix shape. I know the three sites and the mechanism, but not what the
> *correct* behavior is when a format is genuinely `"unresolved"` at a pricing lookup —
> throw, return a clarification-mode sentinel, or fall back to a default tier is a
> product decision, not a type-system one.

**How this phase addressed it:** by investigating reachability before writing a line of
fix. The premise turned out to be false — at neither site was it a product decision.

**Shipped, not merged.** Branch `fix/typecheck-errors`, cut off `main` at `e339340`,
pushed at `54d90bf`. No PR opened, nothing merged, `main` still fails `tsc`.

| # | Commit | Group | Errors |
|---|--------|-------|--------|
| 1 | `c48dbc2` | B — unresolved format | 10 → 7 |
| 2 | `4d79719` | A — ClaudeMessageResponse | 7 → 2 |
| 3 | `12c6721` | C — sendSms return type | 2 → 1 |
| 4 | `726cae8` | D — dead ts-expect-error | 1 → 0 |
| 5 | `54d90bf` | typecheck script + todo 052 | — |

**Gates:** `npm run typecheck` → 0 errors. `npm test` → 315 pass, 0 fail, 52 suites.
Re-run independently twice (review agent, then the orchestrating session) rather than
taken on report from the agents that made the changes.

**Group B was two opposite problems, not one product decision.**

- `router.ts:79` — `"unresolved"` **does** reach it (traced: `prompts/classify.ts:67-72`
  emits it, `pipeline/classify.ts:33-38` allows it, `enrich.ts:35-37` preserves it,
  `orchestrator.ts:153` routes it). But `getFormatFamily` was **already total** — it
  loops the family table, matches nothing, returns `"unknown"`. The type was too narrow
  for a function that already handled the case. Fix: widen the parameter.
- `generate.ts:429/434` — `"unresolved"` **cannot** reach it. `findMinFloor` has exactly
  one caller, gated behind `budget.tier === "no_viable_scope"`; every `PricingResult`
  carrying `"unresolved"` is constructed with `budget.tier: "none"`; and `lookupPrice`
  already throws on `"unresolved"` at `price.ts:57`. Fix: narrow the parameter to
  `Format`, with `as Format` at the call site behind a documented invariant.

No runtime guard was added at either site, deliberately: at the first it would be
redundant, at the second it would be dead code masquerading as a safety check.

`PricingResult.format` was deliberately **left** as `RecommendedFormat`. Narrowing it
would trade these 3 errors for 2 new ones at `run-pipeline.ts:35` and `:138` and force
inventing a replacement sentinel — a behavior change smuggled in as a typecheck fix.

**Verification method worth reusing: emitted-JS diff.** Rather than eyeballing the diff
for smuggled behavior, the review transpiled `main`'s and `HEAD`'s version of all four
changed production files through the repo's own esbuild and diffed the output — identical
for all four. Zero runtime behavior change proven mechanically instead of asserted. The
instrument was checked too: `tsc --listFiles` confirms all four files were actually
typechecked, and the test glob matches all 24 test files — so "0 errors" could not have
quietly meant "nothing ran".

**Two errors in the previous handoff, found and corrected:**

- Group A is **5** errors, not 6. The stated 6+3+1+1 = 11; there are 10.
- Todo 052 landed in **`6baf6cd`**, not `8641f3b` (corrected in `aa93fa0`). `8641f3b` is
  the 07-18 UI/UX pass and touches no CSS at all, so `git show 8641f3b` would have read
  as a falsely-closed todo.

**Unplanned but mechanically required:** `src/orchestrator.test.ts` (the spy mock must
return `{success: true}` once `sendSms` is widened) and `ClaudeMessageRequest` →
`MessageCreateParamsNonStreaming` in `src/claude.ts`.

**The new gate is not wired to anything.** `"typecheck": "tsc --noEmit"` exists in
`package.json`, but there is still no `.github/workflows` and no git hooks. It runs only
when a human remembers to run it — the same unenforced-gate class that let 10 errors
accumulate in the first place.

## Prompt for Next Session — SUPERSEDED 2026-08-08, DO NOT RUN

> The typecheck stream in this block is fully closed (items 1-4 all done as of
> `defe03e`). The lead-processing item is still live and has been carried
> forward verbatim into the current **Prompt for Next Session** at the bottom
> of this file. Kept here for the record only.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
Two sessions worked this repo on 2026-08-07/08 and both streams are recorded below.

PRIMARY (from the lead-processing stream):
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.

TYPECHECK STREAM — items 1-3 are DONE as of 2026-08-08, do not redo them:
  [x] 1. fix/typecheck-errors merged (PR #23, f478239). main typechecks clean.
  [x] 2. CI gate wired (PR #24, 9cfa5f8) — .github/workflows/ci.yml runs typecheck +
         test on PRs and pushes to main. Branch protection on main now REQUIRES the
         "typecheck + test" check, with strict + enforce_admins both on. Verified by
         a real rejected push: "GH006: Protected branch update failed".
  [x] 3. todos/082 filed (PricingResult rehydration unvalidated at the DB boundary).
  [x] BONUS. tsconfig now typechecks scripts/ too (PR #25, 400bb1a) — it previously
         passed a planted error in scripts/ at exit 0.
  [ ] 4. STILL OPEN: src/error-middleware.test.ts:155-156 asserts a 200 on
         /dashboard.html as proof auth is intact, but runs with DASHBOARD_USER/PASS
         unset and so takes the dev bypass at src/auth.ts:118-126. "Auth passed" and
         "auth was disabled" produce the same 200; the test cannot detect its own
         bypass. Not a live hole (src/server.ts:18-21 hard-fails in production).

Also open, not urgent: `npm audit` reports 10 vulnerabilities (1 low, 5 moderate,
4 high), deliberately not gated in CI. No linter is configured.

Do not touch data/leads.db or .env.
```

### Three Questions — typecheck fix session (2026-08-07)

1. **Hardest implementation decision in this session?** Whether to trust the previous
   session's framing of Group B as a product decision. The handoff said the fix shape
   was a product call and implied a runtime guard; the conservative move was to
   implement one. Instead I spent four parallel read-only agents on reachability first.
   That inverted the answer: at `generate.ts` the guard would have been unreachable dead
   code that reads as a safety check, and at `router.ts` it would have duplicated
   behavior the function already had. Taking a well-written handoff at face value would
   have produced a worse codebase than the type errors it replaced.
2. **What did you consider changing but left alone, and why?** `PricingResult.format`
   (narrowing it looks tidy but forces inventing a new sentinel — see above). The
   `twilio-webhook.ts:152` persistence hole, left as a todo rather than fixed here: it is
   pre-existing, it fails loud rather than silent, and folding it in is exactly the scope
   creep the reviewer flagged on commit 5. And `.claude/agent-memory/`, still untracked.
3. **Least confident about going into review?** The `as Format` cast at
   `generate.ts:374`. The unreachability proof is sound today, but it rests on an
   invariant maintained by convention across four files — not by the type system and not
   by any test. Nothing fails loudly if a future edit constructs a `PricingResult` with
   `format: "unresolved"` and `budget.tier: "no_viable_scope"`; the cast just goes quiet.
   A test asserting that combination is unconstructible would convert the comment into an
   enforced invariant. Related: the emitted-JS-identical proof shows behavior did not
   change, which is not the same claim as the types now describing reality correctly.

### 2026-08-08 CI gate, dependency, and deploy-verification session

#### Prior Phase Risk

Previous phase's "Least confident about" answer, verbatim:

> The `as Format` cast at `generate.ts:374`. The unreachability proof is sound today,
> but it rests on an invariant maintained by convention across four files — not by the
> type system and not by any test.

**How this phase addressed it: it did not.** That invariant is still unenforced. It is
recorded in `todos/082`, which covers the same boundary from the read side. Accepted
rather than closed, and named here so it is not mistaken for handled.

**Six PRs, all merged, `main` at `defe03e`.**

| PR | What | Merge |
|---|---|---|
| #26 | land the 2026-08-07 session records on main | `2df70df` |
| #27 | file todos 083, 084, 085 | `1f626cf` |
| #28 | resolve all 10 dependency vulnerabilities | `a8389e5` |
| #29 | audit gate; close 084; file 086 | `5196ff8` |
| #30 | `/health` build identifier | `2550b96` |
| #31 | close 086 | `defe03e` |

**The gate is now enforcing, not advisory.** Branch protection on `main` requires the
`typecheck + test` check, with `strict: true` (branch must be up to date, which is the
direct answer to `main` moving under a session mid-PR) and `enforce_admins: true`.

Proven, not assumed. A real push of an empty commit straight at `main` was rejected:

```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Required status check "typecheck + test" is expected.
```

A first attempt used `git push --dry-run` and reported success — dry-run never reaches
the server's receive-time checks, so "would be allowed" and "was never evaluated" print
identically. That result was discarded rather than counted.

**Dependency vulnerabilities: 10 → 0** (`npm audit`). Lockfile-only; `package.json` is
byte-identical, no `--force`, no semver-major bump. `npm audit fix` cleared 9. The tenth
could not be fixed that way: it kept printing "fix available via `npm audit fix`" while
changing nothing, because `tsx@4.21.0` pinned `esbuild@0.27.3`. `npm update tsx`
(4.21.0 → 4.23.11) resolved `esbuild@0.28.1`. **The advisory covers `0.27.3 - 0.28.0`,
so landing on `0.28.0` would have looked like an upgrade and fixed nothing** — "newer"
and "patched" are different claims.

**`npm audit` is gated separately, on purpose** (`.github/workflows/audit.yml`). It
queries the registry at run time, so an advisory published overnight can red a
previously-green PR with no code change. Blocking unrelated work at an arbitrary moment
is how a gate stops being read. It runs on PRs touching `package.json`/`package-lock.json`,
weekly for drift, and on demand. `--audit-level=high` fails the run; the step before
prints the full report unfiltered. Verified against a known answer: clean repo exit 0,
scratch project with `lodash@4.17.11` exit 1.

**Deploys are now verifiable.** `/health` previously returned
`{"status":"ok","rejectedEmails":N}` — no build identifier. Railway auto-deploys from
`main`, so the only post-merge signal was a `200` that was equally true before the merge.
It now returns `commit` and `startedAt`. Confirmed end to end: merge commit `2550b96`,
production `/health` returned `"commit":"2550b96"`. First deploy in this repo verified
rather than inferred.

That also settled an open assumption — `RAILWAY_GIT_COMMIT_SHA` is the correct variable
name. It was checkable only because the field returns a literal `"unknown"` on failure
instead of being omitted; a wrong guess stayed visible rather than going silent.

**Coverage gap closed:** `tsconfig.json` was `include: ["src"]`, so `npm run typecheck`
never looked at `scripts/` — 91 files checked, zero from `scripts/`, confirmed by
planting a type error there that passed at exit 0. Now 94 files. `scripts/plan-gate.ts`
is executed code with its own test file and had been unguarded.

**Housekeeping:** 15 merged branches deleted (all verified as ancestors of `main` first,
SHAs recorded). Suite 315 → 351. Five branches remain, four genuinely unmerged.

## Prompt for Next Session — SUPERSEDED 2026-08-09, DO NOT RUN

> The PRIMARY item (13 leads) and all four open todos are still live and have been
> carried forward verbatim into the current **Prompt for Next Session** at the bottom
> of this file. Kept here for the record only.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
main was defe03e when this was written; this handoff commit sits on top of it, so
check `git log -1` rather than trusting that SHA. CI (typecheck + test) is a REQUIRED
status check with strict and enforce_admins on, so you cannot push to main directly —
branch, PR, let CI pass, merge.

VERIFY A DEPLOY LIKE THIS (new as of 2026-08-08):
  curl -s https://gig-lead-responder-production.up.railway.app/health | jq -r .commit
  It must equal the merged SHA. "unknown" means the build identifier broke.

PRIMARY — carried forward, still open:
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.

OPEN TODOS (nothing p1 outstanding):
  083 p2  src/error-middleware.test.ts:155-156 asserts 200 on /dashboard.html as proof
          auth works, but runs with DASHBOARD_USER/PASS unset and takes the dev bypass
          at src/auth.ts:118-126. "Auth passed" and "auth was disabled" are identical.
          Not a live hole. Its acceptance criteria require DEMONSTRATING the fixed test
          goes red when sessionAuth is removed — do not skip that step.
  082 p2  PricingResult rehydrated from the DB with one-field validation, then cast.
          Also the home of the unenforced generate.ts:374 invariant.
  081 p2  advisor tool — Opus on generate/verify.
  085 p3  no linter configured; decide adopt-or-not and record the decision either way.

Do not touch data/leads.db or .env.
```

## Three Questions

1. **Hardest implementation decision in this session?** How to wire `npm audit` into CI.
   The obvious move was adding a step to `ci.yml`, which would have made it a required
   check on every PR. I rejected that: `npm audit` queries the registry at run time, so
   its verdict depends on what advisories exist today rather than on anything in the
   repo, and an advisory published overnight would red a previously-green PR with no code
   change. For a solo maintainer that means being blocked at an arbitrary moment on work
   unrelated to the finding — the precise mechanism by which a gate stops being read. A
   separate workflow, triggered on lockfile changes plus a weekly schedule, keeps the
   signal and drops the false blocking. The reasoning is written into the file so the
   next person does not "simplify" it back into `ci.yml`.
2. **What did you consider changing but left alone, and why?** The `generate.ts:374`
   invariant — still unenforced, deliberately left to `todos/082` rather than folded into
   an unrelated PR. `npm audit` at `--audit-level=moderate` rather than `high`; rejected
   because moderate advisories in dev tooling are a steady trickle and would turn the
   gate into noise. And `enforce_admins` was initially set to `false` as a safety valve
   before I reversed it — a bypassable gate for a sole admin reproduces the exact failure
   this session was closing.
3. **Least confident about going into review?** That the CI gate covers what matters, as
   opposed to what is easy to check. It runs `tsc` and the test suite. It does not run a
   linter (`085`), does not gate on `npm audit` for most PRs by design, and — the real
   gap — **nothing verifies the deployed app actually works.** `/health` returning the
   right SHA proves the right code shipped; it does not prove the pipeline processes a
   lead correctly. 351 tests pass against a suite that has never sent a real message.
   Separately: `--audit-level=high` means moderate advisories now accumulate silently.
   That is a deliberate trade, but it is the kind of threshold that gets set once and
   never revisited, so it is worth a look if the moderate count ever climbs.

---

### 2026-08-09 compound phase — Yelp allowlist capture bug

**Shipped:** `695b62a` (PR #33) — `docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md`, closing the cycle opened by `197f118` + `4ff91c6` on 2026-08-07.

**What the cycle was.** While pulling real Gmail samples to build a reply parser (roadmap #3), the survey found that `source-validator.ts` allowed `/^(no-reply|biz-alerts)@yelp\.com$/i` while real Yelp mail arrives from `reply+<32 hex>@messaging.yelp.com`. Anchored pattern, so no near-miss: **every Yelp lead had been rejected as "Unknown sender" for months.** Six conversations in the mailbox, three with client replies, none ingested.

**The part that mattered more than the bug.** Fixing the allowlist would have armed `parseYelpEmail`, which had never executed and had no tests. Audited against a real email first, it captured Yelp's passwordless login URL — a bearer credential — into `portalUrl` **and** `rawText`, the field sent to the Claude API. Both fixed before the allowlist change merged.

**Process deviation, recorded not endorsed:** no plan phase and no `/workflows:review` phase this cycle. Verification was 342/342 tests (11 new, proven to fail against the pre-fix parser), a typecheck error set proven byte-identical to `main`, and CI green. **There are no review-agent finding counts — do not read their absence as "review found nothing."**

**Deliberately NOT done:** `gigs@gigsalad.com` was not added to the allowlist. Accepting it without booked-detection turns every payment receipt into a phantom lead.

### Three Questions — compound phase (2026-08-09)

1. **Hardest pattern to extract?** Separating "the allowlist regex was wrong" from the reusable lesson. The typo is not knowledge. The reusable part is that the broken gate was *shielding* an unreviewed code path, so the fix and the audit behind it had to ship together. That only surfaced after tracing what `validateSource` passing actually triggers downstream.
2. **What did you consider documenting but left out?** A redesign making `rejectedEmailCount` persistent and per-platform. Left out because a per-platform counter still cannot distinguish "no Yelp leads arrived" from "Yelp leads were rejected" — the honest instrument is a *positive* liveness assertion (each configured platform has ingested ≥1 lead in N days), and that deserves its own cycle.
3. **Least confident about?** **The fix has never processed a real Yelp email.** Everything green is fixtures. `YelpPortalClient.fetchLeadDetails()` is next in the chain and unexercised by exactly the mechanism that left the parser untested — expect the next defect there. Business impact also remains unmeasured.

## Prompt for Next Session

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
Check `git log -1` rather than trusting any SHA written here. CI (typecheck + test) is a
REQUIRED status check with strict and enforce_admins on, so you cannot push to main
directly — branch, PR, let CI pass, merge.

VERIFY A DEPLOY LIKE THIS:
  curl -s https://gig-lead-responder-production.up.railway.app/health | jq -r .commit
  It must equal the merged SHA. "unknown" means the build identifier broke.
  NOTE: `rejectedEmails` in that same response is in-memory and resets on restart. It
  cannot distinguish a dead channel from a healthy one. Never read it as evidence.

PRIMARY — carried forward, still open:
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.
(Alex's standing rule is to NOT buy usage credits — confirm with him before assuming
this item is unblocked.)

NEW — first real Yelp lead is the open verification:
The 2026-08-07 Yelp fix has never processed a real Yelp email. When one arrives, watch
the whole chain: poller → validateSource (expect kind:"lead") → parseYelpEmail →
YelpPortalClient.fetchLeadDetails() → pipeline. fetchLeadDetails is the next unexercised
stage; treat it as unreviewed. Read
docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md first.

OPEN TODOS (nothing p1 outstanding):
  083 p2  src/error-middleware.test.ts:155-156 asserts 200 on /dashboard.html as proof
          auth works, but runs with DASHBOARD_USER/PASS unset and takes the dev bypass
          at src/auth.ts:118-126. "Auth passed" and "auth was disabled" are identical.
          Not a live hole. Its acceptance criteria require DEMONSTRATING the fixed test
          goes red when sessionAuth is removed — do not skip that step.
  082 p2  PricingResult rehydrated from the DB with one-field validation, then cast.
          Also the home of the unenforced generate.ts:374 invariant.
  081 p2  advisor tool — Opus on generate/verify.
  085 p3  no linter configured; decide adopt-or-not and record the decision either way.

Do not touch data/leads.db or .env.
```
