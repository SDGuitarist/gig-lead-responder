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

// Codex round 2 (port range) finding 2: a marker that exists somewhere and a test
// title that exists somewhere prove nothing about each other. The named test must
// assert the row's marker, and a conditional row's test must also assert absence
// (the plan's non-meeting fixture). Checked per test FILE, not per test body.
const ABSENCE = /assert\.ok\(\s*!|doesNotMatch|notEqual|notDeepEqual|assert\.equal\([^)]*,\s*(?:false|null|undefined)\)/;
test("port manifest PORTED rows: the named test asserts the marker, and conditional rows assert absence", () => {
  const testFiles = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = `${d}/${n}`;
    return statSync(p).isDirectory() ? testFiles(p) : p.endsWith(".test.ts") ? [p] : [];
  });
  const files = testFiles("src").map((f) => ({ text: readFileSync(f, "utf-8") }))
    .map((f) => ({ ...f, titles: [...f.text.matchAll(/\b(?:test|it|describe)\("([^"]+)"/g)].map((m) => m[1]) }));
  const bad: string[] = [];
  for (const [id, , , status, , condition, marker, tests] of tableRows(`${DIR}/port-manifest.md`)) {
    if (status !== "PORTED") continue;
    const named = [...(tests ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((n) => !n.startsWith("npx tsx scripts/"));
    const hit = files.filter((f) => named.some((n) => f.titles.some((t) => t.startsWith(n))));
    const m = marker.replace(/^`|`$/g, "");
    if (!hit.some((f) => f.text.includes(m))) bad.push(`${id}: no named test asserts "${m}"`);
    if (!/^always/.test(condition) && !hit.some((f) => ABSENCE.test(f.text))) bad.push(`${id}: conditional, no absence assertion`);
  }
  assert.deepEqual(bad, []);
});

// Venue history plan (2026-10-11), V15: the exact status of each of the nine venue rows, by id, so a different row
// cannot be ported in another row's place while the counts still add up. R085 (La Valencia) and R089 (Scripps) PORTED 2026-10-11 (Alex).
test("port manifest venues rows: R081-R085, R087-R089, R405 are PORTED", () => {
  const status = new Map(tableRows(`${DIR}/port-manifest.md`).map((r) => [r[0], r[3]]));
  for (const id of ["R081", "R082", "R083", "R084", "R085", "R087", "R088", "R089", "R405"]) assert.equal(status.get(id), "PORTED", id);
});

// T4 reference-lead plan (2026-10-11), T7 (strengthened for Codex code review round 1, P2): R020-R025 PORTED and
// R329 NOT PORTED by id, AND each PORTED row's marker is tied to a test whose BODY asserts it (the generic test
// above only proves a marker and a test title exist somewhere in a file).
// `test` is the prefix the manifest row names; `title` is the ONE test whose body must assert the marker (Codex code
// review round 2, run 2: a prefix matched several bodies, so deleting the assertion from the intended one stayed green).
const T4_ROWS: Record<string, { marker: string; test: string; title: string; body: string }> = {
  R020: { marker: "REFERENCE LEAD: T4 CORPORATE", test: "T4 reference T1", title: "T4 reference T1 a T4 lead gets the section header and the example reply", body: "REFERENCE LEAD: T4 CORPORATE" },
  R021: { marker: "The order, as steps:", test: "T4 reference T1", title: "T4 reference T1 the block lists the seven steps in order", body: "The order, as steps:" },
  R022: { marker: "NO INVENTED FACTS", test: "T4 reference T4", title: "T4 reference T4 states no invented facts", body: "NO INVENTED FACTS" },
  R023: { marker: "ONLY PLAYED SPACES", test: "T4 reference T4", title: "T4 reference T4 states only played spaces and names the venue-history header by its constant", body: "ONLY PLAYED SPACES" },
  R024: { marker: "Never mention battery-powered sound", test: "T4 reference T4", title: "T4 reference T4 forbids mentioning battery-powered sound", body: "Never mention battery-powered sound" },
  // R025's marker is asserted through the test file's constant of the same line.
  R025: { marker: "OPENING: availability first, then the cinematic line.", test: "T4 reference T3", title: "T4 reference T3 urgent: availability first, and never the other line", body: "OPEN_AVAILABILITY" },
};

/** The text of every `it("<title>"...` whose title starts with `prefix` (up to the next `it(` or the end). */
function testBodies(text: string, prefix: string): string[] {
  const parts = text.split(/\n\s*it\(/).slice(1);
  return parts.filter((p) => p.startsWith(`"${prefix}`));
}

/** The body of the one `it("<title>"...` with exactly this title (the closing quote must follow the title). */
function bodyOfTitle(text: string, title: string): string[] {
  return text.split(/\n\s*it\(/).slice(1).filter((p) => p.startsWith(`"${title}"`));
}

/** True when some `assert` line names `needle` and does not negate it (`!x.includes(...)` proves absence, not presence). */
function assertsPositively(body: string, needle: string): boolean {
  return body.split("\n").some((l) => l.includes(needle) && /assert\./.test(l) && !/!\s*[\w.]+\.includes\(/.test(l));
}

test("T4 reference T7 manifest rows: R020-R025 are PORTED, R329 is NOT PORTED, and each marker is asserted by its test", () => {
  const rows = new Map(tableRows(`${DIR}/port-manifest.md`).map((r) => [r[0], r]));
  const impl = readFileSync("src/data/t4-reference.ts", "utf-8");
  const tests = readFileSync("src/t4-reference.test.ts", "utf-8");
  for (const [id, want] of Object.entries(T4_ROWS)) {
    const row = rows.get(id);
    assert.ok(row, `${id}: row missing`);
    assert.equal(row[3], "PORTED", `${id}: status`);
    assert.equal(row[6].replace(/^`|`$/g, ""), want.marker, `${id}: manifest marker`);
    assert.ok((row[7] ?? "").includes(want.test), `${id}: manifest names ${want.test}`);
    assert.ok(impl.includes(want.marker), `${id}: marker not in src/data/t4-reference.ts`);
    assert.ok(want.title.startsWith(want.test), `${id}: the exact title must sit under the manifest's prefix`);
    const bodies = bodyOfTitle(tests, want.title);
    assert.equal(bodies.length, 1, `${id}: expected exactly one test titled "${want.title}"`);
    assert.ok(assertsPositively(bodies[0], want.body), `${id}: "${want.title}" does not assert ${want.body}`);
    // A body that asserts through a constant is only worth something if the constant is defined as the marker.
    if (want.body !== want.marker) {
      assert.ok(tests.includes(`const ${want.body} = "${want.marker}"`), `${id}: ${want.body} is not defined as the marker`);
    }
  }
  const r329 = rows.get("R329");
  assert.ok(r329);
  assert.equal(r329[3], "NOT PORTED");
  assert.ok(/DRAFT_METHOD\.md/.test(r329[4]) && /approved by Alex/.test(r329[4]), "R329: reason and Alex's approval");
});

test("T4 reference T7 the body finder can fail: a title with no matching body is not found", () => {
  const fake = `describe("x", () => {\n  it("T4 reference T9 only", () => {\n    assert.ok(a.includes("FOO"));\n  });\n});`;
  assert.equal(testBodies(fake, "T4 reference T9").length, 1);
  assert.ok(testBodies(fake, "T4 reference T9").some((b) => b.includes("FOO")));
  assert.equal(testBodies(fake, "T4 reference T1").length, 0);
});

test("T4 reference T7 exact binding: a same-prefix body holding the marker cannot stand in for the intended test", () => {
  const fake = [
    'describe("x", () => {',
    '  it("T4 reference T1 intended", () => {',
    '    assert.ok(block.includes("hello"));',
    "  });",
    '  it("T4 reference T1 other", () => {',
    '    assert.ok(prompt.includes("MARKER"));',
    "  });",
    "});",
  ].join("\n");
  // Prefix matching finds a body with MARKER (the old false green)...
  assert.ok(testBodies(fake, "T4 reference T1").some((b) => b.includes("MARKER")));
  // ...exact binding looks only at the intended one and refuses.
  const intended = bodyOfTitle(fake, "T4 reference T1 intended");
  assert.equal(intended.length, 1);
  assert.equal(assertsPositively(intended[0], "MARKER"), false);
  // Positive control: a correctly bound body passes.
  assert.equal(assertsPositively(intended[0], "hello"), true);
  // A title that is only a prefix of another title does not bind.
  assert.equal(bodyOfTitle(fake, "T4 reference T1 inten").length, 0);
});

test("T4 reference T7 a negated assertion is not a positive one", () => {
  const body = '    assert.ok(!block.includes(OPEN_AVAILABILITY), "must not appear");';
  assert.equal(assertsPositively(body, "OPEN_AVAILABILITY"), false);
  assert.equal(assertsPositively('    assert.ok(block.includes(OPEN_AVAILABILITY), "x");', "OPEN_AVAILABILITY"), true);
});
