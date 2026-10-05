import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGigSaladLogins, getGigSaladLoginState } from "./automation/portals/gigsalad-login-check.js";
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
