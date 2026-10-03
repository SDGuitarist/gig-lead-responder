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
