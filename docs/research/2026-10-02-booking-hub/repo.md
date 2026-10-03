# gig-lead-responder: repo research for the booking-hub plan (2026-10-02)

Repo: `/Users/alejandroguillen/Projects/gig-lead-responder`, branch `docs/booking-hub-brainstorm` (HEAD `16f51bb`, 2 doc commits on top of `main` `edc8cfb`). Tree clean. All reads; nothing run, no DB opened, no tests run.

## 0. Findings that matter most for the plan

1. **Approving never sends anything to a client.** SMS `YES` (`src/twilio-webhook.ts:89-107`) only calls `completeApproval()` (DB status `done`, first follow-up scheduled). Dashboard Approve (`src/api.ts:87-129`) texts the compressed draft **to Alex's phone** and then marks it `done`. Follow-up `SEND` (`twilio-webhook.ts:187-209`, `db/follow-ups.ts:75`) only marks a follow-up sent. The only code that can send to a client is the Gmail-poller auto-send path (`automation/orchestrator.ts:285-316`), which is off.
2. **The auto-send path drops the platform.** `orchestrator.ts:130` calls `runPipeline(lead.rawText)` with no `platform`. The platform is set only from that argument (`run-pipeline.ts:107`), so on the Gmail path `classification.platform` is undefined. As a result the GigSalad no-contact-info rules in the generate prompt (`prompts/generate.ts:33-36, 215-216, 384`) and the deterministic GigSalad contact-leak check (`pipeline/post-check.ts:125-131`) **do not run on the one path that can auto-send to GigSalad.** The Mailgun path passes it (`webhook.ts:145`). This is not in todo 020.
3. **"Confidence" is not a send-safety score.** `computeConfidence` (`run-pipeline.ts:57-77`) is +40 gate pass, +20 verified, +10 each for stealth premium, cultural context, competition count > 0 and all concerns traced. A clean, correct, non-cultural direct lead caps at 80. The router (`automation/router.ts:32-103`) does **not** read `confidence_score` at all. It holds on rule triggers instead.
4. **No deterministic price check on the draft.** Nothing compares the dollar figure written in the draft to `pricing.quote_price` / floor. `post-check.ts:55` only flags price *ranges*. Price correctness in the text rests on the LLM verify gate.
5. **Production poller state is unknown, and the counter leans toward "not running".** `rejectedEmails` increments for every unknown-sender message (`orchestrator.ts:47-50`, `source-validator.ts:128`), and rejected messages are not marked processed, so they reappear within the overlap window. On any live inbox the counter would very likely be above 0. A reading of 0 after 54 days is consistent with "poller disabled" (or an inbox with no mail at all). INFERENCE, UNVERIFIED: needs Railway logs.

## 1. Architecture

**Entry points**
- `src/server.ts` is production (`railway.json` start command `npx tsx src/server.ts`; `npm run serve`). It checks env guards (`:8-35`), runs `initDb()` (`:38`) and `createApp()` (`:40`), and on listen starts the follow-up scheduler, the Gmail poller (non-fatal) and `recoverStuckLeads()` (`:43-52`). SIGTERM stops both loops (`:54-61`).
- `src/app.ts` builds the Express app: CSP/security headers (`:33-49`), `GET /health` unauthenticated (`:52-59`), `/dashboard.html` behind `sessionAuth` with a nonce injected (`:62-67`), `/` and `/index.html` redirect to the dashboard (`:70-72`), static `public/` (`:74`), then the Mailgun webhook, Twilio webhook, `api.ts`, `follow-up-api.ts` routers, `POST /logout`, a 404 catch-all and the error handler (`:77-97`).
- `src/index.ts` is a CLI (`npm start` / `npm run demo`). It reads a lead from stdin, prints the classification, pricing and drafts, and copies the draft with `pbcopy`.
- `ecosystem.config.cjs` (pm2) points at `src/automation/main.ts`, which was deleted in `dec2f7d` (2026-04-07). Dead config.

