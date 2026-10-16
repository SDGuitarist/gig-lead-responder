import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseYelpEmail } from "./automation/parsers/yelp.js";
import { routeLead } from "./automation/router.js";
import type { GmailMessage } from "./automation/gmail-watcher.js";
import type { AutomationConfig } from "./automation/config.js";
import type { YelpLead } from "./automation/types.js";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-yelpq-")), "leads.db");
const { processLead } = await import("./automation/orchestrator.js");

/**
 * Fixtures copy the LINE STRUCTURE of two real "requested a quote" emails read on 2026-10-16 (heading, link paragraphs,
 * business address, three form labels, display name, three "0" counters, CTA and footer). Names, answers and tokens are
 * invented; the token is a placeholder of the real shape (a live passwordless token is a bearer credential).
 * Plan: docs/plans/2026-10-16-fix-yelp-parser-reads-the-request-a-quote-email-plan.md.
 */
const TOKEN = "MLA" + "0".repeat(29) + "abc";
const LEADS_PATH = "%2Fleads_center%2FlGwoYFACL339026pNoq5LQ%2Fleads%2FmMH7xkZ-sbMCaBHq8SqnaQ";
const LOGIN_URL = `https://biz.yelp.com/login/passwordless/redirect/${TOKEN}?return_url=${LEADS_PATH}&ytl_=zz&utm_medium=email`;
const MARK = "https://biz.yelp.com/messaging/mark_as_replied_autosubmit/b61e5f2f068d4be78e9d1f11649c37c4";
const DATE_Q = "When do you require this service?";
const DETAILS_Q = "Are there any other details you'd like to share?";
const LOC_Q = "In what location do you need the service?";
const FOOTER = "Don't miss out on future leads — stay responsive!";

interface Parts { first?: string; start?: string | null; labels?: string[]; nameP?: string | null; counters?: string[] | null }

function bodyParagraphs(p: Parts = {}): string[] {
  const first = p.first ?? "Jordan requested a quote from Alex Guillen Music for a musicians. Reply to stay eligible for leads and keep your response rate up!";
  const out = [first, "͏ ͏ ͏ ͏ ͏ ͏ ͏ ͏"];
  if (p.start !== null) out.push(p.start ?? "## You have a new musicians request.");
  out.push(`[Reply to Jordan on Yelp Biz](${LOGIN_URL})`, "Sent to Alex Guillen Music", "444 Anita St Chula Vista, CA 91911");
  out.push(...(p.labels ?? [DATE_Q, "2026-10-30", LOC_Q, "92104"]));
  if (p.nameP !== null) out.push(p.nameP ?? "Jordan T.");
  out.push(...(p.counters === null ? [] : p.counters ?? ["0", "0", "0"]));
  out.push(`[Reply to Jordan on Yelp Biz](${LOGIN_URL})`, `[I'm not interested](${MARK}?reply_type=NOT_NEEDED&ytl_=zz)`, FOOTER);
  return out;
}
const html = `<html><body><p>Jordan requested a quote from Alex Guillen Music for a musicians.</p><h2>You have a new musicians request.</h2>
<p>Sent to Alex Guillen Music</p><p>444 Anita St Chula Vista, CA 91911</p><p>${DATE_Q}</p><p>2026-10-30</p><p>${DETAILS_Q}</p>
<p>I sent you the timing yesterday, a birthday dinner for 20.</p><p>${LOC_Q}</p><p>92104</p><p>Jordan T.</p><p>0</p><p>0</p><p>0</p>
<a href="${LOGIN_URL.replace(/&/g, "&amp;")}">Reply to Jordan on Yelp Biz</a><a href="${MARK}?reply_type=NOT_NEEDED&amp;ytl_=zz">I'm not interested</a><p>${FOOTER}</p></body></html>`;

