# Spike and known-answer evidence log

**Reader and trigger:** anyone deciding whether a Phase 0 gate has passed (plan
`docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md` §0.7 and the launch gate). A row is
**PASSED** only when its evidence is in this repo (a file under `evidence/`, or the exact command
plus pasted output). Anything else is **UNEXECUTED**, with an owner, a reason and a trigger.
**"Recorded" means committed here, nothing less.**

## Executed

| Row | Date | Result | Evidence (in repo) | How to reproduce |
|---|---|---|---|---|
| S1: locked `claude -p` on Max | 2026-10-03 | **PASSED** | `evidence/s1-init-and-result.json`: `apiKeySource: none`, `tools: []`, `mcp_servers: []`, builtin plugins only, version 2.1.285, result "OK" | In an empty `mkdtemp` folder: `env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin:<claude dir>" USER="$USER" LANG=en_US.UTF-8 claude -p "Reply with the single word OK." --output-format stream-json --verbose --tools "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources project --no-session-persistence < /dev/null`. Read the `system/init` and `result` events |
| S1 canary: user CLAUDE.md excluded | 2026-10-03 | **PASSED** (with positive control) | Same environment and argv, prompt asking whether a phrase found only in `~/.claude/CLAUDE.md` is in context, `--output-format json`. Locked run: `NO`. Positive control, identical but without `--setting-sources project`: `YES`. *The outputs were printed in the session and transcribed here; the raw JSON was not saved.* | Re-run both commands; the locked one must answer NO and the control YES |
| Credential sources present on the dev Mac | 2026-10-03 | Observed | The shell environment has `ANTHROPIC_API_KEY` set (name only, value not read). `src/server.ts:1` loads `.env` through dotenv. The settings files `~/.claude/settings.json`, `settings.local.json` and the project `settings.local.json` contain 0 of `apiKeyHelper`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `forceLoginMethod` | `env \| cut -d= -f1 \| grep -i anthropic`; grep the settings files for those key names |
| `npm test -- --test-name-pattern=<fake>` false pass | 2026-10-02 | **Reproduced defect** | Ran all 351 tests, exit 0, for `zz-no-such-test-xyz` | `npm test -- --test-name-pattern="zz-no-such-test-xyz"; echo $?` |
| Leaf-count reporter known answers | 2026-10-03 | **PASSED** | `evidence/leaf-reporter-probe.mjs`. Counts: real name `allows Basic Auth POSTs` → leafPass 1; fake `zz-no-such-test-xyz` → 0; no pattern → 351 | `node --import tsx --test --test-reporter=./docs/research/2026-10-02-booking-hub/evidence/leaf-reporter-probe.mjs --test-name-pattern="<name>" src/*.test.ts scripts/*.test.ts` |
| 0.1 `test:match` instrument (built) | 2026-10-03 | **PASSED** | `evidence/test-match-known-answers.txt`: real name → exit 0 pass 1; `zz-no-such-test` → exit 3; skipped-only match → exit 3; `TEST_MATCH_SELFTEST=1` failing fixture → exit 1; nested fixture → exit 0; old `--test-name-pattern` form → exit 2 (refused); full suite 363 pass / 4 skip. Controls live in `scripts/run-tests.test.ts` | Re-run the commands in the evidence file |
| 0.1 deviation: skips counted apart | 2026-10-03 | **Found + fixed** | node:test emits a skipped test as `test:pass`, so before the fix `test:match -- "selftest deliberate failure"` (skipped without its env var) printed `pass:1` and exited 0. The sentinel is now `{"pass","fail","skip"}` and a skipped-only match exits 3 | `npm run test:match -- "selftest deliberate failure"; echo $?` → 3 |
| 0.1 on CI's Node 22 | 2026-10-03 | **PASSED** (partial) | `npx -y node@22 --import tsx --test --test-reporter=./scripts/leaf-reporter.mjs --test-reporter-destination=stdout --test-name-pattern "nested fixture reachable" "src/**/fixtures-nested/*.test.ts" "tests/**/*.test.ts"` → `LEAF_MATCH {"pass":1,"fail":0,"skip":0}`, exit 0. The full suite was not run on 22 locally (better-sqlite3 is built for Node 25); CI runs it on push | Same command |
| 0.2 step 1 (partial): Railway is live | 2026-10-03 00:37 PDT | **Observed** | `curl -sS https://gig-lead-responder-production.up.railway.app/health` → HTTP 200 `{"status":"ok","rejectedEmails":0,"commit":"edc8cfb","startedAt":"2026-08-09T14:35:43.660Z"}`. `edc8cfb` = current `origin/main` tip (PR #35). `/health` can't show whether the poller runs (0.3 defect). **Not yet read:** `AUTO_SEND_ENABLED`, `DRY_RUN`, `GMAIL_TOKEN_PATH`, poller logs, because `railway status` → `invalid_grant ... Please run railway login again`. Owner: Alex runs `railway login`; trigger: before 0.2 step 2 | Same `curl`; `railway status` |
| 0.3 DKIM defect: real platform headers | 2026-10-03 | **PASSED** (known answer) | Gmail `Authentication-Results` copied from `alex.guillen.music@gmail.com` for one GigSalad, Yelp and Squarespace message each; verbatim (bounce addresses shortened) in `src/source-validator-dmarc.test.ts`. All three: `mx.google.com; ... dmarc=pass ... header.from=<gigsalad.com / yelp.com / squarespace.info>`, and each also has a vendor `dkim=pass` (elasticemail, sendgrid, email-od). Yelp's From is `messaging.yelp.com` but DMARC reports `yelp.com`. Before the fix, 6 of 6 forged headers were accepted; after, 0 of 6, and the 3 real ones still pass | `npm run test:match -- "forged sender rejected"`; `npm run test:match -- "real platform auth headers"` |
| Mac Gmail token (`data/gmail-token.json`) | 2026-10-03 | **Observed: dead** | A metadata-only `users.messages.get` with it → `invalid_grant`. File dated 2026-05-31. Fits 7-day expiry in testing mode (S5). 0.2 step 4 needs a fresh sign-in regardless | Any Gmail API call with that token |
| Railway poller likely not polling | 2026-10-03 | **INFERENCE, unverified** | `/health` reports `rejectedEmails: 0` after ~8 weeks up, while the poller reads all inbox mail (`in:inbox`, `gmail-watcher.ts:142`) and counts every non-platform sender as rejected. `poller.ts:103-110` stops the poller on `invalid_grant` while `/health` stays `ok`. If true, no lead has been processed on Railway since about August. Owner: Alex runs `railway login`, then Claude reads the logs. Trigger: before 0.2 step 2 | `railway logs` after login |
| Incident: test made billed Anthropic calls | 2026-10-03 | **Happened; guarded** | Running `orchestrator passes platform` before its injection point existed ran the real pipeline on the shell's `ANTHROPIC_API_KEY` (classify, generate, verify + 2 rewrites, ~98 s, dry-run, temp DB, no sends). `scripts/run-tests.mjs` now sets a dead key and `ANTHROPIC_BASE_URL=http://127.0.0.1:9`; `src/no-billing-guard.test.ts` proves a real call fails with a connection error. **Gap:** running `node --test <file>` directly bypasses the runner | `npm run test:match -- "cannot reach the real Anthropic API"` |
| Start command | 2026-10-03 | Observed | `package.json` `start` = `tsx src/index.ts` (the CLI, which requires `ANTHROPIC_API_KEY`). `railway.json` `startCommand` = `npx tsx src/server.ts` | `grep '"start"' package.json; grep startCommand railway.json` |
| FileVault / power | 2026-10-03 | Observed | `fdesetup status` → On. `pmset -g` → sleep 1 (minute) without a holder | Same commands |

## UNEXECUTED (owner · reason · trigger)

| Row | Owner | Why not yet | Trigger |
|---|---|---|---|
| S1-adv: injection text can't make a locked run use tools | Claude | Needs a fixture lead; planned for Phase 0.7 | Phase 0.7, before any Module 1 code |
| C1a: Railway stopped | Alex (⚠) | Destructive; needs his yes | Phase 0.2 step 2 |
| C1b: old Railway token returns `invalid_grant` (C1 = C1a + C1b, the Mac poller launch gate) | Claude, after Alex revokes | Can't run until the revoke | Phase 0.2 step 3, **before** the Mac poller starts |
| G1: Gmail `rfc822msgid:` control: a supplied Message-ID survives and is findable after delayed indexing | Claude with Alex's ok | Needs a real send (a harmless message from Alex's own account to himself) | Phase 0.7 (new row G1), before any auto-send |
| S2: GigSalad email reply lands on the platform | Alex | Needs a real lead | The next real GigSalad lead |
| S3: iMessage to self + read-back | Alex with Claude | Needs Full Disk Access granted | Phase 0.7 |
| S5: Gmail token valid on day 8 | Claude | Needs 8 days | 8 days after the "In production" switch |
| S6: overnight awake + catch-up | Alex | Needs a night | The first night after Phase 0.3 |
| FileVault restart after an OS update | Alex | Needs an update | The next macOS update |

`port-manifest.md` **does not exist yet.** It is the output of plan step 0.5. Until every one of
the 406 rows in `port-inventory.md` is accounted for in it, the test "port inventory fully
accounted" fails and Module 1 cannot go live.
