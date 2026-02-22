---
title: "Compute 'Today' Once at Pipeline Entry"
category: logic-errors
tags: [timezone, date, purity, testing, pipeline]
module: pipeline
symptoms:
  - Wrong day-of-week after 5 PM Pacific
  - Clock skew between pipeline stages
  - Tests dependent on wall-clock time
  - Functions marked pure in JSDoc but using new Date()
date_documented: 2026-02-21
---

# Compute "Today" Once at Pipeline Entry

## Problem

Two pipeline stages (`classifyLead` and `enrichClassification`) independently called `new Date()` to determine "today." After 5 PM Pacific, `new Date()` returns a UTC date that is already tomorrow -- so a Friday evening lead would be classified as Saturday, routing mariachi leads to the wrong format. The two independent calls could also straddle midnight, producing different dates for classification vs. enrichment.

## Root Cause

`new Date()` returns a UTC timestamp. In the Pacific timezone (UTC-8 / UTC-7), any time after 4-5 PM local causes `toISOString()` or `.getDay()` to return the next calendar day. Having two separate `new Date()` calls in different pipeline stages also meant there was no guarantee both stages agreed on what day it was, and neither function could be tested without mocking the system clock.

## Solution

A `getTodayISO()` utility computes today's date in Pacific time using `toLocaleDateString`:

```ts
// src/utils/dates.ts
export function getTodayISO(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}
```

The `"en-CA"` locale produces `YYYY-MM-DD` format. The `timeZone` option pins the date to Pacific time regardless of the server's system timezone.

The pipeline entry point (`src/run-pipeline.ts`) calls `getTodayISO()` once and passes the result down to both stages as a plain string parameter:

```ts
// src/run-pipeline.ts
const today = getTodayISO();
const classification = await classifyLead(rawText, today);
// ...
const enriched = enrichClassification(classification, pricing, today);
```

Both `classifyLead` and `enrichClassification` accept `today: string` as a required parameter instead of computing it internally:

```ts
// src/pipeline/classify.ts
export async function classifyLead(
  rawText: string,
  today: string,
): Promise<Classification> { ... }

// src/pipeline/enrich.ts — JSDoc: "Deterministic given inputs — no system clock reads."
export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
  today: string,
): Classification { ... }
```

Tests pass a fixed date string, making them fully deterministic with no clock mocking:

```ts
// src/enrich-generate.test.ts
const result = enrichClassification(c, p, "2026-02-21");
```

A companion `parseLocalDate()` function avoids the same UTC trap when converting ISO date strings back to `Date` objects for day-of-week calculations:

```ts
// src/utils/dates.ts
export function parseLocalDate(isoDate: string): Date {
  const d = new Date(`${isoDate}T12:00:00`);
  if (isNaN(d.getTime())) throw new Error(`Invalid ISO date: "${isoDate}"`);
  return d;
}
```

Parsing at noon instead of midnight prevents `new Date("2026-03-14")` (UTC midnight) from rolling back to March 13 in Pacific time.

## What Was Rejected

Making `today` an optional parameter with a default value (`today = getTodayISO()`) was considered. This would let callers skip the argument for convenience. It was rejected because:

- Default parameters hide impurity -- the function signature looks pure but still reads the clock when no argument is passed.
- Tests that forget to pass a date silently use the real clock instead of failing, making them pass today and break tomorrow.
- Explicit is better: a required parameter forces every caller (including tests) to decide what "today" means.

## Prevention

- **Wall-clock reads at the boundary only.** `new Date()` and `getTodayISO()` should only appear in entry points (`run-pipeline.ts`, CLI scripts, HTTP handlers). Everything downstream receives the value as a parameter.
- **Required, not optional.** Date parameters that affect business logic should be required so tests cannot accidentally depend on wall-clock time.
- **Parse at noon, not midnight.** When converting an ISO date string (`YYYY-MM-DD`) to a `Date` object, append `T12:00:00` to avoid UTC-midnight rollover in western-hemisphere timezones.

## Related

- `src/utils/dates.ts` -- `getTodayISO()` and `parseLocalDate()` implementations
- `src/run-pipeline.ts` -- single `getTodayISO()` call at pipeline entry
- `src/pipeline/enrich.ts` -- format routing uses `parseLocalDate()` for day-of-week checks
