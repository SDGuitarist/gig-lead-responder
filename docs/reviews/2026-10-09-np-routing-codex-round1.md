# Codex round 1 — NP routing R403 (`c8d0cdd`, `b3e3b6e`, `3617b9a`, `468c510`)

**Verdict: NO-GO** (2 P1, 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-09 at `468c510`; tree clean after). Pre-registered stops: 2nd NO-GO stops automatic iteration; round 3 only with `Round 3 authorized by Alejandro: YES`. Verbatim:

---

## Verdict: NO-GO

### P1 — Nonprofit leads can still take premium pricing paths

- `src/prompts/classify.ts:77-86,105-112`
- `docs/PROTOCOL.md:228-232`
- `src/pipeline/classify-verify.ts:109-114`

A nonprofit fundraiser at a Tier A/luxury venue can still be classified with `stealth_premium: true` and `rate_card_tier: "T3"`. The Tier A verifier independently requires T3, and the protocol still says an iconic/luxury venue alone triggers T3. The nonprofit hold prevents auto-send, but does not enforce “NP beats venue premium.”

Root cause: nonprofit routing is added after the existing venue-premium rules rather than as an overriding buyer track.

Required fix: make `nonprofit_buyer` or a recognized nonprofit raw-text signal override venue/Tier A premium classification and verifier enforcement. Add a regression test for a nonprofit fundraiser at a Tier A venue asserting it is held and not priced as T3 solely because of the venue.

### P1 — Backup detection misses explicit nonprofit signals

- `src/pipeline/classify-verify.ts:19`

The fallback does not match `gala`, `benefit`, `auction`, or `school PTA`. If the model returns `nonprofit_buyer: false` for one of these leads, no warning is added and the lead can proceed toward auto-send.

Root cause: the backup regex covers only part of the required nonprofit vocabulary.

Required fix: expand the detector and add tests proving these phrases hold when classification says false.

### P2 — Backup detection creates false holds

- `src/pipeline/classify-verify.ts:19`

Bare `foundation` matches non-nonprofit uses such as “Foundation Room,” “The Foundation” as a venue/band name, and “foundation stone.” These leads are held even when they are unrelated to nonprofit buyers.

Root cause: `foundation` is matched without buyer/event context.

Required fix: use a context-aware pattern or bounded allowlist, with regression tests for venue names and ordinary uses.

Checked clean:

- R403 tests: 124 passed.
- Hold-note tests: 119 passed.
- `npx tsc --noEmit`: passed.
- Router behavior is correct once a warning exists: any `flagged_concerns` entry holds the lead.
- Lead text is wrapped as untrusted data, and `nonprofit_buyer` accepts only literal boolean `true`.
- No additional loaded docs were found naming fundraisers/galas/donors as premium signals.

