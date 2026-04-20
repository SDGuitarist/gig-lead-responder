import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTodayISO, parseLocalDate } from "./utils/dates.js";

describe("getTodayISO", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getTodayISO();
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a parseable date", () => {
    const result = getTodayISO();
    const parsed = new Date(result);
    assert.ok(!isNaN(parsed.getTime()));
  });
});

describe("parseLocalDate", () => {
  it("parses valid ISO date", () => {
    const result = parseLocalDate("2026-06-15");
    assert.ok(result instanceof Date);
    assert.ok(!isNaN(result.getTime()));
  });

  it("parses to noon to avoid UTC rollover", () => {
    const result = parseLocalDate("2026-06-15");
    assert.equal(result.getHours(), 12);
  });

  it("throws on invalid date string", () => {
    assert.throws(
      () => parseLocalDate("not-a-date"),
      { message: 'Invalid ISO date: "not-a-date"' },
    );
  });

  it("throws on empty string", () => {
    assert.throws(
      () => parseLocalDate(""),
      { message: 'Invalid ISO date: ""' },
    );
  });
});
