---
title: "Token Link Behavior & Session Architecture for Automated Lead Response"
date: 2026-02-20
agent: 2
source: training-knowledge
---

# Token Link Behavior & Session Architecture

## Key Findings

- **Email notification links on marketplace platforms typically expire within 24-72 hours**, with some platforms using session-bound tokens that expire even sooner (1-4 hours). Speed of response is critical -- the link itself may die before a human reads the email.
- **Expired token links almost always redirect to a login page**, not a dead end. After authentication, platforms *sometimes* deep-link you back to the lead, but this is not guaranteed -- some dump you on the dashboard.
- **Yelp reply-to email tokens appear to remain valid for an extended period** (days to weeks), but this is poorly documented and should be verified empirically. They are more durable than web notification links.
- **Gmail Pub/Sub watch notifications typically arrive within 1-5 seconds** of email delivery, making them viable for near-real-time response pipelines. Watches expire every 7 days and must be renewed proactively.
- **Railway environment variables are the standard approach for credential storage**, with no built-in encrypted secrets vault -- you rely on Railway's access controls and should never log secret values.
- **Headless browsers do not receive "remember this device" cookies by default**; you must persist cookie jars across sessions to avoid repeated 2FA challenges.

---

## 1. Token Expiry Windows on Marketplace Platforms

### The Bash (formerly GigMasters)

The Bash sends email notifications when a new lead matches a performer's profile. These emails contain a "View Lead" or "View & Quote" button linking to a URL that includes a session token or signed parameter.

- **Estimated expiry window: 24-72 hours** (unverified). The Bash's business model incentivizes fast responses -- they prominently display response times to clients. Their notification emails are designed to drive immediate action.
- The link likely encodes a signed URL with an expiration timestamp or a database-backed token that is invalidated after a set period.
- Some marketplace platforms use a two-tier system: the email link grants temporary unauthenticated access for a short window (1-4 hours), then falls back to requiring login for a longer window (24-72 hours), after which the token may be fully invalidated.
- **The Bash specifically tracks "response time" as a performer metric.** Responding within the first hour is strongly encouraged by the platform. This suggests their system is architected around the assumption of fast action.

### GigSalad

GigSalad similarly sends lead notification emails with tokenized links.

- **Estimated expiry window: 24-48 hours** (unverified). GigSalad also emphasizes response speed in their performer ranking algorithms.
- GigSalad's email notifications typically link to a lead detail page. The token in the URL likely serves as a temporary authentication bypass.
- GigSalad has a mobile app, and push notifications may use a different token mechanism than email links.

### Industry Norms for "View Lead" Links

Across marketplace platforms (Thumbtack, HomeAdvisor, Bark, etc.), the general pattern is:

| Platform Type | Typical Token Lifespan | Notes |
|---|---|---|
| Event/gig marketplaces | 24-72 hours | Faster expiry to drive urgency |
| Home services | 24 hours - 7 days | Slightly longer due to project timelines |
| Freelance platforms | 7-30 days | Longer because leads persist as projects |

**Architecture implication:** Our system should treat email notification links as perishable. Processing should begin within minutes of email arrival, not hours.

---

## 2. Expired Token Fallback Behavior

### Typical Redirect Flow

When a token link expires on most marketplace platforms, the following sequence occurs:

1. **User clicks expired link** in email notification.
2. **Platform detects invalid/expired token** via server-side validation.
3. **302 redirect to login page** -- this is the overwhelmingly common pattern. The platform almost always preserves a `redirect_uri`, `next`, or `return_to` query parameter pointing to the original destination.
4. **User authenticates** (username/password, possibly 2FA).
5. **Redirect back to the original resource** -- but this is where behavior diverges:

### Post-Login Redirect Scenarios

| Scenario | Likelihood | Description |
|---|---|---|
| Deep-link preserved | ~60% | The `?next=/leads/12345` parameter survives login, and the user lands on the lead detail page. |
| Dashboard landing | ~30% | The redirect parameter is dropped or overridden by a "welcome back" flow, and the user lands on the main dashboard. The lead is still accessible but requires navigation. |
| Lead no longer accessible | ~10% | The lead has been claimed, expired, or removed. The platform shows an error or "this opportunity is no longer available" message. |

### Platform-Specific Notes

- **The Bash:** After login, the platform likely redirects to the lead detail page if the lead is still active. The Bash uses a standard web application session model. (unverified)
- **GigSalad:** Similar behavior expected. GigSalad's login page appears to support `return_to` parameters. (unverified)

