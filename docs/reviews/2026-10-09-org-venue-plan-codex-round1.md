# Codex PLAN review, round 1: organization_name must never be the venue

**Plan:** `docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md` at `8e4fcdf`. No prior Codex verdict.
**Reader and trigger:** plan revision 1 (applies every accepted finding) and the plan round-2 prompt (cites this).

**Verdict: NO-GO on BOTH runs.** Run A (Claude Code): 3 P1, 3 P2. Run B (Alex): 2 P1, 2 P2, 1 P3. All accepted.

| # | Runs | Finding | Fix (plan revision 1) |
|---|---|---|---|
| 1 | A+B P1 | Empty/whitespace `venue_name` unspecified; raw `""` at the call site | Empty or whitespace venue (or org) is never comparable: no match. Tests O5b |
| 2 | A+B P1 | Variants kept: accents, `&` vs `and`, `St.` vs `Saint` | Fold accents (NFD, strip marks) and `&` → `and`: matched. `St.` vs `Saint`: documented KNOWN MISS, pinned by a test so a change is deliberate |
| 3 | A+B P2 | Over-broad drops: "The Grand"/"Grand Avenue Foundation", "The Rock"/"Rock the Vote", "The Center"/"Center for…" | Match = identical word sequences, OR whole-word containment where the shorter has at least 2 words. Overshoot controls O4b |
| 4 | A+B P1/P2 | O6 cannot catch broken call-site wiring | O6 runs a raw object through `classifyLead` (stubbed model) and asserts `organization_name === null` |
| 5 | A P2, B note | Execution Path placeholders; no three-way reading | Concrete `mktemp -d` path, lead text inline, `jq` filter, three-way outcome per run |
| 6 | A P2 | `runEditPipeline` reuses a stored classification; the guard never runs | Apply the same normalization at `runEditPipeline` entry (next to its `venue_name` backfill). Test O9 |
| 7 | B P3 | Non-nonprofit with org = venue | O8: stays null (existing rule) |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-09; HEAD `8e4fcdf`, clean after)

```
NO-GO — Round 1.

Round 0: NO — no execution yet. Findings about runtime model behavior remain “the run must measure X.”

Findings

P1 — Empty `venue_name` is not specified or tested  
Plan §Acceptance Tests, O5, lines 99–100; implementation call at `classify.ts:164` receives raw `obj.venue_name` before the later empty-string sanitization.

Concrete input:

```text
organization_name = "Example Arts Foundation"
venue_name = ""
```

The plan must require that the organization is kept. Otherwise an empty word sequence could accidentally match everything, or the guard may behave inconsistently before `classifyLead` converts `""` to `null`.

Add an explicit empty-string case and require `nameWords("")` / `containsWords` to return “no match.”

P1 — The proposed lexical rule still keeps several obvious venue-as-organization variants  
Plan §Decision, lines 36–49.

Concrete false keeps:

```text
venue_name = "Café São Paulo"
organization_name = "Cafe Sao Paulo"

venue_name = "St. Mary's Church"
organization_name = "Saint Mary's Church"

