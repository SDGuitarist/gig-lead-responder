import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DEDUP_PATH = "data/processed-ids.json";

function getProcessedIds(): Set<string> {
  try {
    return new Set(JSON.parse(readFileSync(DEDUP_PATH, "utf-8")));
  } catch {
    return new Set();
  }
}

export function isProcessed(id: string): boolean {
  return getProcessedIds().has(id);
}

export function markProcessed(id: string): void {
  const ids = getProcessedIds();
  ids.add(id);
  mkdirSync(dirname(DEDUP_PATH), { recursive: true });
  writeFileSync(DEDUP_PATH, JSON.stringify([...ids]));
}
