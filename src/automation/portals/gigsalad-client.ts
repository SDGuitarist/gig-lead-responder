/**
 * GigSalad Portal Client — Playwright-based browser automation.
 *
 * Single operation: submitReply(portalUrl, text)
 * (GigSalad emails contain the full lead — no enrichment needed)
 *
 * Uses persistent browser context to maintain login sessions.
 * NOTE: All selectors marked [VERIFY LIVE] need manual inspection.
 */

import type { PortalResult } from "./yelp-client.js";

export class GigSaladPortalClient {
  private dataDir: string;
  private email: string;
  private password: string;
  private headless: boolean;

  constructor(config: { email: string; password: string; headless?: boolean }) {
    this.dataDir = "data/browser/gigsalad";
    this.email = config.email;
    this.password = config.password;
    this.headless = config.headless ?? true;
  }

  /**
   * Submit a reply/quote on the GigSalad portal.
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

      // Check if we need to log in
      const needsLogin = await this.detectLoginPage(page);
      if (needsLogin) {
        const loginOk = await this.login(page);
        if (!loginOk) {
          return { success: false, error: "Login failed — may need manual auth" };
        }
        await page.goto(portalUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });
      }

      // Find the reply/quote textarea [VERIFY LIVE]
      const textarea = page.locator(
        "textarea[name='message'], textarea[data-testid='quote-message'], textarea[placeholder*='message' i], textarea[id*='message' i]"
      ).first();

      await textarea.waitFor({ timeout: 10_000 });
      await textarea.fill(replyText);

      // Human-like delay
      await page.waitForTimeout(500 + Math.random() * 1000);

      // Click send/submit [VERIFY LIVE]
      const sendBtn = page.locator(
        "button[type='submit'], button:has-text('Send Quote'), button:has-text('Send Message'), button:has-text('Submit')"
      ).first();

      await sendBtn.click();

      // Wait for confirmation
      await page.waitForTimeout(2000);

      await context.close();
      return { success: true };
    } catch (err) {
      await this.screenshotOnFailure(context, "gigsalad-submit");
      await context?.close();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  private async detectLoginPage(page: import("playwright").Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("/login") || url.includes("/sign-in")) return true;
    const loginForm = await page.locator("form[action*='login'], form[action*='sign']").count();
    return loginForm > 0;
  }

  private async login(page: import("playwright").Page): Promise<boolean> {
    try {
      if (!page.url().includes("/login")) {
        await page.goto("https://www.gigsalad.com/login", { timeout: 15_000 });
      }

      // [VERIFY LIVE]
      await page.fill("input[name='email'], input[type='email']", this.email);
      await page.fill("input[name='password'], input[type='password']", this.password);
      await page.waitForTimeout(500 + Math.random() * 500);
      await page.click("button[type='submit']");

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
      // Best-effort
    }
  }
}
