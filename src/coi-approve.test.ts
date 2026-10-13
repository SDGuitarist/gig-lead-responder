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
// The approve route allows 10 requests per window per client (src/rate-limit.ts), so the approval tests are split over
// two files (each runs in its own process): this one has 8.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-coi-approve-")), "leads.db");
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

test("COI C13 approve: a stored draft with no COI sentence, in either draft, is refused before the claim", async () => {
  const ok = draft(DEFAULT);
  const none = draft("");
  const cases: Array<[string, string, string]> = [
    ["compressed lacks it", none, ok],
    ["full lacks it", ok, none],
    ["both lack it", none, none],
  ];
  for (const [why, compressed, fullDraft] of cases) {
    const id = lead(compressed, fullDraft);
    await refused(id, why);
    const row = getLead(id)!;
    assert.equal(row.status, "received", `${why}: not claimed`);
    assert.equal(row.compressed_draft, compressed, `${why}: nothing saved`);
    assert.equal(row.full_draft, fullDraft, `${why}: nothing saved`);
  }
});

test("COI C13 approve: a repeated sentence, or other COI wording beside it, is refused", async () => {
  await refused(lead(draft(`${DEFAULT} ${DEFAULT}`), draft(DEFAULT)), "repeated in compressed");
  await refused(lead(draft(DEFAULT), draft(`${DEFAULT} The venue requires a COI.`)), "other wording in full");
});

test("COI C13 approve positive control: the default sentence once in each draft reaches the sender", async () => {
  await reachesSend(lead(draft(DEFAULT), draft(DEFAULT)), "default sentence");
});

test("COI C13 approve: a client who requires a COI needs the required sentence, and the default is refused", async () => {
  const req = { classification: { coi_required: true } };
  await reachesSend(lead(draft(REQUIRED), draft(REQUIRED), req), "required sentence, which holds COI and liability insurance");
  await refused(lead(draft(DEFAULT), draft(DEFAULT), req), "default where the required one is expected");
});
