---
status: pending
priority: p3
issue_id: "085"
tags: [tooling, ci, code-quality]
dependencies: []
unblocks: []
sub_priority: 1
---

# 085: No linter configured — CI covers types and tests only

## Problem Statement

The repo has no linter. Verified 2026-08-08 on `main` (`2df70df`):

- No config files: `.eslintrc*`, `eslint.config.*`, `.prettierrc*`,
  `biome.json` — none exist.
- No lint dependency: filtering `package.json` deps + devDeps for
  `eslint|prettier|biome|oxlint` returns **NONE**.
- No `lint` script in `package.json`.

CI (`.github/workflows/ci.yml`) runs `npm run typecheck` and `npm test`. Those
catch type errors and behavioral regressions. They do **not** catch unused
variables and imports, unreachable code, floating promises, accidental `any`
leakage through untyped boundaries, or inconsistent formatting that makes
diffs noisy.

**Found by:** CI-gate design session, 2026-08-08.

## Why this is p3 and not higher

This is a real gap but a quiet one. Unlike `082`, `083` and `084`, nothing here
is a latent defect — no user-facing behavior is at risk and no guard is blind.
`tsc --strict` is already enabled and covers a meaningful share of what a
type-aware lint ruleset would flag.

Filing it so the absence is recorded rather than rediscovered. It is
deliberately **not** urgent.

## Findings

- `tsconfig.json` has `strict: true`, which already covers null-safety,
  implicit `any`, and unused-parameter classes of error that people often reach
  for ESLint to get.
- The gap `tsc` genuinely cannot cover: floating promises (needs
  `@typescript-eslint/no-floating-promises`, which requires type-aware linting),
  unused *imports* as opposed to unused locals, and any formatting consistency.
- Floating promises are the one with real teeth in this codebase, given the
  async send/dispatch paths in `src/automation/orchestrator.ts`.
- Coverage note: as of `cf2d700`, `npm run typecheck` covers `src/` **and**
  `scripts/` (94 files). Any lint config should match that scope — a linter
  pointed at `src/` only would repeat the exact gap that `cf2d700` just closed.

## Proposed approach

Prefer one tool over a stack. Options, in rough order of effort:

1. **Biome** — single binary, lint + format, near-zero config, very fast. No
   type-aware rules, so no `no-floating-promises`.
2. **ESLint + `typescript-eslint`** (type-aware) — gets
   `no-floating-promises` and `no-misused-promises`, at the cost of a slower
   CI step and more configuration.
3. **Do nothing.** Legitimate. `strict` mode plus 342 tests is not a bad
   baseline for a solo project.

If adopted, add `"lint"` to `package.json` scripts and a step to
`.github/workflows/ci.yml` — **but** run it against the existing codebase
first and fix or explicitly disable every existing violation before wiring it
to CI. A gate that is red on the day it lands is a gate people learn to ignore
(see `084` for the same reasoning applied to `npm audit`).

## Acceptance criteria

- WHEN a linter is adopted, THE SYSTEM SHALL report zero violations on `main`
  before the CI step is added.
- WHEN the lint step is added to CI, THE SYSTEM SHALL cover both `src/` and
  `scripts/`.
- IF the decision is to adopt no linter, THE SYSTEM SHALL record that decision
  and its reasoning in this file and set status to `done`, so "decided against"
  is distinguishable from "never considered".
