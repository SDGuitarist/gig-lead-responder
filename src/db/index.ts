// Barrel re-export for backwards-compatible imports.
// All 8 consumers previously imported from "../leads.js".
// This barrel lets them switch to "../db/index.js" with no other changes.
// Internal modules (leads, follow-ups, queries) import from each other directly.

// --- migrate.ts ---
export { initDb } from "./migrate.js";

// --- leads.ts ---
export type { InsertLeadInput } from "./leads.js";
export {
  insertLead,
  getLead,
  getLeadsByStatus,
  updateLead,
  claimLeadForSending,
  isEmailProcessed,
  markEmailProcessed,
  runTransaction,
  logVenueMiss,
} from "./leads.js";
// normalizeLeadRow intentionally NOT re-exported — internal cross-module helper

// --- follow-ups.ts ---
export {
  getLeadsDueForFollowUp,
  getLeadAwaitingFollowUp,
  getLeadWithActiveFollowUp,
  scheduleFollowUp,
  approveFollowUp,
  storeFollowUpDraft,
  skipFollowUp,
  snoozeFollowUp,
  markClientReplied,
  claimFollowUpForSending,
  completeApproval,
} from "./follow-ups.js";

// --- queries.ts ---
export type { ListLeadsFilteredOpts, LeadStats } from "./queries.js";
export {
  listLeadsFiltered,
  listFollowUpLeads,
  getAnalytics,
  getLeadStats,
  setLeadOutcomeAndFreeze,
} from "./queries.js";
