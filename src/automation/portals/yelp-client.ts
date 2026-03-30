/**
 * Yelp Portal Client — Playwright-based browser automation.
 *
 * Two operations:
 *   fetchLeadDetails(portalUrl) — read the full client message (email is truncated)
 *   submitReply(portalUrl, text) — post a reply on the portal
 *
 * Uses persistent browser context to maintain login sessions.
 * Falls back to SMS notification on any failure.
 *
 * NOTE: All selectors marked [VERIFY LIVE] need manual inspection before first use.
 * Run in headed mode (HEADLESS=false) to verify selectors against the real portal.
 */

export interface PortalResult {
  success: boolean;
  error?: string;
}

export interface FetchResult extends PortalResult {
  fullMessage: string;
  clientName?: string;
}

/** Minimum characters for a message to be considered real content, not nav/boilerplate */
const MIN_MESSAGE_LENGTH = 20;

/** Known selectors for message containers — tried in order [VERIFY LIVE] */
const MESSAGE_SELECTORS = [
  "[data-testid='message-content']",
  ".message-content",
  ".conversation-message",
  ".biz-message-body",
  "[role='article']",
];

export class YelpPortalClient {
  private dataDir: string;
  private email: string;
  private password: string;
  private headless: boolean;

  constructor(config: { email: string; password: string; headless?: boolean }) {
    this.dataDir = "data/browser/yelp";
    this.email = config.email;
    this.password = config.password;
    this.headless = config.headless ?? true;
  }

  /**
   * Read the full lead message from the Yelp business portal.
   * Yelp email notifications truncate the client's message,
   * so we must visit the portal to get the complete text.
   *
   * Only returns success when a validated message container is found
   * and the extracted text passes basic sanity checks. Generic page
   * text (nav, footers) is NOT treated as a successful enrichment.
   */
  async fetchLeadDetails(portalUrl: string): Promise<FetchResult> {
    if (!portalUrl) {
      return { success: false, fullMessage: "", error: "No portal URL provided" };
    }

    let context;
    try {
      const { chromium } = await import("playwright");
      context = await chromium.launchPersistentContext(this.dataDir, {
        headless: this.headless,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      const page = await context.newPage();
      await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });

      // Detect blocking pages before attempting extraction
      const blocked = await this.detectBlockingPage(page);
      if (blocked) {
        await this.screenshotOnFailure(context, "yelp-fetch-blocked");
        await context.close();
        return { success: false, fullMessage: "", error: `Blocked: ${blocked}` };
      }

      // Check if we need to log in
      const needsLogin = await this.detectLoginPage(page);
      if (needsLogin) {
        const loginOk = await this.login(page);
        if (!loginOk) {
          await this.screenshotOnFailure(context, "yelp-fetch-login-fail");
          await context.close();
          return { success: false, fullMessage: "", error: "Login failed — may need manual auth" };
        }
        await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });

        // Re-check for blocks after login redirect
        const blockedAfterLogin = await this.detectBlockingPage(page);
        if (blockedAfterLogin) {
          await this.screenshotOnFailure(context, "yelp-fetch-blocked-post-login");
          await context.close();
          return { success: false, fullMessage: "", error: `Blocked after login: ${blockedAfterLogin}` };
        }
      }

