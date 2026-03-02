# Gig Lead Responder — Project Instructions

## Three Questions (Mandatory)

Every phase of the compound engineering loop MUST end with three questions
answered in its output document before stopping. Do not skip them even if the
session felt straightforward — the "obvious" sessions are where unexamined
assumptions hide.

### Brainstorm and Plan phases

Append as a `## Three Questions` section at the bottom of the output document:

1. **Hardest decision in this session?**
2. **What did you reject, and why?**
3. **Least confident about going into the next phase?**

### Work phase

Append as a `## Three Questions` section at the bottom of HANDOFF.md:

1. **Hardest implementation decision in this session?**
2. **What did you consider changing but left alone, and why?**
3. **Least confident about going into review?**

### Review phase (synthesize step)

Append as a `## Three Questions` section at the bottom of REVIEW-SUMMARY.md:

1. **Hardest judgment call in this review?** — severity assignment, dedup merge, or dismissal
2. **What did you consider flagging but chose not to, and why?**
3. **What might this review have missed?** — categories, file types, or failure modes no agent checked

### Fix-batched phase

Append as a `## Three Questions` section at the bottom of each batch file:

1. **Hardest fix in this batch?**
2. **What did you consider fixing differently, and why didn't you?**
3. **Least confident about going into the next batch or compound phase?**

### Compound phase

Append as a `## Three Questions` section at the bottom of the solutions document:

1. **Hardest pattern to extract from the fixes?**
2. **What did you consider documenting but left out, and why?**
3. **What might future sessions miss that this solution doesn't cover?**

### Feed-Forward: Read the Previous Phase's Three Questions

Each phase MUST read the `## Three Questions` section from the previous phase's
output before starting its own work. Specifically, read the **"Least confident
about"** answer — that is the previous phase flagging a risk for you.

| Current Phase | Read Three Questions From |
|---------------|--------------------------|
| Plan | Brainstorm (`docs/brainstorms/`) |
| Work | Plan (`docs/plans/`) |
| Review | — (reviews code, not prior phase output) |
| Fix-batched | Review (`docs/reviews/.../REVIEW-SUMMARY.md`) |
| Compound | Fix results (`docs/fixes/.../batchN.md`) |

**How to address it:** Near the top of your output document, add a short
`### Prior Phase Risk` section that:

1. Quotes the previous phase's "Least confident about" answer verbatim.
2. States in one sentence how this phase addresses or accepts that risk.

If the previous phase document has no `## Three Questions` section, note its
absence and proceed normally.

## Session-Closing Handoff (Mandatory)

Before ending ANY session — whether the phase is complete or context is running
low — you MUST update `docs/HANDOFF.md` with:

1. **What was done** this session (commits, files changed, decisions made)
2. **Three questions** answered (per the phase-specific format above)
3. **Next phase** — which phase comes next in the loop
4. **Next-session prompt** — a copy-paste block the user can paste into a fresh
   window to resume exactly where they left off

Format the prompt block like this:

    ### Prompt for Next Session

    ```
    Read [specific file]. [Specific action]. Relevant files: [list].
    ```

If context is running low before the phase is complete, write a **mid-phase
handoff** with the same format but note what's done and what remains.

Do NOT wait for the user to ask. Do NOT skip this because "the session is
almost over." This is the last thing you do before stopping.

## Conventions

- After `/workflows:compound`, always run `/update-learnings` to propagate lessons to all docs
