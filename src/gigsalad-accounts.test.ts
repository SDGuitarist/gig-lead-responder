import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_BROWSER_PROCESSES, gigsaladProfileDir, parseGigSaladAccount, profileProcessArgs, withGigSaladProfile } from "./automation/portals/gigsalad-accounts.js";

// Alex 2026-10-04 (option 1): the app has its OWN GigSalad login per account, saved in one
// browser profile folder each; he signs in himself, no password is stored. A lead read or
// reply in the wrong account would act on the wrong portal, so an unknown name is an error.
test("gigsalad accounts: two accounts, one profile folder each, under the gitignored data/", () => {
  assert.equal(gigsaladProfileDir("music"), "data/browser/gigsalad-music");
  assert.equal(gigsaladProfileDir("business"), "data/browser/gigsalad-business");
  assert.notEqual(gigsaladProfileDir("music"), gigsaladProfileDir("business"));
});

test("gigsalad accounts: an unknown or missing account name is rejected, never defaulted", () => {
  assert.equal(parseGigSaladAccount("music"), "music");
  assert.equal(parseGigSaladAccount("business"), "business");
  for (const bad of [undefined, "", "Music", "personal", "../music"]) {
    assert.throws(() => parseGigSaladAccount(bad), /music.*business/, String(bad));
  }
});

// Login check Codex round 1: once the startup check runs in the background, it can open an account's
// browser profile while a lead is being read from the same profile, and a browser profile can be
// open only once. Every GigSalad browser job takes its account's profile in turn.
test("gigsalad accounts: jobs on the same profile take turns; other accounts run alongside; a failure releases", async () => {
  const log: string[] = [];
  const job = (name: string, ms: number, fail = false) => async () => {
    log.push(`${name} start`);
    await new Promise((r) => setTimeout(r, ms));
    log.push(`${name} end`);
    if (fail) throw new Error(`${name} failed`);
    return name;
  };
  const none = NO_BROWSER_PROCESSES;
  const a = withGigSaladProfile("music", job("A", 30, true), 1_000, none).catch(() => "A caught");
  const b = withGigSaladProfile("music", job("B", 5), 1_000, none);
  const c = withGigSaladProfile("business", job("C", 5), 1_000, none);
  assert.deepEqual(await Promise.all([a, b, c]), ["A caught", "B", "C"]);
  assert.ok(log.indexOf("B start") > log.indexOf("A end"), log.join(", "));
  assert.ok(log.indexOf("C start") < log.indexOf("A end"), log.join(", "));
});

// Login check Codex round 2: a timeout stopped WAITING but not the browser, so the next job could
// open the profile while the old browser still ran. Now: a timed-out job's browser is killed and
// confirmed gone before the profile is released, and no job starts while that profile's browser runs.
function fakeBrowsers() {
  const running = new Set<string>();
  const kills: string[] = [];
  let killWorks = true;
  return {
    running, kills, failKills: () => { killWorks = false; },
    proc: {
      isRunning: async (a: string) => running.has(a),
      kill: async (a: string) => { kills.push(a); if (killWorks) running.delete(a); },
    },
  };
}

test("gigsalad accounts: a hung job's browser is killed and gone before the next job starts (no overlap)", async () => {
  const b = fakeBrowsers();
  const hung = withGigSaladProfile("business", async () => { b.running.add("business"); return new Promise<string>(() => {}); }, 40, b.proc);
  await assert.rejects(hung, /GigSalad business browser job timed out after 40 ms/);
  assert.deepEqual(b.kills, ["business"]);
  let overlapped = false;
  const next = await withGigSaladProfile("business", async () => { overlapped = b.running.has("business"); return "next"; }, 40, b.proc);
  assert.equal(next, "next");
  assert.equal(overlapped, false, "the next job never runs beside the old browser");
});

test("gigsalad accounts: if the old browser cannot be killed, later jobs refuse instead of overlapping", async () => {
  const b = fakeBrowsers();
  b.failKills();
  await assert.rejects(withGigSaladProfile("music", async () => { b.running.add("music"); return new Promise<string>(() => {}); }, 40, b.proc),
    /timed out after 40 ms; its browser is still running/);
  let started = false;
  await assert.rejects(withGigSaladProfile("music", async () => { started = true; return "x"; }, 40, b.proc),
    /previous browser for this profile is still running/);
  assert.equal(started, false);
});

// Known-answer run on the Mac (2026-10-05): without "--", pgrep read the "--user-data-dir" pattern as
// an option and failed, and a failed check counts as "running", so every GigSalad job refused.
test("gigsalad accounts: the browser process check ends pgrep's options before its pattern", () => {
  const args = profileProcessArgs("music");
  assert.deepEqual(args.slice(0, 2), ["-f", "--"]);
  assert.match(args[2], /^--user-data-dir=\/.*\/data\/browser\/gigsalad-music\( \|\$\)$/);
  assert.notEqual(profileProcessArgs("business")[2], args[2]);
});
