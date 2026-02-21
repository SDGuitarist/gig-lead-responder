---
title: "Squarespace Webhook Support & Gmail API Architecture for Automated Lead Response"
date: 2026-02-20
agent: 3
source: training-knowledge
---

# Squarespace Webhook Support & Gmail API Architecture

Research document covering integration options for an automated gig lead response system that monitors incoming leads (via Squarespace form notifications and other sources) and generates AI-powered replies through Gmail.

---

## 1. Squarespace Native Webhook Support

### Commerce Webhooks

Squarespace does offer **native webhooks for Commerce events**. These are available on Commerce plans and cover events such as:

- `order.create`
- `order.update`
- `extension.uninstall`

These webhooks are configured through the Squarespace Developer platform and deliver JSON payloads to a specified endpoint URL. However, these are specifically for **e-commerce/order events**, not for general form submissions.

### Form Submission Webhooks

**Squarespace does NOT provide native webhooks for form submissions.** This is a notable gap. When a visitor submits a form block on a Squarespace site, the platform:

1. Stores the submission internally (viewable in the Squarespace dashboard under the form block's "Submissions" tab).
2. Sends a **notification email** to the configured email address(es).
3. Optionally integrates with Google Sheets or Mailchimp for data collection.

There is no built-in way to receive a real-time HTTP callback when a form is submitted.

### Zapier / Third-Party Integration

**Zapier** is the most common workaround. Squarespace has an official Zapier integration that includes a "New Form Submission" trigger. This works by polling Squarespace periodically (Zapier's polling interval is typically every 1-15 minutes depending on your Zapier plan). The flow would be:

- Squarespace form submitted -> Zapier polls and detects new submission -> Zapier sends webhook to your server

**Downsides:**
- Adds latency (polling-based, not real-time)
- Adds cost (Zapier paid plans for multi-step zaps)
- Adds a dependency/point of failure
- Zapier's free tier is very limited (100 tasks/month as of late 2024) (unverified for 2026 pricing)

### Other Third-Party Options

- **Make (formerly Integromat):** Similar to Zapier, offers a Squarespace integration.
- **IFTTT:** Limited Squarespace support, less reliable for this use case.
- **Custom Google Apps Script:** Could monitor the notification email in Gmail and trigger a webhook to your server. This is effectively what the email-parsing approach achieves.

### Recommendation for This Project

Since the system already needs to monitor Gmail for leads from multiple sources (Yelp, The Knot, WeddingWire, etc.), **parsing the Squarespace notification email in Gmail is the most practical approach**. It avoids adding Zapier as a dependency and unifies all lead sources into a single ingestion pipeline.

---

## 2. Squarespace API for Form Submissions

### Form Submissions API

Squarespace has a **REST API** (v1 and v2), but as of my last knowledge:

- The API covers **Commerce** (orders, products, inventory, transactions), **Content** (pages, blog posts), and **Profiles**.
- **There is no public API endpoint for retrieving form submissions.** (unverified -- Squarespace may have added this in later API versions)
- The API requires OAuth or API key authentication and is primarily oriented toward commerce and CMS operations.

### Why Email Parsing Is Better for This Project

Given the lack of a Form Submissions API, and considering the system's architecture:

1. **Squarespace notification emails contain all form field data** in a structured (though HTML-formatted) email body. Fields like name, email, phone, event date, event type, and message are included.
2. **The system already monitors Gmail** for leads from other sources.
3. **Email parsing is the established pattern** for services like The Knot and WeddingWire, which also send lead notifications via email.
4. **No API key management** for Squarespace is needed.
5. **Works across all Squarespace plans** -- no Commerce plan requirement.

The main challenge is reliably parsing the HTML email body. Squarespace notification emails have a fairly consistent format:

```
From: noreply@squarespace.com (or similar)
Subject: "Form Submission from [Page Name]" or similar

Body contains:
- Form name / page name
- Each field label and value
- Submitter's details
```

A regex or HTML parser (like `cheerio` for Node.js) can extract the structured data reliably.

---

## 3. Gmail API OAuth Scopes

### Required Scopes

| Purpose | Scope URI | Classification |
|---------|-----------|----------------|
| Read inbox messages | `https://www.googleapis.com/auth/gmail.readonly` | Sensitive |
| Send emails as user | `https://www.googleapis.com/auth/gmail.send` | Sensitive |
| Modify labels | `https://www.googleapis.com/auth/gmail.modify` | Sensitive |
| Full access (read, send, modify, delete) | `https://www.googleapis.com/auth/gmail.modify` | Sensitive |

**Key scope details:**

- **`gmail.readonly`**: Read messages and metadata, list messages, get threads. Cannot send or modify.
- **`gmail.send`**: Send messages and drafts on behalf of the user. Does NOT grant read access.
- **`gmail.modify`**: Includes read + send + label management + mark as read/unread. Does NOT include permanent deletion.
- **`gmail.labels`**: Create, update, delete labels only. Narrower scope if you only need label management.
- **`https://www.googleapis.com/auth/gmail.compose`**: Create drafts and send messages. Similar to `gmail.send` but also allows draft management.

### Recommended Scope Set for This Project

```
https://www.googleapis.com/auth/gmail.modify
```

A single `gmail.modify` scope covers reading messages, sending replies, and managing labels. It is classified as a **sensitive scope** (not restricted), which means:

- You do NOT need a full Google security audit (that is for restricted scopes like `gmail` full access).
- You DO need to go through Google's OAuth consent screen verification if you want to move out of "testing mode."

### Testing Mode vs Verified App

**Testing Mode (development):**
- Up to 100 test users can be added manually in Google Cloud Console.
- OAuth consent screen shows a warning ("This app isn't verified").
- Refresh tokens expire after **7 days** in testing mode -- this is critical. (unverified -- Google has changed this policy multiple times; some sources say tokens last indefinitely even in test mode if the app type is "Internal" or "Desktop")
- No review process needed.

**Verified App (production):**
- Requires submitting the app for Google's OAuth verification review.
- For sensitive scopes (like `gmail.modify`), this involves providing a privacy policy, describing data usage, and a brief review process (not a full security audit).
- Review can take days to weeks.
- Refresh tokens do not expire (unless the user revokes access or the token is unused for 6 months).

**For a single-user tool (your own Gmail):**
- You can stay in testing mode indefinitely by adding yourself as a test user.
- Use a **Desktop app** OAuth client type (not Web) -- this avoids some token expiration issues. (unverified)
- Alternatively, use a Google Workspace account where the app can be marked as "Internal," bypassing verification entirely. (unverified for personal Gmail vs Workspace)

---

## 4. Persistent Refresh Tokens on Railway.app

### The Problem

OAuth refresh tokens must persist across deployments. Railway's filesystem is **ephemeral** -- every deployment wipes the filesystem. This means:

- Tokens saved to a local JSON file will be lost on redeploy.
- SQLite databases stored on the default filesystem will be lost on redeploy.

### Option A: Environment Variables (Simplest)

Store the refresh token as a Railway environment variable:

- **Initial setup:** Run the OAuth flow locally, obtain the refresh token, paste it into Railway's environment variable dashboard as `GMAIL_REFRESH_TOKEN`.
- **Token refresh:** When the access token expires (~1 hour), use the refresh token to get a new access token. The refresh token itself typically does NOT change on refresh (though Google sometimes rotates refresh tokens -- see Gotchas).
- **Pros:** Simplest approach, no storage infrastructure needed.
- **Cons:** If Google rotates the refresh token, the new token must be manually updated in Railway. No automation for token rotation.

**Handling token rotation in code:**

```typescript
// Pseudocode
const newTokens = await oauth2Client.refreshAccessToken();
if (newTokens.refresh_token) {
  // Google rotated the refresh token!
  // Log a warning -- you need to update the env var manually
  // Or use Railway API to update the env var programmatically (unverified)
  console.warn('REFRESH TOKEN ROTATED -- update GMAIL_REFRESH_TOKEN env var');
}
```

### Option B: Railway Volumes (Persistent Storage)

Railway supports **Volumes** -- persistent disk storage that survives deployments:

- Mount a volume at a path like `/data`.
- Store SQLite database or token JSON file at `/data/tokens.json`.
- Survives redeploys and restarts.
- **Pricing:** Railway Volumes have a cost associated (included in some plans, pay-per-GB on others). (unverified for current pricing)

**This is the recommended approach if the project already uses SQLite** (which it does, based on the git history showing a SQLite lead store). Store everything in `/data/leads.db` including a `tokens` table.

### Option C: External Database

Use an external service like:
- **Railway's managed PostgreSQL or MySQL** -- built-in, easy to provision.
- **Supabase, PlanetScale, Turso** -- free tiers available.
- **Redis (Upstash)** -- good for simple key-value token storage.

This adds complexity but is the most robust approach for production.

### Token Refresh Lifecycle

1. **Initial OAuth flow:** User authorizes app -> receive authorization code -> exchange for access token + refresh token.
2. **Access token:** Expires in ~3600 seconds (1 hour). Used for all API calls.
3. **Refresh token:** Does not expire under normal conditions. Used to obtain new access tokens.
4. **Automatic refresh:** The Google API client library (`googleapis` npm package) handles access token refresh automatically if you provide the refresh token.
5. **Refresh token revocation:** Happens if user revokes access in Google Account settings, or if the token is unused for 6 months (unverified -- the 6-month policy may only apply to certain app configurations).

### Recommendation

**Use Railway Volumes with SQLite.** Store the refresh token in the same SQLite database as leads. This approach:
- Aligns with the existing SQLite lead store architecture.
- Survives deployments.
- Allows programmatic token rotation handling.
- Keeps everything in one place.

---

## 5. Gmail API Daily Sending Limits

### Consumer Gmail Account Limits

| Limit Type | Amount | Notes |
|-----------|--------|-------|
| Emails per day | **500** (consumer) / **2,000** (Workspace) | Rolling 24-hour window |
| Recipients per day | **500** (consumer) / **2,000** (Workspace) | Total across all emails |
| Recipients per message | **500** | Single email |
| SMTP relay (Workspace only) | **10,000** | Per day |

These limits apply to emails sent through any method: web UI, IMAP/SMTP, or API. The Gmail API does NOT have separate, lower limits -- it shares the same per-user sending quota.

### Is 5-15 Emails/Day Safe?

**Yes, absolutely.** 5-15 emails per day is well within the 500/day consumer limit. At this volume:

- You are using **1-3%** of the daily quota.
- There is virtually **zero risk** of hitting rate limits.
- This volume is consistent with normal human email usage patterns.
- Google is unlikely to flag this as automated/abusive behavior.

### API Rate Limits (Separate from Sending Limits)

The Gmail API also has **quota limits** measured in "quota units":

- Default quota: **250 quota units per second per user**.
- `messages.send`: costs **100 quota units** per call.
- `messages.list`: costs **5 quota units** per call.
- `messages.get`: costs **5 quota units** per call.
- Daily quota: **1,000,000,000 quota units** per project (effectively unlimited for small projects).

At 5-15 emails/day, you will never approach these limits.

---

## 6. Spam Risk Mitigations

### Why Programmatic Gmail Replies Are Low Risk

When you use the Gmail API to send from a personal Gmail account:

- The email is sent **through Google's own infrastructure**.
- **SPF, DKIM, and DMARC** are handled by Google automatically. You do not need to configure these -- they are built into Gmail's sending infrastructure.
- The `From:` address is your verified Gmail address.
- Replies to existing threads inherit the conversation context.

This is fundamentally different from sending via a custom SMTP server where you would need to manage DNS records.

### Spam Risk Factors to Watch

1. **Content quality:** Avoid spammy language (excessive caps, too many links, aggressive sales language). AI-generated responses should be natural and personalized.

2. **Volume patterns:** Sending 15 nearly identical emails in rapid succession looks automated. Add **random delays** (e.g., 30 seconds to 5 minutes between sends) to mimic human behavior.

3. **Reply vs. new message:** Replying to an existing thread (the notification email) is inherently lower risk than sending cold outreach. The conversation context helps.

4. **Recipient engagement:** If recipients consistently mark your replies as spam, Google will degrade your sender reputation. Ensure replies are relevant and expected.

5. **Personalization:** Each email should be meaningfully different. Template-based emails with minimal personalization are more likely to trigger spam filters.

### Concrete Mitigations

```
1. Reply to the original notification thread (not a new email)
2. Add 1-5 minute random delay between sends
3. Personalize each response with the client's name, event details, etc.
4. Keep the email concise and professional
5. Include a clear signature with contact info
6. Do NOT include tracking pixels or link shorteners
7. Limit the number of links in the email (1-2 max)
8. Send plain text + HTML multipart (not HTML-only)
```

### SPF/DKIM for Personal Gmail

**You do not need to configure SPF/DKIM.** When sending through the Gmail API:

- Google signs the email with their DKIM key (`d=gmail.com` or your Google Workspace domain).
- SPF passes because the email originates from Google's mail servers.
- DMARC alignment is handled automatically.

This is one of the major advantages of using the Gmail API over a custom mail server.

---

## 7. Gmail Reply Threading

### How Gmail Threading Works

Gmail groups messages into threads (conversations) based on:

1. **Subject line:** Must match (Gmail strips "Re:" prefix for comparison).
2. **`In-Reply-To` header:** Must reference the `Message-ID` of the email being replied to.
3. **`References` header:** Should contain the `Message-ID`(s) from the conversation chain.
4. **`threadId`:** Gmail API-specific -- you can explicitly specify which thread a message belongs to.

### Required Headers for Proper Threading

When using the Gmail API's `messages.send` endpoint, you construct a raw RFC 2822 email. For proper threading:

```
From: your-email@gmail.com
To: client@example.com
Subject: Re: [Original Subject]
In-Reply-To: <original-message-id@squarespace.com>
References: <original-message-id@squarespace.com>
```

Additionally, in the Gmail API request body:

```json
{
  "raw": "base64-encoded-email",
  "threadId": "original-thread-id"
}
```

### Step-by-Step Process

1. **Receive/detect the notification email** (from Squarespace, Yelp, etc.) via Gmail API `messages.list` or Pub/Sub watch.
2. **Get the message details:** `messages.get` returns the message's `threadId`, `id`, and headers including `Message-ID`.
3. **Extract the `Message-ID` header** from the notification email.
4. **Construct the reply:**
   - Set `Subject` to `Re: [original subject]`
   - Set `In-Reply-To` to the original `Message-ID`
   - Set `References` to the original `Message-ID`
   - Set `To` to the **client's email address** (extracted from the form data), NOT to `noreply@squarespace.com`
5. **Send via Gmail API** with the original `threadId`.

### Should the Reply Go TO the Client or TO Squarespace?

**The reply should go TO the client's email address directly.**

Reasons:
- Squarespace notification emails come from `noreply@squarespace.com` -- replying to that address goes nowhere.
- The client's email is contained in the form submission data within the notification email body.
- You want a direct communication channel with the client.
- The reply will still appear in the same Gmail thread (because of `threadId`), giving you a unified conversation view in your inbox.

For **Yelp leads**, the routing is different -- see Section 8.

### Code Example (Node.js / googleapis)

```typescript
import { google } from 'googleapis';

async function replyToLead(gmail, originalMessage, clientEmail, replyBody) {
  const headers = originalMessage.payload.headers;
  const messageId = headers.find(h => h.name === 'Message-ID')?.value;
  const subject = headers.find(h => h.name === 'Subject')?.value;

  const rawEmail = [
    `From: me`,
    `To: ${clientEmail}`,
    `Subject: Re: ${subject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    replyBody
  ].join('\r\n');

  const encodedMessage = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: originalMessage.threadId
    }
  });
}
```

---

## 8. Yelp Email Reply Routing

### Yelp Messaging System

Yelp has a messaging system that allows consumers to contact businesses. When a consumer sends a message through Yelp:

1. The business receives an **email notification** at their registered email address.
2. The email comes from an address like `reply+{token}@messaging.yelp.com` or similar tokenized address.
3. The email body contains the consumer's message and a prompt to reply.

### Does Replying to the Yelp Email Work?

**Yes, replying to the Yelp notification email does deliver the response into the Yelp conversation.** (unverified -- this is based on Yelp's documented behavior and user reports, but the exact mechanics may have changed)

The `reply+{token}@messaging.yelp.com` address is a **tokenized reply address** that:

- Maps to the specific conversation between the consumer and business.
- Routes the reply back into Yelp's messaging system.
- The consumer sees the reply in their Yelp app/website messages.

### How Reliable Is This Pattern?

**Moderately reliable, with caveats:**

1. **Token expiration:** The reply token may expire after a certain period (possibly 24-48 hours, or possibly longer). (unverified) If the token expires, the reply will bounce or not be delivered.

2. **Format sensitivity:** Yelp's inbound email parser may strip HTML or handle formatting inconsistently. **Plain text replies are safer.**

3. **Quote stripping:** Yelp likely strips the quoted original message from the reply. Only the new content above the quote line is delivered to the consumer.

4. **Attachment handling:** Attachments may not be supported or may be stripped. (unverified)

5. **Rate limiting:** Yelp may rate-limit or flag automated-looking replies. Adding natural delays is important.

6. **Reply-To header:** The Yelp notification email should have its `Reply-To` header set to the tokenized address. When constructing the reply via Gmail API, use the `Reply-To` value (not the `From` value) as the `To` address.

### Architecture Recommendation for Yelp

```
1. Detect Yelp notification email (from: *@messaging.yelp.com or *@yelp.com)
2. Extract the Reply-To address (reply+{token}@messaging.yelp.com)
3. Extract the consumer's message from the email body
4. Generate AI response
5. Reply TO the tokenized Reply-To address (not the consumer directly)
6. Set In-Reply-To and References headers for Gmail threading
7. Use plain text format
8. Reply within 1-2 hours to avoid token expiration concerns
```

---

## 9. Gmail Watch (Pub/Sub) Multi-Sender Filtering

### How Gmail Watch Works

The Gmail API's `watch` method uses Google Cloud Pub/Sub to push notifications when changes occur in the user's mailbox:

```typescript
await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/my-project/topics/gmail-notifications',
    labelIds: ['INBOX'],
    labelFilterBehavior: 'INCLUDE'  // Only notify for messages with these labels
  }
});
```

**Key characteristics:**
- Watch expires after **7 days** -- you must renew it periodically.
- Notifications contain only the user's email address and a `historyId` -- they do NOT contain message content.
- You must call `history.list` with the `historyId` to get the actual new messages.
- Notifications are **not filtered by sender** at the watch level.

### Can You Filter by Sender?

**No, the Gmail `watch` API does not support sender-based filtering.** The only filtering available is:

- `labelIds`: Watch specific labels.
- `labelFilterBehavior`: `INCLUDE` (notify only for matching labels) or `EXCLUDE` (notify for everything except matching labels).

### Label-Based Approach (Recommended)

Since you cannot filter by sender at the watch level, the recommended approach is:

1. **Create a Gmail filter** (via Gmail UI or API) that automatically labels emails from specific senders:
   - From: `*@squarespace.com` -> Apply label: `lead-notifications`
   - From: `*@messaging.yelp.com` -> Apply label: `lead-notifications`
   - From: `*@theknot.com` -> Apply label: `lead-notifications`
   - From: `*@weddingwire.com` -> Apply label: `lead-notifications`

2. **Set up watch on that label:**
   ```typescript
   await gmail.users.watch({
     userId: 'me',
     requestBody: {
       topicName: 'projects/my-project/topics/gmail-notifications',
       labelIds: ['Label_XXXX'],  // ID of 'lead-notifications' label
       labelFilterBehavior: 'INCLUDE'
     }
   });
   ```

3. **On notification:** Call `history.list` to get new messages, then process only messages with the `lead-notifications` label.

### Alternative: Poll-Based Approach

Instead of Pub/Sub watch, you can poll the Gmail API on a schedule (e.g., every 2-5 minutes):

```typescript
// List recent messages matching a query
const results = await gmail.users.messages.list({
  userId: 'me',
  q: 'from:(squarespace.com OR messaging.yelp.com OR theknot.com OR weddingwire.com) is:unread newer_than:1h',
  maxResults: 10
});
```

**Pros of polling:**
- Simpler to implement (no Pub/Sub topic setup, no webhook endpoint needed).
- Sender filtering is built into the query.
- No 7-day watch renewal needed.
- Works on Railway without exposing a public endpoint for Pub/Sub push.

**Cons of polling:**
- Higher latency (2-5 minutes vs near-real-time).
- Uses more API quota (though still well within limits at this scale).
- Slightly less efficient.

### Recommendation for This Project

**Start with polling.** For 5-15 leads per day, polling every 2-3 minutes is perfectly adequate and dramatically simpler than setting up Pub/Sub. The Gmail API quota allows ~250 queries per second -- polling once every 2 minutes uses a negligible amount.

If real-time response time becomes important (e.g., responding within 30 seconds), upgrade to Pub/Sub watch with the label-based filtering approach.

---

## Phase 1 Architecture Recommendation

Based on the research above, here is the recommended architecture for Phase 1:

### Lead Ingestion: Gmail Polling

```
[Gmail Inbox]
    |
    v
