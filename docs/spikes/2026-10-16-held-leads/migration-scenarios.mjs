// Plan evidence for todo 097 (not a repo test). Run from the repo root: node docs/spikes/2026-10-16-held-leads/migration-scenarios.mjs
// Offline. Uses ONLY temp databases in the OS temp folder and TEMP COPIES of src/db/migrate.ts + migrations.ts; never opens data/leads.db.
// Runs the scenarios M1-M4 in separate child processes (initDb is a module singleton) against three variants:
//   current  = the repo's code unchanged (control: no hold_reason column exists, nothing should break)
//   numbered = the plan: hold_reason added as migration v4 in MIGRATIONS (must work everywhere)
//   loop     = the REJECTED placement: hold_reason added to the migrate.ts column loop (must break M3, which reproduces round-1 P2-1)
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const root = resolve(".");
const base = mkdtempSync(join(tmpdir(), "glr-mig-spike-"));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };

// ---- build the three variants as temp copies -----------------------------------------------------------------------------
const mig = readFileSync(join(root, "src/db/migrate.ts"), "utf8");
const migs = readFileSync(join(root, "src/db/migrations.ts"), "utf8");
const BETTER = pathToFileURL(join(root, "node_modules/better-sqlite3/lib/index.js")).href;
const fixImports = (s) => s.replace('from "better-sqlite3"', `from "${BETTER}"`).replace('from "../types.js"', `from "${pathToFileURL(join(root, "src/types.ts")).href}"`);
const LOOP_ANCHOR = '    ["snoozed_until", "TEXT"],\n';
const V3_END = '    up: (db) => db.exec("ALTER TABLE leads ADD COLUMN strategic_reserve_json TEXT"),\n  },\n';
if (mig.split(LOOP_ANCHOR).length !== 2) throw new Error("loop anchor not unique");
if (migs.split(V3_END).length !== 2) throw new Error("v3 anchor not unique");
const variants = {
  current: [mig, migs],
  numbered: [mig, migs.replace(V3_END, V3_END + '  {\n    version: 4,\n    name: "hold_reason",\n    up: (db) => db.exec("ALTER TABLE leads ADD COLUMN hold_reason TEXT"),\n  },\n')],
  loop: [mig.replace(LOOP_ANCHOR, LOOP_ANCHOR + '    ["hold_reason", "TEXT"],\n'), migs],
};
for (const [name, [a, b]] of Object.entries(variants)) {
  const d = join(base, "v-" + name); mkdirSync(d);
  writeFileSync(join(d, "migrate.ts"), fixImports(a));
  writeFileSync(join(d, "migrations.ts"), fixImports(b));
}

// ---- run initDb of one variant against one database file in a child process -----------------------------------------------
function runInit(variant, dbPath) {
  const code = `const { initDb } = await import(${JSON.stringify(pathToFileURL(join(base, "v-" + variant, "migrate.ts")).href)});
    const db = initDb();
    const cols = db.pragma("table_info(leads)").map((c) => c.name);
    console.log("RESULT " + JSON.stringify({ v: db.pragma("user_version", { simple: true }), hold: cols.includes("hold_reason"), rows: db.prepare("SELECT mailgun_message_id m, raw_email r, " + (cols.includes("hold_reason") ? "hold_reason" : "NULL") + " h FROM leads ORDER BY id").all().map((x) => x.m + "|" + x.r + "|" + (x.h ?? "null")) }));`;
  const env = { ...process.env, DATABASE_PATH: dbPath }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { env, encoding: "utf8", cwd: root });
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("RESULT "));
  return { ok: r.status === 0 && !!line, res: line ? JSON.parse(line.slice(7)) : null, err: (r.stderr || "").split("\n").find((l) => /Error|error/.test(l)) || "" };
}
const fresh = (n) => join(mkdtempSync(join(base, n + "-")), "leads.db");
const insertTwo = (p) => { const d = new Database(p); d.exec("INSERT INTO leads (mailgun_message_id, raw_email, created_at, updated_at) VALUES ('m-1','first','x','x'),('m-2','second','x','x')"); d.close(); };
const rowsOk = (r) => JSON.stringify(r.rows.slice(0, 2)) === JSON.stringify(["m-1|first|null", "m-2|second|null"]);

