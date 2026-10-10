// Spike G1 control (2026-10-09): can rfc822msgid: find the Sent copy by the Message-ID GMAIL assigned (the
// known answer), and by a body token? Distinguishes "search broken" from "supplied ID replaced". Read-only.
import { google } from "googleapis";
import { loadConfig } from "../../../../src/automation/config.js";
import { loadAuthClient } from "../../../../src/automation/gmail-watcher.js";
const gmail = google.gmail({ version: "v1", auth: loadAuthClient(loadConfig()) });
const assigned = "CAOE=OjL6FKv9-pe4917OsYPs6JEdkJYL7oTzfs_8ZaD6vnoBFg@mail.gmail.com";
for (const q of [`rfc822msgid:${assigned}`, `rfc822msgid:<${assigned}>`, `"gl-test-20261010-2ebd9a86"`]) {
  const r = (await gmail.users.messages.list({ userId: "me", q, includeSpamTrash: true })).data.messages ?? [];
  console.log(JSON.stringify({ q: q.slice(0, 40), found: r.map((m) => m.id) }));
}
