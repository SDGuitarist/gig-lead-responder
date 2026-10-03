# Codex Plan Review — Round 1 (booking hub Phase 0 + Module 1)

**Reviewed:** `docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md` at `5c166ca`
**Verdict:** **NO-GO** (NO-GO #1 on this change)
**Received:** 2026-10-02, pasted by Alex into the Claude Code session
**Stop rule (written down before the fixes):** a NO-GO in round 2 stops automatic iteration. A
round 3 requires the line `Round 3 authorized by Alejandro: YES`.

Codex's findings, verbatim:

---

### P0 — Slot allowlist does not safely authorize priced quotes

The slot approach detects suspicious values outside `{{PRICE}}` and `{{DATE}}`, but it does not require:

- exactly one immutable price slot in the final template;
- the rendered price to equal the gate's computed quote;
- at least one recognized price when a quote is expected;
- all date/price claims to be derived from structured fields;
- rejection of alternate representations such as `1.2k`, encoded text, or unrecognized number words.

A draft could therefore contain a price while avoiding the detector, or omit the required price entirely.

This is a class. Sweep the whole outbound path: draft generation, slot rendering, `routeLead`, `evaluateSendGate`, every sender, and approval sends. The invariant must be enforced immediately before every client-facing send.

### P0 — The single-writer design can still permit two hosts to send

`runtime_lease` is stored in SQLite, but Railway and the Mac have separate database files. A lease in one database cannot block a sender using the other database.

`DRY_RUN=true`, `AUTO_SEND_ENABLED=false`, and "poller disabled" are deployment settings, not a cross-host transactional guarantee. A stale Railway process could still send if its configuration is wrong or if another send path bypasses the intended check.

The plan needs one enforceable cutover invariant: Railway must be proven unable to send before the Mac poller starts, and every sender must enforce the same shared state. Add concrete verification for poller process state, resolved environment values, lease expiry/renewal, startup recovery, and concurrent send attempts.

### P0 — "Exactly once" is overstated

`outbound_messages` plus a stable `Message-ID` can support crash recovery, but Gmail Sent search is not an exactly-once provider guarantee. A crash after Gmail accepts the message but before Sent becomes searchable can cause an unresolved state. A search failure, delayed indexing, altered headers, or a reused idempotency key can also produce ambiguity.

The plan must either define the guarantee honestly as "no automatic retry when delivery state is ambiguous"; or add a provider-level idempotency guarantee. Specify the exact key contents, provider lookup query, delayed-visibility behavior, concurrent claims, draft-hash binding, and the permanent `unknown → Alex review` path. Add tests for crashes before send, after provider acceptance, lookup failure, delayed Sent visibility, and duplicate workers.

### P1 — `claude -p` lockdown is incomplete and partly based on unverified assumptions

`env -u ANTHROPIC_API_KEY` does not remove all possible credential sources (`ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, profiles, helper scripts, stored credentials). `--setting-sources project` may load project settings and hooks; `--strict-mcp-config` does not by itself disable built-in tools; `apiKeySource` is undocumented and unverified; "usage credits stay off" is an account setting, not enforced by the app; the plan does not specify isolated config/home directories, exact Claude version, or an adversarial tool-denial test.

### P1 — `test:match` may still pass while matching zero tests

No reliable leaf-test counting algorithm is defined. `npm test` runs only `src/*.test.ts` and `scripts/*.test.ts`; nested `src/**` tests and `tests/**` are not included. Widening only `test:match` leaves the full-suite command inconsistent. Require a machine-readable match sentinel or explicit leaf-test count; separate propagation of test failures versus zero-match failures; positive and negative controls; one authoritative glob shared by `npm test` and `test:match`; tests for nested test files.

### P1 — The Project-rule port has no complete runtime proof

The manifest names landing places, but that does not prove the runtime loads or executes the rule. `LEAD_RESPONSE_VOICE` says "code checks wherever mechanical"; R1–R3, T4 and nonprofit pricing lack exact destinations; `VENUE_INTEL` and `EVENT_STRUCTURE_THEORY` need classification-path evidence; unresolved Project conflicts depend on Alex's answers; the manifest test only checks that markers are present. This is a class. Sweep every rule in the Project extraction; each manifest row names source, exact runtime file/function, execution condition, marker, and a test through the real assembly path.

### P1 — The Mac execution path is not fully funded

The fallback is only "a small always-on host": no host, install path, credentials, operator or trigger. The `.command` login-item path needs exact setup, env loading, OAuth credential location, heartbeat configuration, restart behavior, and FileVault-restart behavior. A heartbeat detects failure but does not recover it.

### P1 — GigSalad delivery remains a one-off human spike, not a durable launch gate

S2 proves one real lead, but the plan does not define how the result is recorded or bound to the exact account/threading behavior used by auto-send. The acceptance tests do not verify reply headers, thread identity, platform delivery, or the condition that disables auto-send if behavior changes. Persist S2 evidence, bind the sender/account/threading configuration to the channel gate, and make the fallback explicit: draft-only until S2 evidence exists.

---

The fix prompt (7 required fixes, under the fix contract) was applied in the round-1 revision. The
revision's response to each finding is in the plan's `## Round 1 Review Response` section.