**Pipeline (`src/run-pipeline.ts:87-298`).** Order: classify (Claude) → `verifyClassificationHeuristics` → `sanitizeClassification` → **hard gate** (`pipeline/hard-gate.ts`) → travel fee lookup by ZIP → price + budget gap (`pipeline/price.ts`) → enrich (may change the format, then re-price) → PF-Intel venue lookup (`venue-lookup.ts`) → **context** (`pipeline/context.ts`) → generate + verify loop (`pipeline/verify.ts:41-75`, max 2 rewrites, returns `verified:false` if every attempt fails) → deterministic post-check (`pipeline/post-check.ts`: em-dash auto-fix, banned phrases, price ranges, GigSalad contact leak) → confidence score.
- When the hard gate fails, it skips the AI stages and returns a template decline with `gate_status:"fail"`, `verified:false` and confidence 0 (`run-pipeline.ts:132-176`). The router then holds it.
- `runEditPipeline` (`run-pipeline.ts:311-342`) re-runs context → generate (with the edit instructions) → verify → post-check on the stored classification and pricing. It is used by SMS and dashboard edits.
- Model: `claude-sonnet-4-6` is the default in `src/claude.ts:44,100`, with `max_tokens` 4096 and one JSON-repair retry (`:41-91`). Follow-up drafts use `claude-haiku-4-5-20251001` (`pipeline/follow-up-generate.ts:17`).

