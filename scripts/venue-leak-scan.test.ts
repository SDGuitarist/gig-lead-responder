import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WINDOW, claimWindows, collapse, scanText, windowKey } from "./venue-leak-scan.js";

// Made-up venues and sentences only: tests never read ~/Data (venues code review rounds 1-2).
const OPENING = "Fixture opening clause was public long ago";
const LATER = "and fixture later words were never published anywhere.";
const windows = claimWindows([
  { name: "Example Lodge", claim: `${OPENING}, ${LATER}` },
  { name: "Example Harbor Hall", claim: "Example harbor sentence that is private and must never appear in a tracked file." },
  { name: "Example Garden", claim: "Short one." },
]);
// The approved list: fingerprints of the opening's windows in one file, as check-venue-history.ts lists them.
const GUIDE = "docs/GUIDE.md";
const approved = new Set<string>();
for (let i = 0; i + WINDOW <= OPENING.length; i++) approved.add(windowKey(GUIDE, OPENING.slice(i, i + WINDOW)));
const knownIn = (file: string) => (w: string) => approved.has(windowKey(file, w));

describe("venue leak scan", () => {
  it("known-public positive: the approved opening is known, not a leak", () => {
    assert.deepEqual(scanText(collapse(`Voice example: ${OPENING}.`), windows, knownIn(GUIDE)), { leaks: [], known: ["Example Lodge"] });
  });

  it("later window of the same sentence in the same file is a leak (approval is per window, not per venue)", () => {
    assert.deepEqual(scanText(collapse(`Voice example: ${LATER}`), windows, knownIn(GUIDE)).leaks, ["Example Lodge"]);
  });

  it("mixed file: a known match first never hides a new leak after it", () => {
    const r = scanText(collapse(`${OPENING}. Then: Example harbor sentence that is private`), windows, knownIn(GUIDE));
    assert.deepEqual(r, { leaks: ["Example Harbor Hall"], known: ["Example Lodge"] });
  });

  it("overshoot: the approved opening in another file is a leak (approval is bound to its file)", () => {
    assert.deepEqual(scanText(collapse(`${OPENING}.`), windows, knownIn("docs/OTHER.md")).leaks, ["Example Lodge"]);
    assert.deepEqual(scanText(collapse(`${OPENING}.`), windows).leaks, ["Example Lodge"]);
  });

  it("whitespace and line breaks do not hide a copy; a sentence under 30 characters is matched whole", () => {
    assert.deepEqual(scanText(collapse("Example harbor\n   sentence that is private"), windows).leaks, ["Example Harbor Hall"]);
    assert.deepEqual(scanText(collapse("We said: Short one. Twice."), windows).leaks, ["Example Garden"]);
  });

  it("text with none of the sentences reports nothing", () => {
    assert.deepEqual(scanText(collapse("Nothing private here at all, just ordinary words in a file."), windows, knownIn(GUIDE)), { leaks: [], known: [] });
  });

  it("windowKey is 16 hex characters and changes with the file or the window", () => {
    const w = OPENING.slice(0, WINDOW);
    assert.match(windowKey(GUIDE, w), /^[0-9a-f]{16}$/);
    assert.equal(windowKey(GUIDE, w), windowKey(GUIDE, w));
    assert.notEqual(windowKey(GUIDE, w), windowKey("docs/OTHER.md", w));
    assert.notEqual(windowKey(GUIDE, w), windowKey(GUIDE, OPENING.slice(1, WINDOW + 1)));
  });
});
