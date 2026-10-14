import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Plan docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md, the replay's exit-2 contract: a missing or empty
// input must not read as "no matches". Names start "Clarification Replay R<n>".
const script = "scripts/clarification-validator-replay.ts";
const run = (...dirs: string[]) => spawnSync("npx", ["tsx", script, ...dirs], { encoding: "utf-8" });

describe("Clarification Replay: inputs", () => {
  it("Clarification Replay R1 a missing directory, an empty directory and a file with no drafts all exit 2", () => {
    const missing = run(join(tmpdir(), "no-such-replay-dir-xyz"));
    assert.equal(missing.status, 2);
    const empty = mkdtempSync(join(tmpdir(), "replay-empty-"));
    const noFiles = run(empty);
    assert.equal(noFiles.status, 2);
    mkdirSync(empty, { recursive: true });
    writeFileSync(join(empty, "clarification-x.json"), JSON.stringify({ results: [{ calls: [] }] }));
    const noDrafts = run(empty);
    assert.equal(noDrafts.status, 2);
    assert.match(noDrafts.stderr, /no drafts/);
  });

  it("Clarification Replay R2 a directory with drafts counts old and new matches (positive control)", () => {
    const dir = mkdtempSync(join(tmpdir(), "replay-ok-"));
    const drafts = ["Pick a format that can anchor the room?", "The price floor is firm?", "A dance floor changes the setup?", "Plain draft?"];
    writeFileSync(join(dir, "clarification-ok.json"), JSON.stringify({ results: [{ calls: drafts.map((d) => ({ full_draft: d, compressed_draft: d })) }] }));
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /distinct drafts 4/);
    assert.match(r.stdout, /old internal-term alternative matches: 3 drafts/);
    assert.match(r.stdout, /current pattern rejects for an internal term: 1 drafts/);
  });
});
