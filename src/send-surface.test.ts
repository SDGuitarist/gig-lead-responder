import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Static send-surface control (plan 0.2/0.3): Twilio is gone, and no source
// file may bring it back. Module 1 tightens this to "one sender".
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

test("single send surface: no twilio import anywhere in src", () => {
  const files = sourceFiles("src");
  assert.ok(files.length > 20, `expected to scan the source tree, saw ${files.length} files`);
  const offenders = files.filter((f) => /from\s+["']twilio["']|require\(["']twilio["']\)/.test(readFileSync(f, "utf-8")));
  assert.deepEqual(offenders, []);
});
