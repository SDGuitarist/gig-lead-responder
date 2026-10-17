// Todo 097 plan A2: the dashboard API returns hold_reason on the list and the detail route.
// Through the real routes: createApp(), a temp DB, Basic auth (same pattern as src/coi-approve.test.ts).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-hold-api-")), "leads.db");
process.env.DASHBOARD_USER = "u";
process.env.DASHBOARD_PASS = "p";
process.env.COOKIE_SECRET = "test-cookie-secret";
const { createApp } = await import("./app.js");
const { insertLead, updateLead } = await import("./db/index.js");

const server = http.createServer(createApp());
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
after(() => new Promise<void>((r) => server.close(() => r())));

async function get(path: string): Promise<{ status: number; body: any }> {
  const port = (server.address() as { port: number }).port;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { Authorization: `Basic ${Buffer.from("u:p").toString("base64")}` } });
  return { status: res.status, body: await res.json() };
}

const REASON = "Yelp portal reply not verified live (todo 094): Alex sends from Yelp";
const held = insertLead({ raw_email: "held lead", mailgun_message_id: "api-held" });
updateLead(held.id, { status: "sent", hold_reason: REASON });
const plain = insertLead({ raw_email: "plain lead", mailgun_message_id: "api-plain" });
updateLead(plain.id, { status: "sent", done_reason: "review-only: would-auto-send via squarespace" });

test("A2 GET /api/leads/:id returns hold_reason for a held lead and null for another sent lead", async () => {
  const h = await get(`/api/leads/${held.id}`);
  assert.equal(h.status, 200);
  assert.equal(h.body.status, "sent");
  assert.equal(h.body.hold_reason, REASON);
  const p = await get(`/api/leads/${plain.id}`);
  assert.equal(p.status, 200);
  assert.equal(p.body.hold_reason, null);
});

test("A2 GET /api/leads (list) carries hold_reason on each row", async () => {
  const list = await get("/api/leads?status=sent");
  assert.equal(list.status, 200);
  const byId = new Map<number, any>(list.body.map((l: any) => [l.id, l]));
  assert.equal(byId.get(held.id)?.hold_reason, REASON);
  assert.equal(byId.get(plain.id)?.hold_reason, null);
});