// Pre-'replied' database: baseline columns plus the loop columns, follow_up_status with the OLD 4-value CHECK, two rows with DISTINCT ids.
function makeLegacy(p) {
  const d = new Database(p);
  d.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_platform TEXT, mailgun_message_id TEXT UNIQUE, raw_email TEXT NOT NULL, client_name TEXT, event_date TEXT,
    event_type TEXT, venue TEXT, guest_count INTEGER, budget_note TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','sending','sent','done','failed')),
    classification_json TEXT, pricing_json TEXT, full_draft TEXT, compressed_draft TEXT, gate_passed INTEGER, gate_json TEXT,
    edit_round INTEGER NOT NULL DEFAULT 0, edit_instructions TEXT, done_reason TEXT, outcome TEXT, outcome_reason TEXT, actual_price REAL, outcome_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, confidence_score INTEGER, error_message TEXT, pipeline_completed_at TEXT, sms_sent_at TEXT,
    follow_up_status TEXT CHECK(follow_up_status IN ('pending','sent','skipped','exhausted')),
    follow_up_count INTEGER NOT NULL DEFAULT 0, follow_up_due_at TEXT, follow_up_draft TEXT, snoozed_until TEXT)`);
  d.close(); insertTwo(p);
}

console.log("M1 fresh database");
for (const v of ["current", "numbered", "loop"]) { const r = runInit(v, fresh("m1")); console.log(`  [${v}] ${JSON.stringify(r.res)} ${r.err}`);
  if (v === "numbered") check(r.ok && r.res.hold && r.res.v === 4, "M1 numbered: column present, user_version 4");
  if (v === "current") check(r.ok && !r.res.hold, "M1 current (control): no column, runs"); }

console.log("M2 a real current-code database (version 3) with 2 rows, then upgraded");
{ const p = fresh("m2"); const a = runInit("current", p); insertTwo(p); const b = runInit("numbered", p);
  check(a.ok && a.res.v === 3, "M2 setup: the current code leaves user_version 3 (so the upgrade is a real 3 -> 4)");
  check(b.ok && b.res.v === 4 && b.res.hold && rowsOk(b.res), "M2 numbered: upgraded to 4, column added, both rows kept, hold_reason null"); }

console.log("M3 pre-'replied' database with 2 rows (distinct ids): legacy rebuild must run first");
{ for (const v of ["current", "numbered", "loop"]) { const p = fresh("m3-" + v); makeLegacy(p); const r = runInit(v, p); console.log(`  [${v}] ok=${r.ok} ${JSON.stringify(r.res)} ${r.err}`);
    if (v === "current") check(r.ok && !r.res.hold && rowsOk(r.res), "M3 current (control): rebuild succeeds, rows kept");
    if (v === "numbered") check(r.ok && r.res.v === 4 && r.res.hold && rowsOk(r.res), "M3 numbered: rebuild then v4, column present, rows kept");
    if (v === "loop") check(!r.ok, "M3 loop (REJECTED placement) FAILS: this reproduces round-1 P2-1, so M3 would catch it"); } }

console.log("M4 repeated startup, second run in a separate process");
{ const p = fresh("m4"); const a = runInit("numbered", p); insertTwo(p); const b = runInit("numbered", p);
  check(a.ok && b.ok && b.res.v === 4 && rowsOk(b.res), "M4 numbered: second start works, still version 4, rows kept"); }

console.log(bad === 0 ? "\nALL CHECKS PASS" : `\n${bad} CHECK(S) FAILED`);
process.exit(bad === 0 ? 0 : 1);