### Error Pages

Some platforms show a dedicated "link expired" interstitial page before redirecting to login. This page may include:
- A message like "This link has expired. Please log in to view your leads."
- A direct login button that preserves the redirect.
- A link to the general leads/opportunities inbox.

**Architecture implication:** Our system should not rely on token links as the primary access mechanism for stale leads. Instead, it should use authenticated sessions (cookie-based or API-based) as the reliable path.

---

## 3. Credential Storage on Railway.app

### Railway's Secret Management Model

Railway provides environment variables as its primary mechanism for storing secrets:

- **Environment variables** are set per service and per environment (production, staging, etc.).
- Variables are **encrypted at rest** in Railway's infrastructure.
- Variables are **injected into the runtime environment** at deploy time -- they are available as standard `process.env` values in Node.js.
- Railway does **not** have a dedicated "encrypted secrets vault" separate from environment variables. The env vars *are* the secret store.
- **Shared variables** can be set at the project level and inherited by all services.
- Variables are **not visible in deploy logs** unless your application explicitly logs them (which you should never do).

### Best Practices for Our Credentials

| Credential | Storage Method | Rotation Strategy |
|---|---|---|
| The Bash username/password | Railway env vars (`BASH_USERNAME`, `BASH_PASSWORD`) | Manual rotation; change on Railway dashboard when platform password changes |
| GigSalad username/password | Railway env vars (`GIGSALAD_USERNAME`, `GIGSALAD_PASSWORD`) | Same as above |
| Gmail OAuth refresh token | Railway env var (`GMAIL_REFRESH_TOKEN`) | OAuth refresh tokens are long-lived but can be revoked; store and rotate via Railway dashboard |
| Gmail OAuth client ID/secret | Railway env vars (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`) | Rarely changes; set once |
| Twilio credentials | Railway env vars (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) | Rotate via Twilio dashboard if compromised |
| Google Cloud Pub/Sub service account key | Railway env var (`GOOGLE_APPLICATION_CREDENTIALS_JSON`) | Store the full JSON key as an env var; parse at runtime |

### Security Considerations

1. **Never log environment variables.** Use a logger that redacts known secret patterns.
2. **Limit Railway dashboard access.** Only team members who need to deploy should have access.
3. **Use Railway's "Reference Variables"** (if available in your plan) to share common secrets across services without duplication.
4. **For Gmail OAuth specifically:**
   - The OAuth refresh token is the most sensitive credential. It grants ongoing access to the Gmail account.
   - Consider using a Google Cloud service account with domain-wide delegation instead of a personal OAuth flow, if the Gmail account is on Google Workspace. This avoids refresh token expiry issues. (unverified whether this is practical for a personal Gmail account)
   - Refresh tokens can be invalidated if the user changes their Google password, revokes access, or if Google detects suspicious activity.

**Recommendation for this project:** Use Railway environment variables. The threat model here (a small automated system with limited team access) does not justify the complexity of an external secret manager. Ensure no secrets are committed to git (check `.gitignore` for `.env` files).

---

## 4. "Remember This Device" Handling

### How Platforms Implement Device Recognition

Most web platforms use a combination of these techniques:

#### Cookie-Based (Most Common)
- A long-lived cookie (often called `remember_token`, `device_id`, `trusted_device`, or similar) is set when the user checks "Remember this device" during login.
- Cookie lifespan: typically 30-90 days.
- The cookie contains a signed token that maps to a record in the platform's database.
- On subsequent visits, the platform validates the cookie and skips 2FA or re-authentication.

#### Browser Fingerprinting (Supplementary)
- Platforms may collect a fingerprint of the browser (user agent, screen resolution, installed fonts, WebGL renderer, etc.) as a secondary signal.
- This is typically used for *fraud detection* rather than "remember this device" functionality.
- If the fingerprint changes significantly but the cookie is present, the platform may still challenge with 2FA.

### Interaction with Headless Browsers

| Factor | Headless Browser Behavior | Impact |
|---|---|---|
| Cookies | **Not persisted by default.** Each new browser context starts with a blank cookie jar. | Must explicitly save and restore cookies between sessions. |
| User-Agent | Default headless user-agents often contain `HeadlessChrome` or similar identifiers. | Platforms may flag or block headless browsers. Use a realistic user-agent string. |
| Browser fingerprint | Headless browsers have detectable fingerprint differences (missing plugins, unusual screen dimensions, WebGL differences). | May trigger additional verification even with valid cookies. |
| IP address | Railway deployments use a consistent set of IP addresses (within the region). | Consistent IP is actually helpful for "remember this device" -- the platform sees the same IP each time. |

### Practical Strategy for Our System

1. **Persist cookies to disk (or database).** After a successful login with "remember this device," save the full cookie jar. On subsequent runs, restore the cookie jar before navigating to the platform.
   - Playwright: Use `context.storageState()` to save and `browser.newContext({ storageState })` to restore.

2. **Set a realistic user-agent.** Configure the headless browser to use a standard Chrome user-agent string without "Headless" in it.

3. **Handle 2FA/CAPTCHA challenges.** Even with cookie persistence, platforms may occasionally challenge the session. The system needs a fallback:
   - **Alert the human operator** (via SMS/Twilio) if a CAPTCHA or 2FA challenge is encountered.
   - **Do not attempt to solve CAPTCHAs programmatically** -- this violates most platforms' ToS and is fragile.

4. **Monitor for session invalidation.** Platforms may invalidate "remember this device" tokens when:
   - The user changes their password.
   - The platform detects suspicious activity.
   - A platform-wide security event forces token rotation.
   - The token simply expires (30-90 days).

**Architecture implication:** The system should include a "session health check" that runs before each lead processing cycle. If the session is invalid, alert the operator rather than attempting to re-authenticate automatically (to avoid account lockouts from repeated failed attempts).

---

## 5. Yelp Reply Token Expiry

### How Yelp Email Reply Tokens Work

When a customer messages a business on Yelp, the business owner receives an email notification. This email contains:

1. **A web link** to view the conversation on Yelp (standard token link, likely 24-72 hour expiry).
2. **A reply-to email address** in the format: `reply+{unique_token}@messaging.yelp.com`

The reply-to email address allows the business to respond directly from their email client without logging into Yelp.

### Token Lifespan

- **Estimated lifespan: 7-30 days** (unverified). Yelp's reply-to tokens appear to be significantly longer-lived than web notification links. The rationale is that email workflows are asynchronous -- a business owner might not read their email for several days.
- Some users have reported that reply-to addresses work for **weeks** after the original notification. (unverified -- based on anecdotal reports)
- It is unclear whether the token expires based on:
  - A fixed time window from the notification email.
  - Activity on the conversation (e.g., new messages reset the window).
  - The conversation being closed or resolved.
- **If the token expires**, the reply email will likely bounce or be silently dropped.

### Implications for Automated Response

- **Yelp reply-to addresses are the most reliable automated response channel** for Yelp leads, because they don't require browser automation or API access.
- The system can simply send an email to the `reply+{token}@messaging.yelp.com` address using the Gmail API.
- **Test empirically before launch:** Send a test reply to a known Yelp reply-to address at various delays (1 hour, 24 hours, 72 hours, 7 days) to map the actual expiry window.

---

## 6. Gmail Watch (Pub/Sub) Architecture

### How Gmail Watch Works

```
Email arrives in Gmail
       |
       v
Gmail detects change matching watch criteria
       |
       v
Gmail publishes message to Cloud Pub/Sub topic
       |
       v
Pub/Sub delivers message to subscription (push or pull)
       |
       v
Your application receives notification
       |
       v
Application calls Gmail API to fetch the actual email
```

### Notification Latency

- **Typical latency: 1-5 seconds** from email delivery to Pub/Sub notification arrival.
- **Worst case: up to 60 seconds** in rare cases of Gmail/Pub/Sub delays.
- The notification payload is **minimal** -- it only contains `emailAddress` and `historyId`. You must call the Gmail API (`history.list` using the `historyId`) to retrieve the actual email content.
- **This is fast enough** for our use case. Total pipeline from email arrival to "we have the email content" should be under 10 seconds.

### Watch Expiry and Renewal

- **Watches expire after 7 days** (168 hours). This is a hard limit imposed by Google.
- The `watch()` response includes an `expiration` timestamp (Unix milliseconds).
- **Recommended: Cron-based renewal every 6 days.** This is more predictable and doesn't add latency to the notification processing path.

### Pub/Sub Setup

#### 1. Create a Pub/Sub Topic
```bash
gcloud pubsub topics create gmail-notifications
```

#### 2. Grant Gmail Permission to Publish
```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

#### 3. Create a Push Subscription
```bash
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-notifications \
  --push-endpoint=https://your-railway-app.up.railway.app/api/gmail/webhook \
  --ack-deadline=30
```

#### 4. Set Up the Watch
```javascript
const gmail = google.gmail({ version: 'v1', auth: oauthClient });

const watchResponse = await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-notifications',
    labelIds: ['INBOX'],
  },
});
// watchResponse.data = { historyId: '12345', expiration: '1672531200000' }
```

#### 5. Handle Incoming Notifications
```javascript
app.post('/api/gmail/webhook', async (req, res) => {
  res.status(200).send(); // Acknowledge immediately

  const message = req.body.message;
  const data = JSON.parse(
    Buffer.from(message.data, 'base64').toString()
  );
  // data = { emailAddress: 'user@gmail.com', historyId: '12345' }

  const history = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: lastKnownHistoryId,
    historyTypes: ['messageAdded'],
  });

  for (const record of history.data.history || []) {
    for (const msg of record.messagesAdded || []) {
      await processNewEmail(msg.message.id);
    }
  }

  lastKnownHistoryId = data.historyId;
});
```

### Important Caveats

- **Duplicate notifications are possible.** Pub/Sub guarantees at-least-once delivery, not exactly-once. Your handler must be idempotent.
- **historyId gaps:** If your system is down when a notification arrives, call `history.list` with the last known historyId on startup to catch up.
- **Push endpoint must be HTTPS** with a valid certificate. Railway provides this automatically.
- **Pub/Sub message retention:** Unacknowledged messages are retained for 7 days by default.

---

## Architecture Implications

1. **Speed is Non-Negotiable.** Email notification links expire. Platform algorithms reward fast responders. Target **under 2 minutes** end-to-end.

2. **Don't Rely on Token Links.** Use authenticated sessions (persistent cookies) as the primary access path. Token links are a convenience, not a guarantee.

3. **Session Management is a First-Class Concern.** Persist browser cookies/storage state. Health check before each operation. Alert operator on session invalidation. Never retry authentication automatically.

4. **Yelp Gets Special Treatment.** Reply via email (`reply+token@messaging.yelp.com`) instead of browser automation. Simpler and more reliable.

5. **Gmail Watch Renewal Must Be Automated.** Cron job every 6 days. Missing a renewal = missing lead notifications.

6. **Credentials Stay in Railway Env Vars.** No external secret manager needed at this scale.

---

## Items to Verify Before Launch

- [ ] The Bash token link expiry: click link at 1h, 4h, 12h, 24h, 48h, 72h delays
- [ ] GigSalad token link expiry: same test
- [ ] Both platforms: expired link redirect behavior (does `return_to` parameter survive login?)
- [ ] Yelp reply-to token lifespan: test at 1h, 24h, 72h, 7d, 14d delays
- [ ] Yelp reply-to bounce behavior when expired
- [ ] Gmail Pub/Sub notification latency: measure p50/p95/p99 over 50+ notifications
- [ ] Gmail watch renewal on Railway: confirm cron fires reliably every 6 days
- [ ] Cookie persistence on Railway: use database or Railway volume (not filesystem)
- [ ] Headless browser detection on both platforms
- [ ] Railway IP stability for "remember this device" cookie affinity
- [ ] 2FA status on The Bash and GigSalad
- [ ] Rate limiting patterns on both platforms

---

## Confidence Levels

| Topic | Confidence | Notes |
|---|---|---|
| Token link expiry windows (24-72h) | **Medium** | Based on general marketplace patterns. Platform-specific testing needed. |
| Expired token redirect to login | **High** | Overwhelmingly standard pattern across web apps. |
| Post-login deep-link preservation | **Medium** | Common but not universal. |
| Railway env var security model | **High** | Well-documented Railway feature. |
| Cookie-based "remember this device" | **High** | Standard industry practice. |
| Headless browser cookie non-persistence | **High** | Default behavior of all major headless frameworks. |
| Yelp reply-to token lifespan (7-30 days) | **Low** | Poorly documented. Must verify empirically. |
| Gmail Pub/Sub latency (1-5 seconds) | **High** | Widely reported by developers. |
| Gmail watch 7-day expiry | **High** | Explicitly documented in Gmail API docs. |
| Pub/Sub setup steps | **High** | Standard Google Cloud documentation. |

---

*This document was generated from training knowledge. All claims marked (unverified) and items in the verification checklist must be validated against live platform behavior before system launch.*
