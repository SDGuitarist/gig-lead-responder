import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkGigSaladLogins, getGigSaladLoginState, startGigSaladLoginCheck } from "./automation/portals/gigsalad-login-check.js";
import { beginLoginRead, noteGigSaladLoginSeen } from "./automation/portals/gigsalad-login-state.js";
import { findGigSaladLead } from "./automation/portals/gigsalad-match.js";
import type { InboxRead } from "./automation/portals/gigsalad-match.js";

// Alex 2026-10-05: an expired GigSalad login must not pile up held leads silently. Until Module 1's
// alert channel exists, the poller checks both logins when it starts and says so loudly (startup
// output + /health). A check that could not run must never read as "ok".
const reader = (music: InboxRead, business: InboxRead) => async (a: "music" | "business") => (a === "music" ? music : business);
const ok: InboxRead = { status: "ok", links: [] };

test("gigsalad login check: before any check both accounts read unchecked, never ok", () => {
  assert.deepEqual(getGigSaladLoginState(), { checked_at: null, music: "unchecked", business: "unchecked" });
});

test("gigsalad login check: an expired login is named loudly with its exact command", async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
  try {
    await checkGigSaladLogins(reader(ok, { status: "signed_out" }), () => "2026-10-05T12:00:00.000Z");
  } finally { console.error = original; }
  assert.deepEqual(getGigSaladLoginState(), { checked_at: "2026-10-05T12:00:00.000Z", music: "ok", business: "signed_out" });
  assert.ok(errors.some((e) => /GigSalad business login has EXPIRED/.test(e) && /npm run gigsalad:login -- business/.test(e)), errors.join("\n"));
  assert.ok(!errors.some((e) => /music/.test(e)), "a working login is not reported as a problem");
});

test("gigsalad login check: a check that cannot run says so, in different words from expired", async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
  try {
    await checkGigSaladLogins(reader({ status: "error", message: "browser missing" }, ok), () => "2026-10-05T12:05:00.000Z");
    await checkGigSaladLogins(async () => { throw new Error("boom"); }, () => "2026-10-05T12:06:00.000Z");
  } finally { console.error = original; }
  assert.deepEqual(getGigSaladLoginState(), { checked_at: "2026-10-05T12:06:00.000Z", music: "error", business: "error" });
  assert.ok(errors.some((e) => /could NOT check the GigSalad music login/.test(e) && /browser missing/.test(e)), errors.join("\n"));
  assert.ok(!errors.some((e) => /EXPIRED/.test(e)), "an unrun check is not reported as an expired login");
});

// Login check Codex round 1 P1: the poller awaited the check before its first poll, so a hung or
// slow browser delayed or stopped polling. The check now starts in the background.
test("gigsalad login check: starting the check returns at once, even if the browser hangs", () => {
  // It returns undefined, not a promise: nothing is awaited. (A stopwatch here flaked under load.)
  const result = startGigSaladLoginCheck(() => new Promise<never>(() => {}));
  assert.equal(result, undefined);
});

test("gigsalad login check: the poller starts the check without waiting, before its first poll", () => {
  const src = readFileSync("src/automation/poller.ts", "utf-8");
  assert.doesNotMatch(src, /await\s+checkGigSaladLogins|await\s+startGigSaladLoginCheck/);
  const start = src.indexOf("startGigSaladLoginCheck()");
  assert.ok(start > 0, "the poller starts the login check");
  assert.ok(start < src.indexOf("await poll();"), "before the first poll");
  assert.ok(src.indexOf("if (!config.dryRun)") < start, "after the Gmail gate and config setup");
});

// Alex 2026-10-05: the startup check looks once, so a login that expires while the poller runs went
// unnoticed. Every GigSalad lead already reads both inboxes; each read now refreshes that account's
// status (/health) and prints the loud line when a login CHANGES to expired or unreadable.
test("gigsalad login check: a lead's inbox read refreshes the status, loud once per change", () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
  try {
    noteGigSaladLoginSeen("music", "ok", { seq: beginLoginRead(), now: "2026-10-05T13:00:00.000Z" });
    noteGigSaladLoginSeen("music", "signed_out", { seq: beginLoginRead(), now: "2026-10-05T13:05:00.000Z" });
    noteGigSaladLoginSeen("music", "signed_out", { seq: beginLoginRead(), now: "2026-10-05T13:10:00.000Z" });
  } finally { console.error = original; }
  const state = getGigSaladLoginState();
  assert.equal(state.music, "signed_out");
  assert.equal(state.checked_at, "2026-10-05T13:10:00.000Z");
  assert.equal(errors.filter((e) => /GigSalad music login has EXPIRED/.test(e) && /gigsalad:login -- music/.test(e)).length, 1, errors.join("\n"));
});

