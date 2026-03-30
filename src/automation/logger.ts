import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface LeadLogEntry {
  timestamp: string;
  gmailMessageId: string;
  platform: string;
  parseConfidence: string;
  classification?: string;    // format_recommended
  quotePrice?: number;
  edgeCase: boolean;
  edgeCaseReasons?: string[];
  status: "sent" | "held" | "failed" | "dry-run";
  error?: string;
  durationMs?: number;
}

let logPath = "logs/leads.jsonl";

export function setLogPath(path: string): void {
  logPath = path;
}

export function logLead(entry: LeadLogEntry): void {
  mkdirSync(dirname(logPath), { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(logPath, line);
  console.log(`[${entry.status}] ${entry.platform} lead — ${entry.classification ?? "unknown"} — $${entry.quotePrice ?? "?"}`);
}
