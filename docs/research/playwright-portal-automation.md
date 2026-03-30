# Playwright Portal Automation — Research Document

**Date:** 2026-03-29
**For:** Phase 3 of Auto-Reply Automation Layer
**Context:** GigSalad and Yelp portal reply submission via Playwright
**Note:** WebSearch/WebFetch/Context7 tools were unavailable during research. This document is based on Playwright's stable API (v1.40+) and known portal structures. Items marked **[VERIFY LIVE]** need manual browser inspection before coding.

---

## Table of Contents

1. [Persistent Context Setup](#1-persistent-context-setup)
2. [Login Detection](#2-login-detection)
3. [Login Flow Patterns](#3-login-flow-patterns)
4. [Anti-Bot Detection](#4-anti-bot-detection)
5. [Navigation Patterns](#5-navigation-patterns)
6. [Form Filling](#6-form-filling)
7. [Error Handling](#7-error-handling)
8. [Screenshot on Failure](#8-screenshot-on-failure)
9. [Headless vs Headed Mode](#9-headless-vs-headed-mode)
10. [Full TypeScript Code Examples](#10-full-typescript-code-examples)

---

## 1. Persistent Context Setup

### What is `launchPersistentContext`?

Normal Playwright launches a fresh browser every time — no cookies, no saved passwords, no login state. `launchPersistentContext` is different: it creates a browser that **saves everything to a folder on your disk**, just like your real Chrome browser does. Next time you launch, all your cookies and login sessions are still there.

Think of it like this:
- **Normal launch:** Opening an incognito window every time (starts fresh)
- **Persistent context:** Opening your regular Chrome profile (remembers everything)

### Why use it for this project?

GigSalad and Yelp require logging in. If we use a persistent context:
- First run: Playwright logs in, cookies get saved to disk
- Every subsequent run: Playwright is **already logged in** — no login needed
- This is faster (skip the login page) and safer (fewer login attempts = less suspicious)

### Concrete TypeScript Code

```typescript
import { chromium, BrowserContext, Page } from "playwright";
import path from "path";

// Each portal gets its own folder so their cookies don't interfere
const BROWSER_DATA_DIR = path.resolve("data/browser");

/**
 * Launch a persistent browser context for a specific portal.
 *
 * "userDataDir" is a folder on your disk where Playwright saves:
 *   - Cookies (login sessions)
 *   - localStorage
 *   - IndexedDB
 *   - Browser cache
 *
 * Each portal (gigsalad, yelp) gets its own folder so they
 * don't share cookies or interfere with each other.
 */
async function launchPortalBrowser(
  portal: "gigsalad" | "yelp",
  options?: { headless?: boolean }
): Promise<BrowserContext> {
  // This folder stores all browser data between runs
  // e.g., "data/browser/gigsalad" or "data/browser/yelp"
  const userDataDir = path.join(BROWSER_DATA_DIR, portal);

  const context = await chromium.launchPersistentContext(userDataDir, {
    // --- Core options ---
    headless: options?.headless ?? true,

    // --- Anti-detection options (explained in Section 4) ---
    args: [
      "--disable-blink-features=AutomationControlled",
      // Removes the "Chrome is being controlled by automated software" bar
      "--disable-infobars",
    ],

    // --- Make the browser look like a real desktop browser ---
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",

    // --- User agent: pretend to be a normal Chrome browser ---
    // Use a recent, real Chrome user agent string
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/122.0.0.0 Safari/537.36",

    // --- Slow down actions slightly to look human ---
    // This adds a small delay before each action (click, type, etc.)
    // Not a built-in option — we'll handle this manually in our code
  });

  return context;
}
```

### Key parameters explained

| Parameter | What it does | Why we set it |
|-----------|-------------|---------------|
| `userDataDir` | Folder to save cookies/sessions | So we stay logged in between runs |
| `headless` | Run without a visible window | `true` for the always-on Mac server |
| `args` | Chrome command-line flags | Anti-detection (see Section 4) |
| `viewport` | Browser window size | Real browsers have a size; bots often don't |
| `locale` | Language setting | Matches a real US English browser |
| `timezoneId` | Browser timezone | Matches your real location |
| `userAgent` | Browser identity string | Makes it look like real Chrome, not Playwright |

### Folder structure on disk

```
data/
  browser/
    gigsalad/          # GigSalad's persistent browser data
      Default/
        Cookies        # Login session cookies
        Local Storage/ # localStorage data
        ...
    yelp/              # Yelp's persistent browser data
      Default/
        Cookies
        Local Storage/
        ...
```

These folders are created automatically by Playwright. Add `data/browser/` to `.gitignore` — they contain login sessions.

---

## 2. Login Detection

### The idea

Before trying to log in, check if we're **already logged in** from a previous run. This avoids unnecessary logins (which look suspicious and waste time).

### How it works

1. Navigate to a page that only logged-in users can see (e.g., the dashboard)
2. Look for an element that only appears when logged in (e.g., a "My Leads" link, your name, or a profile avatar)
3. If that element exists within a few seconds, you're logged in
4. If it doesn't exist (or you got redirected to a login page), you need to log in

### Concrete TypeScript Code

```typescript
/**
 * Check if we're already logged in to a portal.
 *
 * Strategy: navigate to the dashboard/leads page and look for
 * a known element that only appears when authenticated.
 *
 * Returns true if logged in, false if we need to authenticate.
 */
async function isLoggedIn(
  page: Page,
  portal: "gigsalad" | "yelp"
): Promise<boolean> {
  try {
    if (portal === "gigsalad") {
      // Navigate to GigSalad member dashboard
      // [VERIFY LIVE] — check the actual URL for the member area
      await page.goto("https://www.gigsalad.com/member/dashboard", {
        waitUntil: "domcontentloaded", // Don't wait for all images/scripts
        timeout: 15000, // 15 seconds max
      });

      // [VERIFY LIVE] — inspect the logged-in page and find a stable element
      // Look for something like: your name, "My Leads", "Inbox", profile menu
      // Examples of what to look for:
      //   - page.getByText("My Leads")
      //   - page.locator('[data-testid="member-nav"]')
      //   - page.getByRole("link", { name: "Inbox" })
      const loggedInIndicator = page.getByText("My Leads");
      const isVisible = await loggedInIndicator.isVisible({ timeout: 5000 });
      return isVisible;

    } else {
      // Navigate to Yelp for Business dashboard
      // [VERIFY LIVE] — check the actual URL
      await page.goto("https://biz.yelp.com/dashboard", {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // [VERIFY LIVE] — find the logged-in indicator element
      const loggedInIndicator = page.getByText("Messages");
      const isVisible = await loggedInIndicator.isVisible({ timeout: 5000 });
      return isVisible;
    }
  } catch (error) {
    // If navigation times out or element check fails, assume NOT logged in
    return false;
  }
}
```

### How to find the right "logged-in indicator" element

This is something you need to do **manually once** before writing the final code:

1. Open Chrome normally and log into GigSalad/Yelp
2. Right-click on something that only appears when logged in (like "My Leads" or your profile name)
3. Click "Inspect" to open DevTools
4. Look at the HTML element. Note its:
   - Text content (e.g., "My Leads")
   - `id` attribute (e.g., `id="member-nav"`)
   - `data-testid` attribute (if it has one)
   - `aria-label` attribute (e.g., `aria-label="Inbox"`)
   - Role (e.g., is it a link, button, heading?)
5. Use the most stable selector (priority order):
   - `data-testid` (designed for automation, rarely changes)
   - `id` (usually stable)
   - `aria-label` or role (accessibility attributes, fairly stable)
   - Text content (changes if they rename features)
   - CSS class (changes frequently — avoid)

### Alternative: Check URL after navigation

```typescript
// Another approach: if the site redirects you to login when not authenticated
async function isLoggedInByUrl(page: Page, portal: "gigsalad" | "yelp"): Promise<boolean> {
  const dashboardUrl = portal === "gigsalad"
    ? "https://www.gigsalad.com/member/dashboard"
    : "https://biz.yelp.com/dashboard";

  await page.goto(dashboardUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

  // If the URL still contains "dashboard", we're logged in
  // If we got redirected to "/login" or "/signin", we're not
  const currentUrl = page.url();
  const isOnLoginPage = currentUrl.includes("login") || currentUrl.includes("signin");

  return !isOnLoginPage;
}
```

This is often simpler and more reliable than checking for specific elements.

---

## 3. Login Flow Patterns

### Basic login: email + password

```typescript
/**
 * Log into a portal by filling email and password fields.
 *
 * This function:
 * 1. Navigates to the login page
 * 2. Fills in the email and password
 * 3. Clicks the submit button
 * 4. Waits for the page to load after login
 * 5. Verifies login succeeded
 */
async function loginToPortal(
  page: Page,
  portal: "gigsalad" | "yelp",
  credentials: { email: string; password: string }
): Promise<void> {
  if (portal === "gigsalad") {
    // [VERIFY LIVE] — check actual login page URL and form field selectors
    await page.goto("https://www.gigsalad.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // --- Fill email field ---
    // Try multiple selector strategies (most stable first)
    // [VERIFY LIVE] — inspect the actual login form to find the right selectors
    await page.getByLabel("Email").fill(credentials.email);
    // If getByLabel doesn't work, try these alternatives:
    //   await page.locator('input[name="email"]').fill(credentials.email);
    //   await page.locator('input[type="email"]').fill(credentials.email);
    //   await page.locator('#email').fill(credentials.email);

    // --- Fill password field ---
    await page.getByLabel("Password").fill(credentials.password);
    // Alternatives:
    //   await page.locator('input[name="password"]').fill(credentials.password);
    //   await page.locator('input[type="password"]').fill(credentials.password);

    // --- Small random delay to look human ---
    await randomDelay(500, 1500);

    // --- Click the submit/login button ---
    await page.getByRole("button", { name: /log\s*in|sign\s*in/i }).click();
    // Alternatives:
    //   await page.locator('button[type="submit"]').click();
    //   await page.getByText("Log In").click();

    // --- Wait for navigation after login ---
    await page.waitForURL("**/member/**", { timeout: 15000 });

  } else {
    // Yelp for Business login
    // [VERIFY LIVE] — Yelp uses biz.yelp.com for business accounts
    await page.goto("https://biz.yelp.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await page.getByLabel("Email").fill(credentials.email);
    await randomDelay(300, 800);
    await page.getByLabel("Password").fill(credentials.password);
    await randomDelay(500, 1500);
    await page.getByRole("button", { name: /log\s*in|sign\s*in/i }).click();

    await page.waitForURL("**/dashboard**", { timeout: 15000 });
  }

  // Verify we actually logged in (not stuck on login page with an error)
  const loggedIn = await isLoggedIn(page, portal);
  if (!loggedIn) {
    throw new Error(`Login to ${portal} failed — still on login page after submit`);
  }
}

/**
 * Random delay to simulate human behavior.
 * Bots act instantly; humans take variable time between actions.
 */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
```

### Handling Two-Factor Authentication (2FA)

If GigSalad or Yelp has 2FA enabled on your account, automated login cannot complete without human intervention. Here is how to handle it:

```typescript
/**
 * Detect if a 2FA prompt appeared after entering credentials.
 * If 2FA is detected, we cannot proceed automatically.
 */
async function check2FA(page: Page): Promise<boolean> {
  // [VERIFY LIVE] — look for common 2FA indicators
  const twoFactorIndicators = [
    page.getByText(/verification code/i),
    page.getByText(/two.?factor/i),
    page.getByText(/enter.*code/i),
    page.getByText(/check your (email|phone)/i),
    page.locator('input[name="code"]'),
    page.locator('input[name="otp"]'),
    page.locator('input[autocomplete="one-time-code"]'),
  ];

  for (const indicator of twoFactorIndicators) {
    try {
      const visible = await indicator.isVisible({ timeout: 2000 });
      if (visible) return true;
    } catch {
      // Element not found — keep checking others
    }
  }

  return false;
}
```

**Recommended 2FA strategy for this project:**

1. **Disable 2FA on portal accounts if possible** — these are business accounts you control. Since the old Mac is physically secure and FileVault is enabled, 2FA on the portal accounts themselves is less critical.

2. **If you cannot disable 2FA**, use `launchPersistentContext` with `headless: false` on the first run. Manually complete 2FA once. The session cookie will persist — most portals don't re-prompt for 2FA on the same browser for weeks/months.

3. **If 2FA fires unexpectedly**, the automation should detect it, take a screenshot, send an SMS alert, and stop trying (fall back to manual).

```typescript
// Inside loginToPortal, after clicking submit:
const has2FA = await check2FA(page);
if (has2FA) {
  await page.screenshot({ path: "logs/screenshots/2fa-prompt.png" });
  throw new Error(
    `2FA prompt detected on ${portal}. ` +
    `Manual login needed. Screenshot saved to logs/screenshots/2fa-prompt.png`
  );
}
```

### Handling CAPTCHAs

CAPTCHAs (those "I'm not a robot" checkboxes or image puzzles) are the biggest threat to automation.

```typescript
/**
 * Detect if a CAPTCHA appeared.
 * CAPTCHAs cannot be solved automatically (at least not ethically/reliably).
 * Our strategy: detect it, screenshot it, fall back to SMS.
 */
async function checkCaptcha(page: Page): Promise<boolean> {
  // Common CAPTCHA indicators
  const captchaIndicators = [
    // Google reCAPTCHA
    page.locator('iframe[src*="recaptcha"]'),
    page.locator(".g-recaptcha"),
    page.locator("#recaptcha"),
    // hCaptcha
    page.locator('iframe[src*="hcaptcha"]'),
    page.locator(".h-captcha"),
    // Cloudflare Turnstile
    page.locator('iframe[src*="challenges.cloudflare.com"]'),
    page.locator(".cf-turnstile"),
    // Generic "are you human" text
    page.getByText(/verify.*human/i),
    page.getByText(/are you a robot/i),
    page.getByText(/complete.*captcha/i),
  ];

  for (const indicator of captchaIndicators) {
    try {
      const visible = await indicator.isVisible({ timeout: 2000 });
      if (visible) return true;
    } catch {
      // Not found — keep checking
    }
  }

  return false;
}
```

**CAPTCHA strategy for this project:**

1. **Persistent context dramatically reduces CAPTCHAs** — the browser looks like a returning visitor with real cookies. Most sites only CAPTCHA new/suspicious visitors.
2. **If CAPTCHA appears:** Screenshot, SMS alert, fall back to manual. Do NOT try to solve it programmatically.
3. **Prevention is better than solving:** See Section 4 (Anti-Bot Detection) for how to avoid triggering CAPTCHAs in the first place.

---

## 4. Anti-Bot Detection

### Does GigSalad block automated browsers?

**[VERIFY LIVE]** GigSalad is a mid-size marketplace for event performers. Based on its market position:

- **Likely detection level: Low to Medium.** GigSalad is not a high-security target like banks or ticketing sites. They likely use basic protections (maybe Cloudflare) but not aggressive bot detection.
- **Risk factor:** If you're logging into your own account and performing actions at human speed (1-3 times per day), detection risk is very low.
- **Main concern:** Cloudflare's "checking your browser" interstitial page, which can appear on first visits.

### Does Yelp block automated browsers?

**[VERIFY LIVE]** Yelp is a larger platform and historically more aggressive about automation:

- **Likely detection level: Medium to High.** Yelp actively fights scrapers and fake reviewers. Their business portal (biz.yelp.com) may have different protections than the consumer site.
- **Risk factor:** Yelp may use fingerprinting, behavioral analysis, or rate limiting. However, logging into your own business account 1-3 times per day is normal behavior.
- **Main concern:** Yelp might flag the account if they detect automation patterns. Start with DRY_RUN and monitor carefully.

### Anti-detection strategies (ordered by importance)

#### Strategy 1: Persistent context (already covered)

The single most effective anti-detection measure. A browser with real cookies, history, and cached data looks like a returning human user.

#### Strategy 2: Remove automation indicators

Playwright/Chromium sets certain JavaScript properties that websites can detect. Remove them:

```typescript
const context = await chromium.launchPersistentContext(userDataDir, {
  args: [
    // This is THE most important flag:
    // It removes navigator.webdriver = true, which is the #1 way
    // sites detect Playwright/Puppeteer/Selenium
    "--disable-blink-features=AutomationControlled",

    // Remove the "Chrome is being controlled" info bar
    "--disable-infobars",

    // Disable automation extension
    "--disable-extensions",
  ],
});
```

#### Strategy 3: Override navigator.webdriver

Even with the flag above, some Playwright versions still expose `navigator.webdriver`. Override it:

```typescript
// Run this on every new page BEFORE navigating anywhere
async function applyStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Remove the webdriver flag
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Some sites check for specific Playwright/automation properties
    // Remove them if they exist
    // @ts-ignore
    delete window.__playwright;
    // @ts-ignore
    delete window.__pw_manual;
  });
}
```

#### Strategy 4: Realistic user agent

Always set a real, recent Chrome user agent string. Playwright's default user agent includes "HeadlessChrome" which is an instant giveaway:

```typescript
// BAD (default Playwright):
// "Mozilla/5.0 ... HeadlessChrome/122.0.0.0 ..."
//                   ^^^^^^^^^^^^^^ dead giveaway

// GOOD (real Chrome):
// "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
//  (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
```

**How to find a current user agent:** Open your real Chrome, go to `chrome://version`, and copy the User Agent string.

#### Strategy 5: Human-like timing

Bots are fast and consistent. Humans are slow and variable.

```typescript
/**
 * Add realistic delays between actions.
 * This is crucial for anti-detection.
 */
async function humanLikeType(page: Page, selector: string, text: string): Promise<void> {
  const element = page.locator(selector);
  await element.click(); // Click the field first (like a human would)
  await randomDelay(200, 500); // Pause before typing

  // Type character by character with variable speed
  // (faster than fill() which is instant, but uses Playwright's built-in delay)
  await element.pressSequentially(text, {
    delay: 50 + Math.random() * 100, // 50-150ms between keystrokes
  });
}

async function humanLikeClick(page: Page, locator: ReturnType<Page["locator"]>): Promise<void> {
  // Move to element area first (simulates mouse movement)
  await locator.hover();
  await randomDelay(100, 300);
  await locator.click();
}
```

#### Strategy 6: Viewport and screen properties

Make the browser report realistic screen dimensions:

```typescript
const context = await chromium.launchPersistentContext(userDataDir, {
  viewport: { width: 1280, height: 720 },
  screen: { width: 1440, height: 900 }, // Physical screen size
  deviceScaleFactor: 2, // Retina display (Mac)
  isMobile: false,
  hasTouch: false,
});
```

#### Strategy 7: Handle Cloudflare challenges

Both GigSalad and Yelp might use Cloudflare. If you see a "Checking your browser..." page:

```typescript
/**
 * Wait for Cloudflare challenge to resolve (if present).
 * Cloudflare usually auto-resolves in 2-5 seconds for browsers
 * that pass its checks.
 */
async function waitForCloudflare(page: Page): Promise<void> {
  // Check if we're on a Cloudflare challenge page
  const isChallenge =
    page.url().includes("challenge") ||
    (await page.title()).toLowerCase().includes("just a moment");

  if (isChallenge) {
    console.log("Cloudflare challenge detected, waiting for resolution...");
    // Wait up to 15 seconds for the challenge to auto-resolve
    await page.waitForURL((url) => !url.toString().includes("challenge"), {
      timeout: 15000,
    });
    // Extra wait for page to fully load after challenge
    await randomDelay(2000, 3000);
  }
}
```

### Summary of anti-detection measures

| Measure | Effectiveness | Difficulty | Must-have? |
|---------|--------------|------------|------------|
| Persistent context | Very high | Easy | Yes |
| `--disable-blink-features=AutomationControlled` | High | Easy | Yes |
| Real user agent string | High | Easy | Yes |
| `navigator.webdriver` override | Medium | Easy | Yes |
| Human-like delays | Medium | Easy | Yes |
| Realistic viewport/screen | Low-Medium | Easy | Yes |
| Cloudflare handling | Situational | Medium | If needed |

---

## 5. Navigation Patterns

### How to get from notification email to the reply form

Your system receives a notification email from GigSalad or Yelp. That email contains a link to the lead. The flow:

```
Email body → extract portal URL → Playwright navigates to URL → find reply form
```

#### GigSalad navigation

**[VERIFY LIVE]** GigSalad notification emails typically contain a link like:
`https://www.gigsalad.com/member/leads/12345` or similar.

```typescript
async function navigateToGigSaladLead(page: Page, portalUrl: string): Promise<void> {
  // Step 1: Navigate to the lead URL from the email
  await page.goto(portalUrl, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // Step 2: Handle Cloudflare if present
  await waitForCloudflare(page);

  // Step 3: Check if we got redirected to login
  if (page.url().includes("login") || page.url().includes("signin")) {
    throw new Error("Session expired — need to re-login");
  }

  // Step 4: Wait for the reply form area to be visible
  // [VERIFY LIVE] — look for the reply textarea or quote form
  // GigSalad's lead page likely has:
  //   - Lead details (event type, date, location, budget)
  //   - A reply/quote form (textarea + submit button)
  //   - Possibly a "Send Quote" or "Reply" button to open the form
  await page.waitForSelector("textarea, [role='textbox']", { timeout: 10000 });
}
```

#### Yelp navigation

**[VERIFY LIVE]** Yelp business message notifications link to:
`https://biz.yelp.com/message/thread/...` or similar.

```typescript
async function navigateToYelpLead(page: Page, portalUrl: string): Promise<void> {
  await page.goto(portalUrl, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  await waitForCloudflare(page);

  if (page.url().includes("login") || page.url().includes("signin")) {
    throw new Error("Session expired — need to re-login");
  }

  // [VERIFY LIVE] — Yelp business messaging interface
  // Yelp likely has a messaging thread view with:
  //   - Customer's original message
  //   - A reply textbox at the bottom
  //   - A "Send" button
  await page.waitForSelector("textarea, [role='textbox'], [contenteditable='true']", {
    timeout: 10000,
  });
}
```

### Important: Some portals use modals or multi-step forms

**[VERIFY LIVE]** GigSalad's quote form might require clicking a "Send Quote" button first to open a modal/expanded form. In that case:

```typescript
// If the reply form is hidden behind a button:
const replyButton = page.getByRole("button", { name: /reply|send quote|respond/i });
if (await replyButton.isVisible({ timeout: 3000 })) {
  await humanLikeClick(page, replyButton);
  await randomDelay(500, 1000);
  // Now the textarea should be visible
  await page.waitForSelector("textarea", { timeout: 5000 });
}
```

---

## 6. Form Filling

### Finding and filling a textarea

```typescript
/**
 * Fill the reply form with the generated draft.
 *
 * Strategy: try multiple selectors from most stable to least.
 * The first one that works wins.
 */
async function fillReplyForm(page: Page, replyText: string): Promise<void> {
  // --- Step 1: Find the textarea ---
  // Try selectors in order of stability
  const textareaSelectors = [
    // Most stable: data-testid or name attribute
    '[data-testid="reply-textarea"]',
    '[data-testid="message-input"]',
    'textarea[name="message"]',
    'textarea[name="reply"]',
    'textarea[name="body"]',
    'textarea[name="quote_message"]',

    // Medium stability: aria attributes
    '[aria-label="Reply"]',
    '[aria-label="Message"]',
    '[aria-label="Write a reply"]',

    // Medium stability: role
    '[role="textbox"]',

    // Least stable but broad: any visible textarea
    "textarea",

    // Some modern apps use contenteditable divs instead of textarea
    '[contenteditable="true"]',
  ];

  let filled = false;
  for (const selector of textareaSelectors) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 2000 });
      if (isVisible) {
        // Click the field first (activates it, like a human would)
        await element.click();
        await randomDelay(300, 600);

        // Clear any existing text
        await element.fill("");
        await randomDelay(200, 400);

        // Type the reply with human-like speed
        // For long texts, use fill() instead of pressSequentially
        // (pressSequentially would take minutes for a full reply)
        await element.fill(replyText);

        filled = true;
        console.log(`Filled reply using selector: ${selector}`);
        break;
      }
    } catch {
      // Selector not found — try the next one
      continue;
    }
  }

  if (!filled) {
    throw new Error("Could not find reply textarea — no selector matched");
  }
}
```

### GigSalad: Quote form may have additional fields

**[VERIFY LIVE]** GigSalad's lead reply form likely includes more than just a message:

```typescript
/**
 * GigSalad-specific form filling.
 * Their quote form may include: price, message, availability.
 * [VERIFY LIVE] — inspect the actual form fields.
 */
async function fillGigSaladQuoteForm(
  page: Page,
  replyText: string,
  quotePrice?: number
): Promise<void> {
  // Fill quote price if there's a price field
  // [VERIFY LIVE] — check if GigSalad has a separate price input
  if (quotePrice) {
    const priceField = page.locator(
      'input[name="price"], input[name="quote_price"], input[name="amount"]'
    );
    if (await priceField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await priceField.fill(String(quotePrice));
      await randomDelay(300, 600);
    }
  }

  // Fill the main message
  await fillReplyForm(page, replyText);
}
```

### Clicking the submit button

```typescript
/**
 * Find and click the submit/send button.
 *
 * Similar to textarea: try multiple selectors from most stable to least.
 */
async function clickSubmitButton(page: Page): Promise<void> {
  // Try selectors in order of reliability
  const buttonSelectors = [
    // By role + name (most reliable for buttons)
    page.getByRole("button", { name: /send|submit|reply/i }),
    page.getByRole("button", { name: /send quote/i }),
    page.getByRole("button", { name: /send message/i }),

    // By data-testid
    page.locator('[data-testid="send-button"]'),
    page.locator('[data-testid="submit-button"]'),

    // By type
    page.locator('button[type="submit"]'),

    // By text content (least stable)
    page.locator('button:has-text("Send")'),
    page.locator('button:has-text("Submit")'),
    page.locator('input[type="submit"]'),
  ];

  for (const locator of buttonSelectors) {
    try {
      const isVisible = await locator.isVisible({ timeout: 2000 });
      if (isVisible) {
        await randomDelay(500, 1500); // Pause before clicking (human-like)
        await locator.click();
        console.log("Submit button clicked");
        return;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not find submit button — no selector matched");
}
```

### Verify submission succeeded

```typescript
/**
 * After clicking submit, verify the reply was actually sent.
 * Look for success indicators (confirmation message, redirect, etc.)
 */
async function verifySubmission(page: Page, portal: string): Promise<void> {
  // Wait a moment for the page to react
  await randomDelay(1000, 2000);

  // Check for success indicators
  const successIndicators = [
    page.getByText(/sent|success|delivered|thank/i),
    page.getByText(/message sent/i),
    page.getByText(/quote sent/i),
    page.locator(".success-message, .alert-success, [role='alert']"),
  ];

  let confirmed = false;
  for (const indicator of successIndicators) {
    try {
      const isVisible = await indicator.isVisible({ timeout: 5000 });
      if (isVisible) {
        confirmed = true;
        break;
      }
    } catch {
      continue;
    }
  }

  // Also check for error indicators
  const errorIndicators = [
    page.getByText(/error|failed|try again/i),
    page.locator(".error-message, .alert-danger, .alert-error"),
  ];

  for (const indicator of errorIndicators) {
    try {
      const isVisible = await indicator.isVisible({ timeout: 1000 });
      if (isVisible) {
        const errorText = await indicator.textContent();
        throw new Error(`${portal} submission error: ${errorText}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("submission error")) throw e;
      // Not found — good, no error
    }
  }

  if (!confirmed) {
    // No success and no error — take a screenshot for manual review
    console.warn(`Could not confirm submission on ${portal} — screenshot saved`);
    await page.screenshot({
      path: `logs/screenshots/${portal}-unconfirmed-${Date.now()}.png`,
    });
    // Don't throw — the reply may have been sent even if we can't confirm
  }
}
```

---

## 7. Error Handling

### Concrete try/catch patterns

```typescript
/**
 * Custom error types for portal automation.
 * These help the orchestrator decide what to do:
 *   - SessionExpired → re-login and retry
 *   - CaptchaDetected → fall back to SMS
 *   - TwoFactorRequired → fall back to SMS
 *   - SelectorNotFound → take screenshot, fall back to SMS
 *   - SubmissionFailed → take screenshot, fall back to SMS
 */
class PortalError extends Error {
  constructor(
    message: string,
    public readonly portal: string,
    public readonly errorType:
      | "session_expired"
      | "captcha"
      | "two_factor"
      | "selector_not_found"
      | "submission_failed"
      | "navigation_timeout"
      | "unknown"
  ) {
    super(message);
    this.name = "PortalError";
  }
}
```

### The main try/catch wrapper

```typescript
/**
 * Submit a reply to a portal with full error handling.
 * This is the function the orchestrator calls.
 *
 * Returns: { success: true } or { success: false, error: string, screenshotPath?: string }
 */
async function submitPortalReply(
  portal: "gigsalad" | "yelp",
  portalUrl: string,
  replyText: string,
  credentials: { email: string; password: string },
  quotePrice?: number
): Promise<{ success: boolean; error?: string; screenshotPath?: string }> {
  let context: BrowserContext | null = null;

  try {
    // Step 1: Launch browser with persistent context
    context = await launchPortalBrowser(portal, { headless: true });
    const page = context.pages()[0] || (await context.newPage());

    // Apply anti-detection scripts
    await applyStealthScripts(page);

    // Step 2: Check if already logged in
    let loggedIn = await isLoggedIn(page, portal);

    // Step 3: Login if needed (with retry)
    if (!loggedIn) {
      try {
        await loginToPortal(page, portal, credentials);
      } catch (loginError) {
        // Check specifically for 2FA and CAPTCHA
        if (await check2FA(page)) {
          const screenshotPath = `logs/screenshots/${portal}-2fa-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          return {
            success: false,
            error: `2FA required on ${portal} — manual login needed`,
            screenshotPath,
          };
        }
        if (await checkCaptcha(page)) {
          const screenshotPath = `logs/screenshots/${portal}-captcha-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          return {
            success: false,
            error: `CAPTCHA on ${portal} login — manual solve needed`,
            screenshotPath,
          };
        }
        // Some other login error
        const screenshotPath = `logs/screenshots/${portal}-login-fail-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        return {
          success: false,
          error: `Login to ${portal} failed: ${loginError instanceof Error ? loginError.message : String(loginError)}`,
          screenshotPath,
        };
      }
    }

    // Step 4: Navigate to the lead
    try {
      await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await waitForCloudflare(page);
    } catch (navError) {
      const screenshotPath = `logs/screenshots/${portal}-nav-fail-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      return {
        success: false,
        error: `Navigation to ${portal} lead failed (timeout or network error)`,
        screenshotPath,
      };
    }

    // Step 5: Check if we got kicked back to login (session expired mid-navigation)
    if (page.url().includes("login") || page.url().includes("signin")) {
      // Try ONE re-login
      try {
        await loginToPortal(page, portal, credentials);
        await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch {
        const screenshotPath = `logs/screenshots/${portal}-relogin-fail-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        return {
          success: false,
          error: `Session expired on ${portal} and re-login failed`,
          screenshotPath,
        };
      }
    }

    // Step 6: Check for CAPTCHA on the lead page
    if (await checkCaptcha(page)) {
      const screenshotPath = `logs/screenshots/${portal}-captcha-lead-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      return {
        success: false,
        error: `CAPTCHA appeared on ${portal} lead page`,
        screenshotPath,
      };
    }

    // Step 7: Fill the reply form
    try {
      if (portal === "gigsalad" && quotePrice) {
        await fillGigSaladQuoteForm(page, replyText, quotePrice);
      } else {
        await fillReplyForm(page, replyText);
      }
    } catch (fillError) {
      const screenshotPath = `logs/screenshots/${portal}-fill-fail-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return {
        success: false,
        error: `Could not fill reply form on ${portal}: ${fillError instanceof Error ? fillError.message : String(fillError)}`,
        screenshotPath,
      };
    }

    // Step 8: Submit
    try {
      await clickSubmitButton(page);
      await verifySubmission(page, portal);
    } catch (submitError) {
      const screenshotPath = `logs/screenshots/${portal}-submit-fail-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return {
        success: false,
        error: `Submit failed on ${portal}: ${submitError instanceof Error ? submitError.message : String(submitError)}`,
        screenshotPath,
      };
    }

    return { success: true };

  } catch (unexpectedError) {
    // Catch-all for anything we didn't anticipate
    const screenshotPath = `logs/screenshots/${portal}-unexpected-${Date.now()}.png`;
    // Try to take a screenshot even for unexpected errors
    try {
      const page = context?.pages()[0];
      if (page) await page.screenshot({ path: screenshotPath });
    } catch {
      // Can't even screenshot — that's fine
    }
    return {
      success: false,
      error: `Unexpected error on ${portal}: ${unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError)}`,
      screenshotPath,
    };

  } finally {
    // IMPORTANT: Close the context but keep the data on disk
    // Closing saves cookies/sessions for next time
    if (context) {
      await context.close();
    }
  }
}
```

### Timeout configuration pattern

```typescript
/**
 * Centralized timeout values.
 * Keep them in one place so they're easy to tune.
 */
const TIMEOUTS = {
  navigation: 15000,   // 15 seconds to load a page
  loginCheck: 5000,    // 5 seconds to verify login status
  selectorFind: 10000, // 10 seconds to find a form element
  cloudflare: 15000,   // 15 seconds for Cloudflare challenge
  totalPerLead: 60000, // 60 seconds total per lead (hard limit)
} as const;
```

### Total timeout per lead (prevents hanging forever)

```typescript
/**
 * Wrap the entire portal submission in a timeout.
 * If anything takes more than 60 seconds total, give up.
 */
async function submitWithTimeout(
  portal: "gigsalad" | "yelp",
  portalUrl: string,
  replyText: string,
  credentials: { email: string; password: string },
  quotePrice?: number
): Promise<{ success: boolean; error?: string; screenshotPath?: string }> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Total timeout (${TIMEOUTS.totalPerLead}ms) exceeded for ${portal}`)),
      TIMEOUTS.totalPerLead
    )
  );

  try {
    return await Promise.race([
      submitPortalReply(portal, portalUrl, replyText, credentials, quotePrice),
      timeoutPromise,
    ]);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

---

## 8. Screenshot on Failure

### Why screenshots matter

When your automation runs headless on the old Mac and something goes wrong, you can't see what happened. Screenshots are your debugging eyes.

### Basic screenshot

```typescript
// Save a screenshot of what the browser is showing right now
await page.screenshot({
  path: "logs/screenshots/gigsalad-error-1711700000000.png",
});
```

### Full-page screenshot (captures content below the fold)

```typescript
await page.screenshot({
  path: "logs/screenshots/gigsalad-error-1711700000000.png",
  fullPage: true, // Captures the ENTIRE page, not just the visible area
});
```

### Screenshot with timestamp and context

```typescript
/**
 * Take a diagnostic screenshot with descriptive filename.
 *
 * Creates files like:
 *   logs/screenshots/gigsalad-login-fail-2026-03-29T14-30-00.png
 *   logs/screenshots/yelp-captcha-2026-03-29T14-30-00.png
 */
async function takeDebugScreenshot(
  page: Page,
  portal: string,
  reason: string
): Promise<string> {
  // Create a filename-safe timestamp (colons aren't allowed in filenames)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${portal}-${reason}-${timestamp}.png`;
  const filepath = `logs/screenshots/${filename}`;

  // Ensure directory exists
  const { mkdirSync } = await import("fs");
  mkdirSync("logs/screenshots", { recursive: true });

  await page.screenshot({
    path: filepath,
    fullPage: true,
  });

  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}
```

### Cleanup old screenshots

Screenshots accumulate. Clean up old ones to save disk space:

```typescript
import { readdirSync, statSync, unlinkSync } from "fs";
import path from "path";

/**
 * Delete screenshots older than 7 days.
 * Call this once per day (e.g., at the start of the polling loop).
 */
function cleanOldScreenshots(dir: string = "logs/screenshots", maxAgeDays: number = 7): void {
  try {
    const files = readdirSync(dir);
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const file of files) {
      const filepath = path.join(dir, file);
      const stats = statSync(filepath);
      if (now - stats.mtimeMs > maxAgeMs) {
        unlinkSync(filepath);
        console.log(`Cleaned up old screenshot: ${filepath}`);
      }
    }
  } catch {
    // Directory doesn't exist yet — that's fine
  }
}
```

---

## 9. Headless vs Headed Mode

### What's the difference?

- **Headless (`headless: true`):** The browser runs invisibly in the background. No window appears on screen. This is what you want for the always-on server.
- **Headed (`headless: false`):** A real Chrome window opens on screen. You can see everything the browser does. Useful for debugging and initial setup.

### Tradeoffs for an always-on Mac

| Factor | Headless | Headed |
|--------|----------|--------|
| **Resource usage** | Lower (no rendering to screen) | Higher (renders every pixel) |
| **Debugging** | Hard (can't see what's happening) | Easy (watch it work) |
| **Anti-detection** | Slightly more detectable (some sites check) | Looks more like a real browser |
| **Always-on server** | Ideal — no window clutter | Window stays open, can interfere with screensaver/sleep |
| **Initial setup** | Can't manually handle 2FA/CAPTCHA | Can manually handle 2FA/CAPTCHA |
| **Screenshot debugging** | Rely on `page.screenshot()` | Can also watch live |

### Recommended approach

```typescript
// In your config:
interface AutomationConfig {
  // ...
  headless: boolean; // From .env: HEADLESS=true or HEADLESS=false
}

// Default to headless, but allow override for debugging
const headless = process.env.HEADLESS !== "false"; // true unless explicitly "false"
```

**Workflow:**

1. **First-ever run:** Use `HEADLESS=false` so you can see the browser, manually log in, handle 2FA, verify selectors work. The persistent context saves the login session.

2. **After initial setup:** Switch to `HEADLESS=true`. From now on, the saved session keeps you logged in. The browser runs invisibly.

3. **When debugging a failure:** Temporarily set `HEADLESS=false`, trigger the failing lead manually, watch what happens. Review screenshots from `logs/screenshots/`.

### New Headless vs Old Headless

Playwright (and Chrome) has two headless modes:

```typescript
// "New headless" (default in modern Playwright) — recommended
// Uses the same rendering engine as headed mode
// Better anti-detection, more accurate behavior
headless: true

// "Old headless" — avoid unless you have a specific reason
// Uses a different, simpler rendering engine
// More detectable, some features missing
channel: "chrome",
args: ["--headless=old"]
```

The default `headless: true` in Playwright v1.40+ uses "new headless" automatically. You don't need to do anything special.

---

## 10. Full TypeScript Code Examples

### Complete GigSalad sender module

This is the full implementation file that would go in `src/automation/senders/gigsalad.ts`:

```typescript
// src/automation/senders/gigsalad.ts
//
// Automates replying to GigSalad leads via their web portal.
// Uses Playwright with a persistent browser context to stay logged in.

import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import { mkdirSync } from "fs";

// ─── Configuration ────────────────────────────────────────────────
const BROWSER_DATA_DIR = path.resolve("data/browser/gigsalad");
const SCREENSHOT_DIR = path.resolve("logs/screenshots");

const TIMEOUTS = {
  navigation: 15000,
  loginCheck: 5000,
  selectorFind: 10000,
  cloudflare: 15000,
  totalPerLead: 60000,
} as const;

// Ensure directories exist
mkdirSync(BROWSER_DATA_DIR, { recursive: true });
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ─── Helper: Random Delay ─────────────────────────────────────────
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helper: Debug Screenshot ─────────────────────────────────────
async function screenshot(page: Page, reason: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filepath = path.join(SCREENSHOT_DIR, `gigsalad-${reason}-${timestamp}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot: ${filepath}`);
  return filepath;
}

// ─── Helper: Anti-Detection ───────────────────────────────────────
async function applyStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
}

// ─── Helper: Cloudflare Check ─────────────────────────────────────
async function waitForCloudflare(page: Page): Promise<void> {
  const title = await page.title();
  if (title.toLowerCase().includes("just a moment") || page.url().includes("challenge")) {
    console.log("Cloudflare challenge detected, waiting...");
    try {
      await page.waitForURL((url) => !url.toString().includes("challenge"), {
        timeout: TIMEOUTS.cloudflare,
      });
      await randomDelay(2000, 3000);
    } catch {
      throw new Error("Cloudflare challenge did not resolve within timeout");
    }
  }
}

// ─── Helper: CAPTCHA Check ────────────────────────────────────────
async function hasCaptcha(page: Page): Promise<boolean> {
  const selectors = [
    'iframe[src*="recaptcha"]',
    ".g-recaptcha",
    'iframe[src*="hcaptcha"]',
    ".h-captcha",
    'iframe[src*="challenges.cloudflare.com"]',
  ];
  for (const sel of selectors) {
    try {
      if (await page.locator(sel).isVisible({ timeout: 1500 })) return true;
    } catch { /* not found */ }
  }
  return false;
}

// ─── Helper: 2FA Check ───────────────────────────────────────────
async function has2FA(page: Page): Promise<boolean> {
  const indicators = [
    page.getByText(/verification code/i),
    page.getByText(/two.?factor/i),
    page.locator('input[autocomplete="one-time-code"]'),
  ];
  for (const loc of indicators) {
    try {
      if (await loc.isVisible({ timeout: 1500 })) return true;
    } catch { /* not found */ }
  }
  return false;
}

// ─── Core: Check If Logged In ─────────────────────────────────────
async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // [VERIFY LIVE] — navigate to member area and check for logged-in indicator
    await page.goto("https://www.gigsalad.com/member/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.navigation,
    });
    await waitForCloudflare(page);

    // Check URL: if we stayed on dashboard, we're logged in
    // If we got redirected to login page, we're not
    const url = page.url();
    if (url.includes("login") || url.includes("signin")) return false;

    // Double-check: look for a known logged-in element
    // [VERIFY LIVE] — replace with actual element from the member dashboard
    try {
      await page.getByText(/leads|inbox|dashboard/i).first().waitFor({
        state: "visible",
        timeout: TIMEOUTS.loginCheck,
      });
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// ─── Core: Login ──────────────────────────────────────────────────
async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // [VERIFY LIVE] — check actual login URL
  await page.goto("https://www.gigsalad.com/login", {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.navigation,
  });
  await waitForCloudflare(page);

  // [VERIFY LIVE] — check actual form field selectors
  // Try label-based first, fall back to input type
  const emailField =
    page.getByLabel(/email/i).or(page.locator('input[type="email"]')).or(page.locator('input[name="email"]'));
  const passwordField =
    page.getByLabel(/password/i).or(page.locator('input[type="password"]')).or(page.locator('input[name="password"]'));

  await emailField.fill(email);
  await randomDelay(300, 800);
  await passwordField.fill(password);
  await randomDelay(500, 1500);

  // [VERIFY LIVE] — check actual submit button text
  const submitButton = page
    .getByRole("button", { name: /log\s*in|sign\s*in/i })
    .or(page.locator('button[type="submit"]'));
  await submitButton.click();

  // Wait for navigation after login
  await page.waitForURL((url) => !url.toString().includes("login"), {
    timeout: TIMEOUTS.navigation,
  });

  // Check for 2FA
  if (await has2FA(page)) {
    throw new Error("2FA prompt detected — manual login required");
  }

  // Check for CAPTCHA
  if (await hasCaptcha(page)) {
    throw new Error("CAPTCHA detected during login — manual solve required");
  }
}

// ─── Core: Fill Reply Form ────────────────────────────────────────
async function fillAndSubmit(
  page: Page,
  replyText: string,
  quotePrice?: number
): Promise<void> {
  // [VERIFY LIVE] — GigSalad may require clicking a button to open the reply form
  // Check for a "Send Quote" or "Reply" button
  const openFormButton = page.getByRole("button", { name: /reply|send quote|respond/i });
  try {
    if (await openFormButton.isVisible({ timeout: 3000 })) {
      await openFormButton.click();
      await randomDelay(500, 1000);
    }
  } catch { /* button not present — form may already be visible */ }

  // [VERIFY LIVE] — check for a price input field
  if (quotePrice) {
    const priceField = page.locator(
      'input[name="price"], input[name="quote_price"], input[name="amount"], input[name="bid"]'
    );
    try {
      if (await priceField.isVisible({ timeout: 2000 })) {
        await priceField.fill(String(quotePrice));
        await randomDelay(300, 600);
      }
    } catch { /* no price field — that's OK */ }
  }

  // Find and fill the message textarea
  // [VERIFY LIVE] — check actual textarea selector
  const textarea = page
    .locator('textarea[name="message"]')
    .or(page.locator('textarea[name="reply"]'))
    .or(page.locator('textarea[name="body"]'))
    .or(page.locator("textarea").first())
    .or(page.locator('[contenteditable="true"]').first());

  await textarea.waitFor({ state: "visible", timeout: TIMEOUTS.selectorFind });
  await textarea.click();
  await randomDelay(300, 600);
  await textarea.fill(replyText);
  await randomDelay(500, 1500);

  // Click submit
  // [VERIFY LIVE] — check actual submit button
  const submitButton = page
    .getByRole("button", { name: /send|submit/i })
    .or(page.locator('button[type="submit"]'));
  await submitButton.click();

  // Verify submission
  await randomDelay(1000, 2000);

  // Check for error messages
  const errorMsg = page.locator(".error, .alert-danger, .alert-error");
  try {
    if (await errorMsg.isVisible({ timeout: 2000 })) {
      const text = await errorMsg.textContent();
      throw new Error(`Form submission error: ${text}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Form submission error")) throw e;
  }
}

// ─── Public API ───────────────────────────────────────────────────

export interface GigSaladSendResult {
  success: boolean;
  error?: string;
  screenshotPath?: string;
}

/**
 * Submit a reply to a GigSalad lead via the web portal.
 *
 * This is the only function the orchestrator calls.
 * It handles: launch browser → check login → login if needed →
 *             navigate → fill form → submit → verify.
 *
 * On any failure, it takes a screenshot and returns { success: false }.
 */
export async function sendGigSaladReply(
  portalUrl: string,
  replyText: string,
  credentials: { email: string; password: string },
  quotePrice?: number,
  options?: { headless?: boolean }
): Promise<GigSaladSendResult> {
  let context: BrowserContext | null = null;

  try {
    // ── Launch persistent browser ──
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: options?.headless ?? true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
      ],
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/122.0.0.0 Safari/537.36",
    });

    const page = context.pages()[0] || (await context.newPage());
    await applyStealthScripts(page);

    // ── Check if logged in ──
    let loggedIn = await isLoggedIn(page);

    // ── Login if needed ──
    if (!loggedIn) {
      try {
        await login(page, credentials.email, credentials.password);
      } catch (e) {
        const sp = await screenshot(page, "login-fail");
        return { success: false, error: `Login failed: ${(e as Error).message}`, screenshotPath: sp };
      }
    }

    // ── Navigate to the lead ──
    try {
      await page.goto(portalUrl, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.navigation,
      });
      await waitForCloudflare(page);
    } catch {
      const sp = await screenshot(page, "nav-fail");
      return { success: false, error: "Failed to navigate to lead page", screenshotPath: sp };
    }

    // ── Check for session expiry (redirected to login) ──
    if (page.url().includes("login") || page.url().includes("signin")) {
      try {
        await login(page, credentials.email, credentials.password);
        await page.goto(portalUrl, {
          waitUntil: "domcontentloaded",
          timeout: TIMEOUTS.navigation,
        });
      } catch {
        const sp = await screenshot(page, "relogin-fail");
        return { success: false, error: "Session expired and re-login failed", screenshotPath: sp };
      }
    }

    // ── Check for CAPTCHA ──
    if (await hasCaptcha(page)) {
      const sp = await screenshot(page, "captcha");
      return { success: false, error: "CAPTCHA on lead page", screenshotPath: sp };
    }

    // ── Fill and submit ──
    try {
      await fillAndSubmit(page, replyText, quotePrice);
    } catch (e) {
      const sp = await screenshot(page, "submit-fail");
      return { success: false, error: `Submit failed: ${(e as Error).message}`, screenshotPath: sp };
    }

    return { success: true };

  } catch (e) {
    // Unexpected error
    let sp: string | undefined;
    try {
      const page = context?.pages()[0];
      if (page) sp = await screenshot(page, "unexpected");
    } catch { /* can't screenshot */ }
    return { success: false, error: `Unexpected: ${(e as Error).message}`, screenshotPath: sp };

  } finally {
    // Always close — saves cookies/sessions to disk
    if (context) await context.close();
  }
}
```

### Complete Yelp sender module

The Yelp sender follows the same structure. Here is the key difference file:

```typescript
// src/automation/senders/yelp.ts
//
// Same pattern as gigsalad.ts but with Yelp-specific URLs and selectors.

import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import { mkdirSync } from "fs";

const BROWSER_DATA_DIR = path.resolve("data/browser/yelp");
const SCREENSHOT_DIR = path.resolve("logs/screenshots");

mkdirSync(BROWSER_DATA_DIR, { recursive: true });
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ... (same helpers as gigsalad.ts — randomDelay, screenshot, applyStealthScripts,
//      waitForCloudflare, hasCaptcha, has2FA — consider extracting to a shared module)

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // [VERIFY LIVE] — Yelp business portal URL
    await page.goto("https://biz.yelp.com/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const url = page.url();
    if (url.includes("login") || url.includes("signin")) return false;

    // [VERIFY LIVE] — check for Yelp business dashboard element
    try {
      await page.getByText(/messages|inbox|overview/i).first().waitFor({
        state: "visible",
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

async function login(page: Page, email: string, password: string): Promise<void> {
  // [VERIFY LIVE] — Yelp business login URL
  // Note: Yelp may use biz.yelp.com/login or redirect to www.yelp.com/login
  await page.goto("https://biz.yelp.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // [VERIFY LIVE] — Yelp login form selectors
  // Yelp has historically used id-based selectors
  const emailField = page
    .locator('#email')
    .or(page.getByLabel(/email/i))
    .or(page.locator('input[name="email"]'));
  const passwordField = page
    .locator('#password')
    .or(page.getByLabel(/password/i))
    .or(page.locator('input[type="password"]'));

  await emailField.fill(email);
  await randomDelay(300, 800);
  await passwordField.fill(password);
  await randomDelay(500, 1500);

  await page.getByRole("button", { name: /log\s*in|sign\s*in/i })
    .or(page.locator('button[type="submit"]'))
    .click();

  await page.waitForURL((url) => !url.toString().includes("login"), { timeout: 15000 });
}

async function fillAndSubmit(page: Page, replyText: string): Promise<void> {
  // [VERIFY LIVE] — Yelp messaging interface
  // Yelp's business messaging likely has a textbox at the bottom of the thread
  const textarea = page
    .locator('textarea[name="message"]')
    .or(page.locator('[role="textbox"]'))
    .or(page.locator('[contenteditable="true"]'))
    .or(page.locator("textarea").first());

  await textarea.waitFor({ state: "visible", timeout: 10000 });
  await textarea.click();
  await randomDelay(300, 600);
  await textarea.fill(replyText);
  await randomDelay(500, 1500);

  // [VERIFY LIVE] — Yelp send button
  const sendButton = page
    .getByRole("button", { name: /send/i })
    .or(page.locator('button[type="submit"]'));
  await sendButton.click();

  await randomDelay(1000, 2000);
}

export interface YelpSendResult {
  success: boolean;
  error?: string;
  screenshotPath?: string;
}

export async function sendYelpReply(
  portalUrl: string,
  replyText: string,
  credentials: { email: string; password: string },
  options?: { headless?: boolean }
): Promise<YelpSendResult> {
  // Same structure as sendGigSaladReply — launch, check login,
  // login if needed, navigate, fill, submit, screenshot on failure.
  // (See gigsalad.ts for the full pattern)

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: options?.headless ?? true,
      args: ["--disable-blink-features=AutomationControlled", "--disable-infobars"],
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/122.0.0.0 Safari/537.36",
    });

    const page = context.pages()[0] || (await context.newPage());
    await applyStealthScripts(page);

    if (!(await isLoggedIn(page))) {
      await login(page, credentials.email, credentials.password);
    }

    await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    if (page.url().includes("login")) {
      await login(page, credentials.email, credentials.password);
      await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    }

    if (await hasCaptcha(page)) {
      const sp = await screenshot(page, "captcha");
      return { success: false, error: "CAPTCHA on Yelp", screenshotPath: sp };
    }

    await fillAndSubmit(page, replyText);
    return { success: true };

  } catch (e) {
    let sp: string | undefined;
    try {
      const pg = context?.pages()[0];
      if (pg) sp = await screenshot(pg, "error");
    } catch { /* */ }
    return { success: false, error: (e as Error).message, screenshotPath: sp };

  } finally {
    if (context) await context.close();
  }
}
```

### How the orchestrator uses these senders

```typescript
// Inside src/automation/orchestrator.ts — the relevant sender dispatch

import { sendGigSaladReply } from "./senders/gigsalad.js";
import { sendYelpReply } from "./senders/yelp.js";
import { sendSms } from "./senders/twilio-sms.js";
import type { AutoSendResult } from "./types.js";

async function dispatchReply(result: AutoSendResult, config: AutomationConfig): Promise<void> {
  const { lead, pipelineOutput } = result;
  const replyText = pipelineOutput.verified; // The final, verified draft

  let sendResult: { success: boolean; error?: string; screenshotPath?: string };

  switch (lead.platform) {
    case "gigsalad":
      sendResult = await sendGigSaladReply(
        lead.portalUrl,
        replyText,
        { email: config.gigsaladEmail, password: config.gigsaladPassword },
        pipelineOutput.pricing.quote_price,
        { headless: config.headless }
      );
      break;

    case "yelp":
      sendResult = await sendYelpReply(
        lead.portalUrl,
        replyText,
        { email: config.yelpEmail, password: config.yelpPassword },
        { headless: config.headless }
      );
      break;

    case "squarespace":
      // Gmail API sender — no Playwright needed (separate module)
      sendResult = await sendGmailReply(lead.clientEmail, replyText, config);
      break;
  }

  // If portal submission failed, fall back to SMS
  if (!sendResult.success) {
    console.error(`Portal send failed: ${sendResult.error}`);
    const portalLink = "portalUrl" in lead ? lead.portalUrl : "N/A";
    await sendSms(
      `FAIL: ${lead.platform} lead. ${sendResult.error?.slice(0, 80)}. Link: ${portalLink}`
    );
  }
}
```

---

## Appendix A: Shared Utilities to Extract

The GigSalad and Yelp senders share a LOT of code. Before implementing, extract shared helpers into a single file:

```typescript
// src/automation/senders/browser-utils.ts
//
// Shared browser automation utilities used by both gigsalad.ts and yelp.ts

export { randomDelay }       // Human-like timing
export { applyStealthScripts } // Anti-detection init scripts
export { waitForCloudflare }   // Cloudflare challenge handler
export { hasCaptcha }          // CAPTCHA detection
export { has2FA }              // 2FA detection
export { screenshot }          // Debug screenshot helper
export { cleanOldScreenshots } // Screenshot cleanup
```

This way each sender file only contains the portal-specific logic (URLs, selectors, form fields).

---

## Appendix B: First-Time Setup Checklist

Before the automation can work, you need to do this **once manually**:

1. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```
   This downloads the Chromium browser that Playwright controls. ~200MB.

2. **First login — headed mode:**
   ```bash
   HEADLESS=false npx tsx src/automation/senders/gigsalad.ts
   ```
   Watch the browser window. If 2FA or CAPTCHA appears, handle it manually. The persistent context saves the session.

3. **Verify selectors:** While in headed mode, inspect each portal's:
   - Login page form fields (email input, password input, submit button)
   - Lead/message page layout (textarea, send button)
   - Logged-in indicator (what element proves you're logged in)

   Update the `[VERIFY LIVE]` selectors in the code.

4. **Test in DRY_RUN mode:** Run the full flow but don't actually click submit. Log what would happen.

5. **Switch to headless:** Once everything works, set `HEADLESS=true` and let it run.

---

## Appendix C: References

- **Playwright persistent context docs:** https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
- **Playwright authentication guide:** https://playwright.dev/docs/auth
- **Playwright locators guide (getByRole, getByLabel, etc.):** https://playwright.dev/docs/locators
- **Playwright page API (goto, fill, click, screenshot):** https://playwright.dev/docs/api/class-page
- **Playwright best practices:** https://playwright.dev/docs/best-practices
- **GigSalad performer account:** https://www.gigsalad.com/login (member portal)
- **Yelp for Business:** https://biz.yelp.com (business portal)
- **Chrome user agent strings:** https://www.whatismybrowser.com/guides/the-latest-user-agent/chrome
- **Playwright stealth discussion:** https://github.com/nicedayfor/playwright-extra (community anti-detection plugins)

---

## Appendix D: Key Risks and Mitigations Summary

| Risk | Mitigation | Fallback |
|------|-----------|----------|
| Portal layout changes | Use stable selectors (role, label, name, not CSS class) | Screenshot + SMS |
| Session expires | Persistent context + auto re-login | SMS with draft + link |
| CAPTCHA appears | Persistent context reduces frequency | SMS notification |
| 2FA triggered | Disable 2FA or log in manually once | SMS notification |
| Yelp blocks automation | Human-like delays, real user agent, low frequency | SMS notification |
| Total timeout | 60-second hard limit per lead | SMS notification |
| Browser crash | pm2 restarts the process | Next poll cycle retries |
| Selectors all fail | Try multiple selectors, screenshot on failure | SMS notification |

**The golden rule:** Every failure path ends with an SMS to Alejandro containing the draft text and portal link, so the lead can still be responded to manually within minutes.