**How docs/*.md load at runtime (`src/pipeline/context.ts`)**
- `DOCS_DIR = join(process.cwd(), "docs")` (`:7`). Files are read on every pipeline run with `readFile`, with no caching (`:12-22`).
- Required (throw `ContextError` if missing): `RESPONSE_CRAFT.md` (`:35`) and `PRICING_TABLES.md` (`:38`).
- Optional (warn and skip): `PRINCIPLES.md` (`:50`), `QUICK_REFERENCE.md` (`:69`), and only when `cultural_tradition === "spanish_latin"`: `CULTURAL_SPANISH_LATIN.md` + `CULTURAL_CORE.md` (`:56-65`). The venue block is inserted after pricing (`:43-47`).
- **Not loaded at runtime:** `DRAFT_METHOD.md`, `PROTOCOL.md`, `VERIFICATION.md`, `PRICING.md`, every `Rate_Card_*.md`, `Bolero_Trio_Negotiation_Playbook.md`, `Sourced_Format_Definitions.md`, `TRAVEL_FEES.md`. Their content is hand-encoded into `src/prompts/*.ts` and `src/data/rates.ts` (for example `prompts/classify.ts:3` "Implements PROTOCOL.md Steps 0-5", `prompts/generate.ts:8` "Implements RESPONSE_CRAFT.md Steps 6-10"). Todo 069 (done) chose to remove the DRAFT_METHOD references rather than load the file.
- **Implication for the merge:** a rule ported into a doc that `context.ts` does not load has no effect. A port into PROTOCOL / DRAFT_METHOD / rate cards needs matching edits to `src/prompts/*.ts` or `src/data/rates.ts`, or a change to `context.ts`.

**`src/data/rates.ts` (390 lines).** Typed `FormatRates` tables `{durationHours: {T1?,T2P,T2D,T3P,T3D: {anchor, floor}}}` for solo, duo, flamenco_duo/trio/trio_full, mariachi_4piece/full, bolero_trio, and sourced_cultural_solo/duo/trio/quartet/5piece. They are combined into `RATE_TABLES: Record<Format, FormatRates>` (`:376-390`). Header comments cite the rate-card source docs ("April 2026 ($500 floor enforced)", `:21`). There are no residency (R1-R3), T4 or nonprofit tiers. Consumers: `pipeline/price.ts:1` and `prompts/generate.ts:1`. `data/voice-references.ts` holds voice exemplars used by the generate and verify prompts.

**`src/prompts/*`.** These are system-prompt builders: `classify.ts` (176 lines), `generate.ts` (451), `verify.ts` (238; gut-check threshold 13 of 15 from `types.ts:175-176`; the LLM itself sets `gate_status`, and `verify.ts:7-20` validates only the shape), and `follow-up.ts` (82). Untrusted text is wrapped through `utils/sanitize.ts`.

## 2. Data model

- **Tech:** SQLite via `better-sqlite3`, WAL, foreign_keys ON (`src/db/migrate.ts:6,17-19`). Path is `DATABASE_PATH` or `./data/leads.db` (`:9`). `docs/deployment.md:21-31,47` says Railway uses a volume at `/data` with `DATABASE_PATH=/data/leads.db`.
- **Migrations:** there is no migration framework. `initDb()` does `CREATE TABLE IF NOT EXISTS`, then an `ALTER TABLE ADD COLUMN` list (`:65-87`), a one-time table rebuild to widen a CHECK constraint (`:108-182`), a one-time data normalization (`:185-201`) and the indexes (`:205-210`). CHECK values are kept in sync with `types.ts` constants by comment.
- **Tables:**
  - `leads` (`:22-49` + added columns): source_platform, mailgun_message_id (UNIQUE; also stores the Gmail id), raw_email, client_name, event_date, event_type, venue, guest_count, budget_note, `status` ∈ {received, sending, sent, done, failed}, classification_json, pricing_json, full_draft, compressed_draft, gate_passed, gate_json, edit_round, edit_instructions, done_reason; **outcome** ∈ {booked, lost, no_reply}, outcome_reason ∈ {price, competitor, cancelled, other}, actual_price, outcome_at; confidence_score, error_message, pipeline_completed_at, sms_sent_at; **follow-up** columns: follow_up_status ∈ {pending, sent, skipped, exhausted, replied}, follow_up_count, follow_up_due_at, follow_up_draft, snoozed_until.
  - Note: `status='sent'` means "draft texted to Alex, awaiting approval", not "sent to client" (`post-pipeline.ts:48-52`; the orchestrator also uses it for holds, `orchestrator.ts:175`).
  - `processed_emails` (external_id PK, platform, received_at) is used for dedup on both intake paths (`db/leads.ts:163-180`, `automation/dedup.ts`).
  - `venue_misses` (`migrate.ts:213-222`).
- **Nothing for gigs, bookings, contacts, payments, invoices, contracts or calendar.** A grep for deposit, invoice, calendar and retainer in `src/` returns 0 hits. One lead row has one `client_name` and no email or phone column (the Squarespace client email exists only in memory on `ParsedLead`, `automation/types.ts:33-37`). "Booked" exists only as `leads.outcome` + `actual_price`.
- DB modules: `db/leads.ts` (CRUD, `claimLeadForSending`, `runTransaction`), `db/follow-ups.ts` (state machine, `completeApproval` `:187-202`), `db/queries.ts` (list/analytics/stats), `db/stmt-cache.ts`, barrel `db/index.ts`. `db/migrate.ts:1-2` forbids importing from `./index.js`.

## 3. Auto-send, confidence gates, SMS approve/edit

**Auto-send**
- Implemented in `src/automation/orchestrator.ts:268-341` (`handleAutoSendDecision`). It sends `output.drafts.compressed_draft` (`:287`) through `dispatchReply` (`:217-245`): Squarespace goes through the Gmail API (`senders/gmail-sender.ts`), GigSalad and Yelp go through Playwright (`portals/*-client.ts`). On success it calls `completeApproval(..., "auto-sent via X")` (`:312`).
- **Flags** (`automation/config.ts:49-52`): `AUTO_SEND_ENABLED === "true"` (default false, review-only) and `DRY_RUN !== "false"` (default **true**). `poller.ts:57-62` also forces DRY RUN when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` or **`TWILIO_TO_NUMBER`** is missing. The mode is logged at startup (`poller.ts:124-126`). With review-only it sets status `sent`, done_reason `review-only: would-auto-send via X`, and sends a "REVIEW" SMS (`:317-340`).
- HANDOFF (`HANDOFF.md:119`): "Auto-send is NOT live." The live Railway values of `AUTO_SEND_ENABLED` and `DRY_RUN` are UNVERIFIED.
- `.env.example` lists none of `AUTO_SEND_ENABLED`, `TWILIO_TO_NUMBER`, `GMAIL_CREDENTIALS_JSON`, `GMAIL_TOKEN_JSON`, `DISABLE_FOLLOW_UPS`, `DEV_WEBHOOK_KEY` or `LOG_PATH`.

**Gate signals that exist today**
- Hard gate (`pipeline/hard-gate.ts:70-141`), all deterministic:
  - Auto-decline on a non-Alex format (DJ, karaoke, band, other instruments; `:20-34`, `:80-111`).
  - Red-flag keywords become `flags` (commission, exposure, bar sales, tips only, for free, no pay, volunteer; `:38-46`).
  - Capability alias map: `unknown_capability` or `ambiguous_capability` flags (`:123-133`).
- Verify gate: an LLM-judged `gate_status` with 15 gut checks (threshold 13), the GigSalad contact rule and the sign-off rule (`prompts/verify.ts:87-99`). Up to 3 attempts.
- Post-check: banned phrases, price ranges and the GigSalad contact leak turn the result into a fail and set `verified=false` (`run-pipeline.ts:260-283`).
- Router holds (`automation/router.ts:42-94`): parseConfidence low; Yelp not enriched; missing portalUrl for GigSalad/Yelp; `!verified`; quote > `EDGE_CASE_BUDGET_THRESHOLD` (default 3000); any `flagged_concerns`; cross-family format correction; vague + one_question; stealth_premium + assume_and_quote.
- `confidence_score`: see §0.3. It is stored (`orchestrator.ts:161`) and shown on the dashboard, but **not used for routing**.
- Tests: `src/confidence.test.ts` (scoring, edit pipeline, stage events), `src/hard-gate.test.ts`, `src/orchestrator.test.ts`, `src/post-check.test.ts`, `src/verify-prompt.test.ts`. A test file for `routeLead` was not found by name (UNVERIFIED whether `orchestrator.test.ts` covers the router).

**SMS (Twilio)**
- Outbound: `src/sms.ts`. `sendSms(body)` goes to `ALEX_PHONE` from `TWILIO_FROM_NUMBER` and throws on failure (`:19-27`). `sendSmsSafe(config, body)` goes to `TWILIO_TO_NUMBER`, supports dry run and **truncates to 160 chars** (`:30-63`). The two senders use **two different env vars** for the same phone.
- Inbound: `POST /webhook/twilio` (`twilio-webhook.ts:232-307`). It checks the signature against `BASE_URL + /webhook/twilio` (`:34-56`) and accepts only `From === ALEX_PHONE` (`:244`). Commands:
  - `YES|Y|APPROVE|OK[-id]` → approve (DB only).
  - `#id: text` or `id text` → edit.
  - `SKIP` → cancel follow-ups.
  - `SEND` → mark the follow-up sent.
  - Anything else → edit of the single pending lead (`resolveLead` refuses if more than 1 is pending, `:64-84`).
  - Max 3 edit rounds (`:23`).
- **/leads deep-link bug, confirmed:** `twilio-webhook.ts:76` (`${baseUrl()}/leads`), `:105` and `:129` (`${baseUrl()}/leads/${id}`). No `/leads` route exists in `src/` or `public/` (only `/api/leads`), so these links fall through to the 404 JSON (`app.ts:92-94`). The scheduler uses the correct `/dashboard.html#follow-ups` (`follow-up-scheduler.ts:24`). The stale path also appears in `docs/deployment.md:49,50,66,227` and `docs/e2e-test.md:110` (todo 020 cites `e2e-test.md:21`; this pass found `:110`).
- HANDOFF `:81` says the local `.env` `TWILIO_AUTH_TOKEN` is truncated (31 chars). Production token: UNVERIFIED.

