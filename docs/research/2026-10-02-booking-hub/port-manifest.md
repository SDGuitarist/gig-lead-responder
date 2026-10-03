# Port manifest (plan step 0.5)

**Reader and trigger:** whoever ports the Project into the repo (plan 0.5), and the Module 1 launch gate: Module 1 cannot go live while any row is `UNREVIEWED` or `BLOCKED`. Checked by `npm run test:match -- "port manifest structure"`.

**Rows** come from `port-inventory.md`, in order. **Statuses:** `UNREVIEWED` (nobody has compared it yet), `PORTED` (cites the runtime function and the test that calls it), `ALREADY PRESENT` (cites the repo file, and line where useful, that already does it), `NOT PORTED` (reason plus Alex's approval) or `TO PORT` (reviewed: a real gap, destination named, not built yet) or `BLOCKED` (waiting on an Alex question).

**Open Alex question (q-d):** the chat Project also answered interactive questions ("what should I quote for...", "what do I know about this venue", "does this sound like me"). The app only answers leads. **Answered 2026-10-03: Alex approved NOT PORTED for those rows (R007, R009, R010, R011, R019).**

**Answered 2026-10-03 (Alex):** q-e: cross-reference/navigation rows NOT PORTED. q-f: the stale "Pricing Shorthand" table removed from `docs/QUICK_REFERENCE.md` (test `stale price shorthand`). q-g: contact block stays name only (R252).

**Public repo:** headings, statuses and repo locations only. No rates, no client names, no source text (the source lives in `~/Data/gig-lead-responder/`).

| # | Source | Section | Status | Where / reason | Condition | Marker | Test |
|---|---|---|---|---|---|---|---|
| R001 | P1 | Pacific Flow Entertainment: System Router | ALREADY PRESENT | `src/run-pipeline.ts`: the classify → price → generate → verify pipeline is the dispatcher for the app's one task | always |  |  |
| R002 | P1 | Prime Directive | ALREADY PRESENT | `docs/PRINCIPLES.md:12`, loaded by `selectContext` (`src/pipeline/context.ts:50`) | always | `CLOSE THE DEAL` |  |
| R003 | P1 | Critical Process Requirement | ALREADY PRESENT | `src/automation/router.ts:62`: a lead whose gate still fails after the rewrite retries is held, not delivered | gate fail | `Verification gate failed after retries` |  |
| R004 | P1 | Task Routing | ALREADY PRESENT | `src/pipeline/context.ts`: section heading only; its routes are R005–R011 | — |  |  |
| R005 | P1 | Lead Response (Default) | ALREADY PRESENT | `src/pipeline/context.ts`: RESPONSE_CRAFT, PRICING_TABLES, QUICK_REFERENCE always; PROTOCOL = `buildClassifyPrompt`; rate cards = `src/data/rates.ts`. LEAD_RESPONSE_VOICE is not loaded: tracked in its own (F) rows | always |  |  |
| R006 | P1 | Cultural Context Routing | TO PORT | `src/pipeline/context.ts:56`: CULTURAL_CORE.md loads only for `spanish_latin`; the rule says load it for any active cultural context when no genre file exists. Classify (`src/prompts/classify.ts:137`) only knows `spanish_latin`. Not a small port: the flag also drives the generate word count and wedge (`src/prompts/generate.ts:222`, `:262`) and a verify check (`src/prompts/verify.ts:207`), so it needs a design pass and live drafting runs | `cultural_context_active` with any tradition | `## CULTURAL CORE FRAMEWORK` |  |
| R007 | P1 | Pricing Question | NOT PORTED | an interactive chat task, and the app only answers leads; approved by Alex 2026-10-03 (q-d) |  |  |  |
| R008 | P1 | Bolero Trio Pricing or Negotiation | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R009 | P1 | Venue Question | NOT PORTED | an interactive chat task, and the app only answers leads; approved by Alex 2026-10-03 (q-d). The lead-time venue lookup is already in `selectContext` (venue branch) |  |  |  |
| R010 | P1 | Cultural Pattern Request | NOT PORTED | an interactive chat task, and the app only answers leads; approved by Alex 2026-10-03 (q-d) |  |  |  |
| R011 | P1 | Voice Question | NOT PORTED | an interactive chat task, and the app only answers leads; approved by Alex 2026-10-03 (q-d) |  |  |  |
| R012 | P1 | Pricing Architecture | ALREADY PRESENT | `src/pipeline/price.ts:52` `lookupPrice()`: tier + column from classify, anchor/floor from `src/data/rates.ts`, position by competition level | always |  |  |
| R013 | P1 | File Architecture | ALREADY PRESENT | `src/pipeline/context.ts`: file tiers map to the always/conditional loads; each file is checked in its own rows | — |  |  |
| R014 | P1 | Output Format | ALREADY PRESENT | `src/prompts/verify.ts`: the gate is produced and checked before drafts leave the pipeline (`src/run-pipeline.ts`) | always |  |  |
| R015 | P1 | VERIFICATION GATE (Required) | ALREADY PRESENT | `src/types.ts:155`: validation line, best line, concern traceability, scene quote + type, competitor test, and the 9 gut checks; `src/prompts/verify.ts` | always |  |  |
| R016 | P1 | FULL DRAFT ([X] words) | ALREADY PRESENT | `src/prompts/generate.ts`: `full_draft` | always | `full_draft` |  |
| R017 | P1 | COMPRESSED DRAFT ([X] words, [Competition Level]) | ALREADY PRESENT | `src/prompts/generate.ts`: `compressed_draft`, sized by competition level | always | `compressed_draft` |  |
| R018 | P1 | STRATEGIC RESERVE (for follow-up) | TO PORT | No strategic reserve anywhere in `src/`. Destination: a `strategic_reserve` output of `buildGeneratePrompt`, read by the follow-up prompt (`src/prompts/follow-up.ts`) | always |  |  |
| R019 | P1 | Cross-Reference Index | NOT PORTED | a navigation table for the chat Project; each file it points to has its own rows. Approved by Alex 2026-10-03 (q-d) |  |  |  |
| R020 | F1 | When to use this template | UNREVIEWED | | | | |
| R021 | F1 | The structure, in order | UNREVIEWED | | | | |
| R022 | F1 | Fill-in template | UNREVIEWED | | | | |
| R023 | F1 | Re-derive for every lead (never copy) | UNREVIEWED | | | | |
| R024 | F1 | Fixed by standing rules (always keep) | UNREVIEWED | | | | |
| R025 | F1 | Known deviations from the protocol | UNREVIEWED | | | | |
| R026 | F2 | Pacific Flow Entertainment: Voice Specification | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `## LEAD RESPONSE VOICE` | `port manifest F2` |
| R027 | F2 | Who Alex Is (For Voice Calibration) | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `Who Alex Is` | `port manifest F2` |
| R028 | F2 | Voice DNA | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `Voice DNA` | `port manifest F2` |
| R029 | F2 | Core Voice Constants (Hold Across Every Lead) | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `Core Voice Constants` | `port manifest F2` |
| R030 | F2 | Voice by Audience | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `Voice by Audience` | `port manifest F2` |
| R031 | F2 | Drafting Principles (Non-Negotiable) | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `Drafting Principles` | `port manifest F2` |
| R032 | F2 | Quality Checklist (Voice-Level Pass Before Verification Gate) | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `Quality Checklist` | `port manifest F2` |
| R033 | F2 | What NOT to Sound Like | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always | `What NOT to Sound Like` | `port manifest F2` |
| R034 | F2 | Hard Language Rules | PORTED | `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext`; mechanical rules also in `src/pipeline/post-check.ts` | always | `Hard Language Rules` | `port manifest F2`; `voice kill list` |
| R035 | F2 | No em-dashes. Ever. | PORTED | `src/pipeline/post-check.ts` auto-replaces em dashes in prose (pre-existing); `docs/LEAD_RESPONSE_VOICE.md`, loaded for every lead by `selectContext` | always |  | `voice kill list` |
| R036 | F2 | No hype punctuation. | PORTED | `src/pipeline/post-check.ts`: more than one `!` fails; ALL CAPS is a named judgment check in `src/prompts/verify.ts` §7b | always | `voice_exclamations` | `voice kill list`; `port manifest F2 verify` |
| R037 | F2 | Kill list (cut on sight) | PORTED | `src/pipeline/post-check.ts` `VOICE_KILL_LIST` (mechanical words/phrases); words Alex uses in his own converted replies ("just", "really", plain "perfect", "dream") and context words ("foster", "journey", "vision") are judgment checks in `src/prompts/verify.ts` §7b | always | `VOICE_KILL_LIST` | `voice kill list`; `port manifest F2 verify` |
| R038 | F2 | Banned structural patterns | PORTED | `src/prompts/verify.ts` §7b (false binary, triple strawman, FOMO, snappy triads, unearned profundity); the required Named Fear is written out as NOT a false binary; generic cinematic setups are in `src/pipeline/post-check.ts` | always | `False binary` | `port manifest F2 verify` |
| R039 | F2 | Confidence calibration | PORTED | `src/prompts/verify.ts` §7b (overconfidence about what nobody controls) | always | `Overconfidence` | `port manifest F2 verify` |
| R040 | F2 | Self-Check Protocol | PORTED | Self-check items 1–2 in `src/pipeline/post-check.ts`; 3, 6, 7 in `src/prompts/verify.ts` §7b; 4 is `validated_them`; 5 is `lead_specific_opening` (`src/prompts/verify.ts`) | always |  | `voice kill list`; `port manifest F2 verify` |
| R041 | F2 | When in Doubt | ALREADY PRESENT | Points to an email-samples doc the app does not have; the app's equivalent is `src/data/voice-references.ts` (shown to generate and verify). Left out of the loaded doc | always |  |  |
| R042 | F2 | Cross-References | NOT PORTED | Navigation table; approved by Alex 2026-10-03 (q-e) |  |  |  |
| R043 | F3 | Tier Definitions (Quick Reference) | UNREVIEWED | | | | |
| R044 | F3 | B2C Buyer Tiers (Private Events) | UNREVIEWED | | | | |
| R045 | F3 | Recurring Programming Requests for Trio/Ensemble | UNREVIEWED | | | | |
| R046 | F3 | Flamenco Trio (Guitar + Cajón + Dancer) | UNREVIEWED | | | | |
| R047 | F3 | B2C Pricing: Flamenco Trio Full (Dancer Entire Duration) | UNREVIEWED | | | | |
| R048 | F3 | B2C Pricing: Flamenco Trio Hybrid (Recommended Default) | UNREVIEWED | | | | |
| R049 | F3 | Mariachi: Full Ensemble (Weekend, 8-10 Players) | UNREVIEWED | | | | |
| R050 | F3 | B2C Pricing: San Diego County | UNREVIEWED | | | | |
| R051 | F3 | B2C Pricing: Outside San Diego County | UNREVIEWED | | | | |
| R052 | F3 | Mariachi: 4-Piece (Weekday) | UNREVIEWED | | | | |
| R053 | F3 | B2C Pricing | UNREVIEWED | | | | |
| R054 | F3 | Sourced Cultural Music: Universal Pricing | UNREVIEWED | | | | |
| R055 | F3 | Trio (3 Musicians) | UNREVIEWED | | | | |
| R056 | F3 | Quartet (4 Musicians) | UNREVIEWED | | | | |
| R057 | F3 | 5-Piece (5 Musicians) | UNREVIEWED | | | | |
| R058 | F3 | Booking Guidelines | UNREVIEWED | | | | |
| R059 | F3 | Strategic Notes | UNREVIEWED | | | | |
| R060 | F3 | Cross-References | UNREVIEWED | | | | |
| R061 | F4 | Product Overview | UNREVIEWED | | | | |
| R062 | F4 | B2C Pricing: Bolero Trio (Private Events) | UNREVIEWED | | | | |
| R063 | F4 | 1-Hour Service | UNREVIEWED | | | | |
| R064 | F4 | 1.5-Hour Service (Duration Adjustment Option) | UNREVIEWED | | | | |
| R065 | F4 | 2-Hour Service (Most Common) | UNREVIEWED | | | | |
| R066 | F4 | 3-Hour Service | UNREVIEWED | | | | |
| R067 | F4 | Recurring Programming Requests for Bolero Trio | UNREVIEWED | | | | |
| R068 | F4 | Tier Definitions (Quick Reference) | UNREVIEWED | | | | |
| R069 | F4 | B2C Buyer Tiers (Private Events) | UNREVIEWED | | | | |
| R070 | F4 | B2B Residency Tiers (Recurring Programming): Not Applicable | UNREVIEWED | | | | |
| R071 | F4 | Lead Source Logic | UNREVIEWED | | | | |
| R072 | F4 | Booking Guidelines | UNREVIEWED | | | | |
| R073 | F4 | Strategic Notes | UNREVIEWED | | | | |
| R074 | F4 | Cross-References | UNREVIEWED | | | | |
| R075 | F5 | Pacific Flow Entertainment: Venue Intelligence | UNREVIEWED | | | | |
| R076 | F5 | How to Use This File | UNREVIEWED | | | | |
| R077 | F5 | Section 1: Tier Classification | UNREVIEWED | | | | |
| R078 | F5 | Tier A: Auto-Trigger Premium | UNREVIEWED | | | | |
| R079 | F5 | Tier B: Context-Dependent Premium | UNREVIEWED | | | | |
| R080 | F5 | Standard Venues (No Modifier) | UNREVIEWED | | | | |
| R081 | F5 | Section 2: Venue Profiles: Tier A | UNREVIEWED | | | | |
| R082 | F5 | Hotel del Coronado | UNREVIEWED | | | | |
| R083 | F5 | The Grand Del Mar | UNREVIEWED | | | | |
| R084 | F5 | Lodge at Torrey Pines | UNREVIEWED | | | | |
| R085 | F5 | La Valencia Hotel | UNREVIEWED | | | | |
| R086 | F5 | [TEMPLATE FOR ADDITIONAL TIER A VENUES] | UNREVIEWED | | | | |
| R087 | F5 | Section 3: Venue Profiles: Tier B | UNREVIEWED | | | | |
| R088 | F5 | Coasterra | UNREVIEWED | | | | |
| R089 | F5 | Scripps Seaside Forum | UNREVIEWED | | | | |
| R090 | F5 | [ADD MORE TIER B PROFILES AS NEEDED] | UNREVIEWED | | | | |
| R091 | F5 | Section 4: Red Flag Venues | UNREVIEWED | | | | |
| R092 | F5 | Decline or Approach with Caution | UNREVIEWED | | | | |
| R093 | F5 | Red Flag Patterns (Not Venue-Specific) | UNREVIEWED | | | | |
| R094 | F5 | Section 5: Venue Signal Detection | UNREVIEWED | | | | |
| R095 | F5 | Auto-Premium Signals (Treat as Tier A) | UNREVIEWED | | | | |
| R096 | F5 | Premium Zip Codes | UNREVIEWED | | | | |
| R097 | F5 | Tier B Signals (Context-Dependent) | UNREVIEWED | | | | |
| R098 | F5 | Section 6: Operational Quick Reference | UNREVIEWED | | | | |
| R099 | F5 | Standard Setup Requirements | UNREVIEWED | | | | |
| R100 | F5 | Common Venue Concerns → Responses | UNREVIEWED | | | | |
| R101 | F5 | Cross-References | UNREVIEWED | | | | |
| R102 | F6 | Buyer Tiers (B2C: Private Events) | UNREVIEWED | | | | |
| R103 | F6 | Residency Tiers (B2B: Recurring Programming, Solo Alex Only) | UNREVIEWED | | | | |
| R104 | F6 | B2C Negotiation Rules | UNREVIEWED | | | | |
| R105 | F6 | B2C: Solo Guitar | UNREVIEWED | | | | |
| R106 | F6 | B2C: Duo (Guitar + Second Musician) | UNREVIEWED | | | | |
| R107 | F6 | B2C: Flamenco Duo (Guitar + Cajón) | UNREVIEWED | | | | |
| R108 | F6 | B2B Residency Pricing: Solo Only | UNREVIEWED | | | | |
| R109 | F6 | R1: Owner-Operator (Floor $300) | UNREVIEWED | | | | |
| R110 | F6 | R2: Mid-Tier (Floor $350) | UNREVIEWED | | | | |
| R111 | F6 | R3: Premium (Floor $400+) | UNREVIEWED | | | | |
| R112 | F6 | Sourced Cultural Music: Solo & Duo Only | UNREVIEWED | | | | |
| R113 | F6 | B2C Pricing | UNREVIEWED | | | | |
| R114 | F6 | Trio/Ensemble Rates: Separate Project | UNREVIEWED | | | | |
| R115 | F6 | Strategic Margin Notes: Solo & Duo Only | UNREVIEWED | | | | |
| R116 | F6 | B2B Residency Comparison by Tier (Solo, 2hrs Weekly) | UNREVIEWED | | | | |
| R117 | F6 | Change Log | UNREVIEWED | | | | |
| R118 | F6 | April 26, 2026: Residency Tier Restructure (with same-day scope correction) | UNREVIEWED | | | | |
| R119 | F7 | Pacific Flow Entertainment: Alex's Philosophy on Event Arcs | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R120 | F7 | The Core Thesis | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R121 | F7 | Wedding Arc: The Three-Room Structure | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R122 | F7 | Room 1: The Ceremony | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R123 | F7 | Room 2: The Cocktail Hour | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R124 | F7 | Room 3: The Reception | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R125 | F7 | Corporate Event Arc: The Three-Room Structure | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R126 | F7 | Room 1: Arrival and Networking | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R127 | F7 | Room 2: The Remarks / Speeches Moment | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R128 | F7 | Room 3: The Social Tail | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R129 | F7 | Private Celebration Arc: Birthday, Anniversary, Milestone | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R130 | F7 | Room 1: Arrival | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R131 | F7 | Room 2: Dinner | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R132 | F7 | Room 3: The Peak Moment | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R133 | F7 | Room 4: The Close | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R134 | F7 | Cultural Celebration Arc: The Heritage Layer | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R135 | F7 | The Flamenco Wedding / Heritage Birthday Example | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R136 | F7 | Memorial / Celebration of Life Arc: The Register of Grief | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R137 | F7 | Room 1: Gathering | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R138 | F7 | Room 2: The Service or Shared Moments | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R139 | F7 | Room 3: The Reception Tail | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R140 | F7 | How the Orchestrator Uses This Document | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R141 | F7 | The Repertoire-to-Phase Mapping | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R142 | F7 | Why the Orchestrator Can't Skip This | PORTED | `docs/EVENT_STRUCTURE_THEORY.md` (the Project's newer, em-dash-free copy; a memorial client's first name replaced), loaded by `selectContext` when classify sets `event_arc` (`src/pipeline/classify.ts` `normalizeEventArc`) | `event_arc` set (wedding / corporate / private_celebration / memorial) | `## EVENT ARCS` | `port manifest F7`; `classify event arc` |
| R143 | F8 | Pacific Flow Entertainment: Cultural Response Framework | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R144 | F8 | Why Cultural Responses Are Different | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R145 | F8 | The Gift-Giver Framework | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R146 | F8 | Validation Patterns | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R147 | F8 | The Invisible Gift | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R148 | F8 | Participatory vs. Performance | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R149 | F8 | Performance (Guests Watch) | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R150 | F8 | Participatory (Guests Join In) | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R151 | F8 | Why This Matters | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R152 | F8 | Domain Terminology | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R153 | F8 | The Rule: 1-2 Terms Maximum | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R154 | F8 | How to Use Terms | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R155 | F8 | Finding the Cultural Wedge | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R156 | F8 | 1. The Honoree's Relationship to the Music | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R157 | F8 | 2. The Gift-Giver's Intention | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R158 | F8 | 3. What Will Happen in the Room | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R159 | F8 | 4. The Generational Thread | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R160 | F8 | The Vehicle (Why You) | PORTED | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); taken from the Project 2026-10-03 (was 0.28) | `cultural_tradition === "spanish_latin"` (R006 widens this) | `The Vehicle (Why You)` | `port manifest F8` |
| R161 | F8 | The Flow | PORTED | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); taken from the Project 2026-10-03 (was 0.33) | `cultural_tradition === "spanish_latin"` (R006 widens this) | `The Vehicle (Why You)` | `port manifest F8` |
| R162 | F8 | Vehicle Patterns | PORTED | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); taken from the Project 2026-10-03 (was 0.20) | `cultural_tradition === "spanish_latin"` (R006 widens this) | `The Vehicle (Why You)` | `port manifest F8` |
| R163 | F8 | Vehicle Placement | PORTED | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); taken from the Project 2026-10-03 (was 0.25) | `cultural_tradition === "spanish_latin"` (R006 widens this) | `The Vehicle (Why You)` | `port manifest F8` |
| R164 | F8 | The Test | PORTED | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); taken from the Project 2026-10-03 (was 0.31) | `cultural_tradition === "spanish_latin"` (R006 widens this) | `The Vehicle (Why You)` | `port manifest F8` |
| R165 | F8 | Musical Bridges | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R166 | F8 | Common Bridges | ALREADY PRESENT | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); matched the Project before the port | `cultural_tradition === "spanish_latin"` (R006 widens this) |  |  |
| R167 | F8 | Cultural Response Flow | PORTED | `docs/CULTURAL_CORE.md`, loaded by `selectContext` (`src/pipeline/context.ts:61`); today only for `spanish_latin` (see R006); merged 2026-10-03: kept the repo's 5-step table (matches `src/prompts/generate.ts:81`), added the Project's "The vehicle is essential." | `cultural_tradition === "spanish_latin"` (R006 widens this) | `The vehicle is essential.` | `port manifest F8` |
| R168 | F8 | Cross-References | NOT PORTED | navigation, same class as R019 (approved); approved by Alex 2026-10-03 (q-e) |  |  |  |
| R169 | F9 | Pacific Flow Entertainment: Spanish/Latin Cultural Patterns | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.98) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R170 | F9 | Terminology by Tradition | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R171 | F9 | Flamenco | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R172 | F9 | Mariachi | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R173 | F9 | Bolero/Latin | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.29) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R174 | F9 | The Juerga Dynamic | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R175 | F9 | Juerga Signals (Any 2+) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R176 | F9 | Why Trio (Not Duo) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R177 | F9 | Flamenco Configuration Recommendations | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R178 | F9 | The Bolero Dynamic | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.67) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R179 | F9 | Bolero Signals (Any 2+) | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.36) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R180 | F9 | Why This Matters | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.39) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R181 | F9 | Bolero/Latin Configuration Recommendations | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.31) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R182 | F9 | Painting the Room: Spanish/Latin | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R183 | F9 | Flamenco (Elder Birthday) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R184 | F9 | Flamenco (Juerga/Participatory) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R185 | F9 | Mariachi (Birthday for Elder) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R186 | F9 | Mariachi (Surprise Proposal) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R187 | F9 | Spanish Guitar (Anniversary) | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R188 | F9 | Bolero (Anniversary Dinner) | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.37) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R189 | F9 | Bolero (Latin Heritage Wedding) | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.38) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R190 | F9 | Trova (Intimate Proposal) | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.36) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R191 | F9 | Musical Bridges: Spanish/Latin | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R192 | F9 | "Classical Guitar" → Spanish/Latin | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R193 | F9 | "Acoustic Guitar" + Latino Heritage | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R194 | F9 | "Gypsy Kings Style" → Flamenco Trio | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R195 | F9 | "Spanish Guitar" + Coastal/Wine Country Venue | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R196 | F9 | "Romantic Music" + Latino Heritage → Bolero | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.47) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R197 | F9 | "Spanish Guitar" + Mexican Family → Ranchera/Bolero Mix | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.38) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R198 | F9 | "Background Latin Music" → Trova | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.33) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R199 | F9 | Cultural Wedge Patterns: Spanish/Latin | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R200 | F9 | For Elder Milestones | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R201 | F9 | For Heritage Celebrations | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R202 | F9 | For Gift-Giver Validation | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R203 | F9 | For Participatory Events | ALREADY PRESENT | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); matched the Project before the port | `cultural_tradition === "spanish_latin"` | | |
| R204 | F9 | For Bolero/Latin (Anniversary) | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.45) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R205 | F9 | For Latin Heritage (Any Milestone) | PORTED | `docs/CULTURAL_SPANISH_LATIN.md`, loaded by `selectContext` (`src/pipeline/context.ts:57`); replaced with the Project's version 2026-10-03 (was 0.36) | `cultural_tradition === "spanish_latin"` | `Bolero Signals (Any 2+)` | `port manifest F9` |
| R206 | F9 | Cross-References | NOT PORTED | navigation, same class as R019 (approved); approved by Alex 2026-10-03 (q-e) | | | |
| R207 | F10 | Pacific Flow Entertainment: Core Operating Principles | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R208 | F10 | Prime Directive | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R209 | F10 | The Seven Principles | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R210 | F10 | 1. Capability Trust | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R211 | F10 | 2. Demonstrated Understanding | PORTED | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); merged from the Project 2026-10-03 (the repo's pipeline-specific intro kept on purpose) | always | `Absences as Signals` | `port manifest F10` |
| R212 | F10 | 3. Emotion Over Logic | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R213 | F10 | 4. Friction Kills | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R214 | F10 | 5. Reframe, Don't Downgrade | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R215 | F10 | 6. Name the Fear | ALREADY PRESENT | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); text matches the Project (similarity 1.00) | always |  |  |
| R216 | F10 | 7. Preempt Predictable Questions | PORTED | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); merged from the Project 2026-10-03 (the repo's pipeline-specific intro kept on purpose) | always | `First-Time Event Host` | `port manifest F10` |
| R217 | F10 | The Quality Standard | PORTED | `docs/PRINCIPLES.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:50`); merged from the Project 2026-10-03 (the repo's pipeline-specific intro kept on purpose) | always | `Read the absences?` | `port manifest F10` |
| R218 | F10 | Cross-References | NOT PORTED | navigation, same class as R019 (approved); approved by Alex 2026-10-03 (q-e) |  |  |  |
| R219 | F11 | Pacific Flow Entertainment: Lookup Tables | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) | always |  |  |
| R220 | F11 | Engagement Type (Check First) | TO PORT | Engagement type (private event vs B2B residency) is in no prompt and no code. Destination with F13 PRICING: a classify output field + `lookupPrice()` | always |  |  |
| R221 | F11 | Residency Tiers (B2B: Solo Alex Only) | TO PORT | Residency tiers: plan 0.5 names `RESIDENCY_RATES` in `src/data/rates.ts`, read by `lookupPrice()`. Rates come from F6 (Solo/Duo card); **rate changes need Alex** | solo + residency |  |  |
| R222 | F11 | Competition Levels | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (Competition Levels); the extraction-rule note is in `buildClassifyPrompt` (R358) | always |  |  |
| R223 | F11 | Competition × Vagueness Decision Gate | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`); also `src/prompts/classify.ts` Step 2.5 | always |  |  |
| R224 | F11 | Tier Bridge: Lead Classification → Rate Card (Private Events) | ALREADY PRESENT | `src/prompts/classify.ts` Step 4 (rate card tier mapping) + `src/pipeline/price.ts:52` (tier + column → anchor/floor) | always |  |  |
| R225 | F11 | Competition-Weighted Pricing Matrix (Private Events) | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`); also `src/prompts/classify.ts` Step 3 | always |  |  |
| R226 | F11 | Rate Card Directory | ALREADY PRESENT | `src/data/rates.ts:377` (`RATE_TABLES` by format) | always |  |  |
| R227 | F11 | Stealth Premium Signals | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`); "→ T3" is in `src/prompts/classify.ts` Step 4 | always |  |  |
| R228 | F11 | Tier Thresholds | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) | always |  |  |
| R229 | F11 | Premium (ANY ONE) → Rate Card T3 | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) | always |  |  |
| R230 | F11 | Qualification (ANY ONE) → Rate Card T2 (lower end, reframe first) | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) | always |  |  |
| R231 | F11 | Standard → Rate Card T2 | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) | always |  |  |
| R232 | F11 | Word Count Targets | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`); enforced in `src/prompts/generate.ts:222` | always |  |  |
| R233 | F11 | Full Draft | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical to the Project) | always |  |  |
| R234 | F11 | Compressed Draft (by Competition) | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical to the Project) | always |  |  |
| R235 | F11 | Timeline Bands | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical) | always |  |  |
| R236 | F11 | Close Types | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical apart from punctuation) | always |  |  |
| R237 | F11 | Layer Triggers | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) | always |  |  |
| R238 | F11 | Cultural Context | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical) | always |  |  |
| R239 | F11 | Planner Effort | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical) | always |  |  |
| R240 | F11 | Social Proof | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`) (identical) | always |  |  |
| R241 | F11 | Absences as Signals (Quick Reference) | ALREADY PRESENT | `docs/PRINCIPLES.md` (ported F10, R211) and `docs/RESPONSE_CRAFT.md` Reading Absent Information (R321), both loaded for every lead | always |  |  |
| R242 | F11 | ⚠️ Category vs. Format Check | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md` Category vs. Format Rule (ported R322), loaded for every lead | always |  |  |
| R243 | F11 | Sparse Lead Type Classification | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md` Sparse Lead Type Classification; `src/prompts/generate.ts:152` | always |  |  |
| R244 | F11 | Required Pre-Work (Reasoning-First Method) | TO PORT | `src/prompts/generate.ts:62` reasoning block has details, absences, emotional core, cinematic opening, validation line; it lacks **request type** (FORMAT vs CATEGORY). Destination: a `request_type` reasoning field in `buildGeneratePrompt` | always |  |  |
| R245 | F11 | The Five-Part Draft Sequence (Enforced Order) | ALREADY PRESENT | `src/prompts/generate.ts:75` 5-step sequence (woven, not labeled) | always |  |  |
| R246 | F11 | The 7-Component Checklist (Verification: After Writing) | ALREADY PRESENT | `src/prompts/verify.ts` + `src/types.ts:155` gut checks cover hook, validation, picture, emotion, named fear, answer-everything; close is `close_type` | always |  |  |
| R247 | F11 | The Gut Check (9 Checks) | ALREADY PRESENT | `src/types.ts:155` (the same 9 checks) | always |  |  |
| R248 | F11 | Verification Gate (Required Before Output) | ALREADY PRESENT | `src/prompts/verify.ts`: the gate runs before any draft is delivered | always |  |  |
| R249 | F11 | PRE-WORK (Required Before Drafting) | TO PORT | Same as R244 (request type missing from the reasoning block) | always |  |  |
| R250 | F11 | VERIFICATION GATE (Required) | ALREADY PRESENT | `src/prompts/verify.ts` (JSON gate with the same fields as the template) | always |  |  |
| R251 | F11 | Preempt Questions by Client Type | ALREADY PRESENT | `docs/QUICK_REFERENCE.md`, loaded for every lead (`src/pipeline/context.ts:69`); the First-Time Host row is in `docs/PRINCIPLES.md` (ported R216) | always |  |  |
| R252 | F11 | Contact Block | NOT PORTED | Alex 2026-10-03 (q-g): drafts keep name-only sign-off (`src/pipeline/generate.ts:26`); the Project's business-name + phone block is not used | | | |
| R253 | F12 | Pacific Flow Entertainment: Quality Gate + Output (Steps 10-11) | ALREADY PRESENT | `src/prompts/verify.ts`: `buildVerifyPrompt` implements Steps 10–11 | always |  |  |
| R254 | F12 | ⚠️ MANDATORY SEQUENCE: YOU ARE HERE: FILE 3 OF 3 | ALREADY PRESENT | `src/run-pipeline.ts`: verify runs after generate; chat banner not loaded | always |  |  |
| R255 | F12 | Step 10: Quality Verification | ALREADY PRESENT | `src/prompts/verify.ts` (evidence extraction + gut checks); rewrite loop in `src/run-pipeline.ts` | always |  |  |
| R256 | F12 | Component Quality Standards | TO PORT | The present-vs-excellent rubric and the "best version, or just a version?" test are not given to `src/prompts/verify.ts` (its gut checks are booleans). Destination: rubric text in `buildVerifyPrompt` | always |  |  |
| R257 | F12 | Sourced Lead Quality Standards (Additional) | TO PORT | Sourced quality standards (transparency, authenticity signal, accountability, musician quality) are not checked by `src/prompts/verify.ts`. Destination: `buildVerifyPrompt`, gated on `delivery_mode` (R349) | delivery_mode = sources / hybrid |  |  |
| R258 | F12 | The Quality Test | TO PORT | The present-vs-excellent rubric and the "best version, or just a version?" test are not given to `src/prompts/verify.ts` (its gut checks are booleans). Destination: rubric text in `buildVerifyPrompt` | always |  |  |
| R259 | F12 | The Prose Test | ALREADY PRESENT | `src/prompts/verify.ts` `prose_flows`; `src/prompts/generate.ts` "One continuous movement" | always |  |  |
| R260 | F12 | The "Best Line" Requirement | ALREADY PRESENT | `src/prompts/verify.ts` `best_line` + `best_line_present` | always |  |  |
| R261 | F12 | Revision Protocol | ALREADY PRESENT | `src/run-pipeline.ts`: a failed gate triggers rewrites; `src/automation/router.ts:62` holds after retries | gate fail |  |  |
| R262 | F12 | Step 11: The Gut Check | ALREADY PRESENT | `src/types.ts:155` + `src/prompts/verify.ts` (the 9 checks and more); the Graceful Decline additions are the verify half of R320 (TO PORT) | always |  |  |
| R263 | F12 | The Competitor Test (Required) | ALREADY PRESENT | `src/prompts/verify.ts` §6 Competitor Test + §6b lead specificity; the Graceful Decline additions are the verify half of R320 (TO PORT) | always |  |  |
| R264 | F12 | The Validation Test (Specific) | ALREADY PRESENT | `src/prompts/verify.ts` `validation_line`, `validated_them`, `compressed_validation_present` | always |  |  |
| R265 | F12 | The "Their Details" Test | ALREADY PRESENT | `src/prompts/verify.ts` `lead_specific_opening`, `can_see_it` | always |  |  |
| R266 | F12 | Strategic Reserve | TO PORT | Strategic reserve: same gap as R018 (no output field anywhere in `src/`) | always |  |  |
| R267 | F12 | Output Format | ALREADY PRESENT | `src/prompts/verify.ts`: JSON output (gate before drafts leave the pipeline) | always |  |  |
| R268 | F12 | PRE-WORK (Required Before Drafting) | TO PORT | Same as R244: the generate reasoning block lacks request type (FORMAT vs CATEGORY) | always |  |  |
| R269 | F12 | VERIFICATION GATE (Required) | ALREADY PRESENT | `src/prompts/verify.ts` JSON gate (validation, best line, traceability, scene, competitor, gut checks); the Graceful Decline additions are the verify half of R320 (TO PORT). "Response Mode" is part of R320 | always |  |  |
| R270 | F12 | FULL DRAFT ([X] words) | ALREADY PRESENT | `src/prompts/generate.ts`: `full_draft` | always |  |  |
| R271 | F12 | COMPRESSED DRAFT ([X] words: [Competition Level]) | ALREADY PRESENT | `src/prompts/generate.ts`: `compressed_draft` | always |  |  |
| R272 | F12 | STRATEGIC RESERVE (for follow-up) | TO PORT | Same gap as R018 | always |  |  |
| R273 | F12 | Why the Gate Has Evidence Requirements | ALREADY PRESENT | `src/prompts/verify.ts`: exact quotes required, empty traceability cell = automatic FAIL; the Graceful Decline additions are the verify half of R320 (TO PORT) | always |  |  |
| R274 | F12 | Cross-References | NOT PORTED | Navigation table; approved by Alex 2026-10-03 (q-e) |  |  |  |
| R275 | F13 | Pacific Flow Entertainment: Pricing Router & Qualification Tools | UNREVIEWED | | | | |
| R276 | F13 | Engagement Type Determination | UNREVIEWED | | | | |
| R277 | F13 | Private Event (B2C) | UNREVIEWED | | | | |
| R278 | F13 | Residency (B2B): Solo Alex Only | UNREVIEWED | | | | |
| R279 | F13 | Wedding-Adjacent (Special Case) | UNREVIEWED | | | | |
| R280 | F13 | State | UNREVIEWED | | | | |
| R281 | F13 | Residency Pricing Framework (Solo Alex Only) | UNREVIEWED | | | | |
| R282 | F13 | Tier Determination | UNREVIEWED | | | | |
| R283 | F13 | Tier Determination Logic | UNREVIEWED | | | | |
| R284 | F13 | Conversational Discipline for Residency Quotes | UNREVIEWED | | | | |
| R285 | F13 | Encuentro Exception | UNREVIEWED | | | | |
| R286 | F13 | Recurring Programming Requested for Multi-Musician Format | UNREVIEWED | | | | |
| R287 | F13 | Cross-Reference | UNREVIEWED | | | | |
| R288 | F13 | Tier Bridge: Lead Classification → Rate Card Tier (Private Events) | UNREVIEWED | | | | |
| R289 | F13 | Step 1: Determine Buyer Tier | UNREVIEWED | | | | |
| R290 | F13 | Step 2: Determine Pricing Column | UNREVIEWED | | | | |
| R291 | F13 | Step 3: Calibrate Quote Point (Anchor vs Floor) | UNREVIEWED | | | | |
| R292 | F13 | Step 4: Apply Context Modifiers | UNREVIEWED | | | | |
| R293 | F13 | The Complete Bridge (Example) | UNREVIEWED | | | | |
| R294 | F13 | Competition-Weighted Pricing Matrix (Private Events) | UNREVIEWED | | | | |
| R295 | F13 | Pricing Rules | UNREVIEWED | | | | |
| R296 | F13 | Budget Qualification Language | UNREVIEWED | | | | |
| R297 | F13 | When You Need to Surface Budget | UNREVIEWED | | | | |
| R298 | F13 | When Budget Is Lower Than Expected | UNREVIEWED | | | | |
| R299 | F13 | Reframe Language (Never Say "Cheaper") | UNREVIEWED | | | | |
| R300 | F13 | Quote Formatting | UNREVIEWED | | | | |
| R301 | F13 | T3 / Premium (Structured, Confident) | UNREVIEWED | | | | |
| R302 | F13 | T2 / Standard (Conversational, Approachable) | UNREVIEWED | | | | |
| R303 | F13 | Residency Quote (B2B) | UNREVIEWED | | | | |
| R304 | F13 | Configuration Decision Guidance | UNREVIEWED | | | | |
| R305 | F13 | Rate Card Directory | UNREVIEWED | | | | |
| R306 | F13 | Cross-References | UNREVIEWED | | | | |
| R307 | F13 | Change Log | UNREVIEWED | | | | |
| R308 | F13 | April 26, 2026: Residency Pricing Framework Added (with same-day scope correction) | UNREVIEWED | | | | |
| R309 | F14 | Pacific Flow Entertainment: Pre-Draft Analysis (Steps 6-8) | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R310 | F14 | ⚠️ MANDATORY SEQUENCE: YOU ARE HERE: FILE 1 OF 3 | ALREADY PRESENT | `src/run-pipeline.ts`: classify → generate → verify order is enforced in code. The chat banner text is deliberately NOT in the doc (test `port manifest F14`) | always |  |  |
| R311 | F14 | Step 6: Evaluate Layers | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R312 | F14 | Sourced Delivery Layer | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R313 | F14 | Cultural Context Layer | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R314 | F14 | Planner Effort Layer | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R315 | F14 | Social Proof Technique | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R316 | F14 | Step 7: Address Flagged Concerns | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R317 | F14 | Integration Requirement | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R318 | F14 | Common Concern Patterns | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R319 | F14 | Sourced Delivery Concern Patterns | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R320 | F14 | Graceful Decline Pattern (Format/Fit Mismatch) | TO PORT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`). **Doc half PORTED 2026-10-03** (client name in the canonical example replaced by a placeholder: public repo). Still to port per plan 0.5: `buildVerifyPrompt` checks + gate hold `graceful_decline` when classify flags the trigger. ⚠ `SOFT_REFUSAL_PATTERNS` in `src/pipeline/post-check.ts` (e.g. "recommend looking elsewhere") can flag a legitimate decline exit line; exempt it when the decline mode is active | format-fit or sensitivity trigger | `Graceful Decline Pattern (Format/Fit Mismatch)` | `port manifest F14` |
| R321 | F14 | Reading Absent Information | PORTED | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); merged from the Project 2026-10-03 (was 0.93) | always | `Never treat a sparse lead as permission to go generic` | `port manifest F14` |
| R322 | F14 | ⚠️ Category vs. Format Rule | PORTED | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); merged from the Project 2026-10-03 (was 0.05) | always | `Category vs. Format Rule` | `port manifest F14` |
| R323 | F14 | Sparse Lead Type Classification | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R324 | F14 | Long-Format Expertise (3+ Hours) | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R325 | F14 | Step 8: Find the Wedge | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R326 | F14 | Wedge Sources | PORTED | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); merged from the Project 2026-10-03 (was 0.91) | always | `Ambiguity as Expertise` | `port manifest F14` |
| R327 | F14 | Sourced-Specific Wedge Patterns | PORTED | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); merged from the Project 2026-10-03 (was 0.91) | always | `Ambiguity as Expertise` | `port manifest F14` |
| R328 | F14 | The Wedge Test | ALREADY PRESENT | `docs/RESPONSE_CRAFT.md`, loaded for every lead by `selectContext` (`src/pipeline/context.ts:35`); matched the Project before the port | always |  |  |
| R329 | F14 | ⚠️ Steps 6-8 complete. PROCEED TO DRAFT_METHOD.md (Step 9). | TO PORT | Depends on F15: the app does not load `docs/DRAFT_METHOD.md`. Banner deliberately left out of the doc until that is decided | always |  |  |
| R330 | F14 | Cross-References | NOT PORTED | navigation, same class as R019 (approved); approved by Alex 2026-10-03 (q-e) |  |  |  |
| R331 | F15 | Pacific Flow Entertainment: Writing Execution (Step 9) | ALREADY PRESENT | `src/prompts/generate.ts`: `buildGeneratePrompt` implements Step 9 | always |  |  |
| R332 | F15 | ⚠️ MANDATORY SEQUENCE: YOU ARE HERE: FILE 2 OF 3 | ALREADY PRESENT | `src/run-pipeline.ts`: order enforced in code; the chat banner is not loaded (`docs/DRAFT_METHOD.md` is unloaded on purpose since `1bc9cad`) | always |  |  |
| R333 | F15 | Step 9: Draft Response | ALREADY PRESENT | `src/prompts/generate.ts` STEP 1 REASON + STEP 2 WRITE DRAFTS | always |  |  |
| R334 | F15 | The Reasoning-First Method | TO PORT | `src/prompts/generate.ts`:60 reasoning block has details, absences, emotional core, cinematic opening (with the deletion test), validation line. Missing: pre-work item 5, the list of fears with the sentence that answers each, and the sourced notes (R335) | always |  |  |
| R335 | F15 | Sourced Lead Drafting | TO PORT | Sourced voice table, transparency placement (Part 2/3), differentiator and validation patterns, and sourced price presentation (no breakdown, no coordination fee) are in no prompt and no loaded doc (`docs/DRAFT_METHOD.md` is never loaded, by design since `1bc9cad`). Destination: a sourced block in `buildGeneratePrompt`, gated on `delivery_mode` (R349) | delivery_mode = sources / hybrid |  |  |
| R336 | F15 | The Five-Part Draft Sequence | ALREADY PRESENT | `src/prompts/generate.ts`:75 the same five parts, Part 2 verbatim; sourced Part 2–4 notes are R335 | always |  |  |
| R337 | F15 | The Validation Draft (Required Pre-Work) | ALREADY PRESENT | `src/prompts/generate.ts`: `validation_line` reasoning + "Validation Must Survive Compression" | always |  |  |
| R338 | F15 | The 7-Component Checklist (Verify After Writing) | ALREADY PRESENT | `src/prompts/verify.ts` gut checks (same as R246); the sourced 8th check is R335 | always |  |  |
| R339 | F15 | Non-Negotiables | ALREADY PRESENT | `src/prompts/generate.ts` (details, absences, preempt via concern traceability) + preempt tables in `docs/PRINCIPLES.md` and `docs/QUICK_REFERENCE.md` (battery, COI, volume); mariachi lead time is not stated anywhere (minor) | always |  |  |
| R340 | F15 | Dual Output Requirement | TO PORT | `src/prompts/generate.ts` dual drafts and compressed targets match. Full-draft premium 125–145 is deliberate (`1bc9cad`, matches QUICK_REFERENCE). Gap: the compressed draft "must retain" list lacks **fear resolution** (and sourced integrity). Destination: the Compressed Draft rule in `buildStyleRulesBlock` | always |  |  |
| R341 | F15 | Qualification Responses | TO PORT | No qualification-tier drafting rule in `src/prompts/generate.ts` (budget-gap blocks cover stated budgets only). `docs/PRINCIPLES.md` "Reframe, Don't Downgrade" is loaded. Destination: a block in `buildGeneratePrompt` when `tier === "qualification"` | tier = qualification |  |  |
| R342 | F15 | Close Types | ALREADY PRESENT | `docs/QUICK_REFERENCE.md` Close Types (loaded) + `close_type` in `src/prompts/generate.ts`:85; sourced close note is R335 | always |  |  |
| R343 | F15 | Contact Block (Always Include) | NOT PORTED | Alex 2026-10-03 (q-g): name-only sign-off (`src/pipeline/generate.ts:26`) |  |  |  |
| R344 | F15 | ⚠️ Step 9 complete. PROCEED TO VERIFICATION.md (Steps 10-11). | ALREADY PRESENT | `src/run-pipeline.ts`: verify runs after generate; chat banner not loaded | always |  |  |
| R345 | F15 | Cross-References | NOT PORTED | Navigation table; approved by Alex 2026-10-03 (q-e) |  |  |  |
| R346 | F16 | Pacific Flow Entertainment: Lead Analysis Decision Flow | ALREADY PRESENT | `src/prompts/classify.ts`: `buildClassifyPrompt` implements Steps 0–5 | always |  |  |
| R347 | F16 | When a Lead Arrives | ALREADY PRESENT | `src/run-pipeline.ts`: classify runs first, then generate and verify | always |  |  |
| R348 | F16 | Step 0: Capability Check | ALREADY PRESENT | `docs/PRINCIPLES.md:20` (Capability Trust), loaded by `selectContext`; classify has no capability field, so it cannot decline on capability | always | `Capability Trust` |  |
| R349 | F16 | Step 0.5: Delivery Mode Assessment | TO PORT | No `delivery_mode` in the classify output (`src/prompts/classify.ts`), yet `docs/RESPONSE_CRAFT.md:19` (loaded) triggers its Sourced Delivery layer on it. Destination: `buildClassifyPrompt` Step 0.5 + a `delivery_mode` field (plan 0.5 names this) | always |  |  |
| R350 | F16 | Alex Performs (AGM Delivery) | TO PORT | No `delivery_mode` in the classify output (`src/prompts/classify.ts`), yet `docs/RESPONSE_CRAFT.md:19` (loaded) triggers its Sourced Delivery layer on it. Destination: `buildClassifyPrompt` Step 0.5 + a `delivery_mode` field (plan 0.5 names this) | always |  |  |
| R351 | F16 | Alex Sources (PFE Delivery) | TO PORT | No `delivery_mode` in the classify output (`src/prompts/classify.ts`), yet `docs/RESPONSE_CRAFT.md:19` (loaded) triggers its Sourced Delivery layer on it. Destination: `buildClassifyPrompt` Step 0.5 + a `delivery_mode` field (plan 0.5 names this) | always |  |  |
| R352 | F16 | Hybrid (Alex Performs + Sourced Musicians) | TO PORT | No `delivery_mode` in the classify output (`src/prompts/classify.ts`), yet `docs/RESPONSE_CRAFT.md:19` (loaded) triggers its Sourced Delivery layer on it. Destination: `buildClassifyPrompt` Step 0.5 + a `delivery_mode` field (plan 0.5 names this) | always |  |  |
| R353 | F16 | Why This Matters | TO PORT | No `delivery_mode` in the classify output (`src/prompts/classify.ts`), yet `docs/RESPONSE_CRAFT.md:19` (loaded) triggers its Sourced Delivery layer on it. Destination: `buildClassifyPrompt` Step 0.5 + a `delivery_mode` field (plan 0.5 names this) | always |  |  |
| R354 | F16 | Step 1: Surface Data Extraction | ALREADY PRESENT | `src/prompts/classify.ts` Step 1 (fields, `flagged_concerns`, `competition_quote_count`); delivery mode is R349 | always |  |  |
| R355 | F16 | Step 2: Mode Assessment | ALREADY PRESENT | `src/prompts/classify.ts` Step 2 (`mode`) | always |  |  |
| R356 | F16 | Step 2.5: Competition + Vagueness Check | ALREADY PRESENT | `src/prompts/classify.ts` Step 2.5 | always |  |  |
| R357 | F16 | Competition Level | ALREADY PRESENT | `src/prompts/classify.ts` Step 2.5 competition levels | always |  |  |
| R358 | F16 | ⚠️ Competition Extraction Rule | TO PORT | **Prompt half PORTED 2026-10-03** (`buildClassifyPrompt`, COMPETITION EXTRACTION RULE, test `port manifest R358`). Still to port: the plan's code check (count must equal the platform's displayed count, or 0); the GigSalad parser (`src/automation/parsers/gigsalad.ts`) does not extract the displayed count yet | always |  |  |
| R359 | F16 | Vagueness Assessment | ALREADY PRESENT | `src/prompts/classify.ts` Step 2.5 vagueness | always |  |  |
| R360 | F16 | Decision Gate | ALREADY PRESENT | `src/prompts/classify.ts` Step 2.5 decision gate; binary question in `src/prompts/generate.ts:85` | always |  |  |
| R361 | F16 | Step 2.75: Stealth Premium Check | ALREADY PRESENT | `src/prompts/classify.ts` Step 2.75 (`stealth_premium`) | always |  |  |
| R362 | F16 | Step 3: Pricing Strategy | TO PORT | `src/prompts/classify.ts` Step 3 has `price_point` and `context_modifiers`; the sourced rule ($150 minimum profit, withhold premium signals from subcontractors) is nowhere in `src/`. Destination: `lookupPrice()` (`src/pipeline/price.ts`) for sourced formats | sourced delivery |  |  |
| R363 | F16 | Competition-Weighted Matrix | ALREADY PRESENT | `src/prompts/classify.ts` Step 3 matrix | always |  |  |
| R364 | F16 | Step 4: Tier Classification | ALREADY PRESENT | `src/prompts/classify.ts` Step 4 | always |  |  |
| R365 | F16 | Premium Tier (ANY ONE triggers) → Rate Card T3 | ALREADY PRESENT | `src/prompts/classify.ts` Step 4 premium + T3 mapping | always |  |  |
| R366 | F16 | Qualification Tier (ANY ONE triggers) → Rate Card T2 (lower end, reframe first) | ALREADY PRESENT | `src/prompts/classify.ts` Step 4 qualification | always |  |  |
| R367 | F16 | Standard Tier → Rate Card T2 | ALREADY PRESENT | `src/prompts/classify.ts` Step 4 standard | always |  |  |
| R368 | F16 | Step 5: Check Urgency and Timeline | ALREADY PRESENT | `src/prompts/classify.ts` Step 5 (`timeline_band`, `close_type`) | always |  |  |
| R369 | F16 | Urgency Signals | TO PORT | `src/prompts/classify.ts` derives urgency from the date only; the signal phrases ("original musician cancelled", "last minute", "need to book today") are not listed. Destination: `buildClassifyPrompt` Step 5 | always |  |  |
| R370 | F16 | Timeline Bands | ALREADY PRESENT | `src/prompts/classify.ts` Step 5 timeline bands | always |  |  |
| R371 | F16 | Classification Checkpoint (NOT a Deliverable) | ALREADY PRESENT | `src/prompts/classify.ts`: the JSON output is the checkpoint (delivery mode is R349) | always |  |  |
| R372 | F16 | Cross-References | NOT PORTED | a navigation table, same class as R019 (approved); approved by Alex 2026-10-03 (q-e) |  |  |  |
| R373 | F19 | Strategic Context | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R374 | F19 | The Buyer Psychology | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R375 | F19 | The Anchor Conversation | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R376 | F19 | Negotiation Sequence (In Order) | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R377 | F19 | Stage 1: They Come Back Pushing Back | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R378 | F19 | Stage 2: They're Still Hesitant After Duration Offer | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R379 | F19 | Stage 3A: Trio Agrees to Flex | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R380 | F19 | Stage 3B: Trio Won't Flex | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R381 | F19 | Stage 4: Hold Firm or Walk Away | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R382 | F19 | The Value Framing Language | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R383 | F19 | Scarcity Lever | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R384 | F19 | Emotional Lever | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R385 | F19 | Cultural Authenticity Lever | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R386 | F19 | The Close (After Value Framing) | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R387 | F19 | The Timing Flexibility Option | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R388 | F19 | The Bundle Strategy | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R389 | F19 | When to Walk Away | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R390 | F19 | The "Not a Real Buyer" Signals | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R391 | F19 | The 1.5-Hour Compromise Script | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R392 | F19 | Post-Negotiation Close | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R393 | F19 | Expected Booking Funnel | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R394 | F19 | Strategic Reminders | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R395 | F19 | Cross-References | PORTED | `docs/Bolero_Trio_Negotiation_Playbook.md`, loaded by `selectContext` (`src/pipeline/context.ts`); section text matches the Project (similarity 1.00, 0.97 for Cross-References) | `format_recommended === "bolero_trio"` | `## BOLERO TRIO NEGOTIATION PLAYBOOK` | `port manifest R008` |
| R396 | M1 | index.md | BLOCKED | proposed NOT PORTED: Project name and description only, no rule. Needs Alex's yes (q-h) |  |  |  |
| R397 | M2 | overview.md | TO PORT | Holds the **Instrument Rule**: Alex performs guitar (any style) and ukulele; sourcing only for an instrument he doesn't play, 3+ musicians, or stated unavailability; style never sets delivery mode. Destination: R349 (`delivery_mode` in `buildClassifyPrompt`). The rest is business context, no rule | always |  |  |
| R398 | M3 | preferences.md | TO PORT | Salutation: ALREADY in `src/prompts/generate.ts`:70 (when a first name exists). Follow-up check-in: `src/follow-up-scheduler.ts`. Not in the app: negotiation-stage replies (skip the cinematic opening, no two-option menu or closing script). Destination: the reply/negotiation path (a later module) | negotiation replies |  |  |
| R399 | M4 | tools-and-references.md | ALREADY PRESENT | `src/data/voice-references.ts` (Patterson, Sparse Cocktail and the other references). The T4 reference lead is the F1 rows; the Three Questions protocol is a dev rule (`CLAUDE.md`), not runtime | always |  |  |
| R400 | M5 | booking-terms.md | PORTED | `src/prompts/generate.ts` Quote Terms block (every quote, not clarification or no-viable-scope) | quoting | `50% deposit holds the date` | `port manifest M5 M9` |
| R401 | M6 | education-programs.md | BLOCKED | proposed NOT PORTED: education work status, not a lead-reply rule. Needs Alex's yes (q-h) |  |  |  |
| R402 | M7 | jit-vision-to-voices.md | BLOCKED | proposed NOT PORTED: JIT / Vision to Voices role, not a lead-reply rule. Needs Alex's yes (q-h) |  |  |  |
| R403 | M8 | pricing-decisions.md | TO PORT | T4 tier (solo 2/3/4 hr known) and NP tiers (NP2 solo 1/2 hr known; open at the floor; in-kind line; route on who pays, not venue). Plan 0.5 names `src/data/rates.ts` tier rows + a classify `buyer_track`. **Rate changes need Alex**; several values are still "to be set" in the source | buyer_track ∈ {T4, NP} |  |  |
| R404 | M9 | quote-setup-rules.md | PORTED | `src/prompts/generate.ts` Quote Terms (110V outlet within ~25 ft, armless chair); battery: removed from everything the model sees + `src/pipeline/post-check.ts` fails any draft that mentions it (Alex 2026-10-03) | quoting | `one armless chair` | `port manifest M5 M9`; `post-check holds battery mention`; `battery never shown to the model` |
| R405 | M10 | venue-history.md | TO PORT | Four venues Alex has played that are not in venue intel. Venue credibility comes from PF-Intel (`src/venue-lookup.ts`); destination: PF-Intel data or a local list read by `formatVenueContext` | venue named |  |  |
| R406 | M11 | music-background.md | TO PORT | Ukulele = Alex Performs. Destination: R349 delivery mode; the classify format list has no ukulele value (`src/prompts/classify.ts`) | ukulele requested |  |  |

**Rows: 406.**
