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

      // Navigate to the lead page
      await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });

      // Check if we need to log in
      const needsLogin = await this.detectLoginPage(page);
      if (needsLogin) {
        const loginOk = await this.login(page);
        if (!loginOk) {
          return { success: false, fullMessage: "", error: "Login failed — may need manual auth" };
        }
        // Re-navigate after login
        await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });
      }

      // Extract the full message text [VERIFY LIVE]
      // Yelp business messaging page typically has the conversation in a thread
      const messageText = await page.evaluate(() => {
        // Try multiple selectors for the message container
        const selectors = [
          "[data-testid='message-content']",
          ".message-content",
          ".conversation-message",
          "[role='article']",
          ".biz-message-body",
        ];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            // Get the first (client's) message
            return els[0].textContent?.trim() || "";
          }
        }
        // Fallback: get all paragraph text from main content
        const main = document.querySelector("main") || document.body;
        return main.textContent?.trim().slice(0, 5000) || "";
      });

      // Try to extract client name [VERIFY LIVE]
      const clientName = await page.evaluate(() => {
        const nameEl = document.querySelector(
          "[data-testid='sender-name'], .sender-name, .message-sender"
        );
        return nameEl?.textContent?.trim();
      });

      await context.close();

      if (!messageText) {
        return { success: false, fullMessage: "", error: "Could not extract message text from portal" };
      }

      return { success: true, fullMessage: messageText, clientName: clientName || undefined };
    } catch (err) {
      await this.screenshotOnFailure(context, "yelp-fetch");
      await context?.close();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, fullMessage: "", error: message };
    }
  }

  /**
   * Submit a reply on the Yelp business portal.
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

      // Check login
      const needsLogin = await this.detectLoginPage(page);
      if (needsLogin) {
        const loginOk = await this.login(page);
        if (!loginOk) {
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

      // Small delay to appear human
      await page.waitForTimeout(500 + Math.random() * 1000);

      // Click send [VERIFY LIVE]
      const sendBtn = page.locator(
        "button[type='submit'], button:has-text('Send'), button[data-testid='send-button']"
      ).first();

      await sendBtn.click();

      // Wait for confirmation [VERIFY LIVE]
      await page.waitForTimeout(2000);

      await context.close();
      return { success: true };
    } catch (err) {
      await this.screenshotOnFailure(context, "yelp-submit");
      await context?.close();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  private async detectLoginPage(page: import("playwright").Page): Promise<boolean> {
    // Check if the current URL is a login page or if login form is present
    const url = page.url();
    if (url.includes("/login") || url.includes("/signup")) return true;

    const loginForm = await page.locator("#login-form, form[action*='login']").count();
    return loginForm > 0;
  }

  private async login(page: import("playwright").Page): Promise<boolean> {
    try {
      // Navigate to login if not already there [VERIFY LIVE]
      if (!page.url().includes("/login")) {
        await page.goto("https://biz.yelp.com/login", { timeout: 15_000 });
      }

      // Fill credentials [VERIFY LIVE]
      await page.fill("input[name='email'], #email", this.email);
      await page.fill("input[name='password'], #password", this.password);

      // Human-like delay
      await page.waitForTimeout(500 + Math.random() * 500);

      await page.click("button[type='submit'], #login-button");

      // Wait for navigation away from login page
      await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15_000 });

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
      // Screenshot is best-effort — don't fail on failure
    }
  }

  async close(): Promise<void> {
    // No persistent state to clean up — context is closed after each operation
  }
}
