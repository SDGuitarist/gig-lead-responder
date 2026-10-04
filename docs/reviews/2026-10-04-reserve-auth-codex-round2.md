# Codex round 2 — reserve / auth fixes (`07a5376..9a32942`)

**Verdict: NO-GO** (Codex CLI, `codex exec -s workspace-write`, run by Claude Code at Alex's request on 2026-10-04, at `9a32942`). Codex ran the suite itself this time: 515 pass / 16 fail, all 16 sandbox-blocked (`listen EPERM`, `sysctl`, runner self-test); worktree unchanged after. **Second NO-GO on this change set: automatic iteration STOPPED.** Round 3 only with `Round 3 authorized by Alejandro: YES`. Verbatim output below.

---

ROUND 2 verdict: NO-GO.

Findings:

1. P1 — Follow-up model output remains unvalidated before storage.

`src/pipeline/follow-up-generate.ts:10-21` trims arbitrary `callClaudeText` output, and `src/follow-up-scheduler.ts:44-55` stores it. The prompt’s rules—no pricing, contact details, signature, or more than three sentences—are not enforced deterministically.

This is the remaining confirmed sibling in the “model output reused without enforcing prompt rules” class.

2. P1 — Two prompt-boundary sibling paths still accept raw model text.

- `src/pipeline/verify.ts:72` inserts both generated drafts directly into the verifier prompt.
- `src/pipeline/generate.ts:88-91` inserts model-produced `positiveSignals` outside the edit wrapper.

The six `wrapUntrustedData` call sites are correctly escaped. `wrapVoiceReference` is code-owned reference content and was excluded. The remaining issue is that model output can still contain prompt-like delimiters or instructions.

3. P1 — Strategic-reserve validation is incomplete.

`src/pipeline/generate.ts:39-47` misses several price forms, such as `€900`, `USD 900`, and unqualified monetary language such as “I can do it for 900.” It also permits multiple sentences under the 240-character limit, despite the prompt requiring one-sentence insights.

Passed checks:

- Reserve: 8/0
- Wrapper: 2/0
- Auth detection: 2/0
- Migration: 13/0
- TypeScript: passed
- `git diff --check`: passed
- Worktree remained clean

Full suite: 515 passed / 16 failed / 4 skipped. Every failure was sandbox-related: `listen EPERM`, `sysctl EPERM`, or the runner self-test. Failing test names were:

`instrument: a real test name exits 0 with pass >= 1`; `allows Basic Auth POSTs without CSRF header`; `allows authenticated POSTs when the dashboard CSRF header is present`; `reports commit and startedAt so a deploy can be verified`; `should start test server`; five `error-middleware` request tests; three health tests; `poller skips without the lease`; and `dashboard listens on 127.0.0.1 only`.

Auth detection and migration fixes themselves are correct based on the focused tests. No real Gmail poll, paid model call, or production migration was executed.

Complete Claude Code fix prompt:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0. Ask: fix the remaining round-2 findings from the migration v3 / strategic reserve / auth-detection review.

FIRST -- confirm no other session or auto-continue is live here. Run:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short

Expected starting HEAD: 9a32942 or a later docs-only commit.
If HEAD differs otherwise or the worktree is dirty unexpectedly, STOP and ask Alejandro.

Read first:
  HANDOFF.md
  CLAUDE.md
  docs/reviews/2026-10-04-reserve-auth-codex-round1.md
  ~/.claude/docs/mandatory-review-workflow.md

Prior Codex verdicts:
  - Round 1: NO-GO, recorded in docs/reviews/2026-10-04-reserve-auth-codex-round1.md.
  - Round 2: this review, NO-GO with the findings below.

This is the second NO-GO for this change. Automatic iteration stops after this fix attempt. Do not create a round-3 review prompt unless Alejandro explicitly authorizes:
  Round 3 authorized by Alejandro: YES

Findings to fix:

1. Follow-up model output is stored without enforcing its prompt rules.

Reproduce with a deterministic mocked follow-up response containing pricing, contact information, a signature, or more than three sentences.

Root cause: generateFollowUpDraft() trims arbitrary callClaudeText output but applies no deterministic validation before storeFollowUpDraft() persists it.

Apply the smallest safe fix. Enforce the existing follow-up contract before storage:
- no pricing or quote language;
- no contact information or signature;
- no “just checking in” / “following up” language;
- at most three sentences;
- preserve ordinary Spanish punctuation and accents.

Add a regression test that fails without the fix and a positive/overshoot control showing a normal follow-up remains usable. Do not run a real model call.

2. Remaining raw model text reaches prompts without a safe boundary.

Bounded inventory:
- src/pipeline/verify.ts: verifyGate() inserts full_draft and compressed_draft raw into the verifier prompt.
- src/pipeline/generate.ts: positiveSignals.best_line and validation_line are model-produced text inserted outside wrapEditInstructions().
- src/utils/sanitize.ts: wrapVoiceReference() is used only for code-owned voice examples and is not part of this finding.
- wrapUntrustedData() has six direct call sites, all already escaped.

Reproduce with mocked draft or positive-signal text containing closing tags and instruction text.

Root cause: the wrapper hardening was applied to lead-derived data, but equivalent model-derived text paths still interpolate raw content.

Apply the smallest safe boundary fix. Preserve the semantics of edit instructions: actionable rewrite instructions must remain actionable, while model-produced evidence and drafts must be treated as untrusted data.

Add regression tests that fail without the fix:
- verifier draft text cannot escape its data section;
- positive-signal text cannot inject prompt structure.

Add ordinary-text controls for Spanish accents, punctuation, and normal draft content.

3. Strategic-reserve validation still has false negatives.

Reproduce with reserve entries such as:
- “€900”
- “USD 900”
- “I can do it for 900”
- a two-sentence insight under 240 characters

Root cause: the current validator detects only a narrow subset of dollar/currency-word patterns and does not enforce the prompt’s one-sentence rule.

Extend the existing validator with the smallest defensible rules:
- reject common currency-before-number and currency-symbol forms;
- reject clearly price-bearing “for 900” language;
- reject entries containing more than one sentence;
- retain the 240-character bound and whitespace normalization.

Add regression tests that fail without the fix plus overshoot controls proving that times, guest counts, accented Spanish, and ordinary punctuation remain valid.

Fix contract for every finding:
1. Reproduce it, or explain why deterministic reproduction is impractical.
2. Name the root cause.
3. Add a regression test that fails without the fix, or explain why one is impractical.
4. Run focused tests and the full suite.
5. Report any high-risk claims as UNEXECUTED with reason, owner, and trigger.
6. Because this is the second confirmed instance of the prompt-boundary/model-output failure classes, retain the bounded inventory above and provide a provisional shape assessment: prefer one shared sanitizer/wrapper or one shared follow-up validator if that is the smallest structural fix; otherwise state why a local reversible fix is safer.
7. Do not run a real Gmail poll, paid model call, production migration, or real send.

Before stopping, report:
- changed files;
- reproduction evidence;
- focused test results;
- full-suite result and environment-only failures;
- remaining unexecuted risks;
- whether the worktree is clean.
```

I did not copy this prompt to the clipboard.
---

## Fixes (session 0153v273, 2026-10-04) — Round 3 authorized by Alejandro: YES (2026-10-04, "yes to all")

| Finding | Root cause | Fix | Test (red first) |
|---|---|---|---|
| 2 model text into prompts raw | each wrapper escaped (or not) on its own; drafts and signals had none | `700ecfd`: ONE `escapeForPrompt` used by `wrapUntrustedData`, `wrapEditInstructions` (same flaw, not in the finding) and new `wrapModelText`; verify wraps both drafts; generate escapes the positive signals | `model text boundary` ×2 (red: raw closing tags reached the captured request); controls: Spanish text and actionable instructions unchanged |
| 3 reserve price false negatives, 2 sentences | a narrow dollar regex; no sentence rule | `aabe142`: shared `mentionsPrice` (`src/utils/price-mention.ts`: currency symbols, codes/words, "for/at/of 900" phrasing, "budgeted 1500"); one sentence only | `every price form is dropped, near-misses are kept, and only one sentence` (red on "€900"); controls: 4:30, 120 guests, 7pm, 2 hours, 40th, a ZIP, 150 people, Spanish |
| 1 follow-up draft stored unvalidated | no check between the model and storage | `0e3882e`: `followUpViolations` (price via `mentionsPrice`, contact/link, signature, "checking in"/"following up", > 3 sentences); a failing draft throws, so the scheduler retries later and skips at its cap; never stored | `follow-up draft check` (red: a priced draft returned as-is); control: two normal follow-ups pass unchanged |

Inventory (model calls: 4): classify (lead email, wrapped), generate (rewrite instructions + positive signals, now escaped),
verify (drafts, now wrapped), follow-up (lead context, original draft, reserve: wrapped; output now checked).
Shape: shared escape and shared price detector instead of per-site fixes. Price detection stays a heuristic that errs
toward "price" (a false hit drops an insight or rejects a draft; it never sends one).
Suite 539 pass / 0 fail / 1 skip / 1 todo; `tsc`, `git diff --check` clean.
