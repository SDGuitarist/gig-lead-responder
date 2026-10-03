# Running Claude Code Non-Interactively: Headless Mode Reference

**Source:** Official Claude Code documentation at https://code.claude.com/docs/en/

---

## 1. Claude in Chrome Browser Integration with Headless Mode

**Browser tools in `-p` (print/headless) mode:**
- **UNVERIFIED (not explicitly documented)**: The Chrome integration guide (https://code.claude.com/docs/en/chrome.md) covers browser tools in "plan mode" (`-p` is NOT plan mode) and VS Code interactive sessions, but does NOT explicitly state whether `claude -p --chrome` works or has limitations.
- **What IS documented**: Browser tools are available in interactive sessions and plan mode, with permission prompts appearing in both contexts unless you type `@browser` in VS Code.
- **Inference**: Since `--chrome` requires a direct Anthropic plan (Pro, Max, Team, Enterprise) and sign-in via `/login`, and bare mode (`--bare -p`) skips OAuth, Chrome integration in bare headless mode is likely unavailable.

**Recommendation**: Test locally; official headless+Chrome guidance is absent.

---

## 2. Using Claude Max Subscription Without API Key in Headless

**Authentication precedence in `-p` mode** (https://code.claude.com/docs/en/authentication.md):

1. `ANTHROPIC_API_KEY` env var (if set, takes precedence)
2. `ANTHROPIC_AUTH_TOKEN` env var
3. `apiKeyHelper` script
4. `CLAUDE_CODE_OAUTH_TOKEN` (long-lived token from `claude setup-token`)
5. **Anthropic profiles / federation credentials** (if `ANTHROPIC_PROFILE` or WIF vars are set)
6. **Claude subscription OAuth** (fallback; requires `/login`)

**No API key scenario:**
- Unset `ANTHROPIC_API_KEY` and all env credential sources
- Claude Code falls back to subscription credentials from `/login`
- This works in **interactive CLI** (`-p` without `--bare`) because `/login` stores OAuth credentials in `~/.claude/.credentials.json`
- In **bare mode** (`--bare -p`), no OAuth is available—credentials must come from env vars or `apiKeyHelper`

**Verifying which auth source was used:**
- `--output-format json` includes `session_metadata` and cost tracking, but Claude Code docs **do NOT name a specific field for auth source** (UNVERIFIED).
- Run `/status` in interactive mode to see `Login method` (requires v2.1.210+)
- Best practice: set `CLAUDE_CODE_OAUTH_TOKEN` explicitly for headless runs (one-year token from `claude setup-token`).

---

## 3. Max Subscription Usage Limits for Headless Runs

**Shared usage pool:**
- Headless runs (`claude -p`) share the same subscription usage limits as interactive sessions—no separate cap.
- **Limits vary by plan**:
  - Claude Pro/Max: monthly spend ceiling (configurable at claude.ai/settings/usage for Pro/Max)
  - Team/Enterprise: org-wide limits set by admin
- Run `/usage` to check current consumption and next reset time.

**When limits are hit:**
- Organizations **with usage credits enabled** (Pro/Max at claude.ai/settings/usage; Team/Enterprise at admin-settings) can continue via metered overage.
- Without usage credits: runs rejected until reset, exit code 1.
- Exit codes: `0` success, `1` failure (including usage limit hit), `143` interrupted (SIGTERM).

**No separate headless limit documented**—all usage is aggregated.

---

## 4. Tool Restrictions for Safety in Headless Mode

**For untrusted input (reading untrusted text, strict safety):**

**`--permission-mode` options:**
- **`dontAsk`**: denies every action that would prompt; only allows read-only commands, pre-approved `--allowedTools`, and `permissions.allow` rules. Useful for locked-down runs.
- **`acceptEdits`**: auto-approves file writes and common filesystem commands (`mkdir`, `touch`, `mv`, `cp`), but other Bash and network requests still require `--allowedTools` or allow rules.

**`--allowedTools` (explicit pre-approval, overrides prompts):**
```bash
claude -p "your prompt" --allowedTools "Read,Edit" --permission-mode dontAsk
```
Combines with permission mode: if a tool is in `--allowedTools`, it skips prompts even in `dontAsk`. Narrow usage: `Bash(npm test)` allows only that exact prefix.

**`--permission-prompts none`** (no human approval):
- Denies any tool call that would normally prompt a human via permission host (e.g., `AskUserQuestion`, org-managed connector tools requiring approval).
- Does NOT suppress `--allowedTools` or `permissions.allow` rules—those still work.
- Requires v2.1.259+.

**Recommended for untrusted input:**
```bash
claude -p "Read and analyze untrusted.txt" \
  --allowedTools "Read" \
  --permission-mode dontAsk \
  --permission-prompts none
```

**Limits you cannot set:**
- No `--max-turns` flag documented (UNVERIFIED).
- Token limits: `--output-format json` returns cost estimates, but no per-run token ceiling flag.

---

## 5. Official Guidance on Scheduling / Unattended Execution

**Three official paths:**

### A. **Routines** (Cloud, recommended for automation)
- URL: https://claude.ai/code/routines
- **Triggers**: schedule (recurring or one-off), API endpoint (`/fire`), GitHub events
- **Runs on**: Anthropic-managed infrastructure; session keeps running when laptop sleeps
- **Limits**: 100 scheduled runs/hour (account-wide), 30 "Run now" / API fires per routine per hour
- **MCP connectors**: supported (Slack, Linear, etc.)
- **Availability**: Pro, Max, Team, Enterprise plans only

### B. **Local Scheduling** (`/loop` in-session, `claude -p` in cron/launchd)
- `/loop <interval> <command>` in interactive session: repeats at intervals while session is open
- Direct cron/launchd integration: schedule `claude -p "prompt"` with shell wrapper scripts
- Limitations: laptop must stay running; no cloud infrastructure
- Example cron: `0 9 * * * cd ~/my-project && claude -p "Daily task" --allowedTools "Bash,Read" --permission-mode dontAsk`

### C. **Remote Control** (Alternative to routines)
- Docs: https://code.claude.com/docs/en/remote-control.md
- Lets you **control** a local Claude Code session from phone/browser (claude.ai/code or Claude app)
- NOT itself a scheduler; works with local sessions you run
- Uses local machine resources; code execution stays on your machine

**No other official unattended mechanism documented**.

---

## Summary Table

| Question | Answer | Status |
|----------|--------|--------|
| Chrome in `-p --chrome` headless? | Not explicitly documented; likely unavailable | UNVERIFIED |
| Max subscription without API key in `-p`? | Yes, if `ANTHROPIC_API_KEY` unset; uses OAuth from `/login` | DOCUMENTED |
| apiKeySource field in JSON output? | No such field documented | UNVERIFIED |
| Headless usage limits separate from interactive? | No; shared pool | DOCUMENTED |
| `--max-turns` flag? | Not documented | UNVERIFIED |
| `--allowedTools` for safety? | Yes; combine with `--permission-mode dontAsk` | DOCUMENTED |
| `--permission-prompts none`? | Yes (v2.1.259+) | DOCUMENTED |
| Official scheduling: cron/launchd? | Possible but undocumented; recommended path = Routines | PARTIALLY DOCUMENTED |
| Routines (cloud alternative)? | Yes, >= Pro; schedule/API/GitHub triggers | DOCUMENTED |

