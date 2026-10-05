import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { readFileSync } from "node:fs";
import { HOLD_NOTE_PREFIXES, withoutHoldNotes, type Classification } from "./types.js";

// Port manifest R292 (holiday/peak modifier): the Project says holiday/peak dates are "quoted
// separately above standard rates" and gives no number. Alex 2026-10-05: hold every one for him
// (no price), dates Valentine's, Cinco de Mayo, Mother's Day, Fourth of July, NYE. Any warning
// holds the lead (src/automation/router.ts).
const cls = (event_date_iso: string | null) =>
  ({ format_recommended: "solo", rate_card_tier: "T2", stealth_premium: false, stated_budget: null,
     competition_quote_count: 0, cultural_context_active: false, event_date_iso, flagged_concerns: [] }) as unknown as Classification;
const holiday = (iso: string | null) =>
  verifyClassificationHeuristics("lead text", cls(iso)).warnings.filter((w) => w.startsWith("holiday_peak:"));

test("port manifest R292: every holiday/peak date is held, naming the day", () => {
  const days: [string, string][] = [
    ["2027-02-14", "Valentine's Day"], ["2026-05-05", "Cinco de Mayo"], ["2026-07-04", "Fourth of July"],
    ["2026-12-31", "New Year's Eve"], ["2026-05-10", "Mother's Day"], ["2027-05-09", "Mother's Day"], ["2028-05-14", "Mother's Day"],
  ];
  for (const [iso, name] of days) {
    const w = holiday(iso);
    assert.equal(w.length, 1, iso);
    assert.equal(w[0], `holiday_peak: ${name} (${iso}), quoted separately above standard rates; Alex prices it`);
  }
});

test("port manifest R292: neighbouring days, other Sundays in May, and no date are not held", () => {
  for (const iso of ["2027-02-13", "2027-02-15", "2026-05-04", "2026-05-06", "2026-05-03", "2026-05-17", "2026-05-09",
    "2027-05-16", "2026-07-03", "2026-07-05", "2026-12-30", "2027-01-01", "not-a-date"]) {
    assert.deepEqual(holiday(iso), [], iso);
  }
  assert.deepEqual(holiday(null), []);
  assert.ok(!verifyClassificationHeuristics("lead text", cls("2026-06-20")).warnings.some((w) => w.includes("holiday_peak:")));
});

// Codex round 1 (holiday) P2: the note held the lead but was not a hold-note prefix, so the
// generate and verify prompts (both call withoutHoldNotes) would show it to the drafting model.
test("port manifest R292: the holiday note holds the lead but never reaches the drafting prompts", () => {
  const held = verifyClassificationHeuristics("lead text", cls("2026-07-04")).classification;
  assert.ok(held.flagged_concerns.some((f) => f.startsWith("holiday_peak:")));
  assert.ok(!withoutHoldNotes(held).flagged_concerns.some((f) => f.startsWith("holiday_peak:")));
});

test("hold notes: every note prefix classify-verify writes is stripped from the drafting prompts", () => {
  const src = readFileSync("src/pipeline/classify-verify.ts", "utf-8");
  const prefixes = [...new Set([...src.matchAll(/addWarning\(\s*warnings,\s*[`"]([a-z_]+:)/g)].map((m) => m[1]))];
  assert.ok(prefixes.length >= 4, `control: found ${prefixes.join(" ")}`);
  assert.deepEqual(prefixes.filter((p) => !(HOLD_NOTE_PREFIXES as readonly string[]).includes(p)), []);
});