[Polling Service - every 2-3 min]
    |  Query: from:(squarespace.com OR messaging.yelp.com ...) is:unread
    |
    v
[Email Parser]
    |  - Identify source (Squarespace, Yelp, The Knot, etc.)
    |  - Extract lead data (name, email, event date, message, etc.)
    |  - For Yelp: extract Reply-To tokenized address
    |
    v
[SQLite Lead Store]
    |  - Deduplicate
    |  - Store parsed lead data
    |  - Track status (new -> ai_drafted -> sent -> replied)
    |
    v
[AI Response Generator]
    |  - Use lead data + context docs to generate personalized response
    |  - Human review step (optional, recommended for Phase 1)
    |
    v
[Gmail Sender]
    |  - Squarespace leads: Reply TO client email, thread in Gmail
    |  - Yelp leads: Reply TO tokenized Yelp address, thread in Gmail
    |  - Add 1-5 min random delay between sends
```

### OAuth Token Storage

```
Railway Volume mounted at /data
    -> /data/leads.db (SQLite)
        -> leads table (existing)
        -> tokens table (new: key, value, updated_at)
```

### Gmail OAuth Setup

1. Create Google Cloud project.
2. Enable Gmail API.
3. Create OAuth 2.0 credentials (Desktop app type).
4. Add yourself as test user.
5. Request scope: `https://www.googleapis.com/auth/gmail.modify`.
6. Run initial OAuth flow locally to obtain refresh token.
7. Store refresh token in SQLite on Railway Volume (with env var as fallback).

