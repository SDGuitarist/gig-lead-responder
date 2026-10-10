# Codex round 3 — NP2 round-2 fixes (`3072e6d`..`75b7744`)

> **FIXED (2026-10-09, later):** both residues below are closed by the planned work item. The app now inserts the
> price line and the in-kind line (`src/pipeline/price-block.ts`), and the post-check confirms that block
> (`hasPriceBlock`, `57c58eb`); `hasInKindLine` is deleted. Plan:
> `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md`. This record is unchanged below.

**Verdict: (c) NARROWING same-class residue on ONE surface — THE CAP HAS FIRED.** Both runs agree (run A, Claude
Code: (c), 1 P2 + 1 P3; run B, Alex inside Codex: (c), 1 P2). Authorized by Alex (option B, 2026-10-09); both runs
at Alex's request after round 1 showed the two runs finding disjoint defects. No round 4. No automatic fixes.

**The surface:** `src/pipeline/post-check.ts` `hasInKindLine` infers "the price line" from free prose (round 1: any
position; round 2: any line with the amount; round 3: any line with the amount AND the hours). Each patch narrowed
the false pass; none can make a prose detector recognise a structured quote line.

**Claude Code check:** both REAL, as stated.
- P2 (both runs): "The client budget is $695 for 2 hours." / "I can make $695 work for 2 hours." pass as the price
  line next to the correct in-kind line. Impact: a wrong PASS of the placement rule on a draft that is always held
  for Alex (every nonprofit lead is held); no price is computed differently and nothing sends unreviewed.
- P3 (run A): "in  kind" (two spaces) is not counted. Same impact class.
- Codex's full-suite failures (17) were its sandbox (`listen EPERM`); outside it the suite is 720/0/1 at `75b7744`.

**Alex's decision (2026-10-09): ACCEPT + PLAN THE FIX.** NP2 ships as is; both residues are known gaps (comment at
`hasInKindLine`, HANDOFF). Planned work item (not in this fix loop): the app inserts the price line and the in-kind
line into the drafts itself, and the post-check only confirms that block is intact.

## Run A (Claude Code)

```
(c)

P2 — `src/pipeline/post-check.ts:235` — prose can still masquerade as the required price line.

Failing input:

```text
The client budget is $695 for 2 hours.
My standard rate is $795, so the difference is my in-kind contribution to the Example Foundation.
```

`hasInKindLine()` accepts it because it checks only for the NP amount and priced hours, not the structured quote-line shape. This is the same narrowing post-check failure class, and both R2 and R3 residue land in `src/pipeline/post-check.ts`; the surface is the wrong shape for branch patching.

P3 — `src/pipeline/post-check.ts:229` — `in  kind` with multiple spaces is not counted as an in-kind mention, so a contradictory figure can pass alongside the correct line.

Checked clean: NP2 eligibility/exclusions, pricing threshold, travel totals, budget alternatives, clarification handling, organization-name `The` fix and sanitization, both drafting paths including SMS edits, and TypeScript.

Verification: targeted R403 tests passed 40/40; `npx tsc --noEmit` passed. The full suite reported 703 pass, 17 sandbox-only failures, and 1 skip due prohibited listener/sysctl operations. Worktree and HEAD remained unchanged at `75b7744692a578aa724638c3bedcff6e157dc339`.
```

## Run B (Alex, inside Codex)

```
(c) NARROWING same-class residue landing on ONE surface — the `src/pipeline/post-check.ts` price-line detector is the wrong shape. The cap fires; there is no Round 4.

P2 — `src/pipeline/post-check.ts:232-246`

Concrete failing input:

    The client budget is $695 for 2 hours.
    My standard rate is $795, so the difference is my in-kind contribution to Example Foundation.

`postCheckDrafts()` reports no `in_kind_line_*` violation. The same happens with:

    I can make $695 work for 2 hours.

Why it matters: requiring the NP amount plus priced hours narrowed the prior false pass, but still infers “quote line” from arbitrary prose. A contradictory or non-quote sentence can remain adjacent to the valid in-kind line and bypass the intended structural check. This is the same R2 failure class, now narrowed to the post-check surface.

Checked clean: R2 organization-name fix (leading `The` removed without damaging `Theater` or `YMCA`); venue/name newline and character filtering; correct organization insertion and `[organization]` missing-name hold; standard-rate wording filter and `in-kind` / `in kind` / `inkind` detection; correct placement on both full and compressed drafts; NP2 eligibility, exclusions, pricing threshold, travel totals, budget modes, clarification, T4, residency and duo paths; both pipeline drafting paths and SMS edit wiring; focused suite 157/157 passed; `npx tsc --noEmit` passed; branch and origin ref match `75b7744692a578aa724638c3bedcff6e157dc339`; worktree clean. No server, poller, database, or send used.
```