function msg(p: Parts = {}, over: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: "1a13bd8fa0454399", threadId: "1a13bd8fa0454399",
    from: "Yelp Inbox <reply+b61e5f2f068d4be78e9d1f11649c37c4@messaging.yelp.com>", to: "alex@example.com",
    subject: "Alex Guillen Music's response to Jordan", date: "2026-10-16T19:17:17Z", replyTo: "",
    messageIdHeader: "<q@messaging.yelp.com>",
    authenticationResults: "mx.google.com; dkim=pass header.i=@yelp.com; dmarc=pass (p=REJECT) header.from=yelp.com",
    bodyText: bodyParagraphs(p).join("\n\n"),
    bodyHtml: html,
    ...over,
  } as GmailMessage;
}
const PLACEHOLDER = "(Yelp quote request: form not recognized, held for Alex)";
function assertNoLeak(rawText: string) {
  for (const bad of [TOKEN, "passwordless", "Anita St", "Sent to Alex", "Jordan T.", FOOTER, "Reply to", "not interested", "mark_as_replied", /^0$/m, /<[a-z]/i]) {
    assert.ok(typeof bad === "string" ? !rawText.includes(bad) : !bad.test(rawText), `rawText leaked ${String(bad)}: ${rawText}`);
  }
}
const parse = (p?: Parts, over?: Partial<GmailMessage>) => parseYelpEmail(msg(p, over));
const withDetails = (answer: string[]) => [DATE_Q, "2026-10-30", DETAILS_Q, ...answer, LOC_Q, "92104"];

describe("quote-request form: supported structure", () => {
  it("H1/H3: date and location only is high, complete, rebuilt first sentence, nothing outside the form (E9)", () => {
    const l = parse();
    assert.equal(l.parseConfidence, "high"); assert.equal(l.enriched, true); assert.equal(l.clientName, "Jordan");
    assert.equal(l.rawText, `Jordan requested a quote for a musicians.\n\n${DATE_Q}\n2026-10-30\n\n${LOC_Q}\n92104`);
    assertNoLeak(l.rawText);
  });
  it("H2/E6: details kept between date and location, paragraphs preserved, a client question and a mid-sentence ? stay", () => {
    const l = parse({ labels: withDetails(["Birthday dinner, 20 guests. Is 2 hours enough?", "Is Saturday okay?"]) });
    assert.equal(l.parseConfidence, "high");
    assert.ok(l.rawText.includes(`${DETAILS_Q}\nBirthday dinner, 20 guests. Is 2 hours enough?\n\nIs Saturday okay?\n\n${LOC_Q}`), l.rawText);
    assertNoLeak(l.rawText);
  });
  it("E10: a fourth form question between details and location stays high, in order, no leak", () => {
    const l = parse({ labels: withDetails(["Birthday dinner.", "What is your budget?", "$500"]) });
    assert.equal(l.parseConfidence, "high");
    assert.ok(l.rawText.indexOf("Birthday dinner.") < l.rawText.indexOf("What is your budget?") && l.rawText.indexOf("$500") < l.rawText.indexOf(LOC_Q));
    assertNoLeak(l.rawText);
  });
  it("E15: the three counters are small numbers, not always 0 (real mail had 0, 4, 0 and 0, 1, 0)", () => {
    for (const c of [["0", "4", "0"], ["0", "1", "0"], ["12", "3", "0"]]) assert.equal(parse({ counters: c }).parseConfidence, "high", c.join());
    assert.equal(parse({ counters: ["0", "x", "0"] }).parseConfidence, "low");
  });
  it("display name may extend the sentence name (Jade S. after Jade; a full name equals itself)", () => {
    assert.equal(parse({ first: "Frank Fernandez requested a quote from Alex Guillen Music for a musicians.", nameP: "Frank Fernandez" }).parseConfidence, "high");
    assert.equal(parse({ nameP: "Jordan" }).parseConfidence, "high");
  });
  it("E14: Gmail plain text uses CRLF line ends and zero-width characters in the preheader (as in the real emails)", () => {
    const crlf = bodyParagraphs({ labels: withDetails(["Birthday dinner, 20 guests."]) }).join("\r\n\r\n").replace("͏ ͏", "͏\u200c ͏\u200c");
    const l = parseYelpEmail(msg({}, { bodyText: crlf }));
    assert.equal(l.parseConfidence, "high", l.rawText);
    assert.ok(l.rawText.includes("Birthday dinner, 20 guests."));
    assertNoLeak(l.rawText);
  });
  it("E7: URLs, markdown links and a login URL inside an answer are removed", () => {
    const l = parse({ labels: withDetails([`see https://example.com/x and [a link](${LOGIN_URL}) ok`]) });
    assert.equal(l.parseConfidence, "high");
    assert.ok(!/https?:|passwordless|\]\(/.test(l.rawText), l.rawText);
  });
});