## 4. Intake

There are **two separate intake paths** with different downstream behavior.

**A. Gmail poller** (production path when configured):
- `automation/poller.ts` runs inside `server.ts`. It polls every `POLL_INTERVAL_MS` (default 60 s).
- On Railway, credential files are bootstrapped from `GMAIL_CREDENTIALS_JSON` / `GMAIL_TOKEN_JSON` (`:20-31`). If auth is missing it logs "polling disabled" and returns (`:46-54`). It stops permanently on `invalid_grant`/401 (`:105-111`). None of this appears in `/health`.
- `gmail-watcher.ts` queries `in:inbox after:<ts-120>` with `maxResults: 20` (`:142-148`). `lastPollTimestamp` starts at now−300 s (`poller.ts:75`), so mail that arrives during downtime longer than about 5 minutes is never picked up.
- Account: `userId: "me"`, so it is whatever account authorized `scripts/gmail-auth.ts` (scopes `gmail.readonly` + `gmail.send`, `:22-24`). Docs name **alex.guillen.music@gmail.com** (`docs/SYSTEM_ARCHITECTURE_HANDOFF.md:86,136`; `docs/deployment.md:154`). Which account the production token belongs to is UNVERIFIED.
- Flow (`orchestrator.ts:31-212`): `validateSource` (exact sender allowlist + mandatory SPF and DKIM pass; `source-validator.ts:14-25,79-84`) → skip Yelp replies (`:59-64`) → dedup → parse → `insertLead` → Yelp portal enrichment → pipeline → router → hold SMS or auto-send / review-only.
- Parsed sources (`automation/parsers/`): **GigSalad** (`gigsalad.ts`; senders leads@/noreply@/notifications@gigsalad.com), **Yelp** (`yelp.ts`; always `parseConfidence:"low"` until portal enrichment; sender `reply+<hex>@messaging.yelp.com`), **Squarespace** (`squarespace.ts`; form-submission@/noreply@squarespace.com|info; client email taken from Reply-To). **The Bash is not on this path.**

