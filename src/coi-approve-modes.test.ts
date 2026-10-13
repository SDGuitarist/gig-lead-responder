import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// COI code review round 1 (Codex, P1) and Alex's decision 2026-10-13 ("Refuse, like payment"): the dashboard approve
// path must apply the COI contract to a STORED draft before the claim, as it does for payment terms. Through the real
// route: createApp(), a temp DB. The alert channel always throws today (src/alert.ts), so a send attempt shows up as
// "[ALERT NOT DELIVERED]" + a 500, and a refusal is a 409 with no send.
// Second half of the COI approval tests (the first is src/coi-approve.test.ts); 9 approve calls, under the limit of 10.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-coi-approve2-")), "leads.db");
process.env.DASHBOARD_USER = "u";
process.env.DASHBOARD_PASS = "p";
process.env.COOKIE_SECRET = "test-cookie-secret";
const { createApp } = await import("./app.js");
const { insertLead, updateLead, getLead } = await import("./db/index.js");
const { PAYMENT_SENTENCES, civilDay } = await import("./pipeline/payment-terms.js");
const { COI_SENTENCES } = await import("./pipeline/coi.js");
const { getTodayISO } = await import("./utils/dates.js");

const { full } = PAYMENT_SENTENCES;
const DEFAULT = COI_SENTENCES.default;
const REQUIRED = COI_SENTENCES.required;
// 13 days from the route's own today: the full-payment sentence is current, so payment never refuses here.
const event = new Date((civilDay(getTodayISO())! + 13) * 86_400_000).toISOString().slice(0, 10);
const draft = (coi: string, pay: string = full) => `Hi Sarah,\nSolo guitar, $650, 2 hours.\n${pay} ${coi} Want me to hold it?\nAlex Guillen`;

type Over = { classification?: Record<string, unknown>; pricing?: Record<string, unknown> };
function lead(compressed: string, fullDraft: string, over: Over = {}): number {
  const { id } = insertLead({ raw_email: "x" });
  updateLead(id, {
    classification_json: JSON.stringify({ action: "quote", format_recommended: "solo", lead_source_column: "D", event_date_iso: event,
      ...over.classification }),
    pricing_json: JSON.stringify({ budget: { tier: "none" }, ...over.pricing }),
    compressed_draft: compressed,
    full_draft: fullDraft,
  });
  return id;
}

const server = http.createServer(createApp());
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
after(() => new Promise<void>((r) => server.close(() => r())));

const warnings: string[] = [];
const warn = console.warn;
console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(" ")); };
after(() => { console.warn = warn; });
const sendAttempts = () => warnings.filter((w) => w.includes("[ALERT NOT DELIVERED]")).length;

async function approve(id: number): Promise<{ status: number; code?: string }> {
  const port = (server.address() as { port: number }).port;
  const res = await fetch(`http://127.0.0.1:${port}/api/leads/${id}/approve`, {
    method: "POST", headers: { Authorization: `Basic ${Buffer.from("u:p").toString("base64")}` },
  });
  return { status: res.status, code: ((await res.json()) as { code?: string }).code };
}
const REFUSED = { status: 409, code: "coi_sentence_unverifiable" };
const REACHES_SEND = 500; // no alert channel yet: the request got as far as the sender

async function refused(id: number, why: string) {
  const before = sendAttempts();
  assert.deepEqual(await approve(id), REFUSED, why);
  assert.equal(sendAttempts(), before, `${why}: the sender is never called`);
}
async function reachesSend(id: number, why: string) {
  const before = sendAttempts();
  assert.equal((await approve(id)).status, REACHES_SEND, why);
  assert.equal(sendAttempts(), before + 1, `${why}: the sender is called once`);
}

test("COI C13 approve: a stored classification from before the COI work (no coi_required) expects the default sentence", async () => {
  await refused(lead(draft(""), draft("")), "old stored draft, no sentence");
  await reachesSend(lead(draft(DEFAULT), draft(DEFAULT)), "old stored classification, default sentence");
});

test("COI C13 approve none-mode: clarification, no_viable_scope, residency and graceful decline carry no COI and still send", async () => {
  const none = draft("");
  const clar = { classification: { action: "one_question", format_recommended: "unresolved" } };
  const nvs = { pricing: { budget: { tier: "no_viable_scope" } } };
  const res = { pricing: { budget: { tier: "none" }, residency: { tier: "R2" } } };
  const grace = { classification: { graceful_decline: true } };
  for (const [why, over] of [["clarification", clar], ["no_viable_scope", nvs], ["residency", res], ["graceful decline", grace]] as const) {
    await reachesSend(lead(none, none, over), why);
  }
});

test("COI C13 approve: a platform lead keeps the COI sentence (it is not a payment term)", async () => {
  const gs = { classification: { platform: "gigsalad" } };
  const platform = (coi: string) => `Hi Sarah,\nSolo guitar, $650, 2 hours. ${coi} Want me to hold it?\nAlex Guillen`;
  await refused(lead(platform(""), platform(""), gs), "gigsalad, no sentence");
  await reachesSend(lead(platform(DEFAULT), platform(DEFAULT), gs), "gigsalad, default sentence");
});

test("COI C13 approve: payment terms are checked first and the COI check does not weaken them", async () => {
  const id = lead(draft(DEFAULT, "A deposit secures your date."), draft(DEFAULT));
  assert.deepEqual(await approve(id), { status: 409, code: "payment_terms_unverifiable" });
});
