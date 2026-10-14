// The made-up vague leads shared by the measurement scripts (moved out of scripts/clarification-measure.ts unchanged,
// so the arm manifest's lead-set hash is the same). No venue, no private data.
export const LEADS: Record<string, string> = {
  v1: "Hi, I'm looking for live music for an event sometime next month. I'm not sure what kind of music or how many musicians would work. What do you suggest?",
  v2: "Hi Alex, we are thinking about some live music for a gathering this winter. Not sure yet what we need or what would suit it. Could we talk?",
  v3: "Hi, do you play weddings? Looking for some music. How much?",
  v4: "Need live music for a party. Not sure what's best.",
  v5: "Hello, planning an event in the spring and want some live entertainment. What options do you have and what do they cost?",
  v6: "Hi Alex, looking for a musician for my mom's birthday. Not sure what type of music or how long. Thoughts?",
  // Held out for plan 2 (docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md): written before the change, and
  // their per-run drafts are not read before it is committed.
  h1: "Hi there! My husband's 40th is coming up in the summer and I'd love some live music for it. Not sure what would work. Any ideas?",
  h2: "Looking for a musician for our company holiday gathering. Haven't decided on the vibe yet. What do you recommend?",
  h3: "Hello, we want live music at our anniversary dinner. We don't really know what to ask for. What are the options?",
  h4: "Hi, I run a small art gallery and we're thinking about live music at an opening this fall. Not sure if that's even doable. Thoughts?",
};
