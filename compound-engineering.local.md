# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "The business impact is not measured. Unknown: how many Yelp leads were dropped over what period, and whether any converted anyway because Alex answers Yelp on the app regardless of the system." (`docs/brainstorms/2026-08-07-reply-detection-samples.md`)

**Plan mitigation:** None — **there was no plan phase this cycle.** The brainstorm went straight to work. The finding (every Yelp lead silently rejected) was discovered while surveying the mailbox for a different purpose, and the fix was small and provable enough to go direct. Recorded as a deviation, not a template.

**Work risk (from Feed-Forward):** Fixing the allowlist arms `parseYelpEmail`, which had never executed in production. Its defects were unreachable only because the allowlist bug shielded them. The parser was audited against a real email *before* the allowlist fix merged — that audit found the credential leak.

**Review resolution:** **No formal `/workflows:review` phase ran this cycle.** Verification was: 342/342 tests (11 new), typecheck error set proven byte-identical to `main`, new tests proven to FAIL against the pre-fix parser (6 of 9 containment assertions), and CI green on PR #33. There are no review-agent finding counts to report — do not read the absence as "review found nothing."

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/automation/source-validator.ts` | Added anchored `reply+<32hex>@messaging.yelp.com` alternative; new `kind: "lead" \| "reply"` return | Anchoring is the anti-spoofing control — any loosening to substring matching silently disarms SPF/DKIM gating. New senders must be added as separate anchored alternatives, never by widening an existing one. |
| `src/automation/orchestrator.ts` | Skips `kind === "reply"` before the pipeline; does NOT count replies as rejections | If a reply is ever marked `valid: false`, genuine client mail becomes indistinguishable from a spoof in both logs and the counter — the exact conflation that hid this outage |
| `src/automation/parsers/yelp.ts` | `portalUrl` rebuilt from `return_url` path with token discarded; normalized stop-word guard; `stripCredentialUrls()` | Yelp's "Respond Now" URL is a bearer credential. Any new extractor reading hrefs can re-introduce the leak. `rawText` is sent to the Claude API. |
| `src/yelp-parser.test.ts` | New — first coverage this parser has ever had | Fixtures use same-shape placeholder tokens. Never paste a real Yelp email in as a fixture. |

## Standing Warning for This Repo

`parseYelpEmail` accumulated two defects, including a credential leak, precisely because it could never run. **The same mechanism still applies to `YelpPortalClient.fetchLeadDetails()`** — it is next in the chain and equally unexercised. Treat any newly-reachable Yelp code as unreviewed regardless of its age.

## Plan Reference

No plan doc this cycle. Brainstorm: `docs/brainstorms/2026-08-07-reply-detection-samples.md`
Solution: `docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md`
