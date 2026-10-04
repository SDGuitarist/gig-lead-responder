/**
 * Sign the app in to one GigSalad account: `npm run gigsalad:login -- music` (or business).
 *
 * Opens the app's own browser on screen at GigSalad's login page. Alex signs in himself
 * (no password is read or stored anywhere), then closes the window. The script then reopens
 * the same profile hidden and checks that the inbox loads, and says plainly whether the
 * session was saved. It never opens a lead, never sends anything.
 */
import { chromium } from "playwright";
import { gigsaladProfileDir, parseGigSaladAccount } from "../src/automation/portals/gigsalad-accounts.js";

const INBOX = "https://www.gigsalad.com/promokit/inbox";
const ARGS = ["--disable-blink-features=AutomationControlled"];

async function main(): Promise<number> {
  const account = parseGigSaladAccount(process.argv[2]);
  const dir = gigsaladProfileDir(account);

  const visible = await chromium.launchPersistentContext(dir, { headless: false, args: ARGS });
  const page = visible.pages()[0] ?? (await visible.newPage());
  await page.goto(INBOX, { waitUntil: "domcontentloaded" });
  console.log(`\nSign in to the GigSalad ${account.toUpperCase()} account in the window that opened.`);
  console.log("Tick 'keep me signed in' if GigSalad offers it. When you see your inbox, close the window.\n");
  await new Promise<void>((resolve) => {
    visible.on("close", () => resolve());
    page.on("close", () => resolve());
  });
  await visible.close().catch(() => {});

  // Check the saved session, hidden: a failed save must not read as success.
  const check = await chromium.launchPersistentContext(dir, { headless: true, args: ARGS });
  try {
    const p = await check.newPage();
    await p.goto(INBOX, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const signedIn = p.url().startsWith(INBOX) && /Inbox/i.test(await p.title());
    console.log(signedIn
      ? `SIGNED IN: the app's ${account} session is saved (${dir}).`
      : `STILL SIGNED OUT: the ${account} session was not saved (landed on ${new URL(p.url()).pathname}). Run this again.`);
    return signedIn ? 0 : 1;
  } finally {
    await check.close();
  }
}

main().then((code) => process.exit(code), (err) => {
  console.error(`gigsalad:login failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
