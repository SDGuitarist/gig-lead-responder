import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

// Plan 0.5. port-manifest.md must account for every row of port-inventory.md.
// "port inventory fully accounted" (no UNREVIEWED rows) is added only when the
// last row is reviewed; until then test:match on that name exits 3, by design.
const DIR = "docs/research/2026-10-02-booking-hub";
const STATUSES = ["UNREVIEWED", "TO PORT", "PORTED", "ALREADY PRESENT", "NOT PORTED", "BLOCKED"];

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

test("port manifest every row reviewed: no row is UNREVIEWED", () => {
  const unreviewed = tableRows(`${DIR}/port-manifest.md`).filter((r) => r[3] === "UNREVIEWED").map((r) => r[0]);
  assert.deepEqual(unreviewed, []);
});

// Codex round 1 (port range) finding 4: a PORTED row must carry a marker and name
// at least one test that exists (a test title in src/**/*.test.ts starts with it,
// or a `npx tsx scripts/...` check). Cited files alone are not proof.
function listSources(d: string): string[] {
  return readdirSync(d).flatMap((n) => {
    const p = `${d}/${n}`;
    if (statSync(p).isDirectory()) return listSources(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

test("port manifest PORTED rows name a marker and a real test", () => {
  const files = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = `${d}/${n}`;
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".test.ts") ? [p] : [];
  });
  const titles = files("src").flatMap((f) =>
    [...readFileSync(f, "utf-8").matchAll(/\b(?:test|it|describe)\("([^"]+)"/g)].map((m) => m[1]));
  assert.ok(titles.length > 300, `control: read ${titles.length} test titles`);
  // The runtime surface: app code plus top-level docs (not docs/research, where this manifest lives).
  const topDocs = readdirSync("docs").filter((n) => n.endsWith(".md")).map((n) => `docs/${n}`);
  const runtimeText = [...listSources("src"), ...topDocs].map((f) => readFileSync(f, "utf-8")).join("\n");
  const bad: string[] = [];
  for (const [id, , , status, , , marker, tests] of tableRows(`${DIR}/port-manifest.md`)) {
    if (status !== "PORTED") continue;
    if (!marker) bad.push(`${id}: no marker`);
    const m = marker.replace(/^`|`$/g, "");
    if (m && !runtimeText.includes(m)) bad.push(`${id}: marker "${m}" is not in src/ or docs/`);
    const named = [...(tests ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (named.length === 0) bad.push(`${id}: no test named`);
    for (const n of named) {
      if (!n.startsWith("npx tsx scripts/") && !titles.some((t) => t.startsWith(n))) bad.push(`${id}: no test titled "${n}"`);
    }
  }
  assert.deepEqual(bad, []);
});
