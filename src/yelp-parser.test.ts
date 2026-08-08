import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseYelpEmail, stripCredentialUrls } from "./automation/parsers/yelp.js";
import type { GmailMessage } from "./automation/gmail-watcher.js";

/**
 * Fixtures reproduce the structure of a REAL Yelp notification observed in
 * Alex's mailbox on 2026-08-07. Token VALUES are placeholders of the same
 * shape — the extractors only care about shape, and a live passwordless token
 * is a bearer credential that must never be committed.
 *
 * Regression target: the parser previously stored Yelp's passwordless login
 * URL as portalUrl AND embedded it in rawText, which is the field sent to the
 * Claude API. See docs/brainstorms/2026-08-07-reply-detection-samples.md.
 */
const PW_TOKEN = "MLA" + "0".repeat(29) + "abc";
const THREAD_PATH = "%2Fmessaging%2FlGwoYFACL339026pNoq5LQ%2Fthread%2FHJzfiO_dPuZqADEtSneTWQ";
const LOGIN_URL = `https://biz.yelp.com/login/passwordless/redirect/${PW_TOKEN}?return_url=${THREAD_PATH}`;
const CLIENT_MSG =
  "Hi Alex, nice to hear from you. The wedding is at Monserate Winery in Fallbrook, not Idyllwild. We are looking for one hour as well.";

function yelpMessage(overrides: Partial<GmailMessage> = {}): GmailMessage {
  const bodyText = `Hi Alex Guillen Music G., Kimberly has replied to your message.

| for business
New Message from Kimberly

[ Kimberly S. ](https://yelp.com/user_details?userid=aTqoSRtTwU-zBkuIofoZzA)
**San Francisco, CA**

${CLIENT_MSG}

| [ Respond Now ](${LOGIN_URL})

Or simply respond by replying to this email`;

  return {
    id: "19f629faa566b061",
    threadId: "19f5cb92ea794c56",
    from: "Yelp <reply+17de1e4965044590b37284774f71ee2d@messaging.yelp.com>",
    to: "alex.guillen.music@gmail.com",
    subject: "RE: Alex Guillen Music's response to Kimberly S.",
    date: "2026-07-14T21:54:17Z",
    replyTo: "",
    messageIdHeader: "<probe@messaging.yelp.com>",
    authenticationResults: "spf=pass; dkim=pass",
    bodyText,
    bodyHtml: `<html><body>
<div>New Message from Kimberly</div>
<p>${CLIENT_MSG}</p>
<a href="${LOGIN_URL}&amp;utm_medium=email">Respond Now</a>
</body></html>`,
    ...overrides,
  } as GmailMessage;
}

describe("parseYelpEmail — credential containment (regression)", () => {
  it("never stores the passwordless login URL as portalUrl", () => {
    const { portalUrl } = parseYelpEmail(yelpMessage());
    assert.ok(
      !/login\/passwordless/.test(portalUrl || ""),
      `portalUrl leaked a credential: ${portalUrl}`
    );
  });

  it("derives a clean thread URL from return_url", () => {
    const { portalUrl } = parseYelpEmail(yelpMessage());
    assert.equal(
      portalUrl,
      "https://biz.yelp.com/messaging/lGwoYFACL339026pNoq5LQ/thread/HJzfiO_dPuZqADEtSneTWQ"
    );
  });

  it("leaves no URL of any kind in rawText (it is sent to the model)", () => {
    const { rawText } = parseYelpEmail(yelpMessage());
    assert.ok(!/https?:\/\//.test(rawText), `rawText contained a URL: ${rawText}`);
  });

  it("still captures the client's actual message", () => {
    const { rawText } = parseYelpEmail(yelpMessage());
    assert.ok(rawText.includes("Monserate Winery"), `message lost: ${rawText}`);
  });

  it("stops at the CTA even when wrapped in markdown and table pipes", () => {
    const { rawText } = parseYelpEmail(yelpMessage());
    assert.ok(!/Respond Now/i.test(rawText), `CTA bled into message: ${rawText}`);
    assert.ok(!/simply respond by replying/i.test(rawText));
  });

  it("decodes HTML entities rather than storing &amp;", () => {
    const { portalUrl } = parseYelpEmail(yelpMessage());
    assert.ok(!/&amp;/.test(portalUrl || ""));
  });

  it("refuses an arbitrary return_url redirect", () => {
    const msg = yelpMessage({
      bodyHtml: `<a href="https://biz.yelp.com/login/passwordless/redirect/${PW_TOKEN}?return_url=%2Fevil%2Fpath">x</a>`,
      bodyText: "New Message from Kimberly\n\nsome text that is long enough\n",
    });
    const { portalUrl, parseWarnings } = parseYelpEmail(msg);
    assert.equal(portalUrl, "");
    assert.ok(parseWarnings.some((w) => /No portal URL/i.test(w)));
  });

  it("still extracts the client name", () => {
    assert.equal(parseYelpEmail(yelpMessage()).clientName, "Kimberly");
  });

  it("keeps parseConfidence low and enriched false", () => {
    const parsed = parseYelpEmail(yelpMessage());
    assert.equal(parsed.parseConfidence, "low");
    assert.equal(parsed.enriched, false);
  });
});

describe("stripCredentialUrls", () => {
  it("redacts a passwordless login URL anywhere in the text", () => {
    const out = stripCredentialUrls(`before ${LOGIN_URL} after`);
    assert.ok(!/passwordless/.test(out));
    assert.ok(out.includes("[redacted-login-url]"));
    assert.ok(out.startsWith("before ") && out.endsWith(" after"));
  });

  it("leaves ordinary URLs alone", () => {
    const url = "https://biz.yelp.com/messaging/abc/thread/def";
    assert.equal(stripCredentialUrls(url), url);
  });
});
