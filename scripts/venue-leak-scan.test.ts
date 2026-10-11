import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { claimWindows, collapse, scanText } from "./venue-leak-scan.js";

// Made-up venues and sentences only: tests never read ~/Data (venues code review round 1, finding 1).
const OPENING = "Fixture opening clause was public long ago";
const LATER = "and fixture later words were never published anywhere.";
const windows = claimWindows([
  { name: "Example Lodge", claim: `${OPENING}, ${LATER}` },
  { name: "Example Harbor Hall", claim: "Example harbor sentence that is private and must never appear in a tracked file." },
  { name: "Example Garden", claim: "Short one." },
]);
const publicVersion = collapse(`Voice example:\n${OPENING}.`);

describe("venue leak scan", () => {
  it("known-public positive: the opening already in the public version is known, not a leak", () => {
    assert.deepEqual(scanText(collapse(`Voice example: ${OPENING}.`), windows, publicVersion), { leaks: [], known: ["Example Lodge"] });
  });

  it("later window of the same sentence in the same file is a leak (exemption is per window, not per venue)", () => {
    assert.deepEqual(scanText(collapse(`Voice example: ${LATER}`), windows, publicVersion).leaks, ["Example Lodge"]);
  });

  it("mixed file: a known match first never hides a new leak after it", () => {
    const r = scanText(collapse(`${OPENING}. Then: Example harbor sentence that is private`), windows, publicVersion);
    assert.deepEqual(r, { leaks: ["Example Harbor Hall"], known: ["Example Lodge"] });
  });

  it("overshoot: the public opening in a file with no public version is a leak", () => {
    assert.deepEqual(scanText(collapse(`${OPENING}.`), windows).leaks, ["Example Lodge"]);
  });

  it("whitespace and line breaks do not hide a copy; a sentence under 30 characters is matched whole", () => {
    assert.deepEqual(scanText(collapse("Example harbor\n   sentence that is private"), windows).leaks, ["Example Harbor Hall"]);
    assert.deepEqual(scanText(collapse("We said: Short one. Twice."), windows).leaks, ["Example Garden"]);
  });

  it("text with none of the sentences reports nothing", () => {
    assert.deepEqual(scanText(collapse("Nothing private here at all, just ordinary words in a file."), windows, publicVersion), { leaks: [], known: [] });
  });
});
