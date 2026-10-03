# TypeScript review of booking-hub plan (Kieran)

## Conflicts with current code (fix in plan before Work)
1. **Wrong path.** Plan cites `src/pipeline/run-pipeline.ts:57-77`; the file is `src/run-pipeline.ts`. `runPipeline(rawText, onStage?, platform?)` already takes `platform` (line 87). The `orchestrator.ts:130` bug is only that the call omits it. One-line fix plus test.
2. **The send gate already half-exists.** `src/automation/router.ts:32` `routeLead()` returns `RouterResult = AutoSendResult | HoldResult` with `reasons: string[]` and an existing `budgetThreshold = 3000`. Plan says "new `send-gate.ts`" without saying what happens to `routeLead`. Two gates = a bypass waiting to happen. Decide: `send-gate.ts` holds the pure checks, `routeLead` becomes a thin caller, and `reasons: string[]` becomes `HoldReason[]`.
3. **`status: "sent"` already means "SMS'd to Alex", not "sent to client"** (`post-pipeline.ts:50`, `twilio-webhook.ts:68`, CHECK in `db/migrate.ts:33`). `SendSuccess.status: "sent"` (automation/types.ts:61) means delivered to client. Plan's "approval actually sends" + "atomic status change" will collide. Add `awaiting_approval` / `client_sent` (table rebuild, like the 'replied' rebuild at migrate.ts:108) or rename. Do not overload `sent` a third time. `FOLLOW_UP_STATUSES` also has its own `sent`.
4. **Money is dollars today.** `rates.ts` `RateEntry { anchor: number; floor: number }` holds dollars; `leads.actual_price REAL`. New tables use `*_cents INTEGER`. Plan must name the boundary converter or the gate will compare 500 to 50000.
5. **`npm test` globs `src/*.test.ts scripts/*.test.ts` only.** `tests/` and nested `src/**` tests are NOT run. Every EARS "npm test -- --test-name-pattern=..." passes trivially (0 tests matched) if the file lands in `src/automation/`. Fix the glob first and add a positive control (a pattern that must match >=1 test). Also: `--test-name-pattern` matching nothing exits 0.
6. Plan says "existing `initDb()` style": correct name, but it lives in `src/db/migrate.ts`. Put new tables in `src/db/gigs.ts`, `payments.ts`, etc., migrations in `migrate.ts`.

## Proposed layout
- `src/automation/send-gate.ts` (pure, no I/O), `src/automation/send-gate.test.ts`
- `src/booking/gig-status.ts` (state machine), `src/booking/money.ts`, `src/booking/payment-match.ts`
- `src/claude-cli.ts` (provider) behind `src/claude.ts`
- `src/db/gigs.ts`, `src/db/payments.ts`; fixtures in `src/__fixtures__/` (or move tests and fix glob)

## Send gate
```ts
export type HoldReason =
  | "platform_unknown" | "channel_no_auto" | "price_mismatch" | "price_below_floor"
  | "date_mismatch" | "gigsalad_contact_info" | "new_format_family" | "over_budget"
  | "flagged_concern" | "verify_failed" | "graceful_decline" | "contract_wording"
  | "ramp_review_only";

export interface SendGateInput {
  platform: ParsedLead["platform"];
  draftText: string;
  quote: { amountCents: Cents; floorCents: Cents };
  leadEventDate: string | null; // ISO date
  formatFamilyKnown: boolean;
  verified: boolean;
  concerns: readonly string[];
  isGracefulDecline: boolean;
  rampActive: boolean;
}
export type SendGateResult =
  | { decision: "auto" }
  | { decision: "hold"; reasons: readonly [HoldReason, ...HoldReason[]] };
export function evaluateSendGate(i: SendGateInput): SendGateResult;
```
Non-empty tuple makes "hold with no reason" unrepresentable. Pure function = table-driven tests. `rampActive` is an input, so the ramp is a gate reason, not a separate code path.

## Gig status machine
```ts
export type GigStatus = "inquiry"|"quoted"|"contracted"|"deposit_paid"|"balance_paid"|"played"|"closed"|"lost";
const TRANSITIONS = {
  inquiry: ["quoted","lost"], quoted: ["contracted","lost"],
  contracted: ["deposit_paid","lost"], deposit_paid: ["balance_paid","played","lost"],
  balance_paid: ["played"], played: ["closed"], closed: [], lost: [],
} as const satisfies Record<GigStatus, readonly GigStatus[]>;
export function canTransition(from: GigStatus, to: GigStatus): boolean {
  return (TRANSITIONS[from] as readonly GigStatus[]).includes(to);
}
```
Derive the SQL CHECK from the same const array (the repo already does this with FOLLOW_UP_STATUSES). Open question for the plan: corporate pays on the day, so `deposit_paid -> played` before `balance_paid` must be legal; `played` with balance open must show in the digest.

## Money
```ts
export type Cents = number & { readonly __brand: "Cents" };
export const dollarsToCents = (d: number): Cents => {
  const c = Math.round(d * 100);
  if (!Number.isSafeInteger(c) || c < 0) throw new RangeError(`bad amount ${d}`);
  return c as Cents;
};
export const cardFeeCents = (base: Cents): Cents => Math.round(base * 375 / 10000) as Cents;
```
Parse draft prices with one extractor (`$1,250`, `$1250.00`, `1,250 dollars`) and test it: an extractor that misses a format makes `price_mismatch` silently pass. Gate rule should be "every extracted price matches AND at least one price extracted when a quote exists".

## claude -p provider
`claude.ts` already has an injection seam (`setClaudeRequesterForTests`), but it is typed on SDK `MessageCreateParams`. Keep `callClaude`/`callClaudeText` signatures; swap the requester:
```ts
export interface ClaudeRunResult { text: string; apiKeySource: "none" }
export type ClaudeTextRunner = (req: { system: string; user: string; model: string }) => Promise<ClaudeRunResult>;
```
`claude-cli.ts`: `spawn("claude", ["-p","--output-format","json", ...], { env: withoutApiKey(process.env), timeout })`, parse JSON, and throw `ApiKeyInUseError` if `apiKeySource !== "none"` (a discriminated error, never a fallback). Delete the `@anthropic-ai/sdk` default only after S1 passes. Never `--bare`.

## Tests (node:test)
- `send-gate.test.ts`: table of `[name, input, expected]`; one row per HoldReason plus an all-pass AUTO row (overshoot control: proves the gate CAN auto).
- Leads: real fixtures under `src/__fixtures__/leads/` (gigsalad-with-phone, yelp, under-floor), redacted.
- Dannecker replay: recorded Gmail thread JSON (old thread, PDF attachment late); assert `returned_unverified` + alert.
- Forged payments: same body, three headers: DKIM fail, wrong domain, valid. Only the valid one matches; none mark paid.
- Provider: inject a fake runner returning `apiKeySource: "api_key"`; assert throw + alert, zero retries.
