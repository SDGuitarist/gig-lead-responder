# Email Parsing Research: GigSalad, Yelp, Squarespace

**Date:** 2026-03-29
**Purpose:** Detailed reference for building TypeScript email parsers in Phase 2 of the auto-reply automation plan.
**Context:** Plan doc at `docs/plans/2026-03-29-feat-auto-reply-automation-plan.md`

> **Important caveat:** Web search and Gmail access were unavailable during this research session. The email format details below are based on training data and known platform patterns. **Before writing any parser, you MUST capture 2-3 real emails from each platform and save them to `examples/emails/`.** Real emails are the source of truth -- this document gives you a head start, not a guarantee.

---

## Table of Contents

1. [GigSalad Lead Notification Emails](#1-gigsalad-lead-notification-emails)
2. [Yelp Lead/Message Notification Emails](#2-yelp-leadmessage-notification-emails)
3. [Squarespace Form Submission Emails](#3-squarespace-form-submission-emails)
4. [Email Parsing Techniques in TypeScript](#4-email-parsing-techniques-in-typescript)
5. [Defensive Parsing Strategies](#5-defensive-parsing-strategies)
6. [Concrete TypeScript Code Examples](#6-concrete-typescript-code-examples)
7. [Action Items Before Writing Parsers](#7-action-items-before-writing-parsers)

---

## 1. GigSalad Lead Notification Emails

### What They Are

When a client on GigSalad submits a booking request or quote request, GigSalad sends an email notification to every matching performer. This email contains the lead details and a link to respond on the GigSalad portal.

### Email Envelope

| Field | Expected Value |
|-------|---------------|
| **From address** | `leads@gigsalad.com` or `noreply@gigsalad.com` (may also show as "GigSalad" display name) |
| **Reply-To** | Not the client -- replies go back to GigSalad's system |
| **Subject line pattern** | `New Lead: [Event Type] in [City, State]` or `New Gig Lead: [Event Type] - [Date]` or `You have a new lead!` |
| **To** | Your registered GigSalad email address |

**Subject line examples:**
- `New Lead: Wedding Reception in San Diego, CA`
- `New Gig Lead: Birthday Party - April 26, 2025`
- `You've received a new lead for Spanish Guitar`

The exact subject format has changed over the years. Your parser should not depend on the exact subject -- use the **sender domain** (`gigsalad.com`) as the primary identification signal.

### Email Body Structure

GigSalad sends **HTML emails** with a plain-text fallback (multipart/alternative MIME). The HTML version is the rich one with all fields.

#### Fields Typically Present in the Email Body

| Field | Where in email | Example |
|-------|---------------|---------|
| **Event type** | Prominent heading or bold label | "Quinceañera", "Wedding Reception", "Corporate Event" |
| **Event date** | Labeled field | "Saturday, April 26, 2025" |
| **Event time** | Labeled field | "6:00 PM - 9:00 PM" |
| **Duration** | Sometimes explicit, sometimes you calculate from time range | "3 hours" |
| **Location** | City/State (exact venue may be hidden) | "San Diego, CA" or "Estancia La Jolla, San Diego, CA" |
| **Guest count** | Labeled field | "120 guests" |
| **Budget** | Labeled field (may say "flexible" or give a range) | "$500 - $800", "Under $500", "Flexible" |
| **Genre/Category** | What the client searched for | "Spanish Guitar", "Acoustic Guitar", "Flamenco" |
| **Client's message** | Free-text paragraph | "We want something elegant and special..." |
| **Equipment needs** | Labeled field | "Not sure", "Need sound system", "Venue provides" |
| **Number of quotes** | How many performers have already quoted | "4 quotes received", "Be the first to quote!" |
| **Response link** | CTA button/link | `https://www.gigsalad.com/leads/respond/[lead-id]` or similar |

#### HTML Structure (Approximate)

GigSalad emails use a typical marketing-email HTML structure:

```html
<!-- Outer table-based layout (email standard) -->
<table width="600" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <!-- GigSalad logo -->
      <img src="https://www.gigsalad.com/images/logo.png" alt="GigSalad" />
    </td>
  </tr>
  <tr>
    <td>
      <h2>New Lead: Quinceañera in San Diego, CA</h2>
    </td>
  </tr>
  <tr>
    <td>
      <!-- Lead details as a series of labeled rows -->
      <table>
        <tr>
          <td><strong>Event Type:</strong></td>
          <td>Quinceañera</td>
        </tr>
        <tr>
          <td><strong>Date:</strong></td>
          <td>Saturday, April 26, 2025</td>
        </tr>
        <tr>
          <td><strong>Time:</strong></td>
          <td>6:00 PM – 9:00 PM</td>
        </tr>
        <tr>
          <td><strong>Location:</strong></td>
          <td>San Diego, CA</td>
        </tr>
        <tr>
          <td><strong>Guests:</strong></td>
          <td>120</td>
        </tr>
        <tr>
          <td><strong>Budget:</strong></td>
          <td>$800</td>
        </tr>
        <tr>
          <td><strong>Looking for:</strong></td>
          <td>Spanish Guitar / Flamenco</td>
        </tr>
        <tr>
          <td><strong>Equipment:</strong></td>
          <td>Not sure</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td>
      <p><strong>Message from client:</strong></p>
      <p>This is for my daughter's quinceañera. We want something elegant...</p>
    </td>
  </tr>
  <tr>
    <td>
      <p>4 other performers have already quoted on this lead.</p>
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://www.gigsalad.com/leads/respond/abc123"
         style="background-color: #ff6600; color: white; padding: 12px 24px;">
        Send a Quote
      </a>
    </td>
  </tr>
</table>
```

#### Plain-Text Fallback

The plain-text version is often a stripped-down version that looks similar to your existing example in `examples/quinceanera-lead.txt`:

```
New Lead: Quinceañera in San Diego, CA

Event Type: Quinceañera
Date: Saturday, April 26, 2025
Time: 6:00 PM – 9:00 PM
Location: San Diego, CA
Guest Count: 120
Budget: $800
Looking for: Spanish Guitar / Flamenco
Equipment: Not sure

Message from client:
This is for my daughter's quinceañera. We want something elegant and special...

4 quotes received

Respond to this lead: https://www.gigsalad.com/leads/respond/abc123
```

### Key Extraction Challenge

The main challenge is that **GigSalad can change their email template at any time**. The label text ("Event Type:" vs "Event:" vs "Type of Event:"), the HTML structure (tables vs divs), and the field ordering can all shift. Your parser needs to be resilient.

### Portal URL

The email always contains a link to respond on GigSalad's portal. This URL is critical for the Playwright sender -- it's the `portalUrl` field in your `GigSaladLead` type. Look for links containing `gigsalad.com/leads/` or `gigsalad.com` with a CTA like "Send a Quote" or "Respond Now".

---

## 2. Yelp Lead/Message Notification Emails

### How Yelp Leads Work

Yelp's lead system works differently from GigSalad. There are two main notification types:

1. **Request a Quote (RAQ)** -- A client fills out Yelp's structured form requesting a quote from your business. You get an email notification.
2. **Direct Message** -- A client messages your business directly through the Yelp messaging system. You get an email notification.

Both arrive as email notifications, but the actual conversation happens on the Yelp portal.

### Email Envelope

| Field | Expected Value |
|-------|---------------|
| **From address** | `no-reply@yelp.com` or `notifications@yelp.com` |
| **Display name** | "Yelp" or "Yelp for Business" |
| **Subject line pattern (RAQ)** | `[Client Name] requested a quote from [Your Business Name]` or `New quote request from [Client Name]` |
| **Subject line pattern (Message)** | `[Client Name] sent you a message` or `New message from [Client Name]` |
| **To** | Your Yelp-registered email address |

**Subject line examples:**
- `Maria G. requested a quote from Alex Guillen Music`
- `New quote request from David R.`
- `John S. sent you a message on Yelp`

### Email Body Structure

Yelp notification emails are **HTML-formatted** and relatively minimal. They typically contain:

| Field | Availability | Notes |
|-------|-------------|-------|
| **Client name** | Yes (first name + last initial) | "Maria G.", "David R." |
| **Client's message/request** | **Partial or truncated** | May show first ~100 characters with "Read more" link |
| **Project type** | Sometimes (RAQ only) | "Live Music", "DJ Services" |
| **Date needed** | Sometimes (RAQ only) | May be in the request details |
| **Location/Zip** | Rarely in email | Usually only on portal |
| **Budget** | Rarely in email | Usually only on portal |
| **Portal link** | Always | Link to respond on Yelp |

#### Critical Limitation: Truncated Content

**Yelp intentionally truncates the message in email notifications to drive you to their portal.** The email typically shows only a preview of the client's message (first sentence or two) with a "View and reply" or "Read more" button that links to the Yelp for Business portal.

This means:
- You **cannot reliably extract the full client message** from the email alone
- You **can** extract: client name, the request category/type, and the portal URL
- For the full message, you either need **Playwright to visit the portal** or accept the truncated version

#### Approximate HTML Structure

```html
<table width="600">
  <tr>
    <td>
      <img src="yelp-logo.png" alt="Yelp" />
    </td>
  </tr>
  <tr>
    <td>
      <h2>Maria G. requested a quote</h2>
      <p><strong>Project:</strong> Live Music for Wedding</p>
      <p>"We're looking for a guitarist for our wedding ceremony
         and cocktail hour. The ceremony will be outdoors at..."</p>
      <!-- Message is truncated here -->
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://biz.yelp.com/message/thread/[thread-id]"
         style="background-color: #d32323; color: white; padding: 12px;">
        View and Reply
      </a>
    </td>
  </tr>
</table>
```

### Strategy for Yelp Leads

Because Yelp truncates the message, your parser has two options:

**Option A: Parse what you can from the email, then use Playwright to get the full message**
1. Email parser extracts: client name, request type, portal URL
2. Before running the pipeline, Playwright visits the portal URL and scrapes the full message
3. Feed the full message to the pipeline

**Option B: Use the truncated preview + metadata**
1. Extract whatever is in the email
2. Feed that to the pipeline (may be incomplete)
3. Higher chance of "vague" classification and edge case routing

**Recommendation:** Option A is better. Your plan already has Playwright for sending replies -- use it for reading too. The parser sets `portalUrl`, and a pre-pipeline step uses Playwright to fetch the full message body from the portal page.

### Portal URL Pattern

Look for links containing:
- `biz.yelp.com/message/`
- `biz.yelp.com/leads/`
- `biz.yelp.com` with CTA text like "View and Reply", "Respond", "Reply"

---

## 3. Squarespace Form Submission Emails

### How Squarespace Form Notifications Work

When someone fills out a contact form on your Squarespace website, Squarespace sends a form submission notification email to the email address(es) you configured in the form block settings.

Unlike GigSalad and Yelp, these are **your own forms** -- you control what fields exist. This makes parsing more predictable but also means the format depends on how you set up your form.

### Email Envelope

| Field | Expected Value |
|-------|---------------|
| **From address** | `no-reply@squarespace.info` or `form-submission@squarespace.info` |
| **Display name** | "Squarespace" or your website name |
| **Reply-To** | **The client's email address** (this is critical -- Squarespace sets the Reply-To to the form submitter's email) |
| **Subject line pattern** | `Form Submission from [Your Site Name]` or `New Form Submission` or `[Form Name] - [Your Site Name]` |
| **To** | The notification email you configured in Squarespace |

**Subject line examples:**
- `Form Submission from Alex Guillen Music`
- `New submission from Contact Form`
- `Contact Form - alexguillenmusic.com`

### Email Body Structure

Squarespace form notification emails list each form field as a label-value pair. The format is clean and predictable.

#### Fields (depends on your form setup)

Since this is your own form, the fields match what you configured. A typical musician contact form might include:

| Form Field | Example Value |
|-----------|---------------|
| **Name** | "Maria Gonzalez" |
| **Email** | "maria.gonzalez@gmail.com" |
| **Phone** | "(619) 555-1234" |
| **Event Date** | "April 26, 2025" |
| **Event Type** | "Quinceañera" |
| **Venue/Location** | "Estancia La Jolla" |
| **Guest Count** | "120" |
| **Budget** | "$800" |
| **Message** | "We're looking for a Spanish guitarist for our daughter's quinceañera..." |

#### HTML Structure

Squarespace form notification emails use a simple, consistent HTML format:

```html
<table>
  <tr>
    <td style="padding: 10px; border-bottom: 1px solid #eee;">
      <p style="color: #999; margin: 0;">Name</p>
      <p style="margin: 0;">Maria Gonzalez</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 10px; border-bottom: 1px solid #eee;">
      <p style="color: #999; margin: 0;">Email</p>
      <p style="margin: 0;">maria.gonzalez@gmail.com</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 10px; border-bottom: 1px solid #eee;">
      <p style="color: #999; margin: 0;">Event Date</p>
      <p style="margin: 0;">April 26, 2025</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 10px; border-bottom: 1px solid #eee;">
      <p style="color: #999; margin: 0;">Message</p>
      <p style="margin: 0;">We're looking for a Spanish guitarist for our
         daughter's quinceañera. We want something elegant...</p>
    </td>
  </tr>
</table>

<p style="color: #999; font-size: 12px;">
  Sent via your Squarespace website form - alexguillenmusic.com
</p>
```

#### Plain-Text Fallback

```
Name: Maria Gonzalez
Email: maria.gonzalez@gmail.com
Phone: (619) 555-1234
Event Date: April 26, 2025
Event Type: Quinceañera
Venue: Estancia La Jolla
Guest Count: 120
Budget: $800
Message: We're looking for a Spanish guitarist for our daughter's quinceañera...

---
Sent via alexguillenmusic.com
```

### Extracting the Client's Email

The client's email can be found in **two places**:

1. **Reply-To header** -- Squarespace sets this to the form submitter's email. This is the most reliable source.
2. **Email body** -- If your form has an "Email" field, the address appears in the body content too.

**Use the Reply-To header first**, fall back to parsing the body for an email field.

### Key Advantage

Squarespace leads are the **easiest to parse** because:
- You control the form fields (they don't change unexpectedly)
- The format is simple label-value pairs
- The client's email is in the Reply-To header
- The full message is in the email (not truncated)
- Reply goes via Gmail API (no portal automation needed)

---

## 4. Email Parsing Techniques in TypeScript

### 4.1 Getting the Email Body from Gmail API

The Gmail API returns messages in a specific format. The body is base64url-encoded and may be split across multiple MIME parts.

#### Gmail API Message Structure

When you call `gmail.users.messages.get()`, you get back an object like:

```typescript
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string; // First ~100 chars of the message (plain text, truncated)
  payload: {
    mimeType: string; // "multipart/alternative", "text/html", "text/plain"
    headers: Array<{ name: string; value: string }>;
    body: {
      size: number;
      data?: string; // base64url-encoded body (only present if not multipart)
    };
    parts?: GmailMessagePart[]; // Present if multipart
  };
}

interface GmailMessagePart {
  mimeType: string;
  headers: Array<{ name: string; value: string }>;
  body: {
    size: number;
    data?: string; // base64url-encoded content
  };
  parts?: GmailMessagePart[]; // Can be nested (multipart within multipart)
}
```

#### Decoding Base64url Bodies

Gmail uses **base64url** encoding (not standard base64). The difference:
- `+` is replaced with `-`
- `/` is replaced with `_`
- No `=` padding

```typescript
/**
 * Decode a Gmail base64url-encoded string to UTF-8 text.
 *
 * Why Buffer.from works: Node's "base64url" encoding handles
 * the dash/underscore variants and missing padding automatically.
 */
function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf-8");
}
```

**Note for beginners:** `Buffer` is a Node.js built-in -- no install needed. The `"base64url"` encoding option was added in Node 15.7+ and handles the URL-safe alphabet automatically.

#### Extracting the Body from Multipart Messages

Most emails are `multipart/alternative` with two parts: `text/plain` and `text/html`. Some are `multipart/mixed` (has attachments) wrapping a `multipart/alternative`.

```typescript
/**
 * Recursively find a MIME part by type.
 *
 * Strategy: look for text/html first (more structured, easier to parse).
 * Fall back to text/plain if no HTML part exists.
 */
function findPart(
  payload: GmailMessagePart,
  mimeType: string
): GmailMessagePart | null {
  // Direct match -- the payload itself is the type we want
  if (payload.mimeType === mimeType && payload.body?.data) {
    return payload;
  }

  // Recurse into sub-parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const found = findPart(part, mimeType);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Get the decoded email body as a string.
 * Prefers HTML, falls back to plain text.
 */
function getEmailBody(message: GmailMessage): {
  body: string;
  isHtml: boolean;
} {
  const payload = message.payload;

  // Case 1: Simple message (not multipart) -- body is directly on payload
  if (payload.body?.data) {
    return {
      body: decodeBase64Url(payload.body.data),
      isHtml: payload.mimeType === "text/html",
    };
  }

  // Case 2: Multipart -- look for HTML first, then plain text
  const htmlPart = findPart(payload, "text/html");
  if (htmlPart?.body?.data) {
    return {
      body: decodeBase64Url(htmlPart.body.data),
      isHtml: true,
    };
  }

  const textPart = findPart(payload, "text/plain");
  if (textPart?.body?.data) {
    return {
      body: decodeBase64Url(textPart.body.data),
      isHtml: false,
    };
  }

  // Case 3: No body found (rare -- attachment-only emails)
  return { body: "", isHtml: false };
}
```

#### Extracting Headers

```typescript
/**
 * Get a specific header value from a Gmail message.
 * Header names are case-insensitive in email spec, but Gmail
 * usually returns them with standard casing.
 */
function getHeader(message: GmailMessage, name: string): string | undefined {
  const header = message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value;
}

// Usage:
const from = getHeader(message, "From");       // "GigSalad <leads@gigsalad.com>"
const subject = getHeader(message, "Subject");  // "New Lead: Wedding in San Diego, CA"
const replyTo = getHeader(message, "Reply-To"); // "maria@gmail.com" (Squarespace)
```

### 4.2 HTML Parsing: cheerio vs Regex vs Plain Text

You have three approaches. Here is when to use each:

#### Approach 1: cheerio (Recommended for HTML emails)

**What it is:** cheerio is a jQuery-like library for parsing HTML in Node.js. It does NOT run a browser -- it just parses the HTML string into a DOM you can query.

**Install:** `npm install cheerio` and `npm install -D @types/cheerio`

```typescript
import * as cheerio from "cheerio";

function parseHtmlEmail(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};

  // Strategy: find bold/strong labels followed by values
  // This works for GigSalad and Squarespace's table-based layouts
  $("td").each((_, el) => {
    const text = $(el).text().trim();

    // Look for "Label: Value" patterns
    const match = text.match(/^(.+?):\s*(.+)$/s);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      fields[key] = value;
    }
  });

  // Also check for label/value in separate elements
  $("strong, b").each((_, el) => {
    const label = $(el).text().trim().replace(/:$/, "").toLowerCase();
    const value = $(el).parent().text().replace($(el).text(), "").trim();
    if (label && value) {
      fields[label] = value;
    }
  });

  return fields;
}
```

**Pros:** Handles malformed HTML, fast, familiar jQuery API, no browser needed.
**Cons:** Adds a dependency (~1MB).

#### Approach 2: Plain Text Extraction (Simpler, Good for text/plain parts)

If the email has a plain text part, parsing is much simpler -- just regex on `Label: Value` lines:

```typescript
function parsePlainTextEmail(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = text.split("\n");

  for (const line of lines) {
    // Match lines like "Event Type: Quinceañera"
    const match = line.match(/^([A-Za-z\s]+?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      fields[key] = value;
    }
  }

  return fields;
}
```

**Pros:** Zero dependencies, very simple.
**Cons:** Only works on plain text emails; doesn't handle multi-line values well.

#### Approach 3: HTML-to-Text then Regex (Hybrid)

Strip all HTML to get clean text, then parse that:

```typescript
/**
 * Rough HTML-to-text conversion without any dependencies.
 * For production, use cheerio's $.text() or the 'html-to-text' npm package.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")       // <br> → newline
    .replace(/<\/p>/gi, "\n\n")           // </p> → double newline
    .replace(/<\/tr>/gi, "\n")            // </tr> → newline (table rows)
    .replace(/<\/td>/gi, "\t")            // </td> → tab (table cells)
    .replace(/<[^>]+>/g, "")              // Strip all remaining tags
    .replace(/&nbsp;/g, " ")              // Common HTML entity
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")              // Numeric entities (crude)
    .replace(/\n{3,}/g, "\n\n")          // Collapse excessive newlines
    .trim();
}
```

**Recommendation for this project:** Use **cheerio for HTML parsing** (GigSalad, Yelp) and **plain-text regex for Squarespace** (since the plain-text version is clean and structured). Always try the plain-text MIME part first; fall back to HTML parsing.

### 4.3 Handling Multipart MIME Messages

Email can be nested:

```
multipart/mixed                    ← top level (has attachments)
  ├── multipart/alternative        ← the message body
  │     ├── text/plain             ← plain text version
  │     └── text/html              ← HTML version
  └── application/pdf              ← attachment (ignore)
```

The `findPart()` function above handles this recursion. Key rules:
- Always recurse into `parts` arrays
- Prefer `text/html` (more information) over `text/plain`
- Ignore attachment parts (`application/*`, `image/*`)

### 4.4 Common Encoding Issues

#### Quoted-Printable Encoding

Some emails use `Content-Transfer-Encoding: quoted-printable` instead of base64. In quoted-printable:
- `=` followed by two hex digits is an encoded byte: `=C3=B1` = `n` with tilde
- `=\n` (soft line break) means the line continues on the next line
- Lines are wrapped at 76 characters

Gmail API usually gives you base64url-encoded bodies regardless of original encoding, so you may not encounter this. But if you get raw email content:

```typescript
/**
 * Decode quoted-printable encoding to a regular string.
 * You probably won't need this with Gmail API (it decodes for you),
 * but it's here as a safety net.
 */
function decodeQuotedPrintable(input: string): string {
  return input
    // Remove soft line breaks (= at end of line)
    .replace(/=\r?\n/g, "")
    // Decode =XX hex sequences
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}
```

#### UTF-8 and Special Characters

Lead emails often contain special characters:
- Spanish names: Quinceañera, Jose, Maria
- Em dashes: `--` vs `—` vs `–`
- Curly quotes: `"` `"` `'` `'`
- Currency: `$`, `€`

The `decodeBase64Url` function using `"utf-8"` handles all of these correctly. The main risk is when HTML entities are used instead of raw characters:

```typescript
// After getting the HTML text via cheerio, entities are auto-decoded.
// If doing raw regex on HTML, you may see:
// "Quincea&ntilde;era" instead of "Quinceañera"
// "&#8211;" instead of "–"
//
// cheerio handles entity decoding automatically.
// If parsing plain text, entities shouldn't appear.
```

---

## 5. Defensive Parsing Strategies

### 5.1 Why Defensiveness Matters

Your plan's Feed-Forward risk says it best: *"Each platform can change their notification email format at any time."* A format change shouldn't crash your system or produce garbage quotes. It should gracefully degrade to an SMS notification.

### 5.2 Confidence Scoring

Add a `parseConfidence` field to every `ParsedLead`. This tells the router whether to trust the parsed data.

```typescript
type ParseConfidence = "high" | "medium" | "low";

interface ParsedLeadBase {
  rawText: string;
  clientName?: string;
  eventDate?: string;
  gmailMessageId: string;
  parseConfidence: ParseConfidence; // NEW
  parseWarnings: string[];          // NEW — what went wrong
}
```

#### How to Score Confidence

```typescript
function scoreConfidence(fields: Record<string, string | undefined>): {
  confidence: ParseConfidence;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Required fields — without these, we can't generate a good quote
  if (!fields.eventType) warnings.push("Missing event type");
  if (!fields.message || fields.message.length < 20)
    warnings.push("Missing or very short client message");

  // Important fields — we can work without them but quality drops
  if (!fields.eventDate) warnings.push("Missing event date");
  if (!fields.budget) warnings.push("Missing budget");
  if (!fields.location) warnings.push("Missing location");

  // Score based on warning count
  if (warnings.length === 0) return { confidence: "high", warnings };
  if (warnings.length <= 2) return { confidence: "medium", warnings };
  return { confidence: "low", warnings };
}
```

#### Router Integration

In the edge case router, add:

```typescript
// Low confidence = always hold for review
if (lead.parseConfidence === "low") {
  return {
    action: "hold",
    lead,
    pipelineOutput,
    reasons: [`Low parse confidence: ${lead.parseWarnings.join(", ")}`],
  };
}
```

### 5.3 Never Crash on Bad Input

Every parser function should be wrapped in a try-catch that returns a degraded result instead of throwing:

```typescript
function parseGigSaladEmail(html: string, messageId: string): GigSaladLead | null {
  try {
    // ... parsing logic ...

    // If we couldn't even extract rawText, return null (not a GigSalad lead)
    if (!rawText || rawText.length < 10) {
      console.warn(`[gigsalad-parser] Could not extract lead text from ${messageId}`);
      return null;
    }

    return {
      platform: "gigsalad",
      rawText,
      clientName,
      eventDate,
      gmailMessageId: messageId,
      portalUrl: portalUrl || "", // empty string, not undefined
      parseConfidence: confidence,
      parseWarnings: warnings,
    };
  } catch (error) {
    console.error(`[gigsalad-parser] Crash parsing ${messageId}:`, error);
    return null; // Parser crashed — caller will send SMS fallback
  }
}
```

### 5.4 Detecting Format Changes

Log a warning when your parser encounters unexpected HTML structure:

```typescript
// In your GigSalad parser, after extracting fields:
const expectedLabels = ["event type", "date", "time", "location", "budget", "guest"];
const foundLabels = Object.keys(fields);
const missingLabels = expectedLabels.filter(
  (label) => !foundLabels.some((f) => f.includes(label))
);

if (missingLabels.length > 2) {
  console.warn(
    `[gigsalad-parser] Template may have changed. Missing: ${missingLabels.join(", ")}. ` +
    `Found labels: ${foundLabels.join(", ")}`
  );
  // This warning in your JSONL log will help you debug template changes
}
```

### 5.5 Fallback Chain

When things go wrong, the system should degrade gracefully:

```
Parse email → Success
                │
                ├── High confidence → Run pipeline → Auto-send (if gates pass)
                ├── Medium confidence → Run pipeline → Hold for review via SMS
                └── Low confidence → Skip pipeline → SMS with raw email subject

Parse email → Returns null (can't parse at all)
                └── SMS: "Unknown lead format from [sender]. Subject: [subject]"

Parse email → Throws exception (crash)
                └── Caught by orchestrator → SMS: "Parser crashed on message [id]"
```

### 5.6 Snapshot Testing for Format Stability

Save real email examples and write tests against them. When a format changes, the test fails and you know exactly what broke:

```typescript
// __tests__/parsers/gigsalad.test.ts
import { readFileSync } from "fs";
import { parseGigSaladEmail } from "../src/automation/parsers/gigsalad";

test("parses real GigSalad lead email from 2025-04", () => {
  const html = readFileSync("examples/emails/gigsalad-2025-04-quinceanera.html", "utf-8");
  const result = parseGigSaladEmail(html, "test-id");

  expect(result).not.toBeNull();
  expect(result!.platform).toBe("gigsalad");
  expect(result!.parseConfidence).toBe("high");
  expect(result!.rawText).toContain("quinceañera");
  expect(result!.portalUrl).toMatch(/gigsalad\.com/);
});
```

---

## 6. Concrete TypeScript Code Examples

### 6.1 Platform Router (identifies which platform sent the email)

```typescript
// src/automation/parsers/index.ts
import { parseGigSaladEmail } from "./gigsalad.js";
import { parseYelpEmail } from "./yelp.js";
import { parseSquarespaceEmail } from "./squarespace.js";
import type { ParsedLead } from "../types.js";

/**
 * Identify which platform sent the email and route to the correct parser.
 *
 * Uses the From header's domain as the primary signal.
 * Subject line is a secondary signal (in case domains change).
 */
export function parseLeadEmail(
  from: string,
  subject: string,
  replyTo: string | undefined,
  htmlBody: string,
  textBody: string,
  messageId: string
): ParsedLead | null {
  const fromLower = from.toLowerCase();

  if (fromLower.includes("gigsalad.com")) {
    return parseGigSaladEmail(htmlBody || textBody, messageId);
  }

  if (fromLower.includes("yelp.com")) {
    return parseYelpEmail(htmlBody || textBody, messageId);
  }

  if (
    fromLower.includes("squarespace.info") ||
    fromLower.includes("squarespace.com")
  ) {
    return parseSquarespaceEmail(htmlBody, textBody, replyTo, messageId);
  }

  // Unknown sender — not a lead email we recognize
  return null;
}
```

### 6.2 GigSalad Parser

```typescript
// src/automation/parsers/gigsalad.ts
import * as cheerio from "cheerio";
import type { GigSaladLead } from "../types.js";

// Labels that GigSalad might use (check multiple variations)
const LABEL_MAP: Record<string, string[]> = {
  eventType: ["event type", "event", "type of event", "occasion"],
  date: ["date", "event date", "when"],
  time: ["time", "event time", "start time"],
  location: ["location", "city", "venue", "where"],
  guestCount: ["guest count", "guests", "number of guests", "attendees"],
  budget: ["budget", "price range", "willing to spend"],
  genre: ["looking for", "genre", "category", "type of music", "service"],
  equipment: ["equipment", "sound", "sound system"],
  message: ["message", "additional notes", "notes", "details", "message from client"],
};

/**
 * Try to match a found label against our known label map.
 * Returns the canonical field name, or null if no match.
 */
function matchLabel(foundLabel: string): string | null {
  const normalized = foundLabel.toLowerCase().replace(/[:\s]+$/, "").trim();
  for (const [canonical, variants] of Object.entries(LABEL_MAP)) {
    if (variants.some((v) => normalized.includes(v))) {
      return canonical;
    }
  }
  return null;
}

export function parseGigSaladEmail(
  body: string,
  messageId: string
): GigSaladLead | null {
  try {
    const $ = cheerio.load(body);
    const fields: Record<string, string> = {};

    // Strategy 1: Look for label:value patterns in table cells
    $("td, th, p, div, span").each((_, el) => {
      const text = $(el).text().trim();
      if (!text || text.length > 500) return; // Skip empty or huge blocks

      // Check for "Label: Value" on a single element
      const colonMatch = text.match(/^([^:]{2,40}):\s*(.+)$/s);
      if (colonMatch) {
        const canonical = matchLabel(colonMatch[1]);
        if (canonical && !fields[canonical]) {
          fields[canonical] = colonMatch[2].trim();
        }
      }
    });

    // Strategy 2: Look for bold labels followed by text in next sibling/parent
    $("strong, b").each((_, el) => {
      const labelText = $(el).text().trim();
      const canonical = matchLabel(labelText);
      if (!canonical || fields[canonical]) return;

      // Value might be in a sibling element or the parent's remaining text
      const parent = $(el).parent();
      const fullText = parent.text().trim();
      const value = fullText.replace(labelText, "").replace(/^[\s:]+/, "").trim();
      if (value) {
        fields[canonical] = value;
      }
    });

    // Extract portal URL — look for links to gigsalad.com
    let portalUrl = "";
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("gigsalad.com") && (
        href.includes("/lead") ||
        href.includes("/respond") ||
        href.includes("/quote")
      )) {
        portalUrl = href;
      }
    });

    // Extract quote count — look for text mentioning other quotes
    let quoteCount = 0;
    const allText = $.text();
    const quoteMatch = allText.match(/(\d+)\s*(?:other\s+)?(?:quotes?|performers?)\s*(?:received|already|have)/i);
    if (quoteMatch) {
      quoteCount = parseInt(quoteMatch[1], 10);
    }

    // Build rawText in the format the existing pipeline expects
    // (matches examples/quinceanera-lead.txt structure)
    const rawTextParts: string[] = [];
    if (fields.eventType) rawTextParts.push(`Event Type: ${fields.eventType}`);
    if (fields.date) rawTextParts.push(`Date: ${fields.date}`);
    if (fields.time) rawTextParts.push(`Time: ${fields.time}`);
    if (fields.location) rawTextParts.push(`Location: ${fields.location}`);
    if (fields.guestCount) rawTextParts.push(`Guest Count: ${fields.guestCount}`);
    if (fields.budget) rawTextParts.push(`Budget: ${fields.budget}`);
    if (fields.genre) rawTextParts.push(`Genre Request: ${fields.genre}`);
    if (fields.equipment) rawTextParts.push(`Equipment: ${fields.equipment}`);
    if (fields.message) rawTextParts.push(`Additional Notes: ${fields.message}`);
    rawTextParts.push(`Lead Source: GigSalad`);
    if (quoteCount > 0) rawTextParts.push(`Quotes received: ${quoteCount}`);

    const rawText = rawTextParts.join("\n");

    // Confidence scoring
    const warnings: string[] = [];
    if (!fields.eventType) warnings.push("Missing event type");
    if (!fields.date) warnings.push("Missing date");
    if (!fields.message || fields.message.length < 10) warnings.push("Missing/short message");
    if (!fields.budget) warnings.push("Missing budget");
    if (!portalUrl) warnings.push("Missing portal URL");

    const parseConfidence =
      warnings.length === 0 ? "high" :
      warnings.length <= 2 ? "medium" : "low";

    if (rawText.length < 20) {
      console.warn(`[gigsalad-parser] Extracted text too short for ${messageId}`);
      return null;
    }

    return {
      platform: "gigsalad",
      rawText,
      clientName: undefined, // GigSalad doesn't reveal client name until you respond
      eventDate: fields.date,
      gmailMessageId: messageId,
      portalUrl,
      parseConfidence,
      parseWarnings: warnings,
    };
  } catch (error) {
    console.error(`[gigsalad-parser] Crash on ${messageId}:`, error);
    return null;
  }
}
```

### 6.3 Yelp Parser

```typescript
// src/automation/parsers/yelp.ts
import * as cheerio from "cheerio";
import type { YelpLead } from "../types.js";

export function parseYelpEmail(
  body: string,
  messageId: string
): YelpLead | null {
  try {
    const $ = cheerio.load(body);

    // Extract client name from subject-like heading or prominent text
    // Yelp usually has "Maria G. requested a quote" or similar
    let clientName: string | undefined;
    const headingText = $("h1, h2, h3").first().text().trim();
    const nameMatch = headingText.match(/^(.+?)\s+(?:requested|sent|has)/i);
    if (nameMatch) {
      clientName = nameMatch[1].trim();
    }

    // Extract the message preview (usually truncated)
    // Yelp often puts the message in a blockquote or a styled paragraph
    let messagePreview = "";
    // Look for quoted content
    $("blockquote, .message-preview, [class*='message']").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > messagePreview.length) {
        messagePreview = text;
      }
    });

    // Fallback: look for any paragraph that looks like a client message
    // (longer than 30 chars, not a button or link text)
    if (!messagePreview) {
      $("p, td").each((_, el) => {
        const text = $(el).text().trim();
        if (
          text.length > 30 &&
          !text.includes("View and Reply") &&
          !text.includes("Respond") &&
          !text.includes("Yelp") &&
          text.length > messagePreview.length
        ) {
          messagePreview = text;
        }
      });
    }

    // Extract project type if present
    let projectType = "";
    const allText = $.text();
    const projectMatch = allText.match(/(?:Project|Service|Category):\s*(.+?)(?:\n|$)/i);
    if (projectMatch) {
      projectType = projectMatch[1].trim();
    }

    // Extract portal URL
    let portalUrl = "";
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (
        href.includes("biz.yelp.com") ||
        (href.includes("yelp.com") && (
          href.includes("/message") ||
          href.includes("/lead") ||
          href.includes("/biz_rfi")
        ))
      ) {
        portalUrl = href;
      }
    });

    // Build rawText — note: this will be incomplete for Yelp
    // The orchestrator should use Playwright to get the full message
    const rawTextParts: string[] = [];
    if (projectType) rawTextParts.push(`Event Type: ${projectType}`);
    if (messagePreview) rawTextParts.push(`Additional Notes: ${messagePreview}`);
    rawTextParts.push("Lead Source: Yelp");

    const rawText = rawTextParts.join("\n");

    // Confidence — Yelp emails are inherently lower confidence
    // because the message is truncated
    const warnings: string[] = ["Yelp truncates messages in email notifications"];
    if (!messagePreview) warnings.push("No message preview found");
    if (!portalUrl) warnings.push("Missing portal URL");
    if (!clientName) warnings.push("Could not extract client name");

    const parseConfidence =
      warnings.length <= 1 ? "medium" : "low";

    return {
      platform: "yelp",
      rawText,
      clientName,
      eventDate: undefined, // Rarely available in Yelp email notifications
      gmailMessageId: messageId,
      portalUrl,
      parseConfidence,
      parseWarnings: warnings,
    };
  } catch (error) {
    console.error(`[yelp-parser] Crash on ${messageId}:`, error);
    return null;
  }
}
```

### 6.4 Squarespace Parser

```typescript
// src/automation/parsers/squarespace.ts
import * as cheerio from "cheerio";
import type { SquarespaceLead } from "../types.js";

/**
 * Parse a Squarespace form submission notification email.
 *
 * This is the easiest parser because:
 * 1. You control the form fields (they don't change unexpectedly)
 * 2. The format is simple label-value pairs
 * 3. The full message is present (not truncated)
 * 4. Client email is in the Reply-To header
 */
export function parseSquarespaceEmail(
  htmlBody: string,
  textBody: string,
  replyTo: string | undefined,
  messageId: string
): SquarespaceLead | null {
  try {
    const fields: Record<string, string> = {};

    // Prefer plain text — it's simpler and more reliable
    if (textBody) {
      const lines = textBody.split("\n");
      for (const line of lines) {
        const match = line.match(/^([A-Za-z\s]+?):\s*(.+)$/);
        if (match) {
          fields[match[1].trim().toLowerCase()] = match[2].trim();
        }
      }
    }

    // Fall back to HTML parsing if plain text didn't yield results
    if (Object.keys(fields).length < 2 && htmlBody) {
      const $ = cheerio.load(htmlBody);

      // Squarespace uses a pattern where label is in a gray <p>
      // and value is in the next <p> or in the same <td>
      $("td").each((_, el) => {
        const paragraphs = $(el).find("p");
        if (paragraphs.length >= 2) {
          // First <p> is the label (usually gray/muted), second is the value
          const label = paragraphs.eq(0).text().trim().toLowerCase();
          const value = paragraphs.eq(1).text().trim();
          if (label && value && label.length < 50) {
            fields[label] = value;
          }
        }
      });

      // Fallback: look for label:value in any text
      $("p, td, div").each((_, el) => {
        const text = $(el).text().trim();
        const match = text.match(/^([A-Za-z\s]{2,30}):\s*(.+)$/s);
        if (match) {
          const key = match[1].trim().toLowerCase();
          if (!fields[key]) {
            fields[key] = match[2].trim();
          }
        }
      });
    }

    // Extract client email — three sources, in priority order:
    // 1. Reply-To header (most reliable)
    // 2. "email" field in the form
    // 3. Any email address found in the body
    let clientEmail = "";

    if (replyTo && replyTo.includes("@") && !replyTo.includes("squarespace")) {
      // Clean up Reply-To — might be "Maria Gonzalez <maria@gmail.com>"
      const emailMatch = replyTo.match(/<(.+?)>/) || replyTo.match(/([^\s<>]+@[^\s<>]+)/);
      clientEmail = emailMatch ? emailMatch[1] : replyTo;
    }

    if (!clientEmail && fields.email) {
      clientEmail = fields.email;
    }

    if (!clientEmail) {
      // Last resort: find any email in the body
      const bodyText = textBody || htmlBody || "";
      const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch && !emailMatch[0].includes("squarespace")) {
        clientEmail = emailMatch[0];
      }
    }

    // Build rawText matching the pipeline's expected format
    const rawTextParts: string[] = [];

    // Map common Squarespace form field names to pipeline field names
    const nameField = fields.name || fields["full name"] || fields["your name"];
    const eventTypeField = fields["event type"] || fields.event || fields.occasion;
    const dateField = fields["event date"] || fields.date || fields.when;
    const locationField = fields.venue || fields.location || fields.where;
    const guestField = fields["guest count"] || fields.guests || fields["number of guests"];
    const budgetField = fields.budget || fields["price range"];
    const messageField = fields.message || fields.details || fields["additional notes"] ||
      fields["tell us about your event"] || fields.comments;

    if (eventTypeField) rawTextParts.push(`Event Type: ${eventTypeField}`);
    if (dateField) rawTextParts.push(`Date: ${dateField}`);
    if (locationField) rawTextParts.push(`Location: ${locationField}`);
    if (guestField) rawTextParts.push(`Guest Count: ${guestField}`);
    if (budgetField) rawTextParts.push(`Budget: ${budgetField}`);
    if (messageField) rawTextParts.push(`Additional Notes: ${messageField}`);
    rawTextParts.push("Lead Source: Squarespace");

    const rawText = rawTextParts.join("\n");

    // Confidence scoring
    const warnings: string[] = [];
    if (!clientEmail) warnings.push("Could not extract client email");
    if (!messageField || messageField.length < 10) warnings.push("Missing/short message");
    if (!eventTypeField && !messageField) warnings.push("No event details found");

    const parseConfidence =
      warnings.length === 0 ? "high" :
      warnings.length <= 1 ? "medium" : "low";

    if (!clientEmail && rawText.length < 20) {
      console.warn(`[squarespace-parser] No email and no content for ${messageId}`);
      return null;
    }

    return {
      platform: "squarespace",
      rawText,
      clientName: nameField,
      eventDate: dateField,
      gmailMessageId: messageId,
      clientEmail,
      parseConfidence,
      parseWarnings: warnings,
    };
  } catch (error) {
    console.error(`[squarespace-parser] Crash on ${messageId}:`, error);
    return null;
  }
}
```

### 6.5 Full Gmail Body Extraction Utility

```typescript
// src/automation/gmail-body.ts
// Pulls together all the MIME handling into one clean utility.

import type { gmail_v1 } from "googleapis";

type GmailMessage = gmail_v1.Schema$Message;
type MessagePart = gmail_v1.Schema$MessagePart;

/**
 * Decode Gmail's base64url encoding to a UTF-8 string.
 */
function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf-8");
}

/**
 * Recursively find a MIME part matching the given type.
 */
function findPart(part: MessagePart, mimeType: string): MessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return part;
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findPart(child, mimeType);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get a header value from a Gmail message (case-insensitive).
 */
export function getHeader(msg: GmailMessage, name: string): string | undefined {
  return msg.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  )?.value ?? undefined;
}

export interface EmailContent {
  from: string;
  subject: string;
  replyTo: string | undefined;
  htmlBody: string;
  textBody: string;
  messageId: string;
}

/**
 * Extract everything you need from a Gmail API message object.
 *
 * Call gmail.users.messages.get({ userId: "me", id: msgId, format: "full" })
 * and pass the result here.
 */
export function extractEmailContent(msg: GmailMessage): EmailContent {
  const payload = msg.payload;
  if (!payload) {
    return {
      from: "",
      subject: "",
      replyTo: undefined,
      htmlBody: "",
      textBody: "",
      messageId: msg.id || "",
    };
  }

  // Extract headers
  const from = getHeader(msg, "From") || "";
  const subject = getHeader(msg, "Subject") || "";
  const replyTo = getHeader(msg, "Reply-To");

  // Extract bodies
  let htmlBody = "";
  let textBody = "";

  // Case 1: Non-multipart — body is directly on payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      htmlBody = decoded;
    } else {
      textBody = decoded;
    }
  }

  // Case 2: Multipart — search for parts
  if (payload.parts) {
    const htmlPart = findPart(payload as MessagePart, "text/html");
    if (htmlPart?.body?.data) {
      htmlBody = decodeBase64Url(htmlPart.body.data);
    }

    const textPart = findPart(payload as MessagePart, "text/plain");
    if (textPart?.body?.data) {
      textBody = decodeBase64Url(textPart.body.data);
    }
  }

  return {
    from,
    subject,
    replyTo,
    htmlBody,
    textBody,
    messageId: msg.id || "",
  };
}
```

---

## 7. Action Items Before Writing Parsers

These are **mandatory** steps before implementing real parsers. Do not skip them.

### Step 1: Capture Real Emails

Save 2-3 real notification emails from each platform. You can do this manually:

1. **In Gmail web UI:** Open a GigSalad lead email, click the three dots menu, select "Show original". Copy the full raw email and save it.
2. **Or via Gmail API:** Use `gmail.users.messages.get({ userId: "me", id: msgId, format: "raw" })` to get the full MIME message.

Save to:
```
examples/emails/
  gigsalad-lead-1.html        # Just the HTML body (extracted from the email)
  gigsalad-lead-1-raw.json    # Full Gmail API response (for testing MIME handling)
  yelp-lead-1.html
  yelp-lead-1-raw.json
  squarespace-form-1.html
  squarespace-form-1-raw.json
```

**Strip personal information** (client names, emails, phone numbers) from checked-in examples. Keep the structure intact.

### Step 2: Verify Assumptions Against Real Emails

For each platform, check:
- [ ] Is the sender address what we expected?
- [ ] Is the subject line pattern what we expected?
- [ ] Is the body HTML or plain text? Both?
- [ ] Are all the expected fields present?
- [ ] What labels/headings are used for each field?
- [ ] Where is the portal URL / CTA link?
- [ ] For Yelp: how much of the message is actually visible in the email?
- [ ] For Squarespace: is the client email in the Reply-To header?

### Step 3: Update This Document

After capturing real emails, come back and update the HTML structure examples in sections 1-3 with the **actual** HTML from your inbox. This turns the research doc from "educated guesses" into "verified truth."

### Step 4: Write Snapshot Tests

For each saved email, write a test that parses it and checks the extracted fields. These tests will break when platform formats change -- that's the point. A broken test is better than silently wrong output.

---

## Key Reference URLs

These are useful pages to consult during implementation:

- **GigSalad Help Center:** https://support.gigsalad.com/hc/en-us
- **Yelp for Business Support:** https://biz.yelp.com/support
- **Squarespace Form Notifications:** https://support.squarespace.com/hc/en-us/articles/206544687-Form-block-notification-emails
- **Gmail API Messages.get:** https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get
- **Gmail API Message Format:** https://developers.google.com/gmail/api/guides/message-format
- **cheerio Documentation:** https://cheerio.js.org/docs/intro
- **Node.js Buffer (base64url):** https://nodejs.org/api/buffer.html#buffers-and-character-encodings

---

## Summary Table

| Platform | Sender Domain | Full Message in Email? | Client Email Available? | Reply Mechanism | Parser Difficulty |
|----------|--------------|----------------------|----------------------|----------------|------------------|
| GigSalad | `gigsalad.com` | Yes | No (anonymous until you respond) | Playwright portal | Medium |
| Yelp | `yelp.com` | **No (truncated)** | No | Playwright portal | Hard |
| Squarespace | `squarespace.info` | Yes | **Yes (Reply-To header)** | Gmail API direct email | Easy |
