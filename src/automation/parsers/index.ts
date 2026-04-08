import type { GmailMessage } from "../gmail-watcher.js";
import type { GmailPlatform } from "../source-validator.js";
import type { ParsedLead } from "../types.js";
import { parseGigSaladEmail } from "./gigsalad.js";
import { parseYelpEmail } from "./yelp.js";
import { parseSquarespaceEmail } from "./squarespace.js";

/**
 * Route a validated Gmail message to the correct platform parser.
 * The platform has already been identified by source-validator.ts.
 */
export function parseLeadEmail(msg: GmailMessage, platform: GmailPlatform): ParsedLead {
  switch (platform) {
    case "gigsalad":
      return parseGigSaladEmail(msg);
    case "yelp":
      return parseYelpEmail(msg);
    case "squarespace":
      return parseSquarespaceEmail(msg);
  }
}