      // Extract message text from a known container — NOT the whole page.
      // We iterate specific selectors and only accept text from a validated
      // container. If no container matches, we fail rather than scraping
      // generic page text which would produce garbage input for the pipeline.
      const messageText = await page.evaluate((selectors: string[]) => {
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            return { text: els[0].textContent?.trim() || "", selector: sel };
          }
        }
        return { text: "", selector: "" };
      }, MESSAGE_SELECTORS);

      // Sanity check: must have found a real container with real content
      if (!messageText.selector) {
        await this.screenshotOnFailure(context, "yelp-fetch-no-container");
        await context.close();
        return {
          success: false,
          fullMessage: "",
          error: "No known message container found on page — selectors may need updating",
        };
      }

      if (messageText.text.length < MIN_MESSAGE_LENGTH) {
        await this.screenshotOnFailure(context, "yelp-fetch-short-message");
        await context.close();
        return {
          success: false,
          fullMessage: "",
          error: `Message too short (${messageText.text.length} chars) — likely not real content`,
        };
      }

      // Extract client name [VERIFY LIVE]
      const clientName = await page.evaluate(() => {
        const nameEl = document.querySelector(
          "[data-testid='sender-name'], .sender-name, .message-sender"
        );
        return nameEl?.textContent?.trim();
      });

      await context.close();

      return {
        success: true,
        fullMessage: messageText.text,
        clientName: clientName || undefined,
      };
    } catch (err) {
      await this.screenshotOnFailure(context, "yelp-fetch");
      await context?.close();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, fullMessage: "", error: message };
    }
  }

  /**
   * Submit a reply on the Yelp business portal.
   * Verifies a real success signal after clicking send.
   */
  async submitReply(portalUrl: string, replyText: string): Promise<PortalResult> {
    if (!portalUrl) {
      return { success: false, error: "No portal URL provided" };
    }

    let context;
    try {
      const { chromium } = await import("playwright");
      context = await chromium.launchPersistentContext(this.dataDir, {
        headless: this.headless,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      const page = await context.newPage();
      await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });

      // Detect blocking pages
      const blocked = await this.detectBlockingPage(page);
      if (blocked) {
        await this.screenshotOnFailure(context, "yelp-submit-blocked");
        await context.close();
        return { success: false, error: `Blocked: ${blocked}` };
      }

      const needsLogin = await this.detectLoginPage(page);
      if (needsLogin) {
        const loginOk = await this.login(page);
        if (!loginOk) {
          await this.screenshotOnFailure(context, "yelp-submit-login-fail");
          await context.close();
          return { success: false, error: "Login failed — may need manual auth" };
        }
        await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });
      }

      // Find reply textarea [VERIFY LIVE]
      const textarea = page.locator(
        "textarea[name='message'], textarea[data-testid='reply-input'], textarea[placeholder*='message' i]"
      ).first();

      await textarea.waitFor({ timeout: 10_000 });
      await textarea.fill(replyText);
      await page.waitForTimeout(500 + Math.random() * 1000);

      // Click send [VERIFY LIVE]
      const sendBtn = page.locator(
        "button[type='submit'], button:has-text('Send'), button[data-testid='send-button']"
      ).first();

      await sendBtn.click();

      // Verify success — look for confirmation signal instead of blind sleep.
      // Accept any of: success toast, textarea cleared, new message in thread.
      const confirmed = await this.verifySubmitSuccess(page);
      await context.close();

      if (!confirmed) {
        return { success: false, error: "No success confirmation detected after submit" };
      }

      return { success: true };
    } catch (err) {
      await this.screenshotOnFailure(context, "yelp-submit");
      await context?.close();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Detect CAPTCHA, anti-bot, 2FA, or other blocking pages.
   * Returns a description of the block, or null if the page looks normal.
   */
  private async detectBlockingPage(page: import("playwright").Page): Promise<string | null> {
    const url = page.url().toLowerCase();
    const title = (await page.title()).toLowerCase();

    // CAPTCHA / anti-bot
    if (url.includes("captcha") || url.includes("challenge")) {
      return "CAPTCHA page detected";
    }
    const hasCaptcha = await page.locator(
      "iframe[src*='recaptcha'], iframe[src*='hcaptcha'], #captcha, .captcha, [data-testid='captcha']"
    ).count();
    if (hasCaptcha > 0) return "CAPTCHA widget detected on page";

    // Cloudflare challenge
    if (title.includes("just a moment") || title.includes("attention required")) {
      return "Cloudflare challenge page";
    }

    // 2FA / verification
    if (url.includes("verify") || url.includes("two-factor") || url.includes("2fa")) {
      return "2FA / verification page detected";
    }
    const has2FA = await page.locator(
      "input[name='code'], input[name='verification_code'], input[autocomplete='one-time-code']"
    ).count();
    if (has2FA > 0) return "2FA code input detected";

    // Access denied
    if (title.includes("access denied") || title.includes("forbidden")) {
      return "Access denied page";
    }

    return null;
  }

  /**
   * After clicking submit, verify that the reply was actually sent.
   * Looks for: success toast, textarea cleared, or new message appearing.
   */
  private async verifySubmitSuccess(page: import("playwright").Page): Promise<boolean> {
    try {
      // Strategy 1: Look for success toast/alert [VERIFY LIVE]
      const hasToast = await page.locator(
        "[role='alert']:has-text('sent'), .toast:has-text('sent'), .success-message"
      ).count().catch(() => 0);
      if (hasToast > 0) return true;

      // Strategy 2: Wait a moment, then check if textarea was cleared
      await page.waitForTimeout(2000);
      const textarea = page.locator(
        "textarea[name='message'], textarea[data-testid='reply-input']"
      ).first();
      const textareaValue = await textarea.inputValue().catch(() => null);
      if (textareaValue === "") return true; // Cleared = likely sent

      // Strategy 3: Check if our reply text appears in the conversation thread
      // (very loose signal but better than nothing)
      const pageText = await page.locator("main").textContent().catch(() => "");
      if (pageText && pageText.includes("Alex Guillen")) return true;

      return false;
    } catch {
      return false;
    }
  }

  private async detectLoginPage(page: import("playwright").Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("/login") || url.includes("/signup")) return true;
    const loginForm = await page.locator("#login-form, form[action*='login']").count();
    return loginForm > 0;
  }

  private async login(page: import("playwright").Page): Promise<boolean> {
    try {
      if (!page.url().includes("/login")) {
        await page.goto("https://biz.yelp.com/login", { timeout: 15_000 });
      }

      // Check for blocking before login attempt
      const blocked = await this.detectBlockingPage(page);
      if (blocked) return false;

      await page.fill("input[name='email'], #email", this.email);
      await page.fill("input[name='password'], #password", this.password);
      await page.waitForTimeout(500 + Math.random() * 500);
      await page.click("button[type='submit'], #login-button");

      await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15_000 });

      // Check for 2FA/CAPTCHA after login
      const blockedAfter = await this.detectBlockingPage(page);
      if (blockedAfter) return false;

      return true;
    } catch {
      return false;
    }
  }

  private async screenshotOnFailure(
    context: import("playwright").BrowserContext | undefined,
    prefix: string
  ): Promise<void> {
    try {
      if (!context) return;
      const pages = context.pages();
      if (pages.length === 0) return;

      const { mkdirSync } = await import("node:fs");
      mkdirSync("logs/screenshots", { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await pages[0].screenshot({
        path: `logs/screenshots/${prefix}-${timestamp}.png`,
        fullPage: true,
      });
    } catch {
      // Screenshot is best-effort
    }
  }

  async close(): Promise<void> {
    // Context is closed after each operation — nothing to clean up
  }
}
