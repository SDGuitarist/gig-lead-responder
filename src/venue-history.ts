import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { nameWords } from "./pipeline/classify.js";

// Venues Alex has played (port manifest R081-R089, R405; plan 2026-10-11 venue history). The data lives in a
// PRIVATE file outside this public repo. A venue line tells the drafter it may say Alex performed there, so a
// false match is a false statement to a client: matching is biased to misses.

export const VENUE_HISTORY_HEADER = "ALEX HAS PERFORMED HERE";

export interface VenueHistoryEntry {
  name: string;
  aliases: string[];
  claim: string | null; // Alex's own sentence, only when it carries a real `confirmed` date
}

export type VenueHistoryLoad =
  | { type: "ok"; venues: VenueHistoryEntry[] }
  | { type: "missing"; path: string }
  | { type: "invalid"; path: string; reason: string };

export function venueHistoryPath(): string {
  return process.env.VENUE_HISTORY_PATH || join(homedir(), "Data", "gig-lead-responder", "venue-history.json");
}

// The date is only a label (it cannot prove Alex gave it); it stops blank and half-finished sentences.
function isRealDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function validEntry(raw: unknown, index: number): VenueHistoryEntry | null {
  const e = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name) {
    console.warn(`[venue-history] entry ${index} dropped: no valid name`);
    return null;
  }
  let aliases: string[] = [];
  if (e.aliases !== undefined && !Array.isArray(e.aliases)) {
    console.warn(`[venue-history] "${name}": aliases dropped (not a list)`);
  } else if (Array.isArray(e.aliases)) {
    aliases = e.aliases.filter((a): a is string => typeof a === "string" && a.trim() !== "").map((a) => a.trim());
    if (aliases.length !== e.aliases.length) console.warn(`[venue-history] "${name}": invalid aliases dropped`);
  }
  let claim: string | null = null;
  if (e.claim !== undefined) {
    if (typeof e.claim !== "string" || /\[|tbd/i.test(e.claim)) {
      console.warn(`[venue-history] "${name}": claim dropped (not text, or a placeholder); venue kept`);
    } else if (!isRealDate(e.confirmed)) {
      console.warn(`[venue-history] "${name}": claim dropped (no real "confirmed" date); venue kept`);
    } else {
      claim = e.claim.trim();
    }
  }
  return { name, aliases, claim };
}

function readVenueHistory(path: string): VenueHistoryLoad {
  if (!existsSync(path)) return { type: "missing", path };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    return { type: "invalid", path, reason: err instanceof Error ? err.message : "unreadable" };
  }
  const list = (parsed as { venues?: unknown } | null)?.venues;
  if (!Array.isArray(list)) return { type: "invalid", path, reason: 'not { "venues": [...] }' };
  return { type: "ok", venues: list.map(validEntry).filter((v): v is VenueHistoryEntry => v !== null) };
}

// Cached per absolute path (the file is tiny; restart to pick up edits). Each warning prints once per path.
const cache = new Map<string, VenueHistoryLoad>();
let override: VenueHistoryLoad | null | undefined;

export function loadVenueHistory(path: string): VenueHistoryLoad {
  const abs = resolve(path);
  const cached = cache.get(abs);
  if (cached) return cached;
  const result = readVenueHistory(abs);
  if (result.type === "missing") console.warn(`[venue-history] venue history file not found at ${abs}: no venue-history lines`);
  if (result.type === "invalid") console.warn(`[venue-history] venue history file at ${abs} is invalid: ${result.reason}`);
  cache.set(abs, result);
  return result;
}

/** Tests only: a fixed result, or null for "history disabled". Undo with resetVenueHistoryForTests(). */
export function setVenueHistoryForTests(result: VenueHistoryLoad | null): void {
  override = result;
}

export function resetVenueHistoryForTests(): void {
  override = undefined;
  cache.clear();
}

function containsRun(long: string[], short: string[]): boolean {
  return long.some((_, i) => short.every((w, j) => long[i + j] === w));
}

// One direction only: the lead's venue equals the entry's name or an alias, or the entry's CANONICAL name
// (2+ words) sits inside the lead's venue. Aliases never use containment ("Del Coronado Yacht Club" is another
// place), and a lead shorter than the entry never matches ("Rancho Santa Fe" is not the Rancho Santa Fe Inn).
export function findVenueHistory(venueName: unknown, venues: VenueHistoryEntry[]): VenueHistoryEntry | null {
  const lead = nameWords(venueName);
  if (!lead.length) return null;
  const same = (x: string[]) => x.length === lead.length && x.every((w, i) => w === lead[i]);
  for (const v of venues) {
    const name = nameWords(v.name);
    if (!name.length) continue;
    if (same(name) || v.aliases.some((a) => same(nameWords(a)))) return v;
    if (name.length >= 2 && containsRun(lead, name)) return v;
  }
  return null;
}

export function formatVenueHistory(v: VenueHistoryEntry): string {
  const lines = [`## ${VENUE_HISTORY_HEADER}: ${v.name}`, "Alex has performed at this venue. You may say so."];
  if (v.claim) lines.push(`Alex's own words about it (use as written or shorten; add nothing): "${v.claim}"`);
  lines.push("Do not invent rooms, event counts, dates or details that are not written here.");
  return lines.join("\n");
}

/** The section for a lead's venue, or null (no venue, no file, no match). */
export function venueHistorySection(venueName: unknown): string | null {
  const loaded = override === undefined ? loadVenueHistory(venueHistoryPath()) : override;
  if (!loaded || loaded.type !== "ok") return null;
  const hit = findVenueHistory(venueName, loaded.venues);
  return hit ? formatVenueHistory(hit) : null;
}
