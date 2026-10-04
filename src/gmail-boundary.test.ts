import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchedMessageId, listMessageIdsSince } from "./automation/gmail-watcher.js";

// Codex round 1 (Phase 0 runtime), finding 5: Gmail list pages were type-asserted,
// an id-less entry was skipped silently, a repeating page token looped forever, and a
// fetched message with no id became "" (so several would collide on one dedup key).
// Malformed provider data now throws: the poll fails, the cursor holds, it is retried.
const listOf = (pages: Record<string, unknown>) => async ({ pageToken }: { pageToken?: string }) =>
  pages[pageToken ?? "first"] as never;

test("gmail boundary: a malformed list page is rejected", async () => {
  for (const [label, page] of [
    ["page not an object", "oops"],
    ["messages not an array", { messages: { id: "m1" } }],
    ["entry without an id", { messages: [{ threadId: "t1" }] }],
    ["id not a string", { messages: [{ id: 42 }] }],
    ["empty id", { messages: [{ id: "" }] }],
    ["id with a path character", { messages: [{ id: "../m1" }] }],
    ["page token not a string", { messages: [{ id: "m1" }], nextPageToken: 7 }],
  ] as const) {
    await assert.rejects(listMessageIdsSince(listOf({ first: page }), 1_791_000_000), /Gmail list/, label);
  }
});

test("gmail boundary: a page token that repeats stops instead of looping", async () => {
  let calls = 0;
  const looping = async () => { calls += 1; if (calls > 5) throw new Error("test: looped"); return { messages: [{ id: "m1" }], nextPageToken: "same" }; };
  await assert.rejects(listMessageIdsSince(looping, 1_791_000_000), /Gmail list.*repeated/);
  assert.ok(calls <= 2, `stopped after ${calls} pages`);
});

test("gmail boundary: control, real pages and an empty inbox still parse", async () => {
  assert.deepEqual(await listMessageIdsSince(listOf({ first: {} }), 1), []);
  assert.deepEqual(await listMessageIdsSince(listOf({ first: { messages: null, nextPageToken: null } }), 1), []);
  assert.deepEqual(await listMessageIdsSince(listOf({
    first: { messages: [{ id: "18f2a9c4b7d1e0a3" }], nextPageToken: "p2" },
    p2: { messages: [{ id: "18f2a9c4b7d1e0a4", threadId: "x" }] },
  }), 1), ["18f2a9c4b7d1e0a3", "18f2a9c4b7d1e0a4"]);
});

test("gmail boundary: a fetched message must carry the id that was asked for", () => {
  assert.equal(fetchedMessageId("18f2a9c4b7d1e0a3", "18f2a9c4b7d1e0a3"), "18f2a9c4b7d1e0a3", "control");
  for (const got of [null, undefined, "", "different"]) {
    assert.throws(() => fetchedMessageId("18f2a9c4b7d1e0a3", got), /Gmail message/, String(got));
  }
});

// The poller reads "401" anywhere in an error as an auth failure and stops for good,
// so a boundary error must never echo a provider value (a hex id can contain 401).
test("gmail boundary: errors never echo provider values", async () => {
  const errs: string[] = [];
  try { fetchedMessageId("18f2a9c4b7d1e401", "ffff401") } catch (e) { errs.push((e as Error).message); }
  await listMessageIdsSince(listOf({ first: { messages: [{ id: "bad/401" }] } }), 1).catch((e: Error) => errs.push(e.message));
  await listMessageIdsSince(async () => ({ messages: [], nextPageToken: "tok401" }), 1).catch((e: Error) => errs.push(e.message));
  assert.equal(errs.length, 3, "control: all three rejected");
  for (const e of errs) assert.ok(!e.includes("401"), e);
});
