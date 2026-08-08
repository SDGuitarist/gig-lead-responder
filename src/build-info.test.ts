import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { getBuildCommit, STARTED_AT } from "./build-info.js";
import { createApp } from "./app.js";

const ENV_KEYS = ["RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT_SHA"] as const;

describe("getBuildCommit", () => {
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('returns "unknown" when no build SHA is set', () => {
    assert.equal(getBuildCommit(), "unknown");
  });

  it("returns the short SHA from RAILWAY_GIT_COMMIT_SHA", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "a8389e5d7ff1be47c85906b3638bd92eea92e566";
    assert.equal(getBuildCommit(), "a8389e5");
  });

  it("falls back to GIT_COMMIT_SHA", () => {
    process.env.GIT_COMMIT_SHA = "5196ff8abcdef1234567";
    assert.equal(getBuildCommit(), "5196ff8");
  });

  it("prefers RAILWAY_GIT_COMMIT_SHA over GIT_COMMIT_SHA", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "aaaaaaa";
    process.env.GIT_COMMIT_SHA = "bbbbbbb";
    assert.equal(getBuildCommit(), "aaaaaaa");
  });

  it("tolerates surrounding whitespace", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "  a8389e5d7ff1be47  ";
    assert.equal(getBuildCommit(), "a8389e5");
  });

  it('returns "unknown" for an empty string rather than an empty commit', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "";
    assert.equal(getBuildCommit(), "unknown");
  });

  // /health is unauthenticated. An env var can hold anything, so a value that
  // is not a SHA must never be reflected back to an anonymous caller.
  it("does not reflect non-SHA env content", () => {
    for (const bad of [
      "not-a-sha",
      "main",
      "<script>alert(1)</script>",
      "sk-ant-secret-value",
      "abc", // too short to be a SHA
      "a".repeat(41), // too long
    ]) {
      process.env.RAILWAY_GIT_COMMIT_SHA = bad;
      assert.equal(getBuildCommit(), "unknown", `should not reflect: ${bad}`);
    }
  });

  it("captures STARTED_AT as a valid ISO timestamp", () => {
    assert.match(STARTED_AT, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(!Number.isNaN(Date.parse(STARTED_AT)));
  });
});

describe("GET /health build identifier", () => {
  it("reports commit and startedAt so a deploy can be verified", async () => {
    const saved = process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.RAILWAY_GIT_COMMIT_SHA = "d34dbeef1234567890";

    const srv = http.createServer(createApp());
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as Record<string, unknown>;

      assert.equal(body.status, "ok");
      assert.equal(body.commit, "d34dbee");
      assert.equal(body.startedAt, STARTED_AT);

      // The whole point of 086: the payload must distinguish one build from
      // another. A response without these fields is indistinguishable from a
      // stale deploy still serving.
      assert.ok("commit" in body, "commit must be present, not omitted");
      assert.ok("startedAt" in body, "startedAt must be present, not omitted");
    } finally {
      srv.close();
      if (saved === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
      else process.env.RAILWAY_GIT_COMMIT_SHA = saved;
    }
  });
});
