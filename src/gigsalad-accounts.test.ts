import { test } from "node:test";
import assert from "node:assert/strict";
import { gigsaladProfileDir, parseGigSaladAccount, withGigSaladProfile } from "./automation/portals/gigsalad-accounts.js";

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
  const a = withGigSaladProfile("music", job("A", 30, true)).catch(() => "A caught");
  const b = withGigSaladProfile("music", job("B", 5));
  const c = withGigSaladProfile("business", job("C", 5));
  assert.deepEqual(await Promise.all([a, b, c]), ["A caught", "B", "C"]);
  assert.ok(log.indexOf("B start") > log.indexOf("A end"), log.join(", "));
  assert.ok(log.indexOf("C start") < log.indexOf("A end"), log.join(", "));
});

// A hung browser job must not hold its profile forever (every later job on that account, and the
// poller behind a lead, would wait forever). Each job is cut off and the profile released.
test("gigsalad accounts: a hung browser job times out and releases the profile for the next job", async () => {
  const hung = withGigSaladProfile("business", () => new Promise<string>(() => {}), 40);
  await assert.rejects(hung, /GigSalad business browser job timed out after 40 ms/);
  assert.equal(await withGigSaladProfile("business", async () => "next", 40), "next");
});
