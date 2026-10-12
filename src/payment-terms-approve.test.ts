import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Payment terms code review round 1 (both runs): approve must refresh EVERY present draft, refuse (409) before the claim
// when either cannot be refreshed, and save both only when both succeed. Through the real route: createApp(), a temp DB.
// The alert channel always throws today (src/alert.ts), so a send attempt shows up as "[ALERT NOT DELIVERED]" + a 500.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-approve-")), "leads.db");
process.env.DASHBOARD_USER = "u";
process.env.DASHBOARD_PASS = "p";
process.env.COOKIE_SECRET = "test-cookie-secret";
const { createApp } = await import("./app.js");
const { insertLead, updateLead, getLead } = await import("./db/index.js");
const { PAYMENT_SENTENCES, civilDay } = await import("./pipeline/payment-terms.js");
const { getTodayISO } = await import("./utils/dates.js");

const { full, twoWeeks } = PAYMENT_SENTENCES;
// 13 days from the route's own today: full payment is current, the two-weeks sentence is stale.
const event = new Date((civilDay(getTodayISO())! + 13) * 86_400_000).toISOString().slice(0, 10);
const draft = (s: string) => `Hi Sarah,\nSolo guitar, $650, 2 hours.\n${s} Want me to hold it?\nAlex Guillen`;

function lead(compressed: string, fullDraft: string, platform?: string): number {
  const { id } = insertLead({ raw_email: "x" });
  updateLead(id, {
    classification_json: JSON.stringify({ action: "quote", format_recommended: "solo", lead_source_column: "D", event_date_iso: event, platform }),
    pricing_json: JSON.stringify({ budget: { tier: "none" } }),
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

test("a full draft with no known sentence, or two, is refused before the claim: 409, no send, nothing saved", async () => {
  // "" is a present draft with no sentence (code round 2), not an absent one.
  for (const bad of [draft("A deposit secures your date."), draft(`${full} ${twoWeeks}`), ""]) {
    const id = lead(draft(twoWeeks), bad);
    const before = sendAttempts();
    assert.deepEqual(await approve(id), { status: 409, code: "payment_terms_unverifiable" }, bad);
    assert.equal(sendAttempts(), before, "the sender is never called");
    const row = getLead(id)!;
    assert.equal(row.status, "received");
    assert.equal(row.compressed_draft, draft(twoWeeks), "the compressed draft is not saved when the full one fails");
    assert.equal(row.full_draft, bad);
  }
});

test("both drafts stale: both refreshed before the send; compressed already current: the stale full draft is still refreshed", async () => {
  for (const compressed of [draft(twoWeeks), draft(full)]) {
    const id = lead(compressed, draft(twoWeeks));
    const before = sendAttempts();
    assert.equal((await approve(id)).status, 500, "reaches the send (no alert channel yet)");
    assert.equal(sendAttempts(), before + 1);
    const row = getLead(id)!;
    assert.equal(row.compressed_draft, draft(full));
    assert.equal(row.full_draft, draft(full));
  }
});

test("a GigSalad lead: both drafts unchanged", async () => {
  const id = lead(draft("Looking forward to it."), draft(twoWeeks), "gigsalad");
  assert.equal((await approve(id)).status, 500);
  const row = getLead(id)!;
  assert.equal(row.compressed_draft, draft("Looking forward to it."));
  assert.equal(row.full_draft, draft(twoWeeks));
});
