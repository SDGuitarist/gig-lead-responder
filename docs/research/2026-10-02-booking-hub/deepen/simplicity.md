# Simplicity / YAGNI review: booking-hub plan (2026-10-02)

Plan: /Users/alejandroguillen/Projects/gig-lead-responder/docs/plans/2026-10-02-feat-booking-hub-plan.md

## New moving parts that an existing one already covers

1. **Cut the separate "helper" process (Shape, lines 97-103).** The main app is already launched from a Terminal `.command` (line 510). Full Disk Access is granted to Terminal, so the child Node process inherits it. Run chat.db reads, `osascript` iMessage and `claude -p` from the one app. That leaves one process, one log and one health check.
2. **Defer Telegram (S5, Phase 1.5, the "alert fallback" EARS test).** The plan contradicts itself. The prerequisite table says "only if S4 fails" (line 526), but Phase 1.5 and the acceptance test build Telegram unconditionally. The fallback should be **email to self through the Gmail client the app already has**. Build Telegram only if S4 fails.
3. **Defer Tailscale (S7).** No success measure needs the dashboard on a phone, and approvals come by alert. Revisit if Alex reaches for it.
4. **Don't run Railway and the Mac at the same time (line 561).** Two pollers on one inbox is a double-send risk, and it means two runtimes to babysit. Shut Railway down once 0.5 passes, as 0.1 already says.

## Phase 0: trim

- **0.2:** Delete the SMS deep links instead of fixing them, since Twilio is going away. Cut the README, pm2-config and eslint "hygiene" items, because none of them serves a success measure and pm2 stops mattering under `.command`. Keep the platform-drop P1, the travel-fee data fix and `/health`.
- **0.4 baseline:** Time-box it to the GigSalad dashboard plus a count of GIG Calendar bookings. Mining both Gmail accounts across 12 months is the expensive part, and it is a "before" number, not a feature.
- **S3:** Keep it only as the read-back half of S4. Reading **payments and text leads** from chat.db can wait until Phase 3 shows that email receipts miss real payments. Until then, Alex forwards text leads.

## Phase 1: smallest version

- **GigSalad ships as "fill, Alex presses Send"**, which is exactly what S2 proves. Auto-press stays a later toggle that the 20-lead ramp has to earn. Reply speed still improves, and the ToS-strike risk stays at zero until then.
- **Reply clock:** use one clock (only GigSalad has a rule) and cut quiet hours for now.
- **Text/call lead capture from iMessage:** cut it and forward instead (see S3).

## Tables and states not needed yet

- **`venues`:** move it to the phase that uses it. Phase 2 only needs a `coi_required` note in logistics.
- **`documents`:** belongs in Phase 3, not the global model.
- **`contacts` + `gig_contacts`:** merge into one `gig_contacts(gig_id, name, email, phone, role)`. Reusing a contact across gigs is rare at 5-15 leads a week. Add the join table if a planner repeats often.
- **`gigs.status` has 8 states:** `inquiry`/`quoted` duplicate lead status, because a gig is created at booking. `deposit_paid`/`balance_paid` can be worked out from confirmed `payments` rows, and storing them twice means they will drift. Keep `booked | played | closed | cancelled`.
- **`reminders.next_run_at` + `due_at`:** these are one-shot reminders, so one `due_at` is enough. `next_run_at` is for recurring jobs.

## Phase 2 / 3 / 4: cut or merge

- **Cut the questionnaire "lock"** (2.3 and its EARS test). It is a Jotform feature to build, and no measure depends on it.
- **Cut backfill import code (2.5).** Four gigs fit in one seed script or a manual entry form.
- **Defer the workshop contract variant (3.1).** It is not gig booking, and the plan's own "Not building" list excludes workshop material.
- **Phase 4: drop Claude in Chrome on the insurance portal.** That would be a second fragile browser automation for a few COIs a year. The app prepares the additional-insured text and Alex pastes it. License "document need" becomes one reminder kind with no automation. What is left of Phase 4 (a venue flag, COI text, one reminder) **merges into Phase 2's logistics check**, which already asks "COI needed".

## Estimate

- About 25-30% of the planned build disappears: helper process, Telegram, Tailscale, 2 tables, 4 states, the lock, the import, the workshop variant, COI browser automation and hygiene work.
- No success measure loses coverage.
- Phases go from 4 modules to 3.
- Complexity: High → Medium.