**B. Mailgun webhook** `POST /webhook/mailgun` (`src/webhook.ts`):
- Checks the HMAC + a 5-minute replay window (`:16-83`).
- Parses with `email-parser.ts`, which handles only **GigSalad** (`leads@gigsalad.com`) and **The Bash** (`info@thebash.com`) (`email-parser.ts:25,90,155-159`; `types.ts:348`).
- Does an atomic dedup + insert, then runs the pipeline (with platform) on a 2-minute timeout, then `postPipeline` texts Alex the draft "Reply YES to send" (`post-pipeline.ts:13-55`). There is no router and no auto-send.
- Whether Gmail→Mailgun forwarding is configured and live: UNVERIFIED. `docs/deployment.md:133-227` describes the setup.

**Portal reply code (Playwright).**
- `portals/gigsalad-client.ts`: `submitReply` only. Persistent context in `data/browser/gigsalad`, headless, `--disable-blink-features=AutomationControlled`, email+password login. Selectors are marked **`[VERIFY LIVE]`** (`:8,56`).
- `portals/yelp-client.ts`: `fetchLeadDetails` + `submitReply`, with block detection and failure screenshots.
- HANDOFF `:552-553` says `fetchLeadDetails` has never run on a real Yelp email.
- `playwright` is a dependency, but nothing runs `playwright install` (no postinstall, no nixpacks.toml/Dockerfile). Whether Chromium exists on Railway: UNVERIFIED, and probably not. The browser profile dirs are relative `data/…`, not on the `/data` volume.
- No The Bash portal client exists.

## 5. Follow-ups, outcomes, analytics