describe("quote-request form: anything not provably complete takes the safe fallback (E2, E3, E4, E5, E10, E11)", () => {
  const cases: Array<[string, Parts]> = [
    ["date label missing", { labels: [LOC_Q, "92104"] }],
    ["location label missing", { labels: [DATE_Q, "2026-10-30"] }],
    ["empty date answer", { labels: [DATE_Q, LOC_Q, "92104"] }],
    ["empty location answer", { labels: [DATE_Q, "2026-10-30", LOC_Q] }],
    ["duplicate label (a client paragraph equal to a label)", { labels: withDetails([DATE_Q, "x"]) }],
    ["labels out of order", { labels: [LOC_Q, "92104", DATE_Q, "2026-10-30"] }],
    ["start marker missing", { start: null }],
    ["end marker (three 0) missing", { counters: null }],
    ["only two counters", { counters: ["0", "0"] }],
    ["display name missing, location followed by a second short paragraph", { nameP: null, labels: [DATE_Q, "2026-10-30", LOC_Q, "92104", "San Diego"] }],
    ["display name does not start with the sentence name", { nameP: "San Diego" }],
    ["display name longer than 40 characters", { nameP: "Jordan " + "T".repeat(41) }],
    ["location is two paragraphs", { labels: [DATE_Q, "2026-10-30", LOC_Q, "92104", "near the park"] }],
    ["location longer than 80 characters", { labels: [DATE_Q, "2026-10-30", LOC_Q, "x".repeat(81)] }],
    ["a fourth question after the location label", { labels: [DATE_Q, "2026-10-30", LOC_Q, "92104", "Anything else?", "No"], nameP: "Jordan T." }],
    ["first sentence not recognized", { first: "Hello from Yelp" }],
  ];
  for (const [name, parts] of cases) {
    it(name, () => {
      const l = parse(parts);
      assert.equal(l.parseConfidence, "low", name); assert.equal(l.enriched, false);
      assert.equal(l.rawText, PLACEHOLDER);
      assertNoLeak(l.rawText);
    });
  }
  it("E5: HTML-only mail never parses as complete and keeps no HTML, even with 'sent you' in the client's words (E11)", () => {
    const l = parse({}, { bodyText: "" });
    assert.equal(l.parseConfidence, "low"); assert.equal(l.rawText, PLACEHOLDER); assertNoLeak(l.rawText);
  });
  it("E11: a failed quote request whose text contains 'sent you', 'new message' and 'wrote:' does not start the old capture", () => {
    const l = parse({ labels: [DATE_Q, "2026-10-30", DETAILS_Q, "I sent you the timing yesterday. New message: she wrote: hi", LOC_Q] });
    assert.equal(l.rawText, PLACEHOLDER); assertNoLeak(l.rawText);
  });
});

