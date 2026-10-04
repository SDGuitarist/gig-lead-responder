# Codex round 1 — migration v3, strategic reserve (R018/R266/R272), auth detection (`79929a0..07a5376`)

**Verdict: NO-GO** (Codex CLI, `codex exec -s read-only`, run by Claude Code at Alex's request on 2026-10-04, at `07a5376`). Codex's sandbox could not run the tests (temp-dir EPERM); Mac evidence 527/0/4. Verbatim output below.

---

## Verdict: NO-GO

The implementation matches the plan’s intended wiring, but two security/validation gaps remain before this range is safe.

### P1 — Strategic reserve is not semantically or size-bounded

`normalizeStrategicReserve()` in `src/pipeline/generate.ts:35` validates only “array of strings, max 3.” It does not enforce:

- maximum length per insight;
- one-sentence shape;
- no prices, despite the prompt requiring “never a price”;
- safe handling of prompt-boundary characters.

A model can therefore return a large insight containing pricing or instructions. It is stored and later inserted into a follow-up prompt.

Root cause: the implementation treats prompt instructions as validation.

Required fix: bound and validate each reserve string before persistence and before later prompt use. Add positive controls preserving a normal insight and overshoot controls rejecting/truncating long or price-bearing content.

This is an instance of the broader untrusted-text validation class. The bounded reserve surface is:

- `normalizeStrategicReserve`
- both save paths
- `buildFollowUpPrompt`
- `generateFollowUpDraft`

### P1 — The untrusted-data wrapper is delimiter-escapable

`wrapUntrustedData()` interpolates content directly between XML-like tags. A reserve containing `</strategic_reserve>` can terminate its wrapper and append apparent instructions.

This is a class-level issue, not only a reserve one-off. The bounded surface has 9 call sites, including lead email, classification, original drafts, and the new strategic reserve.

Root cause: the wrapper labels content as untrusted but does not escape delimiter characters.

Required fix: make the shared wrapper delimiter-safe, then add a regression test proving injected closing tags remain data. Include an overshoot control for ordinary Spanish punctuation, accents, and normal draft text.

### P2 — Required migration behavior is implemented but incompletely covered

The migration code correctly:

- applies v3 only when `user_version < 3`;
- leaves an already-v3 database unchanged;
- rejects a database newer than the migration list;
- backs up before applying v3.

However, the new reserve test covers only a fresh database. The generic migration tests use synthetic migrations rather than the real `MIGRATIONS` array. Add explicit tests for:

- real v3 rerun returning `[]` with no new backup;
- real `MIGRATIONS` rejecting `user_version = 4`;
- real v3 backup containing the pre-column schema.

### Auth-failure review

No defect found in the new `isAuthError()` logic.

It handles the gaxios shapes present in the installed dependency:

- `err.status === 401`;
- `err.response.status === 401`;
- `err.response.data.error === "invalid_grant"`;
- message-level `invalid_grant` fallback.

It correctly avoids treating arbitrary free-text `401` as authentication failure.

Real Gmail/gaxios execution remains UNEXECUTED, as documented.

### Exception contract

The lower layers currently raise:

- Gmail list/page parsing: ordinary `Error`;
- Gmail provider calls: gaxios errors;
- message fetch validation: ordinary `Error`;
- model JSON/shape failures: `GenerationError`;
- reserve JSON corruption: caught locally and treated as no reserve;
- migration failures: thrown after transaction rollback.

The callers catch these consistently for the reviewed paths:

- poll fetch errors are classified, auth state is saved when appropriate, then rethrown to the poller handler;
- non-auth poll errors are logged without stopping the poller;
- malformed stored reserve JSON does not escape follow-up prompt construction;
- migration errors escape startup, as required.

No additional exception-contract escape was found.

### Scope and feed-forward

The range does not address either plan Feed-Forward risk:

- Mac sleep, lid closure, and FileVault restarts are still detected but not recovered.
- GigSalad reply landing on-platform remains unverified; S2 is still UNEXECUTED.

No unrelated implementation files changed. The `gmail-watcher.ts` comment, runtime-lease test adjustment, retry test adjustment, manifest, HANDOFF, and review documentation are all explainable within this range.

I could not independently rerun the suite because this sandbox denies temporary-directory creation. The provided Mac evidence remains the authoritative result: 527 passing, 0 failing, and TypeScript clean.

## Claude Code fix prompt

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder
Branch: feat/hub-phase0
Ask: fix the Codex round-1 findings for migration v3, strategic reserve R018/R266/R272, and poller auth detection.

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected branch: feat/hub-phase0
Expected HEAD: the current branch tip, currently 07a5376 (or a later docs-only handoff/review commit)
Stop if the branch, HEAD, or worktree differs unexpectedly.

Read first:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md
  docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md
  docs/reviews/CODEX-REVIEW-GATE.md
  ~/.claude/docs/mandatory-review-workflow.md

Fix only the named findings:

1. Strategic reserve validation:
   - Reproduce the issue with a reserve containing a price and an oversized insight.
   - Name the root cause: validation relies on model instructions and does not bound persisted prompt input.
   - Apply the smallest safe fix that enforces a per-insight length bound and rejects or removes price-bearing reserve entries.
   - Add regression tests that fail without the fix.
   - Add a positive control proving an ordinary insight remains usable.
   - Add an overshoot control proving valid accented Spanish text and normal punctuation remain usable.

2. Prompt-boundary escaping:
   - Reproduce the issue with a reserve containing a closing wrapper tag and instruction text.
   - Name the root cause: wrapUntrustedData interpolates raw content without delimiter escaping.
   - Fix the shared boundary safely.
   - Sweep the bounded wrapUntrustedData surface and report every call site and count.
   - Add a regression test that fails without the fix.
   - Add a positive/overshoot control for ordinary lead text, Spanish accents, and existing prompt content.
   - If the sweep shows this requires materially broader redesign, stop and report the bounded inventory and escalate rather than expanding scope silently.

3. Migration coverage:
   - Add tests using the real MIGRATIONS array for an already-v3 database and a database newer than code.
   - Verify the real pre-v3 backup contains the old schema.
   - Do not modify production data or run migration v3 against data/leads.db in this fix session.

Follow the fix contract in ~/.claude/docs/mandatory-review-workflow.md for every valid finding:
- reproduce it or explain why reproduction is impractical;
- name the root cause;
- add a regression test or explain why deterministic testing is impractical;
- include positive/overshoot controls whenever the fix could overreach;
- on the second confirmed instance of a failure class, provide the bounded inventory and provisional shape assessment;
- execute high-risk “safe because X” claims when practical, otherwise label them UNEXECUTED with reason, owner, and trigger;
- report focused tests, full-suite results, and remaining risks.

Do not perform a broad unrelated review. Do not run a real model call, real Gmail poll, or real data migration.

Before stopping, report:
- changed files;
- focused test results;
- full-suite result;
- any unexecuted claims with owner and trigger;
- remaining risks.
```

This is round 1 NO-GO. Per the pre-registered budget, any next review should verify only these named fixes, not perform another broad sweep.
---

## Fixes (session 0153v273, 2026-10-04)

| Finding | Root cause | Fix | Test (red first) |
|---|---|---|---|
| P1 reserve not bounded | the prompt's "one sentence, never a price" was trusted, not enforced | `b7b4754`: `normalizeStrategicReserve` collapses whitespace and drops entries over 240 chars or with a price (`$` + digit, or a number + dollars/usd/bucks). It runs before saving AND when the follow-up reads the stored reserve | `a reserve entry with a price or past one sentence's length is dropped` (red); overshoot control: times and guest counts kept, accented Spanish kept |
| P1 wrapper delimiter-escapable | `wrapUntrustedData` put content between tags raw | `4023ef8`: `<` and `>` in content escaped to `&lt;` `&gt;` | `untrusted wrapper: content cannot close its block or open a new one` (red without the fix, shown by stashing it); control: Spanish lead text with accents, ¿, quotes and $ unchanged |
| P2 migration coverage | tests used made-up migrations | `b7b4754` | `the real migration list backs up, reruns as a no-op, and refuses a newer DB` (pins current behaviour; no code change) |

Inventory (`wrapUntrustedData`): 6 call sites, all fixed by the one shared change: classify `lead_email`, generate and
verify `lead_classification`, follow-up `lead_context`, `original_response`, `strategic_reserve`. `wrapVoiceReference`
is separate and carries only Alex's own fixed examples from `src/data/voice-references.ts` (not lead text). Codex counted 9.
Suite 531 pass / 0 fail / 4 skip on the Mac; `tsc` and `git diff --check` clean.

**Independence note (Alex, 2026-10-04):** in this round and both review-#1 rounds, Codex's read-only sandbox could not
run tests, so its verdicts used Claude's reported numbers. Probe: `codex exec -s workspace-write` CAN run the suite:
515 pass / 16 fail of the same 531; all 16 are sandbox-blocked (`listen EPERM` on localhost, `sysctl` EPERM, one runner
self-test); the repo was unchanged after. The 16 (incl. the 3 `/health` tests changed today) can only be confirmed
on the Mac.
