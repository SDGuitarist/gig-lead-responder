# Port manifest (plan step 0.5)

**Reader and trigger:** whoever ports the Project into the repo (plan 0.5), and the Module 1 launch gate: Module 1 cannot go live while any row is `UNREVIEWED` or `BLOCKED`. Checked by `npm run test:match -- "port manifest structure"`.

**Rows** come from `port-inventory.md`, in order. **Statuses:** `UNREVIEWED` (nobody has compared it yet), `PORTED` (cites the runtime function and the test that calls it), `ALREADY PRESENT` (cites the repo file, and line where useful, that already does it), `NOT PORTED` (reason plus Alex's approval) or `BLOCKED` (waiting on an Alex question).

**Public repo:** headings, statuses and repo locations only. No rates, no client names, no source text (the source lives in `~/Data/gig-lead-responder/`).

| # | Source | Section | Status | Where / reason | Condition | Marker | Test |
|---|---|---|---|---|---|---|---|
| R001 | P1 | Pacific Flow Entertainment: System Router | UNREVIEWED | | | | |
| R002 | P1 | Prime Directive | UNREVIEWED | | | | |
| R003 | P1 | Critical Process Requirement | UNREVIEWED | | | | |
| R004 | P1 | Task Routing | UNREVIEWED | | | | |
| R005 | P1 | Lead Response (Default) | UNREVIEWED | | | | |
| R006 | P1 | Cultural Context Routing | UNREVIEWED | | | | |
| R007 | P1 | Pricing Question | UNREVIEWED | | | | |
| R008 | P1 | Bolero Trio Pricing or Negotiation | UNREVIEWED | | | | |
| R009 | P1 | Venue Question | UNREVIEWED | | | | |
| R010 | P1 | Cultural Pattern Request | UNREVIEWED | | | | |
| R011 | P1 | Voice Question | UNREVIEWED | | | | |
| R012 | P1 | Pricing Architecture | UNREVIEWED | | | | |
| R013 | P1 | File Architecture | UNREVIEWED | | | | |
| R014 | P1 | Output Format | UNREVIEWED | | | | |
| R015 | P1 | VERIFICATION GATE (Required) | UNREVIEWED | | | | |
| R016 | P1 | FULL DRAFT ([X] words) | UNREVIEWED | | | | |
| R017 | P1 | COMPRESSED DRAFT ([X] words, [Competition Level]) | UNREVIEWED | | | | |
| R018 | P1 | STRATEGIC RESERVE (for follow-up) | UNREVIEWED | | | | |
| R019 | P1 | Cross-Reference Index | UNREVIEWED | | | | |
| R020 | F1 | When to use this template | UNREVIEWED | | | | |
| R021 | F1 | The structure, in order | UNREVIEWED | | | | |
| R022 | F1 | Fill-in template | UNREVIEWED | | | | |
| R023 | F1 | Re-derive for every lead (never copy) | UNREVIEWED | | | | |
| R024 | F1 | Fixed by standing rules (always keep) | UNREVIEWED | | | | |
| R025 | F1 | Known deviations from the protocol | UNREVIEWED | | | | |
| R026 | F2 | Pacific Flow Entertainment: Voice Specification | UNREVIEWED | | | | |
| R027 | F2 | Who Alex Is (For Voice Calibration) | UNREVIEWED | | | | |
| R028 | F2 | Voice DNA | UNREVIEWED | | | | |
| R029 | F2 | Core Voice Constants (Hold Across Every Lead) | UNREVIEWED | | | | |
| R030 | F2 | Voice by Audience | UNREVIEWED | | | | |
| R031 | F2 | Drafting Principles (Non-Negotiable) | UNREVIEWED | | | | |
| R032 | F2 | Quality Checklist (Voice-Level Pass Before Verification Gate) | UNREVIEWED | | | | |
| R033 | F2 | What NOT to Sound Like | UNREVIEWED | | | | |
| R034 | F2 | Hard Language Rules | UNREVIEWED | | | | |
| R035 | F2 | No em-dashes. Ever. | UNREVIEWED | | | | |
| R036 | F2 | No hype punctuation. | UNREVIEWED | | | | |
| R037 | F2 | Kill list (cut on sight) | UNREVIEWED | | | | |
| R038 | F2 | Banned structural patterns | UNREVIEWED | | | | |
| R039 | F2 | Confidence calibration | UNREVIEWED | | | | |
| R040 | F2 | Self-Check Protocol | UNREVIEWED | | | | |
| R041 | F2 | When in Doubt | UNREVIEWED | | | | |
| R042 | F2 | Cross-References | UNREVIEWED | | | | |
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
| R119 | F7 | Pacific Flow Entertainment: Alex's Philosophy on Event Arcs | UNREVIEWED | | | | |
| R120 | F7 | The Core Thesis | UNREVIEWED | | | | |
| R121 | F7 | Wedding Arc: The Three-Room Structure | UNREVIEWED | | | | |
| R122 | F7 | Room 1: The Ceremony | UNREVIEWED | | | | |
| R123 | F7 | Room 2: The Cocktail Hour | UNREVIEWED | | | | |
| R124 | F7 | Room 3: The Reception | UNREVIEWED | | | | |
| R125 | F7 | Corporate Event Arc: The Three-Room Structure | UNREVIEWED | | | | |
| R126 | F7 | Room 1: Arrival and Networking | UNREVIEWED | | | | |
| R127 | F7 | Room 2: The Remarks / Speeches Moment | UNREVIEWED | | | | |
| R128 | F7 | Room 3: The Social Tail | UNREVIEWED | | | | |
| R129 | F7 | Private Celebration Arc: Birthday, Anniversary, Milestone | UNREVIEWED | | | | |
| R130 | F7 | Room 1: Arrival | UNREVIEWED | | | | |
| R131 | F7 | Room 2: Dinner | UNREVIEWED | | | | |
| R132 | F7 | Room 3: The Peak Moment | UNREVIEWED | | | | |
| R133 | F7 | Room 4: The Close | UNREVIEWED | | | | |
| R134 | F7 | Cultural Celebration Arc: The Heritage Layer | UNREVIEWED | | | | |
| R135 | F7 | The Flamenco Wedding / Heritage Birthday Example | UNREVIEWED | | | | |
| R136 | F7 | Memorial / Celebration of Life Arc: The Register of Grief | UNREVIEWED | | | | |
| R137 | F7 | Room 1: Gathering | UNREVIEWED | | | | |
| R138 | F7 | Room 2: The Service or Shared Moments | UNREVIEWED | | | | |
| R139 | F7 | Room 3: The Reception Tail | UNREVIEWED | | | | |
| R140 | F7 | How the Orchestrator Uses This Document | UNREVIEWED | | | | |
| R141 | F7 | The Repertoire-to-Phase Mapping | UNREVIEWED | | | | |
| R142 | F7 | Why the Orchestrator Can't Skip This | UNREVIEWED | | | | |
| R143 | F8 | Pacific Flow Entertainment: Cultural Response Framework | UNREVIEWED | | | | |
| R144 | F8 | Why Cultural Responses Are Different | UNREVIEWED | | | | |
| R145 | F8 | The Gift-Giver Framework | UNREVIEWED | | | | |
| R146 | F8 | Validation Patterns | UNREVIEWED | | | | |
| R147 | F8 | The Invisible Gift | UNREVIEWED | | | | |
| R148 | F8 | Participatory vs. Performance | UNREVIEWED | | | | |
| R149 | F8 | Performance (Guests Watch) | UNREVIEWED | | | | |
| R150 | F8 | Participatory (Guests Join In) | UNREVIEWED | | | | |
| R151 | F8 | Why This Matters | UNREVIEWED | | | | |
| R152 | F8 | Domain Terminology | UNREVIEWED | | | | |
| R153 | F8 | The Rule: 1-2 Terms Maximum | UNREVIEWED | | | | |
| R154 | F8 | How to Use Terms | UNREVIEWED | | | | |
| R155 | F8 | Finding the Cultural Wedge | UNREVIEWED | | | | |
| R156 | F8 | 1. The Honoree's Relationship to the Music | UNREVIEWED | | | | |
| R157 | F8 | 2. The Gift-Giver's Intention | UNREVIEWED | | | | |
| R158 | F8 | 3. What Will Happen in the Room | UNREVIEWED | | | | |
| R159 | F8 | 4. The Generational Thread | UNREVIEWED | | | | |
| R160 | F8 | The Vehicle (Why You) | UNREVIEWED | | | | |
| R161 | F8 | The Flow | UNREVIEWED | | | | |
| R162 | F8 | Vehicle Patterns | UNREVIEWED | | | | |
| R163 | F8 | Vehicle Placement | UNREVIEWED | | | | |
| R164 | F8 | The Test | UNREVIEWED | | | | |
| R165 | F8 | Musical Bridges | UNREVIEWED | | | | |
| R166 | F8 | Common Bridges | UNREVIEWED | | | | |
| R167 | F8 | Cultural Response Flow | UNREVIEWED | | | | |
| R168 | F8 | Cross-References | UNREVIEWED | | | | |
| R169 | F9 | Pacific Flow Entertainment: Spanish/Latin Cultural Patterns | UNREVIEWED | | | | |
| R170 | F9 | Terminology by Tradition | UNREVIEWED | | | | |
| R171 | F9 | Flamenco | UNREVIEWED | | | | |
| R172 | F9 | Mariachi | UNREVIEWED | | | | |
| R173 | F9 | Bolero/Latin | UNREVIEWED | | | | |
| R174 | F9 | The Juerga Dynamic | UNREVIEWED | | | | |
| R175 | F9 | Juerga Signals (Any 2+) | UNREVIEWED | | | | |
| R176 | F9 | Why Trio (Not Duo) | UNREVIEWED | | | | |
| R177 | F9 | Flamenco Configuration Recommendations | UNREVIEWED | | | | |
| R178 | F9 | The Bolero Dynamic | UNREVIEWED | | | | |
| R179 | F9 | Bolero Signals (Any 2+) | UNREVIEWED | | | | |
| R180 | F9 | Why This Matters | UNREVIEWED | | | | |
| R181 | F9 | Bolero/Latin Configuration Recommendations | UNREVIEWED | | | | |
| R182 | F9 | Painting the Room: Spanish/Latin | UNREVIEWED | | | | |
| R183 | F9 | Flamenco (Elder Birthday) | UNREVIEWED | | | | |
| R184 | F9 | Flamenco (Juerga/Participatory) | UNREVIEWED | | | | |
| R185 | F9 | Mariachi (Birthday for Elder) | UNREVIEWED | | | | |
| R186 | F9 | Mariachi (Surprise Proposal) | UNREVIEWED | | | | |
| R187 | F9 | Spanish Guitar (Anniversary) | UNREVIEWED | | | | |
| R188 | F9 | Bolero (Anniversary Dinner) | UNREVIEWED | | | | |
| R189 | F9 | Bolero (Latin Heritage Wedding) | UNREVIEWED | | | | |
| R190 | F9 | Trova (Intimate Proposal) | UNREVIEWED | | | | |
| R191 | F9 | Musical Bridges: Spanish/Latin | UNREVIEWED | | | | |
| R192 | F9 | "Classical Guitar" → Spanish/Latin | UNREVIEWED | | | | |
| R193 | F9 | "Acoustic Guitar" + Latino Heritage | UNREVIEWED | | | | |
| R194 | F9 | "Gypsy Kings Style" → Flamenco Trio | UNREVIEWED | | | | |
| R195 | F9 | "Spanish Guitar" + Coastal/Wine Country Venue | UNREVIEWED | | | | |
| R196 | F9 | "Romantic Music" + Latino Heritage → Bolero | UNREVIEWED | | | | |
| R197 | F9 | "Spanish Guitar" + Mexican Family → Ranchera/Bolero Mix | UNREVIEWED | | | | |
| R198 | F9 | "Background Latin Music" → Trova | UNREVIEWED | | | | |
| R199 | F9 | Cultural Wedge Patterns: Spanish/Latin | UNREVIEWED | | | | |
| R200 | F9 | For Elder Milestones | UNREVIEWED | | | | |
| R201 | F9 | For Heritage Celebrations | UNREVIEWED | | | | |
| R202 | F9 | For Gift-Giver Validation | UNREVIEWED | | | | |
| R203 | F9 | For Participatory Events | UNREVIEWED | | | | |
| R204 | F9 | For Bolero/Latin (Anniversary) | UNREVIEWED | | | | |
| R205 | F9 | For Latin Heritage (Any Milestone) | UNREVIEWED | | | | |
| R206 | F9 | Cross-References | UNREVIEWED | | | | |
| R207 | F10 | Pacific Flow Entertainment: Core Operating Principles | UNREVIEWED | | | | |
| R208 | F10 | Prime Directive | UNREVIEWED | | | | |
| R209 | F10 | The Seven Principles | UNREVIEWED | | | | |
| R210 | F10 | 1. Capability Trust | UNREVIEWED | | | | |
| R211 | F10 | 2. Demonstrated Understanding | UNREVIEWED | | | | |
| R212 | F10 | 3. Emotion Over Logic | UNREVIEWED | | | | |
| R213 | F10 | 4. Friction Kills | UNREVIEWED | | | | |
| R214 | F10 | 5. Reframe, Don't Downgrade | UNREVIEWED | | | | |
| R215 | F10 | 6. Name the Fear | UNREVIEWED | | | | |
| R216 | F10 | 7. Preempt Predictable Questions | UNREVIEWED | | | | |
| R217 | F10 | The Quality Standard | UNREVIEWED | | | | |
| R218 | F10 | Cross-References | UNREVIEWED | | | | |
| R219 | F11 | Pacific Flow Entertainment: Lookup Tables | UNREVIEWED | | | | |
| R220 | F11 | Engagement Type (Check First) | UNREVIEWED | | | | |
| R221 | F11 | Residency Tiers (B2B: Solo Alex Only) | UNREVIEWED | | | | |
| R222 | F11 | Competition Levels | UNREVIEWED | | | | |
| R223 | F11 | Competition × Vagueness Decision Gate | UNREVIEWED | | | | |
| R224 | F11 | Tier Bridge: Lead Classification → Rate Card (Private Events) | UNREVIEWED | | | | |
| R225 | F11 | Competition-Weighted Pricing Matrix (Private Events) | UNREVIEWED | | | | |
| R226 | F11 | Rate Card Directory | UNREVIEWED | | | | |
| R227 | F11 | Stealth Premium Signals | UNREVIEWED | | | | |
| R228 | F11 | Tier Thresholds | UNREVIEWED | | | | |
| R229 | F11 | Premium (ANY ONE) → Rate Card T3 | UNREVIEWED | | | | |
| R230 | F11 | Qualification (ANY ONE) → Rate Card T2 (lower end, reframe first) | UNREVIEWED | | | | |
| R231 | F11 | Standard → Rate Card T2 | UNREVIEWED | | | | |
| R232 | F11 | Word Count Targets | UNREVIEWED | | | | |
| R233 | F11 | Full Draft | UNREVIEWED | | | | |
| R234 | F11 | Compressed Draft (by Competition) | UNREVIEWED | | | | |
| R235 | F11 | Timeline Bands | UNREVIEWED | | | | |
| R236 | F11 | Close Types | UNREVIEWED | | | | |
| R237 | F11 | Layer Triggers | UNREVIEWED | | | | |
| R238 | F11 | Cultural Context | UNREVIEWED | | | | |
| R239 | F11 | Planner Effort | UNREVIEWED | | | | |
| R240 | F11 | Social Proof | UNREVIEWED | | | | |
| R241 | F11 | Absences as Signals (Quick Reference) | UNREVIEWED | | | | |
| R242 | F11 | ⚠️ Category vs. Format Check | UNREVIEWED | | | | |
| R243 | F11 | Sparse Lead Type Classification | UNREVIEWED | | | | |
| R244 | F11 | Required Pre-Work (Reasoning-First Method) | UNREVIEWED | | | | |
| R245 | F11 | The Five-Part Draft Sequence (Enforced Order) | UNREVIEWED | | | | |
| R246 | F11 | The 7-Component Checklist (Verification: After Writing) | UNREVIEWED | | | | |
| R247 | F11 | The Gut Check (9 Checks) | UNREVIEWED | | | | |
| R248 | F11 | Verification Gate (Required Before Output) | UNREVIEWED | | | | |
| R249 | F11 | PRE-WORK (Required Before Drafting) | UNREVIEWED | | | | |
| R250 | F11 | VERIFICATION GATE (Required) | UNREVIEWED | | | | |
| R251 | F11 | Preempt Questions by Client Type | UNREVIEWED | | | | |
| R252 | F11 | Contact Block | UNREVIEWED | | | | |
| R253 | F12 | Pacific Flow Entertainment: Quality Gate + Output (Steps 10-11) | UNREVIEWED | | | | |
| R254 | F12 | ⚠️ MANDATORY SEQUENCE: YOU ARE HERE: FILE 3 OF 3 | UNREVIEWED | | | | |
| R255 | F12 | Step 10: Quality Verification | UNREVIEWED | | | | |
| R256 | F12 | Component Quality Standards | UNREVIEWED | | | | |
| R257 | F12 | Sourced Lead Quality Standards (Additional) | UNREVIEWED | | | | |
| R258 | F12 | The Quality Test | UNREVIEWED | | | | |
| R259 | F12 | The Prose Test | UNREVIEWED | | | | |
| R260 | F12 | The "Best Line" Requirement | UNREVIEWED | | | | |
| R261 | F12 | Revision Protocol | UNREVIEWED | | | | |
| R262 | F12 | Step 11: The Gut Check | UNREVIEWED | | | | |
| R263 | F12 | The Competitor Test (Required) | UNREVIEWED | | | | |
| R264 | F12 | The Validation Test (Specific) | UNREVIEWED | | | | |
| R265 | F12 | The "Their Details" Test | UNREVIEWED | | | | |
| R266 | F12 | Strategic Reserve | UNREVIEWED | | | | |
| R267 | F12 | Output Format | UNREVIEWED | | | | |
| R268 | F12 | PRE-WORK (Required Before Drafting) | UNREVIEWED | | | | |
| R269 | F12 | VERIFICATION GATE (Required) | UNREVIEWED | | | | |
| R270 | F12 | FULL DRAFT ([X] words) | UNREVIEWED | | | | |
| R271 | F12 | COMPRESSED DRAFT ([X] words: [Competition Level]) | UNREVIEWED | | | | |
| R272 | F12 | STRATEGIC RESERVE (for follow-up) | UNREVIEWED | | | | |
| R273 | F12 | Why the Gate Has Evidence Requirements | UNREVIEWED | | | | |
| R274 | F12 | Cross-References | UNREVIEWED | | | | |
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
| R309 | F14 | Pacific Flow Entertainment: Pre-Draft Analysis (Steps 6-8) | UNREVIEWED | | | | |
| R310 | F14 | ⚠️ MANDATORY SEQUENCE: YOU ARE HERE: FILE 1 OF 3 | UNREVIEWED | | | | |
| R311 | F14 | Step 6: Evaluate Layers | UNREVIEWED | | | | |
| R312 | F14 | Sourced Delivery Layer | UNREVIEWED | | | | |
| R313 | F14 | Cultural Context Layer | UNREVIEWED | | | | |
| R314 | F14 | Planner Effort Layer | UNREVIEWED | | | | |
| R315 | F14 | Social Proof Technique | UNREVIEWED | | | | |
| R316 | F14 | Step 7: Address Flagged Concerns | UNREVIEWED | | | | |
| R317 | F14 | Integration Requirement | UNREVIEWED | | | | |
| R318 | F14 | Common Concern Patterns | UNREVIEWED | | | | |
| R319 | F14 | Sourced Delivery Concern Patterns | UNREVIEWED | | | | |
| R320 | F14 | Graceful Decline Pattern (Format/Fit Mismatch) | UNREVIEWED | | | | |
| R321 | F14 | Reading Absent Information | UNREVIEWED | | | | |
| R322 | F14 | ⚠️ Category vs. Format Rule | UNREVIEWED | | | | |
| R323 | F14 | Sparse Lead Type Classification | UNREVIEWED | | | | |
| R324 | F14 | Long-Format Expertise (3+ Hours) | UNREVIEWED | | | | |
| R325 | F14 | Step 8: Find the Wedge | UNREVIEWED | | | | |
| R326 | F14 | Wedge Sources | UNREVIEWED | | | | |
| R327 | F14 | Sourced-Specific Wedge Patterns | UNREVIEWED | | | | |
| R328 | F14 | The Wedge Test | UNREVIEWED | | | | |
| R329 | F14 | ⚠️ Steps 6-8 complete. PROCEED TO DRAFT_METHOD.md (Step 9). | UNREVIEWED | | | | |
| R330 | F14 | Cross-References | UNREVIEWED | | | | |
| R331 | F15 | Pacific Flow Entertainment: Writing Execution (Step 9) | UNREVIEWED | | | | |
| R332 | F15 | ⚠️ MANDATORY SEQUENCE: YOU ARE HERE: FILE 2 OF 3 | UNREVIEWED | | | | |
| R333 | F15 | Step 9: Draft Response | UNREVIEWED | | | | |
| R334 | F15 | The Reasoning-First Method | UNREVIEWED | | | | |
| R335 | F15 | Sourced Lead Drafting | UNREVIEWED | | | | |
| R336 | F15 | The Five-Part Draft Sequence | UNREVIEWED | | | | |
| R337 | F15 | The Validation Draft (Required Pre-Work) | UNREVIEWED | | | | |
| R338 | F15 | The 7-Component Checklist (Verify After Writing) | UNREVIEWED | | | | |
| R339 | F15 | Non-Negotiables | UNREVIEWED | | | | |
| R340 | F15 | Dual Output Requirement | UNREVIEWED | | | | |
| R341 | F15 | Qualification Responses | UNREVIEWED | | | | |
| R342 | F15 | Close Types | UNREVIEWED | | | | |
| R343 | F15 | Contact Block (Always Include) | UNREVIEWED | | | | |
| R344 | F15 | ⚠️ Step 9 complete. PROCEED TO VERIFICATION.md (Steps 10-11). | UNREVIEWED | | | | |
| R345 | F15 | Cross-References | UNREVIEWED | | | | |
| R346 | F16 | Pacific Flow Entertainment: Lead Analysis Decision Flow | UNREVIEWED | | | | |
| R347 | F16 | When a Lead Arrives | UNREVIEWED | | | | |
| R348 | F16 | Step 0: Capability Check | UNREVIEWED | | | | |
| R349 | F16 | Step 0.5: Delivery Mode Assessment | UNREVIEWED | | | | |
| R350 | F16 | Alex Performs (AGM Delivery) | UNREVIEWED | | | | |
| R351 | F16 | Alex Sources (PFE Delivery) | UNREVIEWED | | | | |
| R352 | F16 | Hybrid (Alex Performs + Sourced Musicians) | UNREVIEWED | | | | |
| R353 | F16 | Why This Matters | UNREVIEWED | | | | |
| R354 | F16 | Step 1: Surface Data Extraction | UNREVIEWED | | | | |
| R355 | F16 | Step 2: Mode Assessment | UNREVIEWED | | | | |
| R356 | F16 | Step 2.5: Competition + Vagueness Check | UNREVIEWED | | | | |
| R357 | F16 | Competition Level | UNREVIEWED | | | | |
| R358 | F16 | ⚠️ Competition Extraction Rule | UNREVIEWED | | | | |
| R359 | F16 | Vagueness Assessment | UNREVIEWED | | | | |
| R360 | F16 | Decision Gate | UNREVIEWED | | | | |
| R361 | F16 | Step 2.75: Stealth Premium Check | UNREVIEWED | | | | |
| R362 | F16 | Step 3: Pricing Strategy | UNREVIEWED | | | | |
| R363 | F16 | Competition-Weighted Matrix | UNREVIEWED | | | | |
| R364 | F16 | Step 4: Tier Classification | UNREVIEWED | | | | |
| R365 | F16 | Premium Tier (ANY ONE triggers) → Rate Card T3 | UNREVIEWED | | | | |
| R366 | F16 | Qualification Tier (ANY ONE triggers) → Rate Card T2 (lower end, reframe first) | UNREVIEWED | | | | |
| R367 | F16 | Standard Tier → Rate Card T2 | UNREVIEWED | | | | |
| R368 | F16 | Step 5: Check Urgency and Timeline | UNREVIEWED | | | | |
| R369 | F16 | Urgency Signals | UNREVIEWED | | | | |
| R370 | F16 | Timeline Bands | UNREVIEWED | | | | |
| R371 | F16 | Classification Checkpoint (NOT a Deliverable) | UNREVIEWED | | | | |
| R372 | F16 | Cross-References | UNREVIEWED | | | | |
| R373 | F19 | Strategic Context | UNREVIEWED | | | | |
| R374 | F19 | The Buyer Psychology | UNREVIEWED | | | | |
| R375 | F19 | The Anchor Conversation | UNREVIEWED | | | | |
| R376 | F19 | Negotiation Sequence (In Order) | UNREVIEWED | | | | |
| R377 | F19 | Stage 1: They Come Back Pushing Back | UNREVIEWED | | | | |
| R378 | F19 | Stage 2: They're Still Hesitant After Duration Offer | UNREVIEWED | | | | |
| R379 | F19 | Stage 3A: Trio Agrees to Flex | UNREVIEWED | | | | |
| R380 | F19 | Stage 3B: Trio Won't Flex | UNREVIEWED | | | | |
| R381 | F19 | Stage 4: Hold Firm or Walk Away | UNREVIEWED | | | | |
| R382 | F19 | The Value Framing Language | UNREVIEWED | | | | |
| R383 | F19 | Scarcity Lever | UNREVIEWED | | | | |
| R384 | F19 | Emotional Lever | UNREVIEWED | | | | |
| R385 | F19 | Cultural Authenticity Lever | UNREVIEWED | | | | |
| R386 | F19 | The Close (After Value Framing) | UNREVIEWED | | | | |
| R387 | F19 | The Timing Flexibility Option | UNREVIEWED | | | | |
| R388 | F19 | The Bundle Strategy | UNREVIEWED | | | | |
| R389 | F19 | When to Walk Away | UNREVIEWED | | | | |
| R390 | F19 | The "Not a Real Buyer" Signals | UNREVIEWED | | | | |
| R391 | F19 | The 1.5-Hour Compromise Script | UNREVIEWED | | | | |
| R392 | F19 | Post-Negotiation Close | UNREVIEWED | | | | |
| R393 | F19 | Expected Booking Funnel | UNREVIEWED | | | | |
| R394 | F19 | Strategic Reminders | UNREVIEWED | | | | |
| R395 | F19 | Cross-References | UNREVIEWED | | | | |
| R396 | M1 | index.md | UNREVIEWED | | | | |
| R397 | M2 | overview.md | UNREVIEWED | | | | |
| R398 | M3 | preferences.md | UNREVIEWED | | | | |
| R399 | M4 | tools-and-references.md | UNREVIEWED | | | | |
| R400 | M5 | booking-terms.md | UNREVIEWED | | | | |
| R401 | M6 | education-programs.md | UNREVIEWED | | | | |
| R402 | M7 | jit-vision-to-voices.md | UNREVIEWED | | | | |
| R403 | M8 | pricing-decisions.md | UNREVIEWED | | | | |
| R404 | M9 | quote-setup-rules.md | UNREVIEWED | | | | |
| R405 | M10 | venue-history.md | UNREVIEWED | | | | |
| R406 | M11 | music-background.md | UNREVIEWED | | | | |

**Rows: 406.**
