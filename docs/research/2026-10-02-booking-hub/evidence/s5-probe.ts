// Spike S5 (plan §0.7): is the Mac Gmail token still valid 8 days after the "In production" sign-in (2026-10-03 08:21 PDT)?
// Read-only: one users.getProfile call with the app's own loader. Testing-mode tokens die after 7 days with invalid_grant.
// The token file's access token is >1 h old, so this call must use the refresh token (the part that expires).
// Run from the repo root: npx tsx docs/research/2026-10-02-booking-hub/evidence/s5-probe.ts
import { google } from "googleapis";
import { statSync } from "node:fs";
import { loadConfig } from "../../../../src/automation/config.js";
import { loadAuthClient } from "../../../../src/automation/gmail-watcher.js";

const before = statSync("data/gmail-token.json").mtime.toISOString();
try {
  const gmail = google.gmail({ version: "v1", auth: loadAuthClient(loadConfig()) });
  const me = (await gmail.users.getProfile({ userId: "me" })).data.emailAddress;
  console.log(JSON.stringify({ result: "PASS", account: me, at: new Date().toISOString(), tokenFileBefore: before }));
} catch (e) {
  const err = e as { message?: string; response?: { data?: unknown } };
  console.log(JSON.stringify({ result: "FAIL", error: err.message, detail: err.response?.data ?? null, tokenFileBefore: before }));
  process.exitCode = 1;
}
