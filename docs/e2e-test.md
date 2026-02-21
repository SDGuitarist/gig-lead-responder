# End-to-End Test Checklist

Manual test steps covering the full lead → pipeline → SMS → approval loop.
Run these after first Railway deploy and after any major changes.

**Pre-requisite:** Complete all steps in `docs/deployment.md` (Railway deployed,
volume mounted, env vars set, Mailgun route configured, Twilio webhook set,
Gmail filters created).

---

## Test 0: Healthcheck + Dashboard

Confirms the deploy is alive and accessible.

- [ ] Visit `https://<your-app>.up.railway.app/health`
  - **Expected:** `{"status":"ok"}`
  - **If it fails:** Check Railway logs. Common causes: missing `ANTHROPIC_API_KEY`
    (server exits on startup), failed `better-sqlite3` native build, volume not
    mounted (SQLite can't write to ephemeral filesystem path).
- [ ] Visit `https://<your-app>.up.railway.app/leads`
  - **Expected:** Browser prompts for Basic Auth credentials
  - Enter `DASHBOARD_USER` / `DASHBOARD_PASS` from Railway env vars
  - **Expected:** Empty leads table (no leads yet)

---

## Test 1: Direct Mailgun Webhook (Bypass Gmail)

Confirms webhook → email parser → pipeline → DB write → SMS works.
This bypasses Gmail entirely — sends directly to the Mailgun inbound address.

- [ ] Send an email **from any address** to your Mailgun inbound address
  (e.g., `leads@yourdomain.com`)
  - **Subject:** `Gig Alert: Wedding Lead! (Gig ID #99999)`
  - **From display name** should include `info@thebash.com` (the parser checks this)
  - **Body (plain text):** Any text — the parser extracts from subject for The Bash
  - **Body (HTML):** Must include a `<a href="https://example.com/view">VIEW NOW</a>` link
- [ ] Check Railway logs within 30 seconds
  - **Expected:** Log line showing webhook received, email parsed, pipeline started
- [ ] Wait for pipeline to complete (check logs — typically 15-30 seconds)
  - **Expected:** Log showing pipeline completed, SMS sent
- [ ] Check your phone for SMS
  - **Expected:** Compressed draft with lead details, "Reply YES to send"
- [ ] Check dashboard at `/leads`
  - **Expected:** New lead with status `sent`, confidence score, event type from
    subject, drafts populated

**If webhook doesn't fire:** Check Mailgun dashboard → Logs for the email.
Verify the route is active and pointing to the correct Railway URL.

**If webhook fires but returns 401:** Verify `MAILGUN_WEBHOOK_KEY` matches
the key in Mailgun → Settings → API Keys.

**If pipeline fails:** Check Railway logs for the error. Common cause: invalid
`ANTHROPIC_API_KEY`.

---

## Test 2: Gmail Filter → Mailgun → Webhook (Full Path)

Confirms the Gmail forwarding filter works end-to-end. Requires a real
notification email from GigSalad or The Bash, OR a self-sent email that
matches the filter criteria.

### Option A: Wait for a Real Lead

- [ ] Wait for a real GigSalad or The Bash notification to arrive in Gmail
- [ ] Confirm the email appears in Gmail inbox (filter set to "Also keep in Inbox")
- [ ] Check Railway logs within 1-2 minutes
  - **Expected:** Webhook hit from Mailgun (Gmail forwarding adds ~30-60s delay)
- [ ] Check your phone for SMS
- [ ] Check `/leads` dashboard for the new lead

### Option B: Simulate with a Self-Sent Email

Gmail filters match on the **From** header. You can't easily spoof this from
your own Gmail. Instead:

- [ ] Use a different email account (or Mailgun's API) to send an email to
  `alex.guillen.music@gmail.com` with:
  - **From:** Must contain `info@thebash.com` (for The Bash filter) — this
    requires sending from an SMTP server you control, or using Mailgun's
    send API with a custom from address
  - **Subject:** `Gig Alert: Test Lead! (Gig ID #88888)`
  - **HTML body:** Include `<a href="https://example.com/test">VIEW NOW</a>`
- [ ] Confirm the email arrives in Gmail and is forwarded
- [ ] Check Railway logs, phone, and dashboard

**If email arrives in Gmail but isn't forwarded:** Check **Settings** → **Filters
and Blocked Addresses** → verify the filter exists and the forwarding address
is correct. Also verify the forwarding address is verified under **Settings** →
**Forwarding and POP/IMAP**.

---

## Test 3: SMS Approval (YES Reply)

Confirms Twilio inbound → lead marked done → confirmation SMS.

**Pre-requisite:** A lead with status `sent` from Test 1 or Test 2. Note the
lead ID from the SMS or dashboard.

- [ ] Reply to the SMS with `YES` (if only one pending lead) or `YES-{ID}`
  (e.g., `YES-1`)
- [ ] Check your phone within 10 seconds
  - **Expected:** Confirmation SMS: `Lead #1 approved! Full draft: https://...`
- [ ] Check `/leads` dashboard
  - **Expected:** Lead status changed to `done`, `done_reason: approved`
- [ ] Check `/leads/{id}` detail page
  - **Expected:** All fields populated, drafts visible, status = done

**If SMS reply isn't processed:** Check Railway logs for:
- `Twilio webhook signature validation failed` → BASE_URL mismatch. Use the
  `DISABLE_TWILIO_VALIDATION` debugging flow (see deployment.md section 6).
- `Twilio webhook from unknown number` → ALEX_PHONE doesn't match your number.
  Check the number format includes country code (e.g., `+1` for US).
- No log at all → Twilio webhook URL not configured. Check Twilio console →
  Phone Numbers → Messaging → "A message comes in" is set to your Railway URL.

---

## Test 4: SMS Edit Reply

Confirms edit instructions → re-run generate+verify → new draft SMS.

**Pre-requisite:** A lead with status `sent`. If you already approved the
lead in Test 3, you need to create a new one (re-run Test 1).

- [ ] Reply to the SMS with edit instructions, e.g.:
  `Make the tone more formal and mention our mariachi experience`
  Or with a lead ID prefix: `#1 Make the tone more formal`
- [ ] Wait for re-generation (10-20 seconds — runs generate + verify stages)
- [ ] Check your phone
  - **Expected:** New draft SMS: `Lead #1 -- Edit 1/3` followed by the
    revised compressed draft
- [ ] Check `/leads` dashboard
  - **Expected:** `edit_round` incremented, new draft text, status still `sent`
- [ ] Optionally send more edits (max 3 rounds total)
- [ ] After final edit, reply `YES` to approve
  - **Expected:** Lead marked `done`

**If edit fails:** Check Railway logs. Common cause: `classification_json` or
`pricing_json` is null on the lead (pipeline didn't complete fully on the
original run).

---

## Test 5: Deduplication

Confirms the same email doesn't create duplicate leads.

- [ ] Re-send the exact same test email from Test 1 (same Message-Id if possible,
  or same content to the same Mailgun address)
- [ ] Check Railway logs
  - **Expected:** `Already processed` or similar skip message
- [ ] Check `/leads` dashboard
  - **Expected:** Still only one lead from that email, no duplicate

**Note:** Dedup works on `Message-Id` header (for Mailgun) and
`mailgun_message_id` (UNIQUE constraint on leads table). If you send a truly
new email with a different Message-Id, it will create a new lead — this is
correct behavior.

---

## Test 6: Error Path

Confirms a malformed email is handled gracefully.

- [ ] Send an email to the Mailgun inbound address with:
  - **From:** `unknown-sender@example.com` (not a recognized platform)
  - **Subject:** `Random subject`
  - **Body:** Any text
- [ ] Check Railway logs
  - **Expected:** Parser returns "skip" — `Unknown sender` message logged
- [ ] Check `/leads` dashboard
  - **Expected:** No new lead created (email was skipped, not failed)

---

## Test 7: Volume Persistence

Confirms leads survive a redeploy.

- [ ] Note the current lead count on `/leads` dashboard
- [ ] Trigger a redeploy in Railway (change any env var value, or push a
  no-op commit)
- [ ] After redeploy completes, visit `/leads` again
  - **Expected:** Same leads still present, same count, same data
- [ ] Visit `/health`
  - **Expected:** `{"status":"ok"}`

**If leads are gone after redeploy:** The volume is not mounted correctly.
Check Railway service → Volume → verify mount path is `/data` and
`DATABASE_PATH` is `/data/leads.db`.

---

## Test 8: DISABLE_TWILIO_VALIDATION Toggle

Run this if Test 3 fails with signature validation errors.

- [ ] Set `DISABLE_TWILIO_VALIDATION=true` in Railway variables
- [ ] Wait for Railway to redeploy
- [ ] Send an SMS reply (e.g., `YES`)
- [ ] Check Railway logs
  - **Expected:** Warning: `Twilio signature validation disabled via DISABLE_TWILIO_VALIDATION`
  - **Expected:** SMS is processed successfully (approval or edit)
- [ ] Copy the exact URL from Railway logs or `BASE_URL` env var
- [ ] Compare it to the Twilio webhook URL in Twilio console
  - **Fix any mismatch** — common issues: trailing slash, http vs https,
    different subdomain
- [ ] Set `DISABLE_TWILIO_VALIDATION=false` in Railway variables
- [ ] Wait for redeploy, then re-test SMS reply
  - **Expected:** Works without the escape hatch now

---

## Quick Reference: Expected Flow

```
Email arrives in Gmail
  ↓ (Gmail filter forwards to Mailgun)
Mailgun receives email
  ↓ (Mailgun POSTs to /webhook/mailgun)
Railway webhook receives POST
  ↓ (email parser extracts fields)
  ↓ (dedup check: processed_emails table)
  ↓ (creates LeadRecord in SQLite)
  ↓ (fires runPipeline() async)
Pipeline runs (classify → price → context → generate → verify)
  ↓ (writes results to lead row)
  ↓ (sends compressed draft via Twilio SMS)
Lead status: "sent"
  ↓
Alex receives SMS with draft
  ↓ (replies YES or edit instructions)
Twilio forwards SMS to /webhook/twilio
  ↓ (signature validation)
  ↓ (approval: marks done | edit: re-runs generate+verify)
Lead status: "done" or updated draft
```