- **Scheduler** (`src/follow-up-scheduler.ts`): ticks every 15 minutes with a `setTimeout` chain (`:7,81-97`). Takes up to 10 due leads (`db/follow-ups.ts:35-40`). Generates a Haiku draft, atomically claims pending→sent, stores the draft, then texts the dashboard link (`:31-74`). After 3 failures the lead is set to `skipped` (`:64-67`). Can be disabled with `DISABLE_FOLLOW_UPS=true`.
- **State machine:** `db/follow-ups.ts:8-19`. Delays are +24 h, +3 d, +7 d, max 3 (`:21-27`).
- Follow-ups are **never sent to the client by the app**. SEND or approve only increments the count. "Replied" is manual only (dashboard `POST /api/leads/:id/follow-up/replied`). Reply detection is not wired: the roadmap #3 comment is at `orchestrator.ts:54-58`.
- **Outcomes:** `POST /api/leads/:id/outcome` (`api.ts:179`) → `setLeadOutcomeAndFreeze` (`db/queries.ts:268`).
- **Analytics:** `GET /api/analytics` → `getAnalytics()` (`db/queries.ts:100-…`). It returns booked/lost/no_reply counts, revenue = SUM(actual_price for booked), average actual vs quoted price, by platform, by format, average days to book, monthly trend (gap-filled), revenue by event type, by follow-up count and loss reasons. Every query is filtered to `status='done'`. `GET /api/stats` → `getLeadStats()`.
- The local DB has 0 outcomes (sweep report A). There is no win-rate baseline in data.

## 6. Deployment

- **Railway:** `railway.json` uses the Nixpacks builder, `npx tsx src/server.ts`, healthcheck `/health` (300 s timeout), restart ON_FAILURE ×3. HANDOFF says it auto-deploys from `main`. Production URL: `https://gig-lead-responder-production.up.railway.app` (`HANDOFF.md:517`). The sweep on 2026-10-02 saw `commit:"edc8cfb"`, `startedAt:"2026-08-09T14:35:43Z"`. GitHub `origin/HEAD` points at `feat/gig-lead-pipeline`, not `main`; that is cosmetic but noted.
- **Health endpoint** (`app.ts:52-59`): `{status, rejectedEmails, commit, startedAt}`. `commit` comes from `RAILWAY_GIT_COMMIT_SHA`/`GIT_COMMIT_SHA` validated as a SHA, else "unknown" (`build-info.ts:32-38`). There is no poller, scheduler, travel-data or Twilio state. `docs/deployment.md:65` still says it returns only `{"status":"ok"}`.
- **Old-Mac plan** (`docs/brainstorms/2026-03-29-auto-reply-automation-brainstorm.md:52-53`; plan `docs/plans/2026-03-29-feat-auto-reply-automation-plan.md:493-505`, status `code-complete-pending-fixtures`). The code was written but the plan was **superseded by Railway rather than carried out**:
  - `a2aab93` (2026-03-30) added `ecosystem.config.cjs` + `scripts/setup-old-mac.sh`, but that commit is only on `feat/gig-lead-pipeline`. `setup-old-mac.sh` is not on `main`.
  - The same day, `2d18427` embedded the poller in `server.ts` "for single-deploy operation", and `c553da7` added Railway env bootstrapping. `dec2f7d` (2026-04-07) deleted `automation/main.ts`.
  - The plan's manual checkboxes (sleep settings, gmail-auth on the old Mac) are unchecked. No evidence anywhere in the repo that the old Mac was ever set up. Whether a physical Mac exists or runs anything: UNVERIFIED.
- **Env flags read in code:** ANTHROPIC_API_KEY; NODE_ENV/RAILWAY_ENVIRONMENT (production guards); DASHBOARD_USER/PASS, COOKIE_SECRET (≥16), BASE_URL; TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER, TWILIO_TO_NUMBER, ALEX_PHONE; MAILGUN_WEBHOOK_KEY, DISABLE_MAILGUN_VALIDATION + DEV_WEBHOOK_KEY, DISABLE_TWILIO_VALIDATION; DATABASE_PATH; DRY_RUN, AUTO_SEND_ENABLED, POLL_INTERVAL_MS, EDGE_CASE_BUDGET_THRESHOLD, LOG_PATH; GMAIL_CREDENTIALS_PATH/TOKEN_PATH/CREDENTIALS_JSON/TOKEN_JSON; GIGSALAD_EMAIL/PASSWORD, YELP_EMAIL/PASSWORD; PF_INTEL_API_URL, PF_INTEL_SERVER_API_KEY; DISABLE_FOLLOW_UPS; RAILWAY_GIT_COMMIT_SHA/GIT_COMMIT_SHA; PORT.
- **Auth:** dashboard login with Basic Auth credentials, then a 14-day HMAC cookie; CSRF via the `X-Requested-With` header. Dev bypass when credentials are unset outside production (`auth.ts:118-126`; todo 083).

