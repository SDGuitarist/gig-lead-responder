import { test } from "node:test";
import assert from "node:assert/strict";
import { listMessageIdsSince } from "./automation/gmail-watcher.js";

// Gmail returns at most maxResults ids per page, newest first. Before this,
// the poller read only the first 20, so older mail in a long gap was skipped.
test("poller gap recovery: follows every page of the Gmail list", async () => {
  const pages: Record<string, { messages: { id: string }[]; nextPageToken?: string }> = {
    first: { messages: [{ id: "m25" }, { id: "m24" }], nextPageToken: "p2" },
    p2: { messages: [{ id: "m23" }], nextPageToken: "p3" },
    p3: { messages: [{ id: "m22" }] },
  };
  const queries: string[] = [];
  const ids = await listMessageIdsSince(async ({ q, pageToken }) => {
    queries.push(q);
    return pages[pageToken ?? "first"];
  }, 1_791_000_000);
  assert.deepEqual(ids, ["m25", "m24", "m23", "m22"]);
  assert.deepEqual(new Set(queries), new Set([`in:inbox after:${1_791_000_000 - 120}`]));
});

test("poller gap recovery: an empty inbox page returns no ids", async () => {
  const ids = await listMessageIdsSince(async () => ({}), 1_791_000_000);
  assert.deepEqual(ids, []);
});
