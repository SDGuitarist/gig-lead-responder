// One-off ingest: run ONE Gmail message through the same path the poller uses (processLead), always in DRY RUN.
// The poller only looks at mail newer than its cursor, so a lead that arrived before the server started is never seen.
// Usage: npx tsx scripts/ingest-one.ts <gmail-message-id> [--parse-only]
// --parse-only: fetch the message, validate the sender and parse it, print the result. No database write, no model call, no portal call.
//   The printed rawText holds the client's words: it stays on this screen. portalUrl is printed as shape only (it can hold a path from a login link).
// The result lands in data/leads.db like any polled lead, so it shows on the dashboard (reload the page).
// Safe to repeat: processLead skips an id it already processed. Nothing is sent: dryRun is forced true here.
import "dotenv/config";
import { google } from "googleapis";
import { loadConfig } from "../src/automation/config.js";
import { setLogPath } from "../src/automation/logger.js";
import { loadAuthClient, fetchMessage } from "../src/automation/gmail-watcher.js";
import { processLead } from "../src/automation/orchestrator.js";
import { validateSource } from "../src/automation/source-validator.js";
import { parseLeadEmail } from "../src/automation/parsers/index.js";
import { initDb } from "../src/db/index.js";
import { YelpPortalClient } from "../src/automation/portals/yelp-client.js";
import { GigSaladPortalClient } from "../src/automation/portals/gigsalad-client.js";

const parseOnly = process.argv.includes("--parse-only");
const id = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!id || !/^[0-9a-f]{10,32}$/i.test(id)) {
  console.error("Usage: npx tsx scripts/ingest-one.ts <gmail-message-id> [--parse-only]   (the id from the Gmail API, hex)");
  process.exit(2);
}

const config = { ...loadConfig(), dryRun: true };
setLogPath(config.logPath);
const auth = loadAuthClient(config);
const gmail = google.gmail({ version: "v1", auth });
const yelp = new YelpPortalClient({ email: config.portalCredentials.yelp.email, password: config.portalCredentials.yelp.password });
const gigsalad = new GigSaladPortalClient({ email: config.portalCredentials.gigsalad.email, password: config.portalCredentials.gigsalad.password });

const msg = await fetchMessage(gmail, id);
console.log(`Fetched ${msg.id}: from ${msg.from}, subject "${msg.subject}"`);
if (parseOnly) {
  const v = validateSource(msg.from, msg.authenticationResults, msg.subject, msg.bodyText || msg.bodyHtml);
  console.log(`validator: valid=${v.valid} platform=${v.platform ?? "-"} kind=${v.kind ?? "-"}${v.reason ? ` reason=${v.reason}` : ""}`);
  if (v.valid && v.kind === "lead" && v.platform) {
    const lead = parseLeadEmail(msg, v.platform);
    const url = "portalUrl" in lead ? lead.portalUrl : "";
    console.log(`confidence=${lead.parseConfidence} enriched=${"enriched" in lead ? lead.enriched : "-"} clientName=${lead.clientName ?? "-"}`);
    console.log(`portalUrl shape: ${url ? url.replace(/[A-Za-z0-9_-]{8,}/g, "<id>") : "(empty)"}`);
    console.log(`warnings: ${JSON.stringify(lead.parseWarnings)}`);
    console.log(`--- rawText (${lead.rawText.length} chars) ---\n${lead.rawText}\n--- end ---`);
  }
  process.exit(0);
}
initDb();
await processLead(msg, config, auth, yelp, gigsalad);
console.log("Done. Reload the dashboard.");
process.exit(0);
