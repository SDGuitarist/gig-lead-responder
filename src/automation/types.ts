import type { PipelineOutput } from "../types.js";

// --- Parse Confidence ---

export type ParseConfidence = "high" | "medium" | "low";

// --- Parsed Lead (discriminated union by platform) ---

export interface ParsedLeadBase {
  rawText: string;
  parseConfidence: ParseConfidence;
  parseWarnings: string[];
  clientName?: string;
  eventDate?: string;
  // Gmail metadata for replies and audit
  gmailMessageId: string;
  threadId: string;
  messageIdHeader: string;
  receivedAt: Date;
}

export interface GigSaladLead extends ParsedLeadBase {
  platform: "gigsalad";
  portalUrl: string;
}

export interface YelpLead extends ParsedLeadBase {
  platform: "yelp";
  portalUrl: string;
  enriched: boolean; // false after email parse, true after portal read
}

export interface SquarespaceLead extends ParsedLeadBase {
  platform: "squarespace";
  clientEmail: string;
  replyToHeader: string;
}

export type ParsedLead = GigSaladLead | YelpLead | SquarespaceLead;

// --- Router Result (discriminated union by action) ---

export interface AutoSendResult {
  action: "auto-send";
  lead: ParsedLead;
  pipelineOutput: PipelineOutput;
}

export interface HoldResult {
  action: "hold";
  lead: ParsedLead;
  pipelineOutput: PipelineOutput;
  reasons: string[];
}

export type RouterResult = AutoSendResult | HoldResult;

// --- Send Result ---

export interface SendSuccess {
  status: "sent";
  platform: string;
  timestamp: Date;
}

export interface SendFailed {
  status: "failed";
  platform: string;
  error: string;
  timestamp: Date;
}

export type SendResult = SendSuccess | SendFailed;