## 7. Tests and lint

- **Framework:** Node's built-in `node:test`, run through tsx. `npm test` = `node --import tsx --test src/*.test.ts scripts/*.test.ts` (`package.json`). There are 26 test files (25 in `src/`, 1 in `scripts/`).
- **Count:** HANDOFF reports **351 passing** after 2026-08-08 (`HANDOFF.md:449`). A static count of `it(`/`test(` lines gives 288; the difference is presumably generated or looped cases. Not run in this pass (UNVERIFIED today).
- `tests/parsers/parser-tests.ts` is a scaffold and **outside the npm test glob** (it runs by hand, and its fixtures are missing).
- `npm run typecheck` = `tsc --noEmit`, covering `src/` and `scripts/`. `npm run plan:check` = `tsx scripts/plan-gate.ts`, which validates a plan's `## Automation Contract` JSON (required keys `scripts/plan-gate.ts:31-41`).
- **CI:** `.github/workflows/ci.yml` runs typecheck + test on PRs and on pushes to main (Node 22). Branch protection requires it, with strict + enforce_admins on (`HANDOFF.md:412-427`). `audit.yml` is a separate npm audit at high severity.
- **Lint:** none on `main` (todo 085 pending). Branch `chore/add-eslint` (`de22467`) is unmerged (`git branch --merged main` does not list it).

## 8. Conventions

- **CLAUDE.md:**
  - Every phase doc ends with `## Three Questions`. The plan reads the brainstorm's "least confident" answer and opens with `### Prior Phase Risk` (quoted verbatim plus a one-sentence response).
  - HANDOFF.md is updated at the end of every session with a "Prompt for Next Session" block.
  - `/update-learnings` runs after compound.
