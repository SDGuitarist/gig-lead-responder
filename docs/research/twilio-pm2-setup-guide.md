# Twilio SMS + pm2 macOS Setup Guide

**Created:** 2026-03-29 (from deep research during plan deepening)

---

## Part 1: Twilio SMS

### Account Setup
1. Sign up at https://www.twilio.com/try-twilio
2. Verify your phone number (required)
3. Get a free trial phone number from the Console dashboard
4. Find **Account SID** and **Auth Token** on the Console main page

### Pricing (~$2/month for your use case)
- Phone number: $1.15/month
- Outbound SMS: $0.0079/message (~0.8 cents)
- Trial gives $15 credit (~1,800 messages)

### TypeScript Implementation

```typescript
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!, {
  autoRetry: true,
  maxRetries: 3,
});

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    const msg = await client.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: body.slice(0, 160), // Keep to 1 segment
    });
    console.log(`SMS sent: ${msg.sid}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`SMS failed: ${message}`);
    return { success: false, error: message };
  }
}
```

### Key Points
- **160 chars** = 1 SMS segment (cheapest). Avoid emoji (switches to UCS-2, limit drops to 70).
- **autoRetry** handles 429 rate limits automatically with exponential backoff
- **Test credentials** available at Console → scroll down → "Test Credentials" (no real SMS sent, no charges)
- **Magic test numbers:** From `+15005550006` (success), To `+15005550006` (success)

### Common Errors
| Code | Meaning | Action |
|------|---------|--------|
| 21211 | Invalid phone number | Validate E.164 format (+1XXXXXXXXXX) |
| 21610 | Recipient opted out (STOP) | Do not retry — legally required |
| 20003 | Auth error | Check Account SID / Auth Token |

### References
- [Twilio SMS TypeScript](https://www.twilio.com/en-us/blog/send-sms-typescript-twilio)
- [Twilio pricing](https://www.twilio.com/en-us/sms/pricing/us)
- [Twilio test credentials](https://www.twilio.com/docs/iam/test-credentials)
- [Twilio error codes](https://www.twilio.com/docs/api/errors)

---

## Part 2: pm2 on macOS

### Installation
```bash
npm install -g pm2
pm2 --version
```

### ecosystem.config.cjs

```javascript
module.exports = {
  apps: [{
    name: "gig-lead-responder",
    script: "node_modules/.bin/tsx",
    args: "src/automation/main.ts",
    cwd: "/Users/alejandroguillen/Projects/gig-lead-responder",
    env: { NODE_ENV: "production" },
    autorestart: true,
    max_memory_restart: "200M",
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: "60s",
    watch: false,
    error_file: "logs/pm2-error.log",
    out_file: "logs/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    instances: 1,
    exec_mode: "fork",
  }],
};
```

### Auto-Start on Boot (macOS launchd)

```bash
pm2 start ecosystem.config.cjs    # Start the app
pm2 save                           # Save process list
pm2 startup                        # Generates launchd command — COPY + PASTE it
# Output: sudo env PATH=$PATH:/opt/homebrew/bin pm2 startup launchd -u USERNAME --hp $HOME
```

This creates a LaunchDaemon that runs `pm2 resurrect` on every boot.

### Log Management

```bash
pm2 logs                              # Stream live
pm2 logs gig-lead-responder --lines 100  # Last 100 lines
pm2 flush                             # Clear all logs

# Log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Useful Commands

| Task | Command |
|------|---------|
| Status | `pm2 status` |
| Logs | `pm2 logs` |
| Restart | `pm2 restart gig-lead-responder` |
| Monitor | `pm2 monit` |
| Stop | `pm2 stop gig-lead-responder` |
| Delete | `pm2 delete gig-lead-responder` |

### Common macOS Issues
1. **pm2 not found after reboot** — Re-run `pm2 startup` if Node version changed
2. **tsx not found** — Use full path: `node_modules/.bin/tsx` in ecosystem config
3. **.env not loaded** — App must call `import 'dotenv/config'` (pm2 doesn't load .env)
4. **Crash loop** — Check `pm2 logs`; `max_restarts: 10` prevents infinite loops

### Old Mac Setup Script

```bash
#!/bin/bash
set -e

# Install Homebrew + Node 20 (stable path, no nvm issues)
brew install node@20 && brew link node@20 --force --overwrite

# Install pm2 + log rotation
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Clone and install
cd ~/Projects/gig-lead-responder
npm install

# Create .env from template
cp .env.example .env
echo "*** Edit .env with your real credentials ***"

# Start + save + enable auto-boot
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # COPY + PASTE the output command
```

### References
- [pm2 Quick Start](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [pm2 Startup](https://pm2.keymetrics.io/docs/usage/startup/)
- [pm2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [pm2 Complete Guide](https://betterstack.com/community/guides/scaling-nodejs/pm2-guide/)
