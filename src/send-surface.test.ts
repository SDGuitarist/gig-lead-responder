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

// Every call in src/ that can act on the outside world, pinned by file and
// count (plan 0.2). Adding or moving one fails here until this list is
// updated on purpose. Module 1 collapses the client sends into sendClientMessage().
const SEND_PATTERNS: Record<string, RegExp> = {
  "gmail messages.send": /\bmessages\.send\(/g,
  "portal click": /\.click\(/g,
  "anthropic messages.create": /\bmessages\.create\(/g,
  "fetch": /\bfetch\(/g,
};

const PINNED: Record<string, Record<string, number>> = {
  "src/automation/gmail-watcher.ts": { "gmail messages.send": 1 }, // Squarespace reply
  "src/automation/portals/gigsalad-client.ts": { "portal click": 2 }, // send button + login submit
  // Alex 2026-10-05 (option A): "Mark as unread" after the app reads a lead (reading marks it read).
  // Only an exact single button in this lead's form; result proven via the Unread/Archived views.
  "src/automation/portals/gigsalad-unread.ts": { "portal click": 1 },
  "src/automation/portals/yelp-client.ts": { "portal click": 2 }, // send button + login submit
  "src/claude.ts": { "anthropic messages.create": 1 }, // drafting, not a client send
  "src/venue-lookup.ts": { fetch: 1 }, // GET to PF-Intel
};

function countSendSites(files: Array<{ path: string; text: string }>) {
  const found: Record<string, Record<string, number>> = {};
  for (const { path, text } of files) {
    for (const [name, re] of Object.entries(SEND_PATTERNS)) {
      const n = text.match(re)?.length ?? 0;
      if (n > 0) (found[path] ??= {})[name] = n;
    }
  }
  return found;
}

const tree = () => sourceFiles("src").map((p) => ({ path: p, text: readFileSync(p, "utf-8") }));

test("send surface pinned: today's send sites match the list exactly", () => {
  assert.deepEqual(countSendSites(tree()), PINNED);
});

test("send surface pinned: control, a planted extra send is caught", () => {
  const planted = [...tree(), { path: "src/new-feature.ts", text: "await gmail.users.messages.send({})" }];
  assert.notDeepEqual(countSendSites(planted), PINNED);
  assert.deepEqual(countSendSites(planted)["src/new-feature.ts"], { "gmail messages.send": 1 });
});
