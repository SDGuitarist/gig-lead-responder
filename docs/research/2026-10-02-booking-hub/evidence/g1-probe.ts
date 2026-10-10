// Spike G1 (plan §0.7): does Gmail keep a supplied Message-ID, and when does `rfc822msgid:` find it?
// Sends ONE harmless email from the signed-in account TO ITSELF (refuses any other recipient), reads the Sent
// copy's Message-ID header, then searches `rfc822msgid:` right away and every 30 s for up to 10 minutes.
// Run from the repo root: npx tsx docs/research/2026-10-02-booking-hub/evidence/g1-probe.ts
// Alex approved the self-send on 2026-10-09.
import { google } from "googleapis";
import { randomBytes } from "node:crypto";
import { loadConfig } from "../../../../src/automation/config.js";
import { loadAuthClient } from "../../../../src/automation/gmail-watcher.js";

const gmail = google.gmail({ version: "v1", auth: loadAuthClient(loadConfig()) });
const me = (await gmail.users.getProfile({ userId: "me" })).data.emailAddress;
if (!me) throw new Error("no profile address");
const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const mid = `<gl-test-${day}-${randomBytes(4).toString("hex")}@alexguillenmusic.com>`;
const to = me; // the only recipient this probe will ever use
if (to !== me) throw new Error("G1 sends only to the signed-in account itself");
const raw = [
  `From: ${me}`, `To: ${to}`, `Subject: Gig Lead Responder test (control G1), ignore`, `Message-ID: ${mid}`,
  "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "",
  `Harmless test of Message-ID handling (spike G1). ${mid}`,
].join("\r\n");
const t0 = Date.now();
const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url") } });
const meta = await gmail.users.messages.get({ userId: "me", id: sent.data.id!, format: "metadata", metadataHeaders: ["Message-ID"] });
const kept = meta.data.payload?.headers?.find((h) => h.name?.toLowerCase() === "message-id")?.value;
console.log(JSON.stringify({ account: me, supplied: mid, sentId: sent.data.id, sentCopyMessageId: kept, kept: kept === mid }));
for (let i = 0; i <= 20; i++) {
  const q = `rfc822msgid:${mid.slice(1, -1)}`;
  const found = (await gmail.users.messages.list({ userId: "me", q, includeSpamTrash: true })).data.messages ?? [];
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(JSON.stringify({ attempt: i, secondsAfterSend: s, found: found.map((m) => m.id) }));
  if (found.some((m) => m.id === sent.data.id)) { console.log(JSON.stringify({ result: "FOUND", secondsAfterSend: s })); process.exit(0); }
  if (i < 20) await new Promise((r) => setTimeout(r, 30_000));
}
console.log(JSON.stringify({ result: "NOT FOUND within 10 minutes" }));
process.exit(1);