venue_name = "A&B Center"
organization_name = "A and B Center"
```

The rule does not define accent folding, `&`/`and` equivalence, or `St.`/`Saint` equivalence. That may be an intentional conservative boundary, but then the plan must explicitly say these are expected misses and the execution result must not claim the guard generally closes the finding. Otherwise add tests and normalization rules.

P2 — The “false drops only cost a hold” rationale is too broad  
Plan §Decision, lines 45–49; O4 is too narrow.

Concrete false drop beyond the accepted “organization named after venue” case:

```text
venue_name = "The Grand"
organization_name = "Grand Avenue Foundation"
```

Whole-word containment drops the real organization merely because the venue has a generic one-word name. Another example is `"The Center"` versus `"Example Center Foundation"`.

The plan should either narrow the rule, explicitly accept these false drops as a bounded tradeoff, or add positive tests proving the accepted false-drop surface.

P1 — O6 may not fail when call-site wiring is broken  
Plan O6, lines 101–103.

If O6 directly calls `inKindSentence` with `organization_name` already set to `null`, changing the `validateClassification` call to pass `undefined` will not necessarily affect that test. The mutation must pass a raw classifier object through `classifyLead`/`validateClassification`, then use the returned classification for the price sentence and nonprofit note.

Make O6 explicitly assert:

```text
raw organization_name = venue_name
→ classify result organization_name = null
→ inKindSentence contains "[organization]"
→ nonprofitPriceNote says Alex fills "[organization]"
```

P2 — Execution Path is not concrete enough  
Plan §Execution Path, lines 118–126.

`<scratchpad>` is still a placeholder, and the lead text is referenced indirectly from another plan rather than included or named as an exact fixture. The command also does not show how the JSON output will be filtered to the two classification fields.

Use a concrete temporary path and an explicit command, for example:

```sh
tmpdir="$(mktemp -d)"
DATABASE_PATH="$tmpdir/runs.db" npx tsx src/index.ts --json < /absolute/path/to/lead-c.txt \
  | jq '.classification | {organization_name, venue_name}'
```

The positive control using lead (a) is appropriate, but add the expected result: organization remains `"Example Arts Foundation"` while venue remains `"Example Grand Hotel"`.

P2 — The plan does not cover reused classifications  
`runEditPipeline` accepts an existing `Classification` and does not re-run `validateClassification`. A previously stored classification with `organization_name` equal to `venue_name` could still produce the wrong in-kind sentence during an edit.

Either state that the invariant applies only to fresh classification and document the legacy limitation, or add a bounded test/normalization at the edit entry point.

Plan Quality Gate

Questions 1–4 are answered. Question 5 is present but not yet runnable because the execution command and fixture path contain placeholders. After that is corrected, the five-question gate should pass.
```

## Run B (Alex, inside Codex, 2026-10-09)

```
NO-GO — Round 1.

Repo gate passed: correct path, branch, HEAD `8e4fcdf...`, and clean worktree. `ps` was blocked by macOS `EPERM`, so
live-process absence could not be independently verified; no write drift was visible. No server, poller, network, or
database access was used.

Findings:
- P1 — Empty venue behavior is unspecified and untested. Plan lines 57, 91–100 pass raw `obj.venue_name` before
  `classifyLead` sanitizes empty strings at `classify.ts:187–190`. Input: nonprofit org "Example Arts Foundation",
  `venue_name: ""` or "   ". A naive empty-word containment helper can match everything and drop the real
  organization. Require empty/whitespace venues to be non-comparable, with regression tests.
- P1 — The guard still keeps venues with common spelling variants. Plan lines 36–49 only normalize case, leading
  "the," punctuation, and spacing. Concrete false negatives: organization "St. Mary's Hotel", venue "Saint Marys
  Hotel"; organization "Arts & Culture Center", venue "Arts and Culture Center"; organization "Café São Paulo",
  venue "Cafe Sao Paulo". Either expand normalization and test it, or explicitly narrow/document this limitation
  and measure it.
- P2 — The accepted false-drop rationale is too narrow. Input: venue "The Rock", organization "Rock the Vote".
  Whole-word containment drops the real organization. "The Center" / "Center for Community Arts" is another
  example. Add an overshoot control and state whether generic one-word venues require a narrower rule.
- P2 — O6's mutation claim is not guaranteed by the described test. Specify that O6 uses the stubbed classifier
  path and verifies organization_name === null.
- P3 — O5 covers venue_name: null but not empty or whitespace venues. O8 should explicitly cover a non-nonprofit
  classification whose organization equals the venue and confirm the existing non-nonprofit null behavior.

Execution Path is mostly concrete, but its expected result needs a three-way interpretation for each run:
organization already null; organization equals venue and guard fires; organization equals venue while venue is
null/different, meaning the known limitation occurred. The positive control for lead (a) is adequate.

Plan Quality Gate: all five questions are answered. The main risk is the missing empty/variant normalization contract.
(Codex's fix-contract paragraph and stop rules omitted; they match the prompt.)
```