- **HANDOFF.md current state:** the header is stale (date 2026-07-18, branch main).
  - Latest sections: 2026-08-07 security fix and typecheck fix; 2026-08-08 CI gate, dependency and deploy-verification session (PRs #26-31); 2026-08-09 Yelp allowlist compound.
  - Live "Prompt for Next Session" (`:504-557`):
    - Peer-session check first.
    - Process the 13 leads with NULL drafts once API credits exist, but Alex's no-credits rule means confirming with him first.
    - Watch the first real Yelp lead end to end.
    - Open todos 083, 082, 081 (p2) and 085 (p3).
  - Outstanding (`:121-127`): flip auto-send after a monitoring period; production-lessons addendum; the truncated Twilio token.
  - It does not yet record the booking-hub brainstorm.
- **Plans:** `docs/plans/YYYY-MM-DD-{feat|fix|refactor}-<slug>-plan.md` (the 07-18 one omits `-plan`). YAML frontmatter has `title`, `type`, `status`, `date`, and often `origin`/`predecessor`, `feed_forward: {risk, verify_first}`. Example sections:
  - `2026-05-31-…-auto-send-plan.md` (466 lines): Enhancement Summary, Prior Phase Risk, What is changing, What must NOT change, Implementation Steps, Acceptance Tests, How we will know it worked, Most likely way this plan is wrong, Feed-Forward, Three Questions.
  - `2026-04-22-…-capability-hardening-plan.md`: Prior Phase Risk, Review Findings Applied, the five gate questions as headings, Acceptance Tests + Verification Commands, Scope, Feed-Forward.
  - `2026-07-18-…-operational-pass.md` (87 lines): Prior Phase Risk, Goal, Ordered scope, Safety boundaries, Expected files, Three Questions, **`## Automation Contract`** (JSON; checked by `plan:check`).
- **Todos:** `todos/NNN-{pending|done}-pN-slug.md` with YAML frontmatter (status, priority, issue_id, tags). The highest number is 086.
- **Solutions:** `docs/solutions/<category>/` (architecture, logic-errors, process-patterns, prompt-engineering, …), 64 entries.
- **Commits:** Conventional Commits `type(scope): summary` (`feat(health):`, `fix(deps):`, `docs(todo):`, `ci:`, `build(tsconfig):`). One branch per change → PR → required CI → merge commit `Merge pull request #N from SDGuitarist/<branch>`. Commit bodies often carry a Co-Authored-By line.

## 9. pacific-flow-hub todo 020, checked against current code

File: `/Users/alejandroguillen/Projects/pacific-flow-hub/todos/020-pending-p1-lead-responder-production-defects.md`. **Its title and body list THREE defects plus hygiene. The brainstorm says "the 4 known production defects (pacific-flow-hub todo 020)".** The count does not match. The fourth may be the stale `/health` doc (sweep A item 8), the hygiene items, or the new §0.2 platform bug. Resolve this before planning.

| # | Defect | Status in current code |
|---|---|---|
| 1 | SMS deep links 404 | **CONFIRMED.** `src/twilio-webhook.ts:76,105,129` build `/leads` and `/leads/:id`. No such route in `src/app.ts` or any router or `public/`. The 404 catch-all is at `app.ts:92-94`. Docs: `docs/deployment.md:49,50,66,227` and `docs/e2e-test.md:110`. |
| 2 | Travel fee off in production | **CONFIRMED in code; production effect UNVERIFIED.** `src/travel-fee.ts:9` resolves `<repo>/data/zip_distances.json` relative to the source file (not cwd). `.gitignore:8` `/data/` ignores it (`git check-ignore` confirms). `git ls-files data` = 0 files; the file exists only locally. On load failure it logs FATAL and every lookup returns `miss` (`:15-23`); the pipeline then quietly skips travel (`run-pipeline.ts:179-187`). The deployed tree is presumably git-based, so the file would be absent unless a volume is mounted at `/app/data`. The docs mount the volume at `/data`. |
| 3 | Ambiguous health counter | **CONFIRMED.** `/health` = status, rejectedEmails, commit, startedAt (`app.ts:52-59`). No poller state. The poller silently returns on missing auth (`poller.ts:46-54`) and on token expiry (`:105-111`). The counter is in-memory and resets on restart (`source-validator.ts:56`). See §0.5. |
| H1 | No README.md | **CONFIRMED** (`git ls-files` has no readme). |
| H2 | `ecosystem.config.cjs` → `src/automation/main.ts` missing | **CONFIRMED** (`ecosystem.config.cjs:18`; the file was deleted in `dec2f7d`). |
| H3 | `chore/add-eslint` unmerged | **CONFIRMED** (`de22467`, not in `git branch --merged main`). |

Additional defects found in this pass (not in todo 020):
- §0.2: Gmail path drops `platform`, so the GigSalad contact-info guards are off on the auto-send path (`orchestrator.ts:130` vs `webhook.ts:145`).
- `sendSmsSafe` truncates to 160 chars (`sms.ts:53`), which cuts hold reasons and the lead context in SMS.
- Two env vars for Alex's phone (`ALEX_PHONE` vs `TWILIO_TO_NUMBER`), and the second is missing from `.env.example`. If it is unset on Railway, the poller silently runs in DRY RUN (`poller.ts:57-62`).
- Poller misses mail that arrives during downtime longer than about 5 minutes (`poller.ts:75`) and caps at 20 messages per poll (`gmail-watcher.ts:147`).
- No deterministic draft-price check (§0.4). `confidence_score` is not used by the router (§0.3).

## UNVERIFIED (needs Railway, logs or Alex)
- Railway env values: `AUTO_SEND_ENABLED`, `DRY_RUN`, `TWILIO_TO_NUMBER`, `GMAIL_TOKEN_JSON`, `DATABASE_PATH`, the volume mount path.
- Whether the Gmail poller is running in production, and which Gmail account its token belongs to.
- Whether Gmail→Mailgun forwarding is configured, i.e. whether The Bash leads reach the app at all.
- Whether Chromium/Playwright works on the Railway image.
- Today's test pass count. Production DB contents (sweep A could not verify them either).
- Whether the old Mac exists or was ever provisioned.