test("gigsalad login check: finding a lead reports each account's inbox status as it reads it", async () => {
  const seen: Array<[string, string]> = [];
  await findGigSaladLead("Testa would like a quote for a Wedding on August 1, 2026.",
    async (a) => (a === "music" ? { status: "ok", links: [] } : { status: "signed_out" }),
    (account, status) => { seen.push([account, status]); });
  // Live-status Codex round 1 P1: a read that THROWS (timeout, profile busy) is reported as error,
  // not skipped, and the other account is still read.
  const thrown: Array<[string, string]> = [];
  const r = await findGigSaladLead("Testa would like a quote for a Wedding on August 1, 2026.",
    async (a) => { if (a === "music") throw new Error("profile timeout"); return { status: "ok", links: [] }; },
    (account, status) => { thrown.push([account, status]); });
  assert.deepEqual(thrown, [["music", "error"], ["business", "ok"]]);
  assert.equal(r.status, "error");
  assert.deepEqual(seen, [["music", "ok"], ["business", "signed_out"]]);
});

// Live-status Codex round 1 P1: the startup check replaced the whole status after its reads, so a
// lead read that saw "expired" in the meantime could be overwritten by the older startup "ok".
// A result counts only if no read that STARTED later has already reported.
test("gigsalad login check: an older read's result never overwrites a newer one", async () => {
  const older = beginLoginRead();
  const newer = beginLoginRead();
  noteGigSaladLoginSeen("business", "signed_out", { seq: newer, now: "2026-10-05T14:00:00.000Z" });
  noteGigSaladLoginSeen("business", "ok", { seq: older, now: "2026-10-05T14:01:00.000Z" });
  assert.equal(getGigSaladLoginState().business, "signed_out", "an older ok loses");

  // The startup check takes its ticket when its business read starts; a lead read that starts
  // afterwards reports "expired" while startup is still waiting. The slower startup ok must lose.
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const startup = checkGigSaladLogins(async (a) => { if (a === "business") await gate; return { status: "ok", links: [] }; },
    () => "2026-10-05T14:02:00.000Z");
  await new Promise((r) => setTimeout(r, 5));
  noteGigSaladLoginSeen("business", "signed_out", { seq: beginLoginRead(), now: "2026-10-05T14:03:00.000Z" });
  release();
  await startup;
  assert.equal(getGigSaladLoginState().business, "signed_out", "the newer lead result survives the slower startup ok");
});

test("gigsalad login check: control: without a newer read, the startup result does apply", async () => {
  noteGigSaladLoginSeen("business", "signed_out", { seq: beginLoginRead(), now: "2026-10-05T15:00:00.000Z" });
  await checkGigSaladLogins(async () => ({ status: "ok", links: [] }), () => "2026-10-05T15:01:00.000Z");
  assert.equal(getGigSaladLoginState().business, "ok");
});

// Live-status Codex round 2: ordering by Date.now() broke on reads starting in the same millisecond
// and on a clock that moves backwards. Order is now a ticket taken at read start: the clock plays no part.
test("gigsalad login check: same-millisecond and backwards-clock reads keep their start order", () => {
  const realNow = Date.now;
  try {
    Date.now = () => 1_000; // frozen: two reads start "at the same time"
    const first = beginLoginRead();
    const second = beginLoginRead();
    Date.now = () => 500; // the clock moves backwards before a third read starts
    const third = beginLoginRead();
    assert.ok(first < second && second < third);
    noteGigSaladLoginSeen("music", "signed_out", { seq: second, now: "t2" });
    noteGigSaladLoginSeen("music", "ok", { seq: first, now: "t1" });
    assert.equal(getGigSaladLoginState().music, "signed_out", "same millisecond: the later-started read wins");
    noteGigSaladLoginSeen("music", "error", { seq: third, now: "t3" });
    assert.equal(getGigSaladLoginState().music, "error", "backwards clock: the later-started read still counts");
  } finally {
    Date.now = realNow;
  }
});
