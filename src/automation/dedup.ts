import { isEmailProcessed, markEmailProcessed } from "../db/leads.js";

export function isProcessed(id: string): boolean {
  return isEmailProcessed(id);
}

export function markProcessed(id: string, platform: string = "gmail"): void {
  markEmailProcessed(id, platform);
}
