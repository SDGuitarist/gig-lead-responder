---
title: "Proving a Type-Only Change Is Behavior-Free by Diffing Emitted JS"
category: workflow
tags: [typescript, typecheck, type-only, emitted-js, esbuild, tsx, behavior-preservation, review-technique, positive-control, ambiguous-output, reachability, dead-guard, import-elision]
module: src/claude.ts, src/automation/router.ts, src/automation/orchestrator.ts, src/prompts/generate.ts
symptom: "A PR labelled 'type-only' is indistinguishable by eye from one that smuggled a runtime change; reviewers were reading diffs and asserting behavior was unchanged rather than measuring it"
root_cause: "TypeScript annotations are erased before anything runs, but nothing in the review workflow ever compared the erased output — so 'type-only' was a claim about the source, never a measurement of what executes"
date: 2026-08-08
---

# Proving a Type-Only Change Is Behavior-Free by Diffing Emitted JS

## Problem

The typecheck cycle (`e339340..12c6721`, merged in PR #23) cleared 10 `tsc`
errors with edits that were all supposed to be type-only: a parameter widened
from `Format` to `RecommendedFormat`, another narrowed from
`PricingResult["format"]` to `Format`, two `type` aliases repointed at concrete
SDK types, one interface return type widened, plus explanatory comments and one
`as Format` assertion.

Every one of those *looks* inert. None of them is provably inert by reading.
A reviewer's only tool was to scan the diff and assert "no runtime change," and
that assertion is exactly the kind that fails quietly:

- An `as Format` assertion sits one keystroke away from a real narrowing.
- Adding a name to an `import` line can **stop it being elided**, which drags a
  module's side effects into the runtime graph. That is a genuine behavior
  change hiding inside something that reads as a type import.
- A widened interface member forces a companion edit at the implementer
  (`src/orchestrator.test.ts` here), and companion edits are where real logic
  sneaks in.

"I read the diff and it looks type-only" is an opinion. This project needed a
measurement.

## Solution

**Transpile the old and the new revision of each changed file through the
toolchain that actually runs in production, and diff the OUTPUT.** If the
emitted JavaScript is byte-identical, the change was erased. That is not an
argument about behavior; it is the absence of any behavior to argue about.

For this repo the production toolchain is unambiguous:

- `package.json` runs everything through `tsx` (`start`, `serve`, `demo`, `test`).
- `railway.json` `deploy.startCommand` is `npx tsx src/server.ts`.
- `tsc` appears exactly once, as `"typecheck": "tsc --noEmit"`.

So **nothing that runs in production is ever emitted by `tsc`.** The real
emitter is esbuild, vendored inside `tsx` and already on disk at
`./node_modules/.bin/esbuild` (0.27.3, with tsx 4.21.0). Diff *that* output.
Diffing `tsc` output here would measure a compiler this project never uses.

## The Technique — exact commands for THIS repo

Run from the repo root. Read-only; everything lands in a temp dir.

```bash
BASE=e339340   # parent of the first type-only commit
HEAD=12c6721   # last type-only commit
OUT=$(mktemp -d); mkdir -p "$OUT/old" "$OUT/new"

for f in src/claude.ts src/automation/router.ts \
         src/automation/orchestrator.ts src/prompts/generate.ts; do
  n=$(echo "$f" | tr '/' '_')          # NOTE: keeps the .ts extension. Required.
  git show "$BASE:$f" > "$OUT/old/$n"
  git show "$HEAD:$f" > "$OUT/new/$n"

  ./node_modules/.bin/esbuild "$OUT/old/$n" --format=esm --target=es2022 \
    > "$OUT/old/$n.js" || { echo "TRANSPILE FAILED (old) $f"; continue; }
  ./node_modules/.bin/esbuild "$OUT/new/$n" --format=esm --target=es2022 \
    > "$OUT/new/$n.js" || { echo "TRANSPILE FAILED (new) $f"; continue; }

  ob=$(wc -c < "$OUT/old/$n.js"); nb=$(wc -c < "$OUT/new/$n.js")
  if [ "$ob" -lt 100 ] || [ "$nb" -lt 100 ]; then
    echo "SUSPICIOUS: near-empty emit for $f (old=$ob new=$nb) — transpiler probably never ran"
    continue
  fi

  if cmp -s "$OUT/old/$n.js" "$OUT/new/$n.js"; then
    echo "IDENTICAL  $f (${ob} bytes)"
  else
    echo "DIFFERS    $f (old=$ob new=$nb)"; diff "$OUT/old/$n.js" "$OUT/new/$n.js"
  fi
done
```

Measured result on `e339340..12c6721`:

```
IDENTICAL  src/claude.ts (2445 bytes)
IDENTICAL  src/automation/router.ts (2385 bytes)
IDENTICAL  src/automation/orchestrator.ts (8903 bytes)
IDENTICAL  src/prompts/generate.ts (25865 bytes)
```

`--target=es2022` mirrors `tsconfig.json`; `--format=esm` mirrors
`"type": "module"`. Change those and you are measuring a different emit.

### Always run the positive control

An "IDENTICAL" that you cannot distinguish from "the tool never ran" is
decoration. Point the same instrument at a change you *know* is behavioral and
require it to say DIFFERS:

```bash
f=src/automation/source-validator.ts
git show d8fedf4:$f > "$OUT/ctl-old.ts"; git show 197f118:$f > "$OUT/ctl-new.ts"
./node_modules/.bin/esbuild "$OUT/ctl-old.ts" --format=esm --target=es2022 > "$OUT/ctl-old.js"
./node_modules/.bin/esbuild "$OUT/ctl-new.ts" --format=esm --target=es2022 > "$OUT/ctl-new.js"
cmp -s "$OUT/ctl-old.js" "$OUT/ctl-new.js" \
  && echo "CONTROL FAILED — instrument is blind, do not trust its IDENTICALs" \
  || echo "CONTROL PASSED — instrument detects a real change"
```

Measured: **CONTROL PASSED**, old=1345 B, new=2304 B (the Yelp sender-pattern fix).

## The failure I actually hit — read this before trusting a green run

The first attempt passed `--loader=ts` on files whose `/`-to-`_` renaming had
stripped the extension, and piped stderr to `/dev/null`. esbuild refused with

```
✘ [ERROR] "loader" without extension only applies when reading from stdin
```

wrote **zero bytes**, and `cmp -s` duly reported:

```
IDENTICAL  src/claude.ts  (0 bytes)
IDENTICAL  src/automation/router.ts  (0 bytes)
IDENTICAL  src/automation/orchestrator.ts  (0 bytes)
IDENTICAL  src/prompts/generate.ts  (0 bytes)
```

Four empty files compare equal. **"Proved byte-identical" and "the transpiler
never ran" produced the same sentence, with the same confidence.** The byte
counts in the output line and the `-lt 100` guard above exist because of this;
so does never swallowing esbuild's stderr. A verification technique that cannot
report its own failure is worse than no technique, because it manufactures
confidence.

## When it applies

- Typecheck-error cleanups, `strict` migrations, annotation-only refactors.
- Repointing `type` aliases at concrete types (`src/claude.ts` here).
- Widening or narrowing a parameter, return, or interface member.
- Adding `as` assertions or non-null assertions.
- **Any change touching an `import` line.** This is where it earns its keep:
  import elision is a real emit-level effect, and byte-identical output is
  direct proof the added name stayed erased.
- Before hand-writing a large "why this is safe" justification in a commit
  message. Nine seconds of transpiling replaces a paragraph of reasoning.

## When it does NOT apply

- **Any language feature with type-directed emit.** `enum` (especially
  `const enum`), decorators, class parameter properties, namespaces,
  `useDefineForClassFields`. Identical *source* types can emit differently;
  worse, esbuild's single-file transform resolves some of these differently from
  `tsc`. If the change touches these, this test is not authoritative.
- **Changes that also alter formatting or comments in expression position.**
  Verified here: statement-level comments are stripped (the added
  `// Accepts RecommendedFormat` and `// INVARIANT:` blocks do not appear in the
  emitted JS at all), but comments *inside* an object or array literal survive
  into the output. A comment-only edit there will report DIFFERS. That is a
  false alarm, not a false pass, so it fails safe — read the diff and move on.
- **Projects that ship `tsc` output.** Then `tsc --outDir` is the instrument.
  Diff whatever actually runs.
- **Files you did not put in the loop.** The set must be every changed
  non-test file. A type change in file A can alter what compiles in file B; the
  test only covers files you feed it.

## What this technique does NOT prove

Stated plainly, because the temptation to over-read a green run is the whole
risk:

**Byte-identical emitted JS proves the runtime behavior is unchanged. It says
nothing whatsoever about whether the new types describe reality correctly.**

A wrong type and a right type erase to exactly the same nothing. This test
cannot distinguish `RecommendedFormat` from `Format` from `any` — all three
vanish. If the widening was wrong, the emit is still identical and this check
still says IDENTICAL. Specifically it does not prove:

- that the annotation matches what values actually flow through at runtime;
- that a reachability claim used to justify a narrowing is true;
- that a cast is sound (an `as` that is a lie erases just as cleanly as one
  that is true);
- that tests pass, or that `tsc --noEmit` is clean.

Those need separate evidence. Here that was `npx tsc --noEmit` -> 0 errors and
`npm test` -> 342 tests / 56 suites / 0 fail, plus the reachability argument
below. The emit diff answers exactly one question: *did anything that executes
change?* Do not let it answer a second one.

## Secondary lesson: the two-sided reachability question

The three Group B errors all came from `RecommendedFormat` (`Format |
"unresolved"`, `src/types.ts:24`) meeting a parameter typed `Format`. The
reflex fix for all three is a runtime guard. **The reflex was wrong at both
sites, in opposite directions.** Asking "can this site actually receive
`unresolved`?" is a question with two failure modes, and only asking it in one
direction gets you the wrong answer half the time.

**Site 1 — `getFormatFamily` (`src/automation/router.ts:19`): reachable.**
Clarification-first leads carry `"unresolved"` through enrich and into
`routeLead`, which calls it at `router.ts:81`. The function was *already total*
over any string: the `FORMAT_FAMILIES` loop matches nothing and falls through to
`return "unknown"`. So the code was correct and the **type** was wrong. A guard
here would have added a branch to handle a case the function already handled.
Fix: widen the parameter to `RecommendedFormat` and record what already happens.

**Site 2 — `findMinFloor` (`src/prompts/generate.ts:434`, called at `:383`):
provably unreachable.** Its only caller is the `no_viable_scope` tail of
`buildBudgetModeBlock`, guarded by `if (budget.tier === "none") return ""` at
`generate.ts:342`. Every `PricingResult` carrying `"unresolved"` is built with
`tier: "none"` (`src/run-pipeline.ts:35`, and the hard-gate declines), and
`lookupPrice` throws outright on `"unresolved"` (`src/pipeline/price.ts:57-58`).
Nothing can arrive here with `"unresolved"`. A guard would be **dead code
masquerading as a safety check** — permanently un-exercised, un-testable, and
falsely reassuring to the next reader, who would infer the case is possible
*because the guard exists*. Fix: narrow the parameter to `Format`, which is the
honest signature since it indexes `RATE_TABLES: Record<Format, FormatRates>`.

The generalization: **"add a guard" is not a safe default; it is a claim that
the guarded case can occur.** Before adding one, prove reachability. If the
value can arrive and the code already handles it, fix the type. If it provably
cannot arrive, fix the type. The guard is correct only in the third case, where
the value can arrive and the code does not handle it.

One more result worth keeping: `PricingResult.format` stays
`RecommendedFormat`. Narrowing the interface itself would have traded these
three errors for new ones at `run-pipeline`, which legitimately assigns
`"unresolved"` there, and would have forced inventing a replacement sentinel.
**Fix the boundary, not the shared type.**

## Files Changed

Type-only range `e339340..12c6721` (three commits, all merged in PR #23):

| Commit | File | What changed |
|--------|------|--------------|
| `c48dbc2` | `src/automation/router.ts` | `getFormatFamily` parameter `Format` -> `RecommendedFormat` |
| `c48dbc2` | `src/prompts/generate.ts` | `findMinFloor` parameter `PricingResult["format"]` -> `Format`; `as Format` at the call site + invariant comment |
| `4d79719` | `src/claude.ts` | `ClaudeMessageRequest`/`ClaudeMessageResponse` repointed from `Parameters<>`/`ReturnType<>` on the overloaded `messages.create` to `Anthropic.MessageCreateParamsNonStreaming` / `Anthropic.Message` |
| `12c6721` | `src/automation/orchestrator.ts` | `AutoSendDeps.sendSms` return `Promise<void>` -> `Promise<{ success: boolean; error?: string }>` |

Companion test edits (not production, not part of the emit diff):
`src/claude-extended.test.ts`, `src/confidence.test.ts`,
`src/run-pipeline.test.ts` (mock completion for `citations` / cache-token
fields), `src/orchestrator.test.ts` (spy returns `{ success: true }`).

**Scope caveat:** the PR #23 merge commit `f478239` also contains behavioral
commits `197f118` and `4ff91c6` (Yelp sender acceptance, credential-URL
stripping). "PR #23 emitted identical JS" is true only of the type-only subset
`e339340..12c6721`. Cite the range, not the PR.

## Related Patterns

- [`required-nullable-vs-optional-types.md`](../logic-errors/required-nullable-vs-optional-types.md) — the other half of this repo's type-honesty story: making a type describe reality rather than describe a hope.
- [`noop-gut-checks-conditional-features.md`](../architecture/noop-gut-checks-conditional-features.md) — same family as the dead-guard trap: a check that cannot fire is not a safety feature.
- [`silent-failure-escape-hatches.md`](../architecture/silent-failure-escape-hatches.md) — the zero-byte "IDENTICAL" above is this pattern applied to a verification tool instead of to product code.
- [`dead-code-env-var-collision.md`](dead-code-env-var-collision.md) — also a defect `tsc` cannot see; both argue that a clean typecheck is a floor, not a ceiling.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That the two reachability
   answers demanded *opposite-looking* edits (widen at one site, narrow at the
   other) while being the *same* decision: make the type describe what actually
   flows. The surface asymmetry hides the shared rule, so a future session that
   pattern-matches on "widen to fix `RecommendedFormat` errors" will get site 2
   backwards and reintroduce a signature that lies about `RATE_TABLES`.

2. **What did you consider documenting but left out, and why?** A wrapper
   script or an npm script for the emit diff. It would become a fourth capture
   surface with no named reader and no trigger, and its own failure mode (the
   zero-byte run) is precisely what a wrapper hides best. The commands are ten
   lines and belong in the reviewer's hands, where the byte counts are visible.
   If it is ever automated, the positive control must run in the same
   invocation and a missing control must be a hard failure.

3. **What might future sessions miss that this solution doesn't cover?** That
   the technique is scoped to *this* toolchain. It is valid here only because
   `railway.json` starts the server with `npx tsx` and `tsc` is `--noEmit`-only.
   If this project ever adds a real build step, or if the technique is carried
   to a repo that ships compiled output, the instrument must change with it, and
   nothing in the commands themselves will announce that they have gone stale.
   Re-verify the emit path (`grep startCommand railway.json`, `grep tsc
   package.json`) before reusing this, and re-run the positive control every
   time — an esbuild version bump can change comment or formatting behavior
   without changing semantics.
