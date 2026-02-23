# Kieran TypeScript Reviewer — Review Findings

**Agent:** kieran-typescript-reviewer
**Branch:** main (commits ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P1] Non-null assertion on `updateLead` return masks potential data loss

**File:** `src/api.ts:136` and `src/api.ts:165`
**Issue:** `updateLead()` returns `LeadRecord | undefined`. The non-null assertion `!` silently assumes the update succeeded, but between the `getLead` check and the `updateLead` call there is a race window. The `!` operator trains you to ignore nullability. The fix costs one line and gives you a proper 500 response instead of sending `null` to the client.
**Suggestion:** Handle the `undefined` case explicitly:
```ts
const updated = updateLead(id, { /* ... */ });
if (!updated) {
  res.status(500).json({ error: "Failed to update lead" });
  return;
}
res.json(shapeLead(updated));
```

---

### [P1] `/api/analyze` endpoint has no authentication

**File:** `src/server.ts:51`
**Issue:** The `/api/leads` and `/api/stats` routes are protected by `basicAuth`, but `/api/analyze` is mounted directly on the Express app with zero authentication. This endpoint calls `runPipeline`, which hits the Claude API, meaning anyone who discovers the endpoint can burn Anthropic credits. The client-side `dashboard.html` code also does not pass an `Authorization` header to `/api/analyze`.
**Suggestion:** Either move the `/api/analyze` route into `src/api.ts` under the shared `basicAuth` middleware, or apply `basicAuth` directly:
```ts
app.post("/api/analyze", basicAuth, async (req, res) => {
```
And update `dashboard.html` to include the `authHeader` in the analyze fetch call.

---

### [P2] Unsafe `as` casts on parsed JSON fields in `shapeLead`

**File:** `src/api.ts:29` and `src/api.ts:69`
**Issue:** `safeJsonParse` returns `Record<string, unknown> | null`, but `shapeLead` immediately casts nested properties with `as` without any runtime validation. If the stored JSON is malformed or from an older schema version, these casts silently lie.
**Suggestion:** Add a runtime guard or create a small `parseGateJson(raw: string | null)` helper that validates the shape and returns a typed result or `null`.

---

### [P2] `shapeLead` return type is inferred as a wide anonymous object

**File:** `src/api.ts:22-72`
**Issue:** The return type of `shapeLead` is entirely inferred — a 20+ field anonymous object or `null`. Every consumer gets zero autocompletion guidance, and a typo in the return object becomes a silent runtime bug. Since `dashboard.html` depends on specific field names, this is a contract without a type.
**Suggestion:** Define a `ShapedLead` interface and annotate the return type.

---

### [P2] `getLeadStats` aggregate query result cast could be null when table is empty

**File:** `src/leads.ts:279-284`
**Issue:** The `as` cast claims `pending`, `sent`, and `this_month` are `number`. However, SQLite's `SUM()` returns `NULL` when there are zero rows. The `?? 0` fallback on lines 287-290 handles this at runtime, but the type assertion lies to TypeScript about nullability.
**Suggestion:** Type the intermediate result honestly as `number | null` for all aggregate fields.

---

### [P2] `req.params.id as string` cast is unnecessary and misleading

**File:** `src/api.ts:100` and `src/api.ts:142`
**Issue:** Express's `req.params` is typed as `Record<string, string>` by default, so `req.params.id` is already `string`. The `as string` cast is redundant.
**Suggestion:** Remove the cast: `const id = parseInt(req.params.id, 10);`

---

### [P2] Auth middleware applied per-path instead of once on the router

**File:** `src/api.ts:8-9`
**Issue:** Authentication is applied to two specific path prefixes. Any new route added to this router outside those prefixes would be unprotected by default. The pattern invites accidental exposure of future routes.
**Suggestion:** Apply auth once at the router level: `router.use(basicAuth);`

---

### [P2] Default export in `api.ts` conflicts with named export convention

**File:** `src/api.ts:168`
**Issue:** `api.ts` and `dashboard.ts` use `export default router`, while `auth.ts` uses a named export. Default exports make refactoring harder because the import name is decoupled from the export name.
**Suggestion:** Prefer named exports for routers. Follow-up task, not blocking.

---

### [P3] Repeated `gate_passed` boolean conversion pattern across four functions

**File:** `src/leads.ts:123, 132-134, 215-218, 253-256`
**Issue:** The exact same `gate_passed` boolean conversion appears in `getLead`, `getLeadsByStatus`, `listLeads`, and `listLeadsFiltered`. Four copies of the same one-liner.
**Suggestion:** Extract a `hydrateLeadRow(row: LeadRecord): LeadRecord` helper.

---

### [P3] `sendSSE` helper defined in `server.ts` but only used by one route

**File:** `src/server.ts:47-49`
**Issue:** `sendSSE` and the `/api/analyze` route account for about a third of `server.ts`. As the codebase grows, `server.ts` should stay slim — just mounting routers and starting the server.
**Suggestion:** Move `/api/analyze` and `sendSSE` into `src/api.ts`.

---

### [P3] `safeJsonParse` return type could be narrower

**File:** `src/api.ts:13-20`
**Issue:** `JSON.parse` can return any valid JSON value, but the function claims it returns `Record<string, unknown> | null`. If stored JSON is a string or array, the type lies.
**Suggestion:** Add a runtime check that the parsed value is a plain object before returning it.

---

### [P3] Auth password comparison is not timing-safe

**File:** `src/auth.ts:23`
**Issue:** String equality with `===` is vulnerable to timing attacks. For a small internal dashboard this is low risk, but worth noting since this is now a shared auth module.
**Suggestion:** Use `crypto.timingSafeEqual` from Node's built-in `crypto` module.

---

### [P3] `decoded.split(":")` in auth only handles passwords without colons

**File:** `src/auth.ts:21`
**Issue:** Per RFC 7617, the password can contain colons. `split(":")` with destructuring drops everything after the second colon.
**Suggestion:** Use `indexOf(":")` and `slice()` instead of `split(":")`.

---

### [P3] Inline JavaScript in `dashboard.html` is untyped and has no tooling support

**File:** `public/dashboard.html:890-1556`
**Issue:** ~660 lines of vanilla JavaScript with zero type checking. Constants like `FORMAT_NAMES`, `STATUS_DISPLAY`, and `CHECK_NAMES` duplicate TypeScript-side constants and will silently drift.
**Suggestion:** Add comments noting the source of truth for duplicated constants. Consider extracting to a `.ts` file with a bundler in a future iteration.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| P1 | 2 | Non-null assertions hiding failures; unauthenticated API endpoint burning paid credits |
| P2 | 5 | Unsafe `as` casts on JSON boundaries; missing return type; inconsistent auth scope |
| P3 | 5 | Duplicated boolean hydration; timing-safe auth; inline JS drift risk |
