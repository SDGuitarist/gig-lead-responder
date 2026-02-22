# Batch 2 — Framework Documentation (Context7)

**Date:** 2026-02-21
**Libraries queried:** 2

---

## date-fns (v3.5.0)

**Library ID:** /date-fns/date-fns
**Query:** Parse date string, get day of week, isBefore/isAfter, compare dates in TypeScript

**Key Findings:**

- date-fns provides `getDay()`, `isBefore()`, `isAfter()`, `parseISO()`, and `compareAsc()` for all needed date operations.
- However, for the narrow use case in this pipeline (compare one date, get day-of-week), **native `Date` is sufficient.** `new Date("2026-03-14T12:00:00").getDay()` returns the correct day-of-week without any library.
- date-fns becomes worth adding if we later need: locale-aware formatting, relative date descriptions ("in 3 weeks"), or complex date arithmetic.

**Recommendation:** Do NOT add date-fns for this fix. Use native `Date` with the `T12:00:00` noon anchor to avoid UTC rollover. If chrono-node is added later for natural language date parsing fallback, date-fns is still unnecessary — chrono-node returns native `Date` objects.

**Code Patterns:**

If date-fns is ever added, the equivalent operations:

```typescript
import { parseISO, getDay, isBefore } from "date-fns";

// Parse ISO date string
const eventDate = parseISO("2026-03-14"); // returns Date object

// Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
const dayOfWeek = getDay(eventDate); // 6 (Saturday)

// Compare to today
const isPast = isBefore(eventDate, new Date()); // false (March 14 is upcoming)
```

But the native equivalent is equally reliable for this use case:

```typescript
// Native — no library needed
const d = new Date("2026-03-14T12:00:00");
const dayOfWeek = d.getDay(); // 6 (Saturday)
const isPast = d < new Date(); // false
```

---

## Anthropic SDK TypeScript

**Library ID:** /anthropics/anthropic-sdk-typescript
**Query:** Structured output JSON schema, tool use, classification with boolean flags

**Key Findings:**

- The SDK supports `jsonSchemaOutputFormat()` helper for structured JSON output with schema validation. This is the modern (2025+) way to get typed classification output from Claude.
- `client.messages.parse()` returns a `parsed_output` property with the validated structured data — no manual JSON.parse needed.
- Boolean flags like `past_date_detected` and `ambiguous_mariachi_signals` fit cleanly into the JSON schema as `{ type: 'boolean' }` properties.
- The `output_config.format` parameter accepts the schema at the API level, enforcing the structure.

**Recommendation:** If the pipeline currently uses manual JSON.parse on Claude's text output, consider migrating to `messages.parse()` with `jsonSchemaOutputFormat()` for type safety. However, this is a separate enhancement — the three fixes in this brainstorm do NOT require changing the API call pattern. Just add the new boolean fields to the existing schema/type.

**Code Patterns:**

Adding boolean flags to an existing classification schema:

```typescript
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

const ClassificationSchema = {
  type: 'object',
  properties: {
    // ... existing fields ...
    timeline_band: { type: 'string', enum: ['past', 'urgent', 'short', 'comfortable'] },
    event_date_iso: { type: 'string', description: 'Event date as YYYY-MM-DD' },
    past_date_detected: { type: 'boolean' },
    ambiguous_mariachi_signals: { type: 'boolean' },
    // ... rest of existing fields ...
  },
  required: [/* existing required fields */, 'event_date_iso', 'past_date_detected'],
} as const;

const message = await client.messages.parse({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  system: buildClassifyPrompt(new Date().toISOString().split('T')[0]),
  messages: [{ role: 'user', content: leadText }],
  output_config: {
    format: jsonSchemaOutputFormat(ClassificationSchema),
  },
});

const classification = message.parsed_output;
// classification.past_date_detected is typed as boolean
// classification.event_date_iso is typed as string
```

**Note:** The pipeline may already use a different pattern for structured output (e.g., tool_use or manual JSON extraction from text blocks). The key takeaway is that boolean flags are trivial to add to any JSON schema — the API pattern doesn't need to change for these fixes.
