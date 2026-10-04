import { test } from "node:test";
import assert from "node:assert/strict";
import { gigsaladProfileDir, parseGigSaladAccount } from "./automation/portals/gigsalad-accounts.js";

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
