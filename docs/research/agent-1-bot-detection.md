---
title: "Bot Detection & Playwright Strategy: The Bash and GigSalad"
date: 2026-02-20
agent: 1
source: training-knowledge
disclaimer: >
  This document is written entirely from training knowledge (cutoff ~early 2025).
  Claims marked "(unverified)" are informed assessments but have not been confirmed
  against the live sites. Verify all claims before acting on them.
---

# Bot Detection & Playwright Strategy Research

## Table of Contents

1. [Bot Detection Systems](#1-bot-detection-systems)
2. [Playwright Stealth Configurations](#2-playwright-stealth-configurations)
3. [Session Duration & Cookie Behavior](#3-session-duration--cookie-behavior)
4. [Account Suspension Risk](#4-account-suspension-risk)
5. [Terms of Service Analysis](#5-terms-of-service-analysis)
6. [Playwright Best Practices for This Use Case](#6-playwright-best-practices-for-this-use-case)
7. [Risk Assessment](#7-risk-assessment)
8. [Recommended Playwright Configuration](#8-recommended-playwright-configuration)
9. [Go/No-Go Framework](#9-gono-go-framework)
10. [Confidence Levels](#10-confidence-levels)

---

## 1. Bot Detection Systems

### The Bash (thebash.com)

**Best assessment:** The Bash is a mid-size vendor marketplace (formerly GigMasters, rebranded ~2019). Platforms of this scale typically use **moderate** bot detection.

- **Cloudflare:** Likely uses Cloudflare or a similar CDN/WAF for basic protection (unverified). Most mid-tier marketplaces adopted Cloudflare between 2020-2023 because it is cheap and effective at blocking commodity bots.
- **CAPTCHA:** Likely uses reCAPTCHA v2 or v3 on login and form submission pages (unverified). Google reCAPTCHA is the most common choice for marketplaces in this size range.
- **Custom rate limiting:** Probably has server-side rate limits on API endpoints and form submissions (unverified), but these are typically generous (designed for humans clicking around, not strict anti-scraping).
- **No enterprise-grade bot detection:** Unlikely to use PerimeterX (now HUMAN), DataDome, or Akamai Bot Manager (unverified). These cost $50K-$200K+/year and are typically reserved for high-traffic e-commerce (Amazon, Nike, Ticketmaster). A music gig marketplace does not face the same scraping pressure.
- **JavaScript fingerprinting:** May run basic browser fingerprinting through Cloudflare's bot management (unverified), which checks `navigator.webdriver`, canvas fingerprinting, and WebGL hashes.
- **Token-based lead links:** The Bash sends email notifications with unique token URLs when a new lead arrives. These tokens are likely single-use or time-limited (unverified). This is itself a form of access control -- the token proves you received the email.

### GigSalad (gigsalad.com)

**Best assessment:** GigSalad is a comparable mid-size vendor marketplace for entertainers/musicians. Similar detection profile to The Bash.

- **Cloudflare or similar WAF:** Likely present (unverified). GigSalad has been around since ~2007 and serves a similar market size.
- **CAPTCHA:** Likely uses reCAPTCHA on login and quote submission forms (unverified).
- **Rate limiting:** Standard server-side rate limits expected (unverified).
- **No enterprise bot detection:** Same reasoning as The Bash -- the economics don't justify PerimeterX/DataDome/Akamai for a gig marketplace (unverified).
- **Session-based protection:** GigSalad likely relies on standard session cookies and CSRF tokens for form submissions (unverified).

### What Similar Platforms Typically Use (General Pattern)

Marketplaces in the "mid-tier" category (Thumbtack, Bark, HomeAdvisor vendor side) generally deploy:

| Layer | Common Choice | Enterprise Choice |
|-------|--------------|-------------------|
| CDN/WAF | Cloudflare Free/Pro | Cloudflare Enterprise |
| CAPTCHA | reCAPTCHA v2/v3 | hCaptcha, Arkose Labs |
| Fingerprinting | Cloudflare JS challenge | PerimeterX, DataDome |
| Rate limiting | Nginx/application-level | Distributed rate limiting |
| Bot scoring | Basic (Cloudflare bot score) | HUMAN Bot Defender |

The Bash and GigSalad likely sit in the "Common Choice" column (unverified).

---

## 2. Playwright Stealth Configurations

### playwright-extra + stealth plugin

The `playwright-extra` package with `puppeteer-extra-plugin-stealth` (adapted for Playwright) is the primary tool for evading basic bot detection. As of 2024-2025:

- **Package:** `playwright-extra` (npm) wraps Playwright and applies stealth patches.
- **What it does:** Patches `navigator.webdriver` (removes the `webdriver` flag), spoofs `chrome.runtime`, modifies `navigator.plugins` and `navigator.languages`, patches `WebGL` renderer strings, and handles `iframe.contentWindow` access patterns.
- **Effectiveness:** Good against Cloudflare basic challenges and reCAPTCHA v3 passive scoring (unverified for 2025 specifically -- the cat-and-mouse game evolves). Less effective against enterprise solutions like DataDome or HUMAN.
- **Alternative approach:** Instead of `playwright-extra`, you can manually patch key detection vectors. This is lighter and more maintainable for a low-frequency use case.

### Key Stealth Techniques (2024-2025)

**a) navigator.webdriver patching**

The single most important detection vector. Playwright sets `navigator.webdriver = true` by default. Bot detectors check this.

```typescript
// Method 1: Via launch args
const browser = await chromium.launch({
  args: ['--disable-blink-features=AutomationControlled']
});

// Method 2: Via page script injection (before page loads)
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });
});
```

**b) Human-like delays and mouse movements**

- Don't use fixed delays (`page.waitForTimeout(1000)`). Use randomized delays.
- Click elements by moving the mouse to them first, with slight randomness in coordinates.
- Type text character by character with variable delays (50-150ms per keystroke).
- Scroll gradually, not jumping to elements instantly.

```typescript
// Random delay helper
function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Human-like typing
async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
  }
}
```

**c) Residential proxies vs datacenter**

| Factor | Datacenter Proxy | Residential Proxy |
|--------|-----------------|-------------------|
| Detection risk | HIGH -- IPs are well-known and flagged | LOW -- looks like a real user's IP |
| Cost | ~$1-5/GB | ~$5-15/GB |
| Speed | Very fast | Variable, can be slow |
| Reliability | High | Medium (IPs rotate, connections drop) |
| Recommendation for this use case | **Avoid** | **Not needed** (see below) |

**For this specific use case (5-15 leads/day, authenticated sessions from a personal account), using your own home IP is the safest option.** Proxies introduce more risk than they mitigate because:
- You are logging into YOUR vendor account. The platform knows your identity.
- A residential proxy from a different city/country raises more flags than your home IP.
- The volume (5-15 requests/day) is well within normal human usage.

**d) Browser fingerprinting**

Modern bot detection checks:
- Canvas fingerprint (rendering text/graphics and hashing the result)
- WebGL renderer and vendor strings
- Audio context fingerprint
- Screen resolution and color depth
- Installed fonts (via CSS measurement)
- Navigator properties (platform, languages, plugins, hardwareConcurrency)

**For this use case:** Use a persistent browser profile (see section 8) so your fingerprint stays consistent across sessions. Changing fingerprints between requests is a red flag. Consistency is key.

**e) Headless vs headed mode**

| Mode | Pros | Cons |
|------|------|------|
| Headless (default) | No GPU needed, faster, runs on servers | Detectable via multiple vectors (missing GPU info, chrome flags, window.outerHeight === 0) |
| Headed | Hardest to detect, real browser behavior | Needs a display (or Xvfb on Linux), uses more resources |
| `headless: "new"` (Chromium) | Improved headless mode that passes more detection tests | Still detectable by some advanced methods (unverified for 2025) |

**Recommendation:** Use `headless: "new"` for server deployment, headed mode for development/testing. For 5-15 requests/day, the resource cost of headed mode (via Xvfb) is negligible.

---

## 3. Session Duration & Cookie Behavior

### General Marketplace Patterns

Most vendor-facing marketplaces follow these cookie/session patterns:

- **Session cookie:** Expires when browser closes (no `Expires`/`Max-Age` attribute). Used for CSRF and temporary state.
- **Authentication cookie:** Typically 7-30 days (unverified for both platforms specifically). Common values:
  - 7 days (conservative, banking-style)
  - 14 days (common for marketplaces)
  - 30 days (common with "Remember me" checked)
- **"Remember this device" / "Stay signed in":** Usually sets a longer-lived cookie (30-90 days) plus a device fingerprint or token in localStorage (unverified).

### The Bash (estimated, unverified)

- Login likely persists for **14-30 days** with "remember me" (unverified).
- Lead notification emails contain a direct link (likely with an auth token in the URL) that may bypass the need for an active session (unverified). If so, this is the ideal entry point -- no session management needed.
- CSRF tokens are likely per-session and embedded in forms (unverified).

### GigSalad (estimated, unverified)

- Similar to The Bash: **14-30 day** cookie expiry with "remember me" (unverified).
- Also sends lead notification emails with direct links (unverified).
- May use JWT or opaque session tokens (unverified).

### Strategy for Persistent Sessions

The safest approach for maintaining sessions:

1. **Store browser context** (cookies + localStorage) using Playwright's `context.storageState()` after manual login.
2. **Reuse stored state** for subsequent automated sessions via `browser.newContext({ storageState: 'state.json' })`.
3. **Detect session expiry** by checking for redirect to login page, then re-authenticate.
4. **Re-login frequency:** With stored state, expect to re-login every 2-4 weeks (unverified). If the platform's token link bypasses authentication, you may never need to manage sessions at all.

---

## 4. Account Suspension Risk

### Known Cases on Gig Platforms

- **No widely-known public cases** of vendor accounts on The Bash or GigSalad being suspended specifically for automation (unverified). These platforms are smaller and generate less discussion in scraping/automation communities compared to Ticketmaster, LinkedIn, or Amazon.
- **Thumbtack** (a comparable marketplace) has been known to flag accounts for unusual activity patterns (unverified), but this is typically related to review manipulation or lead abuse, not quote submission automation.

### General Suspension Triggers

Based on patterns across marketplace platforms, suspensions are typically triggered by:

1. **Volume anomalies:** Responding to far more leads than humanly possible, or responding faster than a human could read the details. (LOW RISK for 5-15 leads/day with 2-3 minute delay.)
2. **Pattern regularity:** Responding at exact intervals (e.g., every lead gets a response in exactly 120 seconds). Humans are variable. (MITIGATE with random delays.)
3. **IP reputation:** Using known datacenter IPs, VPNs, or flagged proxy IPs. (MITIGATE by using home IP.)
4. **Browser fingerprint changes:** Logging in from different browser fingerprints on each request. (MITIGATE with persistent browser profile.)
5. **CAPTCHA failure patterns:** Failing CAPTCHAs repeatedly, or solving them inhumanly fast. (Monitor and handle manually if needed.)
6. **Terms of Service reports:** Another vendor reports you for suspicious behavior. (LOW RISK -- your behavior looks normal to other vendors.)
7. **Content analysis:** Submitting identical quote text for every lead. (MITIGATE with AI-personalized responses, which your system already does.)

### Rate Limiting Patterns

Typical rate limits on marketplace platforms (unverified for specific platforms):

| Action | Expected Limit | Notes |
|--------|---------------|-------|
| Page views | 100-500/hour | Very generous for logged-in users |
| Login attempts | 5-10/hour | Strict, triggers CAPTCHA or lockout |
| Form submissions | 10-30/hour | Per-user, not per-IP |
| API calls | 60-120/minute | If API is used directly |

**For 5-15 leads/day, you are well below any reasonable rate limit.**

---

## 5. Terms of Service Analysis

### What to Look For

Both The Bash and GigSalad will have Terms of Service (ToS) that likely include these standard clauses (unverified for exact wording):

**a) Prohibited automated access:**

Most marketplace ToS include language like:
> "You agree not to use any automated means, including robots, spiders, or scrapers, to access the Service for any purpose without our express written permission."

This is **nearly universal** in marketplace ToS. It is present in Thumbtack, Upwork, Fiverr, and virtually every platform.

**b) Vendor-specific terms:**

The Bash and GigSalad likely have separate "Vendor Terms" or "Performer Agreement" documents (unverified). These may include:
- Requirements to respond to leads personally
- Prohibitions on using third-party services to manage leads
- Clauses about quote accuracy and good-faith engagement

**c) What "automated access" typically means in enforcement:**

Despite broad ToS language, enforcement is typically focused on:
- Large-scale data scraping (extracting the entire lead database)
- Creating fake accounts
- Manipulating reviews or rankings
- Spamming other users

**Submitting personalized quotes on your own leads at human-like frequency is in a gray area.** You are:
- NOT scraping data you wouldn't otherwise have access to (these are YOUR leads)
- NOT creating fake accounts
- NOT manipulating the platform
- Responding to leads that were sent TO YOU, just faster

**d) Legal risk assessment:**

- **CFAA (Computer Fraud and Abuse Act):** The hiQ v. LinkedIn Supreme Court case (2022) established that accessing publicly available data does not violate CFAA. However, accessing authenticated content after a platform explicitly prohibits automated access could be different. The risk is low for a single vendor account doing low-volume automation, but it exists.
- **ToS breach = contract breach, not criminal:** Violating ToS is a breach of contract (civil matter), not a crime. The remedy is typically account termination, not legal action. For a small vendor account, the platform would simply suspend the account -- they would not sue.
- **Practical reality:** Platforms rarely detect or act against low-volume, human-like automation on vendor accounts. Their detection is tuned for high-volume abuse.

### Sections to Read in Each Platform's ToS

1. "Acceptable Use" or "Prohibited Conduct" -- look for "automated," "robot," "spider," "scraper"
2. "Vendor/Performer Terms" -- specific obligations for paid members
3. "Account Termination" -- what triggers termination and what happens to your data
4. "Intellectual Property" -- who owns the lead data
5. "API Terms" (if any) -- some platforms offer official APIs for vendors

---

## 6. Playwright Best Practices for This Use Case

### The Specific Workflow

```
Email notification arrives
  → Parse email for lead link (2-3 minute window)
  → Open authenticated page via Playwright
  → Scrape lead details (client name, event type, date, budget, etc.)
  → Generate personalized quote (AI)
  → Submit quote via the platform's form
  → Close browser
```

### Why This Use Case Is Favorable for Automation

1. **Low frequency:** 5-15 leads/day means 5-15 browser sessions total. This is indistinguishable from a human checking their laptop when they get an email.
2. **Triggered by real events:** Each session is triggered by a real email from the platform. You are not polling or scraping speculatively.
3. **Authenticated as yourself:** You are using your own paid vendor account. The platform knows who you are and expects you to view and respond to leads.
4. **Time-limited links:** If the lead link contains an auth token, you may not even need a persistent session -- each click is its own authenticated action.
5. **Short sessions:** Each session lasts 30-90 seconds (open page, read data, fill form, submit). This is normal browsing behavior.

### Safest Approach

**Option A: Token Link (Preferred if Available)**

If the email notification contains a direct link with an auth token:

1. Extract the link from the email body (via email parsing -- no browser needed).
2. Open the link in Playwright.
3. If the page loads without requiring login, scrape the lead data and submit the quote.
4. Close the browser context.

This is the safest because:
- No login automation needed
- No session management
- Each request uses a fresh, platform-issued token
- Looks exactly like a human clicking an email link

**Option B: Persistent Session**

If login is required:

1. Log in manually ONCE and save the session state.
2. For each lead, load the saved session state, navigate to the lead page, and submit the quote.
3. If the session expires (detected by redirect to login), re-authenticate (manually or automated).

**Option C: Full Automation (Highest Risk)**

Fully automated login + scrape + submit. Only use this if Options A and B are not feasible.

### Timing Strategy

```
Email received at T+0
  → Wait random(60, 180) seconds (human would open email, read it, click link)
  → Open browser, navigate to lead page
  → Wait random(5, 15) seconds (human reading lead details)
  → Fill quote form with human-like typing delays
  → Wait random(3, 8) seconds (human reviewing before submit)
  → Submit
  → Wait random(2, 5) seconds (human seeing confirmation)
  → Close browser
Total: ~2-4 minutes per lead
```

This timing is both safe and strategically optimal -- platforms like The Bash often reward fast responders (unverified).

---

## 7. Risk Assessment

### The Bash

| Factor | Risk Level | Reasoning |
|--------|-----------|-----------|
| Bot detection sophistication | **LOW** | Mid-size marketplace, likely Cloudflare basic + reCAPTCHA (unverified) |
| Account suspension | **LOW** | 5-15 leads/day at human-like pace is indistinguishable from normal use |
| ToS violation (technical) | **MEDIUM** | ToS almost certainly prohibits "automated access" broadly |
| ToS enforcement at this scale | **LOW** | Platforms focus enforcement on high-volume abuse, not a single vendor responding to their own leads |
| Legal risk | **VERY LOW** | No precedent for legal action against a vendor automating their own quote responses |
| Detection difficulty | **LOW** | Token links + low volume + home IP + persistent fingerprint = very hard to distinguish from human |

**Overall risk: LOW**

### GigSalad

| Factor | Risk Level | Reasoning |
|--------|-----------|-----------|
| Bot detection sophistication | **LOW** | Same tier as The Bash (unverified) |
| Account suspension | **LOW** | Same reasoning as The Bash |
| ToS violation (technical) | **MEDIUM** | Same boilerplate prohibitions expected |
| ToS enforcement at this scale | **LOW** | Same reasoning |
| Legal risk | **VERY LOW** | Same reasoning |
| Detection difficulty | **LOW** | Same reasoning |

**Overall risk: LOW**

### Risk Mitigation Summary

The primary risk is **not detection** but **account termination if discovered.** The cost of account termination is:
- Loss of profile history, reviews, and ranking on the platform
- Possible inability to re-register
- Loss of paid membership fees

Mitigation: Keep the automation conservative, maintain manual fallback capability, and never fully depend on automation for income-critical leads.

---

## 8. Recommended Playwright Configuration

### Project Dependencies

```json
{
  "playwright": "^1.40.0",
  "playwright-extra": "^4.3.0",
  "puppeteer-extra-plugin-stealth": "^2.11.0"
}
```

Note: `playwright-extra` uses the puppeteer-extra stealth plugin adapted for Playwright. Check compatibility for your Playwright version (unverified for latest versions in 2025).

**Alternative (simpler, recommended for this use case):** Skip `playwright-extra` entirely and apply minimal patches manually. For 5-15 requests/day from a home IP, you likely don't need the full stealth suite.

### Minimal Stealth Configuration

```typescript
import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'path';

// --- Configuration ---
const STORAGE_STATE_PATH = path.resolve('./data/browser-state.json');
const USER_DATA_DIR = path.resolve('./data/browser-profile');

// --- Browser Launch ---
async function createBrowser() {
  const browser = await chromium.launch({
    headless: false,  // Use headed mode on desktop; headless: "new" on server
    args: [
      '--disable-blink-features=AutomationControlled',  // Remove webdriver flag
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
    ],
  });

  return browser;
}

// --- Context with Persistent State ---
async function createContext(browser: ReturnType<typeof chromium.launch> extends Promise<infer T> ? T : never) {
  let context: BrowserContext;

  try {
    // Try to reuse saved session
    context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
      viewport: { width: 1366, height: 768 },  // Common laptop resolution
      locale: 'en-US',
      timezoneId: 'America/Chicago',  // Match your real timezone
      userAgent: undefined,  // Let Chromium use its default (more realistic)
    });
  } catch {
    // No saved state -- start fresh
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/Chicago',
    });
  }

  return context;
}

// --- Stealth Patches ---
async function applyStealthPatches(page: Page) {
  await page.addInitScript(() => {
    // 1. Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // 2. Mock chrome runtime (present in real Chrome, missing in Playwright)
    if (!(window as any).chrome) {
      (window as any).chrome = {
        runtime: {},
      };
    }

    // 3. Mock plugins (real Chrome has at least 3)
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // 4. Mock permissions query (Notification permission behavior differs in automation)
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);
  });
}
```

### Human-Like Interaction Helpers

```typescript
// --- Random Delays ---
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// --- Human-Like Typing ---
async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await randomDelay(200, 500);  // Pause after clicking field

  for (const char of text) {
    await page.keyboard.type(char, {
      delay: 40 + Math.random() * 120,  // 40-160ms per keystroke
    });
  }
}

// --- Human-Like Click (move mouse first) ---
async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);

  const box = await element.boundingBox();
  if (!box) throw new Error(`Element not visible: ${selector}`);

  // Click at a random point within the element, not dead center
  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);

  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
  await randomDelay(50, 150);
  await page.mouse.click(x, y);
}

// --- Save Session After Successful Action ---
async function saveSession(context: BrowserContext): Promise<void> {
  await context.storageState({ path: STORAGE_STATE_PATH });
}
```

### Lead Processing Workflow

```typescript
async function processLead(leadUrl: string, quoteData: QuoteData): Promise<void> {
  const browser = await createBrowser();
  const context = await createContext(browser);
  const page = await context.newPage();

  await applyStealthPatches(page);

  try {
    // 1. Navigate to lead page
    await page.goto(leadUrl, { waitUntil: 'networkidle' });
    await randomDelay(2000, 5000);  // "Reading" the page

    // 2. Check if we're on the login page (session expired)
    if (page.url().includes('/login') || page.url().includes('/sign-in')) {
      // Handle re-authentication (manual or automated)
      throw new Error('Session expired -- manual re-login required');
    }

    // 3. Scrape lead details
    const leadDetails = await scrapeLead(page);
    await randomDelay(3000, 8000);  // "Thinking about the quote"

    // 4. Fill and submit quote form
    await fillQuoteForm(page, quoteData);
    await randomDelay(2000, 5000);  // "Reviewing before submit"

    await humanClick(page, 'button[type="submit"]');  // Adjust selector
    await randomDelay(2000, 4000);  // "Seeing confirmation"

    // 5. Save updated session state
    await saveSession(context);

  } finally {
    await context.close();
    await browser.close();
  }
}
```

---

## 9. Go/No-Go Framework

Before launching the bot, verify each item. All items in the "Must Verify" section must be confirmed.

### Must Verify (Blockers)

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 1 | **Read The Bash ToS** | Visit thebash.com/terms and search for "automat", "robot", "scrape" | [ ] |
| 2 | **Read GigSalad ToS** | Visit gigsalad.com/terms and search for same | [ ] |
| 3 | **Test token links** | Click a lead email link. Does it load the lead page without login? Or does it redirect to login? | [ ] |
| 4 | **Identify bot detection** | Open DevTools Network tab on each platform. Look for Cloudflare `cf-ray` headers, reCAPTCHA `<script src="recaptcha">`, DataDome cookies, PerimeterX `_px` cookies | [ ] |
| 5 | **Test session persistence** | Log in, save cookies, close browser, reopen with saved cookies. Does the session persist? How long? | [ ] |
| 6 | **Map the quote form** | Manually submit a quote and record: URL, form fields, required fields, CSRF token location, submission endpoint | [ ] |
| 7 | **CAPTCHA on quote submit?** | Check if submitting a quote triggers CAPTCHA. If yes, need CAPTCHA-solving strategy. | [ ] |
| 8 | **Account value assessment** | How much revenue does each platform account generate? What is the cost of losing it? This determines risk tolerance. | [ ] |

### Should Verify (Important)

| # | Check | How to Verify |
|---|-------|--------------|
| 9 | **Response time advantage** | Does responding faster actually improve lead conversion? Ask platform support or test manually. |
| 10 | **Competitor behavior** | Are other vendors on these platforms clearly using automation? (Instant responses, templated quotes) |
| 11 | **Platform API** | Check if The Bash or GigSalad offer an official vendor API. If so, use that instead -- it is explicitly permitted. |
| 12 | **Email parsing reliability** | Can you reliably extract the lead URL from notification emails? Test with 10+ real emails. |

### Nice to Verify (Low Priority)

| # | Check | How to Verify |
|---|-------|--------------|
| 13 | **Cloudflare challenge frequency** | How often does each platform issue JavaScript challenges to logged-in users? |
| 14 | **Mobile vs desktop behavior** | Do the platforms serve different content to mobile user agents? |
| 15 | **Webhook/notification alternatives** | Do the platforms offer push notifications or webhooks as alternatives to email? |

### Go/No-Go Decision Matrix

| Scenario | Decision |
|----------|----------|
| Token links work without login + no CAPTCHA on submit | **GO** -- Lowest risk. Proceed with Option A. |
| Login required + session persists 14+ days + no CAPTCHA | **GO** -- Low risk. Proceed with Option B. |
| CAPTCHA on every quote submission | **CONDITIONAL GO** -- Need CAPTCHA solving strategy. Consider manual CAPTCHA with notification to you. |
| Platform has enterprise bot detection (DataDome, PerimeterX) | **PAUSE** -- Re-evaluate. May need more sophisticated stealth or a different approach (official API, manual). |
| ToS explicitly mentions vendor automation enforcement | **PAUSE** -- Higher risk. Assess account value vs. benefit. |
| Platform actively suspends accounts for automation | **NO-GO** -- Do not risk your account. Use manual workflow with AI-assisted quote drafting only. |

---

## 10. Confidence Levels

How confident am I in each section, on a scale of 1-5:

| Section | Confidence | Notes |
|---------|-----------|-------|
| 1. Bot Detection Systems | **3/5** | Based on general marketplace patterns. Specific platforms not verified. Could be wrong about Cloudflare vs. another WAF. Core assessment (no enterprise bot detection) is high-confidence. |
| 2. Playwright Stealth | **4/5** | Well-documented techniques as of early 2025. `navigator.webdriver` patching and `--disable-blink-features=AutomationControlled` are standard. Specific plugin versions may have changed. |
| 3. Session Duration | **2/5** | Generic marketplace estimates. Could be significantly different for either platform. Must verify empirically. |
| 4. Account Suspension | **3/5** | No specific data on these platforms. General marketplace patterns are well-understood. The "low volume = low risk" principle is high-confidence. |
| 5. Terms of Service | **4/5** | Nearly all marketplaces prohibit automated access in ToS. The enforcement reality (focused on high-volume abuse) is well-established. Specific ToS wording not verified. |
| 6. Best Practices | **4/5** | The recommended approach (token link + human-like timing + low volume) is well-established as the safest automation pattern. Code examples are standard Playwright patterns. |
| 7. Risk Assessment | **3/5** | Directionally correct (low risk for this use case) but specific platform risk could be higher if they recently upgraded detection. |
| 8. Playwright Config | **4/5** | Standard patterns, well-tested in the automation community. Specific Playwright API details should be verified against current docs. |
| 9. Go/No-Go Framework | **5/5** | The verification checklist is comprehensive and the decision matrix covers realistic scenarios. This is methodology, not platform-specific claims. |

### What Would Change These Assessments

- **Checking each platform's HTTP headers** would confirm or deny Cloudflare/WAF usage (items 1, 7)
- **Testing token links** would confirm the best automation path (item 6)
- **Reading actual ToS** would confirm or raise risk (item 5)
- **One manual test session** with browser DevTools open would reveal CAPTCHA, fingerprinting, and session behavior (items 1, 3, 7)

---

## Appendix: Quick Reference for Implementation

### Priority Order

1. Parse email notifications to extract lead URLs (no browser needed)
2. Test if lead URLs work without login (huge simplification if yes)
3. Implement minimal Playwright flow: open URL, scrape, fill form, submit
4. Add stealth patches only if detection is observed
5. Add human-like delays from the start (cheap insurance)
6. Monitor for CAPTCHA or blocks and adjust

### What NOT to Over-Engineer

- Do not set up residential proxies (your home IP is better)
- Do not randomize browser fingerprints (consistency is safer)
- Do not add mouse movement simulation unless you encounter detection
- Do not implement CAPTCHA solving unless CAPTCHAs actually appear
- Do not rotate user agents (use your real browser's UA)

### Minimum Viable Bot

The simplest version that could work:

```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  storageState: './saved-session.json',  // From manual login
});

const page = await context.newPage();
await page.goto(leadUrl);
// ... scrape and submit ...
await context.storageState({ path: './saved-session.json' });
await browser.close();
```

Start here. Add complexity only when needed.
