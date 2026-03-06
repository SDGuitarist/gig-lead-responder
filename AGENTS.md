# Codex Repo Instructions

## Repo Snapshot
- Project: AI-powered gig lead response pipeline for a musician.
- Read first: `HANDOFF.md`, `CLAUDE.md`, `docs/reviews/CODEX-REVIEW-GATE.md`, then `docs/plans/`, `docs/reviews/`, `docs/solutions/`, and `todos/`.
- Main code: `src/`
- Sample inputs and assets: `examples/`, `public/`, `data/`
- Config: `package.json`

## Commands
- Start the main pipeline: `npm start` — runs `src/index.ts`.
- Run the demo input: `npm run demo` — feeds the example lead into the pipeline.
- Start the server: `npm run serve` — runs `src/server.ts`.
- Run tests: `npm test` — runs the Node test files in `src/*.test.ts`.

## Branch And PR Notes
- Base branch is `main`.
- If PR commands are needed, use `gh pr create --base main`.

## How Codex Should Work Here
- Use Codex for second-opinion plans, branch and PR risk review, plain-English explanation, and focused handoff prompts for Claude Code.
- Follow the compound workflow already documented in `CLAUDE.md` and `HANDOFF.md`.
- When asked to plan, include prior phase risk from `## Feed-Forward` or `## Three Questions`, then propose the smallest safe slice.
- When asked to review, use `docs/reviews/CODEX-REVIEW-GATE.md`, put findings first, and focus on pipeline correctness, pricing or reply regressions, auth or security issues, missing tests, and rollout risk.

## Repo Guardrails
- `HANDOFF.md` is mandatory session state. Update or reference it before claiming status.
- High-risk areas include `src/server.ts`, auth middleware ordering, environment-dependent integrations, and any change that could affect live lead handling.
