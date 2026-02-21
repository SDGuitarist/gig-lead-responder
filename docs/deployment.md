# Railway Deployment Guide

Step-by-step setup for deploying gig-lead-responder to Railway.

---

## 1. Create Railway Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo (`gig-lead-responder`)
3. Railway auto-detects Node.js via nixpacks and installs dependencies

### Native Module Note

`better-sqlite3` is a native C++ addon. Railway's nixpacks builder compiles it
automatically during `npm install`. If the build fails on this step, check that
your Node version is compatible (the project targets ES2022, Node 18+).

---

## 2. Add a Volume (Required for SQLite)

Railway containers are **ephemeral** — without a volume, the SQLite database
resets on every deploy. This is the most critical step.

1. In your Railway service, click **+ New** → **Volume**
2. Set the **mount path** to `/data`
3. Railway provisions persistent storage at that path

The app reads `DATABASE_PATH` to know where to create the SQLite file.
Set `DATABASE_PATH=/data/leads.db` in your environment variables (next step).

---

## 3. Environment Variables

Set all of these in your Railway service's **Variables** tab.

| Variable | Example | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API key for the pipeline |
| `TWILIO_ACCOUNT_SID` | `AC...` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | `...` | Twilio auth token (also used for webhook signature validation) |
| `TWILIO_FROM_NUMBER` | `+1234567890` | Twilio phone number that sends SMS |
| `ALEX_PHONE` | `+1234567890` | Your phone number (receives SMS, only number allowed to reply) |
| `MAILGUN_WEBHOOK_KEY` | `...` | Mailgun webhook signing key (for inbound email verification) |
| `DATABASE_PATH` | `/data/leads.db` | **Must match volume mount.** `/data` is the volume, `leads.db` is the file |
| `BASE_URL` | `https://your-app.up.railway.app` | Your Railway public URL. **Must be exact** — used for Twilio signature validation and SMS dashboard links. No trailing slash. |
| `DASHBOARD_USER` | `admin` | Basic Auth username for the `/leads` dashboard |
| `DASHBOARD_PASS` | *(strong password)* | Basic Auth password for the `/leads` dashboard |
| `DISABLE_TWILIO_VALIDATION` | `false` | Escape hatch — set `true` temporarily to debug Twilio webhook 401 errors caused by BASE_URL mismatch. **Set back to `false` immediately after debugging.** |
| `PORT` | *(do not set)* | Railway injects this automatically. Do not override. |

### Getting Your Railway URL

After your first deploy, Railway assigns a URL like `https://gig-lead-responder-production.up.railway.app`. Copy it and set it as `BASE_URL` (no trailing slash). You may need to redeploy after setting this for the first time.

---

## 4. Verify Deployment

After deploy completes:

1. **Healthcheck:** Visit `https://your-app.up.railway.app/health` — should return `{"status":"ok"}`
2. **Dashboard:** Visit `https://your-app.up.railway.app/leads` — should prompt for Basic Auth credentials
3. **Check logs:** In Railway dashboard → Deployments → click the active deploy → view logs. Confirm you see `Gig Lead Responder running at http://localhost:PORT`

---

## 5. Mailgun Inbound Route Setup

Mailgun forwards incoming emails to your app as webhook POSTs.

1. Go to [Mailgun Dashboard](https://app.mailgun.com) → **Receiving** → **Create Route**
2. Set **Expression Type** to "Match Recipient"
3. Set the recipient pattern (e.g., `leads@yourdomain.com`)
4. Set **Action** to "Forward" with URL: `https://your-app.up.railway.app/webhook/mailgun`
5. Check "Store and notify" if you want Mailgun to retain a copy
6. Save the route
7. Copy the **Webhook Signing Key** from Mailgun → Settings → API Keys and set it as `MAILGUN_WEBHOOK_KEY` in Railway

### Testing Mailgun

Send an email to your inbound address. Check Railway logs for the webhook hit.
If you get a 401, verify `MAILGUN_WEBHOOK_KEY` matches exactly.

---

## 6. Twilio Webhook URL Config

Twilio sends inbound SMS (Alex's replies) to your app.

1. Go to [Twilio Console](https://console.twilio.com) → **Phone Numbers** → select your number
2. Under **Messaging** → **A message comes in**:
   - Set to **Webhook**
   - URL: `https://your-app.up.railway.app/webhook/twilio`
   - Method: **HTTP POST**
3. Save

### Twilio URL Mismatch Debugging

If replies from Alex aren't being processed, check Railway logs for
`Twilio webhook signature validation failed`. This means `BASE_URL` doesn't
match the URL Twilio is POSTing to.

**Quick fix:**
1. Set `DISABLE_TWILIO_VALIDATION=true` in Railway variables
2. Send a test SMS — confirm it hits the webhook (check logs)
3. Fix `BASE_URL` to match your Railway domain exactly
4. Set `DISABLE_TWILIO_VALIDATION=false` immediately

---

## 7. Gmail Forward Filter Setup

Gmail forwards lead notification emails to Mailgun for processing.

1. In Gmail (`alex.guillen.music@gmail.com`), go to **Settings** → **Filters and Blocked Addresses** → **Create a new filter**
2. Set **From** to the sender you want to forward:
   - `form-submission@squarespace.info` (Squarespace leads)
   - `info@thebash.com` (The Bash leads)
   - `leads@gigsalad.com` (GigSalad leads)
3. Click **Create filter** → check **Forward it to** → enter your Mailgun inbound address (e.g., `leads@yourdomain.com`)
4. Optionally check **Also keep in Inbox** to retain a copy
5. Repeat for each sender

### Gmail Forwarding Verification

Gmail requires you to verify the forwarding address first:
1. Go to **Settings** → **Forwarding and POP/IMAP**
2. Click **Add a forwarding address** → enter your Mailgun inbound address
3. Gmail sends a confirmation code to that address
4. Check Mailgun logs for the verification email, click the link or enter the code
5. After verification, the forwarding address becomes available in filter actions

---

## 8. Redeploy Checklist

After changing environment variables:
- Railway redeploys automatically when you change variables
- Volume data (`/data/leads.db`) persists across deploys
- No need to re-configure Twilio or Mailgun URLs unless your Railway domain changes

If you generate a new Railway URL (custom domain, service rename):
1. Update `BASE_URL` in Railway variables
2. Update the webhook URL in Twilio console
3. Update the forward URL in Mailgun routes