describe("portal URL (D5, E8, E8b)", () => {
  it("H4: a leads_center return_url becomes a clean URL with no token", () => {
    const l = parse();
    assert.equal(l.portalUrl, "https://biz.yelp.com/leads_center/lGwoYFACL339026pNoq5LQ/leads/mMH7xkZ-sbMCaBHq8SqnaQ");
    assert.ok(!/passwordless|MLA0/.test(l.portalUrl));
  });
  it("E8: any other return_url path is refused", () => {
    const bad = html.replace(LEADS_PATH, "%2Fsettings%2Fkeys");
    assert.equal(parse({}, { bodyHtml: bad }).portalUrl, "");
  });
  it("E8b: the mark-as-replied links are never the portal URL", () => {
    const noReturn = html.replace(/return_url=[^&"]*/, "");
    const l = parse({}, { bodyHtml: noReturn });
    assert.ok(!/mark_as_replied/.test(l.portalUrl), l.portalUrl);
  });
});

describe("legacy path (E1, E13)", () => {
  it("E13: not a quote request, empty bodyText: tags are stripped before the legacy capture", () => {
    const h = `<html><body><p>New Message from Kimberly</p><p>The wedding is at Monserate Winery.</p><a href="https://x/y">Respond Now</a><p>${FOOTER}</p></body></html>`;
    const l = parseYelpEmail(msg({}, { bodyText: "", bodyHtml: h, subject: "RE: x" }));
    assert.equal(l.parseConfidence, "low");
    assert.ok(!/<[a-z]/i.test(l.rawText), l.rawText);
  });
});

describe("router and orchestrator (H5, H6)", () => {
  const out = () => ({
    classification: { flagged_concerns: [], format_requested: "solo", format_recommended: "solo", vagueness: "clear", action: "quote", stealth_premium: false, client_first_name: "Jordan",
      venue_name: null, event_date_iso: null },
    pricing: { quote_price: 700 }, drafts: { full_draft: "Hi", compressed_draft: "Hi", compressed_word_count: 1 },
    gate: { gate_status: "pass" }, verified: true, confidence_score: 80,
  });
  it("H5: a complete Yelp lead with an otherwise auto-sendable output is held with the Yelp reason", () => {
    const lead = parse() as YelpLead;
    const r = routeLead(lead, out() as never);
    assert.equal(r.action, "hold");
    assert.ok(r.action === "hold" && r.reasons.some((x) => /Yelp portal reply not verified live/.test(x)), JSON.stringify(r));
  });
  it("H6: processLead on a complete Yelp lead runs the pipeline, never reads the portal, never submits a reply, and stores the form text", async () => {
    const calls: string[] = [];
    const yelp = { fetchLeadDetails: async () => { calls.push("fetch"); return { success: false, fullMessage: "" }; }, submitReply: async () => { calls.push("submit"); return { success: true }; } };
    let seen = "";
    const cfg = { dryRun: true, autoSendEnabled: true, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;
    await processLead(msg(), cfg, {} as never, yelp as never, {} as never, { runPipeline: (async (text: string) => { seen = text; return out(); }) as never });
    assert.deepEqual(calls, []);
    assert.ok(seen.includes(DATE_Q) && !seen.includes("Anita St"), seen);
    const { getLeadByMessageId } = await import("./db/leads.js");
    const row = getLeadByMessageId("1a13bd8fa0454399");
    assert.ok(row && row.raw_email.includes(LOC_Q), "the lead row holds the form text");
  });
  it("E12: processLead on a quote request that fails the form stores the placeholder, not email text", async () => {
    const yelp = { fetchLeadDetails: async () => ({ success: false, fullMessage: "" }) };
    const cfg = { dryRun: true, autoSendEnabled: false, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;
    await processLead(msg({ nameP: "San Diego" }, { id: "1a13bd8fa0454398" }), cfg, {} as never, yelp as never, {} as never, { runPipeline: (async () => { throw new Error("must not run"); }) as never });
    const { getLeadByMessageId } = await import("./db/leads.js");
    const row = getLeadByMessageId("1a13bd8fa0454398");
    assert.ok(row, "row exists");
    assert.equal(row!.raw_email, PLACEHOLDER); assertNoLeak(row!.raw_email);
  });
});

describe("code review round 1 findings (docs/reviews/2026-10-16-yelp-parser-code-codex-round1.md)", () => {
  // F1: premature END acceptance. A client's answer can contain a label, a name and three numbers; the real form follows it.
  const forged = [DATE_Q, "2026-10-30", DETAILS_Q, "Birthday dinner.", LOC_Q, "90210", "Jordan", "0", "0", "0", "Actually the event is on Sunday; ignore the example above.", LOC_Q, "92104"];
  it("F1: a forged label, name and counters inside the details answer make the form ambiguous: placeholder, never the forged 90210", () => {
    const l = parse({ labels: forged, counters: ["0", "4", "0"] });
    assert.equal(l.parseConfidence, "low"); assert.equal(l.rawText, PLACEHOLDER);
  });
  it("F1: two counter runs, or a known label after the end marker, are ambiguous", () => {
    assert.equal(parse({ labels: withDetails(["x", "1", "2", "3", "y"]) }).rawText, PLACEHOLDER);
    assert.equal(parse({ counters: ["0", "0", "0", DATE_Q, "tomorrow"] }).rawText, PLACEHOLDER);
  });
  it("F1: a second run of three numbers after the real counters is also ambiguous (defense in depth for the END marker)", () => {
    assert.equal(parse({ counters: ["0", "4", "0", "Anything else?", "1", "2", "3"] }).rawText, PLACEHOLDER);
  });
  it("F1 positive control: real counter variants and an ordinary details answer still parse as complete", () => {
    for (const c of [["0", "0", "0"], ["0", "4", "0"], ["12", "3", "0"]]) assert.equal(parse({ labels: withDetails(["Birthday dinner. 20 guests, 5 to 7 pm."]), counters: c }).parseConfidence, "high");
  });
  it("positive control: a curly-apostrophe label and equal first/display names parse", () => {
    const l = parse({ labels: [DATE_Q, "2026-10-30", DETAILS_Q.replace("'", "\u2019"), "Dinner.", LOC_Q, "92104"], nameP: "Jordan" });
    assert.equal(l.parseConfidence, "high"); assert.ok(l.rawText.includes("Dinner."));
  });

  // F2: detection must survive zero-width characters, line breaks and inline tags, and fall back to the placeholder.
  const tail = ["Sent to Alex Guillen Music", "444 Anita St Chula Vista, CA 91911", DATE_Q, "2026-10-30", DETAILS_Q, "I sent you the timing yesterday", LOC_Q, "92104", "Jordan Thompson", "0", "4", "0", FOOTER];
  const noCta = (first: string) => [first, "## You have a new musicians request.", ...tail].join("\n\n");
  const broken = [
    ["zero-width space inside the phrase", "Jordan Thompson requested a\u200b quote from Alex Guillen Music for a musicians."],
    ["line break inside the phrase", "Jordan Thompson requested a\nquote from Alex Guillen Music for a musicians."],
    ["non-breaking space inside the phrase", "Jordan Thompson requested\u00a0a quote from Alex Guillen Music for a musicians."],
  ] as const;
  const noDisplayName = (first: string) => noCta(first).replace("Jordan Thompson\n\n0", "San Diego\n\n0");
  for (const [name, first] of broken) {
    it(`F2: ${name}, form damaged (display name wrong): placeholder, nothing from the legacy capture`, () => {
      const l = parseYelpEmail(msg({}, { bodyText: noDisplayName(first), bodyHtml: "" }));
      assert.equal(l.rawText, PLACEHOLDER);
    });
    it(`F2: ${name}, form intact: still read as the form (high), rebuilt text only, no footer or address`, () => {
      const l = parseYelpEmail(msg({}, { bodyText: noCta(first), bodyHtml: "" }));
      assert.equal(l.parseConfidence, "high");
      assert.ok(l.rawText.startsWith("Jordan Thompson requested a quote for a musicians."), l.rawText);
      assert.ok(!/stay responsive|Anita|Sent to|\n0\n/.test(l.rawText), l.rawText);
    });
  }
  it("F2: HTML-only mail with the phrase split by inline tags and no request_a_quote metadata: placeholder", () => {
    const h = `<p>Jordan Thompson requested <b>a quote</b> from Alex Guillen Music for a musicians.</p><h2>You have a new musicians request.</h2>` + tail.map((t) => `<p>${t}</p>`).join("");
    const l = parseYelpEmail(msg({}, { bodyText: "", bodyHtml: h }));
    assert.equal(l.rawText, PLACEHOLDER); assert.ok(!/Jordan Thompson|stay responsive|<[a-z]/i.test(l.rawText));
  });
  it("F2: the Yelp form labels alone mark a quote request even when the sentence is unreadable", () => {
    const l = parseYelpEmail(msg({}, { bodyText: [ "Hello", DATE_Q, "2026-10-30", DETAILS_Q, "I sent you the timing yesterday", LOC_Q, "92104", "Jordan Thompson", FOOTER ].join("\n\n"), bodyHtml: "" }));
    assert.equal(l.rawText, PLACEHOLDER);
  });
  it("F2: processLead stores the placeholder, not the display name or footer, for a broken-phrase quote request", async () => {
    const cfg = { dryRun: true, autoSendEnabled: false, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;
    const m = msg({}, { id: "1a13bd8fa0454397", bodyText: noDisplayName("Jordan Thompson requested a\u200b quote from Alex Guillen Music for a musicians."), bodyHtml: "" });
    await processLead(m, cfg, {} as never, { fetchLeadDetails: async () => ({ success: false, fullMessage: "" }) } as never, {} as never, { runPipeline: (async () => { throw new Error("must not run"); }) as never });
    const { getLeadByMessageId } = await import("./db/leads.js");
    const row = getLeadByMessageId("1a13bd8fa0454397");
    assert.ok(row); assert.equal(row!.raw_email, PLACEHOLDER);
  });
  it("legacy positive control: a genuine old reply with no Yelp form markers still keeps the client's message", () => {
    const l = parseYelpEmail({ ...msg(), subject: "RE: x", bodyHtml: "", bodyText: "New Message from Kimberly\n\nThe wedding is at Monserate Winery in Fallbrook.\n\n| [ Respond Now ](https://example.com/x)" } as GmailMessage);
    assert.ok(l.rawText.includes("Monserate Winery"), l.rawText);
  });
});

describe("code review round 2 finding (docs/reviews/2026-10-16-yelp-parser-code-codex-round2.md): quoted client prose is not template structure", () => {
  const legacy = (prose: string) => ({ bodyHtml: "", subject: "x", bodyText: `New Message from Kimberly\n\n${prose}\n\n| [ Respond Now ](https://example.com/x)` });
  it("P2: a legacy message whose sentence quotes a form label keeps the client's text (not the placeholder)", () => {
    const l = parseYelpEmail(msg({}, legacy('You asked "When do you require this service?" The wedding is October 30 in Fallbrook. We need one hour.')));
    assert.ok(l.rawText.includes("wedding is October 30 in Fallbrook"), l.rawText);
    assert.notEqual(l.rawText, PLACEHOLDER);
  });
  it("P2: a legacy message whose sentence quotes the form heading keeps the client's text", () => {
    const l = parseYelpEmail(msg({}, legacy('You wrote "you have a new musicians request" earlier. The wedding is October 30 in Fallbrook.')));
    assert.ok(l.rawText.includes("wedding is October 30 in Fallbrook"), l.rawText);
  });
  it("P2: a legacy message quoting the phrase 'requested a quote from' mid-sentence keeps its text", () => {
    const l = parseYelpEmail(msg({}, legacy("My friend said he requested a quote from you last year. The wedding is October 30 in Fallbrook.")));
    assert.ok(l.rawText.includes("wedding is October 30 in Fallbrook"), l.rawText);
  });
  it("P2 storage consequence: processLead stores the client's legacy text, not the placeholder", async () => {
    const cfg = { dryRun: true, autoSendEnabled: false, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;
    const m = msg({}, { id: "1a13bd8fa0454396", ...legacy('You asked "When do you require this service?" The wedding is October 30 in Fallbrook. We need one hour.') });
    await processLead(m, cfg, {} as never, { fetchLeadDetails: async () => ({ success: false, fullMessage: "" }) } as never, {} as never, { runPipeline: (async () => { throw new Error("must not run"); }) as never });
    const { getLeadByMessageId } = await import("./db/leads.js");
    const row = getLeadByMessageId("1a13bd8fa0454396");
    assert.ok(row && row.raw_email.includes("wedding is October 30 in Fallbrook"), row?.raw_email);
  });
  it("positive controls: a standalone label paragraph, a standalone heading paragraph, and the sentence at the start of a paragraph still mark a quote request (placeholder)", () => {
    const text = (first: string, ...rest: string[]) => ({ bodyHtml: "", bodyText: [first, ...rest, "Jordan Thompson", FOOTER].join("\n\n") });
    assert.equal(parseYelpEmail(msg({}, text("Hello", DATE_Q, "tomorrow"))).rawText, PLACEHOLDER);
    assert.equal(parseYelpEmail(msg({}, text("Hello", "## You have a new musicians request.", "I sent you the timing"))).rawText, PLACEHOLDER);
    assert.equal(parseYelpEmail(msg({}, text("Jordan Thompson requested a\u200b quote from Alex Guillen Music for a musicians.", "I sent you the timing yesterday"))).rawText, PLACEHOLDER);
  });
});
