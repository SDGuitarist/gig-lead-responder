import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Plan 0.5. port-manifest.md must account for every row of port-inventory.md.
// "port inventory fully accounted" (no UNREVIEWED rows) is added only when the
// last row is reviewed; until then test:match on that name exits 3, by design.
const DIR = "docs/research/2026-10-02-booking-hub";
const STATUSES = ["UNREVIEWED", "PORTED", "ALREADY PRESENT", "NOT PORTED", "BLOCKED"];

function tableRows(path: string): string[][] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => /^\| R\d{3} \|/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

test("port manifest structure: every inventory row appears exactly once, in order", () => {
  const inventory = tableRows(`${DIR}/port-inventory.md`).map((r) => r.slice(0, 3).join("|"));
  const manifest = tableRows(`${DIR}/port-manifest.md`).map((r) => r.slice(0, 3).join("|"));
  assert.equal(inventory.length, 406);
  assert.deepEqual(manifest, inventory);
});

test("port manifest structure: statuses are valid and cited places exist", () => {
  for (const [id, , , status, where] of tableRows(`${DIR}/port-manifest.md`)) {
    assert.ok(STATUSES.includes(status), `${id}: bad status "${status}"`);
    if (status === "ALREADY PRESENT" || status === "PORTED") {
      const file = /`([^`:]+)(?::\d+)?`/.exec(where)?.[1];
      assert.ok(file && existsSync(file), `${id}: cites "${where}", which is not an existing file`);
    }
    if (status === "NOT PORTED") assert.match(where, /Alex/, `${id}: NOT PORTED needs Alex's approval noted`);
  }
});
