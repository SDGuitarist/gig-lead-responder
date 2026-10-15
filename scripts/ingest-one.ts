// One-off ingest: run ONE Gmail message through the same path the poller uses (processLead), always in DRY RUN.
// The poller only looks at mail newer than its cursor, so a lead that arrived before the server started is never seen.
// Usage: npx tsx scripts/ingest-one.ts <gmail-message-id>
// The result lands in data/leads.db like any polled lead, so it shows on the dashboard (reload the page).
// Safe to repeat: processLead skips an id it already processed. Nothing is sent: dryRun is forced true here.
import "dotenv/config";
import { google } from "googleapis";
import { loadConfig } from "../src/automation/config.js";
import { setLogPath } from "../src/automation/logger.js";
import { loadAuthClient, fetchMessage } from "../src/automation/gmail-watcher.js";
import { processLead } from "../src/automation/orchestrator.js";
import { initDb } from "../src/db/index.js";
import { YelpPortalClient } from "../src/automation/portals/yelp-client.js";
import { GigSaladPortalClient } from "../src/automation/portals/gigsalad-client.js";

const id = process.argv[2];
if (!id || !/^[0-9a-f]{10,32}$/i.test(id)) {
  console.error("Usage: npx tsx scripts/ingest-one.ts <gmail-message-id>   (the id from the Gmail API, hex)");
  process.exit(2);
}

const config = { ...loadConfig(), dryRun: true };
setLogPath(config.logPath);
initDb();
const auth = loadAuthClient(config);
const gmail = google.gmail({ version: "v1", auth });
const yelp = new YelpPortalClient({ email: config.portalCredentials.yelp.email, password: config.portalCredentials.yelp.password });
const gigsalad = new GigSaladPortalClient({ email: config.portalCredentials.gigsalad.email, password: config.portalCredentials.gigsalad.password });

const msg = await fetchMessage(gmail, id);
console.log(`Fetched ${msg.id}: from ${msg.from}, subject "${msg.subject}"`);
await processLead(msg, config, auth, yelp, gigsalad);
console.log("Done. Reload the dashboard.");
process.exit(0);