### Polling vs Pub/Sub Decision

| Factor | Polling | Pub/Sub Watch |
|--------|---------|---------------|
| Implementation complexity | Low | Medium-High |
| Latency | 2-3 minutes | ~10-30 seconds |
| Infrastructure needs | Just a cron/setInterval | Pub/Sub topic + push endpoint |
| Railway compatibility | Native (no exposed endpoint needed) | Requires public HTTPS endpoint |
| Maintenance | None | Renew watch every 7 days |
| Good enough for 5-15 leads/day? | Yes | Overkill |

**Verdict: Polling for Phase 1.**

---

## Gotchas & Risks

### High Priority

1. **Refresh token expiration in test mode:** Google may expire refresh tokens after 7 days for apps in "testing" OAuth consent status. If this happens, the system goes offline until you manually re-authenticate. **Mitigation:** Monitor for auth failures and alert immediately. Consider getting the app verified (sensitive scope review is lighter than restricted scope).

2. **Yelp reply token expiration:** If the system doesn't respond quickly enough, the Yelp tokenized reply address may stop working. **Mitigation:** Prioritize Yelp leads; aim to reply within 1 hour.

3. **Squarespace email format changes:** If Squarespace changes their notification email format, the parser breaks silently (leads are ingested but parsed incorrectly). **Mitigation:** Validate parsed data (require name + email minimum) and alert on parse failures.

