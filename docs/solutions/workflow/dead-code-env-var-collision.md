# Dead Code with Conflicting Env Var Names

**Category:** Code hygiene
**Tags:** dead-code, env-vars, silent-failure, imports

## Problem

A superseded file (`src/twilio.ts`) sat next to its replacement (`src/sms.ts`)
with different env var names for the same values:

```
src/twilio.ts  →  TWILIO_PHONE_NUMBER,  ALEX_PHONE_NUMBER   (dead)
src/sms.ts     →  TWILIO_FROM_NUMBER,   ALEX_PHONE           (live)
```

Both files export a `sendSms()` function. If any file accidentally imports from
`./twilio` instead of `./sms`, SMS silently fails at runtime — the env vars are
never set, the Twilio client initializes with `undefined` credentials, and the
error only surfaces when an actual SMS send is attempted in production.

TypeScript can't catch this. Both files type-check fine. The import autocomplete
even suggests the wrong one first (alphabetical order: `twilio` before `sms`).

## How It Was Detected

Code review grepped for `import.*twilio` across the codebase and found zero
imports of `src/twilio.ts`. Combined with the env var name mismatch, it was
clearly dead code, not an alternative implementation.

## What Worked

Delete the file. Verify zero imports first:

```bash
# Before deleting — confirm nothing imports it
grep -r "from.*['\"].*\/twilio['\"]" src/
# Should return ONLY the twilio SDK import, not the local file
```

## Reusable Pattern

1. **When replacing a module, delete the old one in the same commit.** Don't
   leave it "in case we need it" — that's what git history is for.

2. **Before deleting any file, grep for imports:**
   ```bash
   grep -r "from.*['\"].*\/MODULE_NAME['\"]" src/
   ```

3. **Env var names are invisible coupling.** Two files can use different names
   for the same secret. TypeScript won't catch it. The only symptom is a runtime
   `undefined` that may not error until the value is actually used (lazy init).

4. **Name your replacement distinctly.** If the old file is `twilio.ts` and the
   new one is `sms.ts`, the naming difference makes the dead file obvious in
   code review. If both were named `twilio.ts` (in different directories), the
   collision would be harder to spot.

5. **Autocomplete is a hazard.** IDE autocomplete suggests files alphabetically.
   A dead `twilio.ts` appears before a live `twilio-webhook.ts`. Delete dead
   files to remove the footgun.