4. **Google refresh token rotation:** Google may issue a new refresh token when you refresh the access token. If you don't save the new refresh token, the old one may become invalid. **Mitigation:** Always check for a new refresh token in the refresh response and persist it.

### Medium Priority

5. **Gmail filter drift:** If you add new lead sources, you must update both the Gmail filter (for labels) and the polling query. Easy to forget one.

6. **Rate limiting on replies:** If you send too many replies too quickly, Gmail may temporarily restrict sending. Very unlikely at 5-15/day, but worth adding delays.

7. **Thread confusion:** If the same client submits multiple forms, replies may thread incorrectly. Each form submission should ideally start a new thread (by not setting `threadId` if it's a new lead).

8. **Railway Volume reliability:** Railway Volumes are persistent but not backed up automatically. **Mitigation:** Periodically export/backup the SQLite database.

### Low Priority

9. **Email parsing edge cases:** Clients may include unusual characters, very long messages, or submit forms in unexpected ways.

10. **Gmail quota changes:** Google occasionally adjusts API quotas, though increases are more common than decreases for small-scale usage.

---

## Items to Verify Before Launch

- [ ] **Squarespace notification email format:** Send test form submissions and examine the exact HTML structure. Document the parsing selectors/regex.
- [ ] **Squarespace sender address:** Confirm the exact `From` address used for form notifications (e.g., `noreply@squarespace.com`, `form@squarespace.info`, etc.).
- [ ] **Yelp reply routing:** Send a test Yelp message, reply via email, and confirm it appears in the Yelp conversation.
- [ ] **Yelp reply-to address format:** Document the exact format of the tokenized reply address.
- [ ] **Yelp token expiration:** Test whether old Yelp notification emails still have working reply addresses.
- [ ] **Gmail OAuth token behavior in test mode:** Confirm whether refresh tokens actually expire after 7 days or persist indefinitely.
- [ ] **Google Cloud project setup:** Create project, enable Gmail API, configure OAuth consent screen.
- [ ] **Railway Volume setup:** Provision a volume, mount at `/data`, confirm persistence across deploys.
- [ ] **Railway Volume backups:** Set up a periodic backup mechanism (e.g., copy SQLite to object storage).
- [ ] **The Knot / WeddingWire email formats:** If these are lead sources, document their notification email formats.
- [ ] **Gmail filter setup:** Create filters for all lead source sender addresses.
- [ ] **Error alerting:** Set up notification (SMS via Twilio, which is already integrated) for auth failures and parse failures.
- [ ] **Test end-to-end flow:** Submit a form, confirm polling picks it up, confirm parser extracts correct data, confirm AI generates appropriate response, confirm reply threads correctly.

---

## Confidence Levels

| Finding | Confidence | Notes |
|---------|------------|-------|
| Squarespace lacks form submission webhooks | **High** | Well-documented limitation as of 2024 |
| Squarespace has commerce webhooks | **High** | Documented in developer docs |
| Squarespace lacks Form Submissions API | **Medium** | May have been added in API v2 updates |
| Gmail API `gmail.modify` scope covers read+send+labels | **High** | Well-documented in Google's OAuth scope reference |
| Gmail OAuth test mode token expiration (7 days) | **Medium** | Google has changed this policy; may not apply to Desktop app type |
| Gmail daily sending limit: 500 for consumer | **High** | Widely documented and stable |
| Gmail API rate limits (quota units) | **High** | Documented in Google Cloud console |
| SPF/DKIM handled automatically for Gmail API sends | **High** | Fundamental to Gmail's architecture |
| Gmail threading via In-Reply-To + threadId | **High** | Well-documented API behavior |
| Yelp reply+token email routing works | **Medium** | Based on user reports; Yelp may change behavior |
| Yelp token expiration window | **Low** | No official documentation found; purely anecdotal |
| Gmail watch cannot filter by sender | **High** | Documented API limitation |
| Gmail watch expires after 7 days | **High** | Documented in API reference |
| Railway Volumes persist across deploys | **High** | Core Railway feature |
| Polling at 2-3 min interval is within Gmail API quota | **High** | Simple math against documented quotas |
| 5-15 emails/day is safe for Gmail sending | **High** | Well within documented limits |
