# Gmail API Setup Guide (Node.js / TypeScript)

**Created:** 2026-03-29 (from deep research during plan deepening)

## Quick Reference

| Item | Detail |
|------|--------|
| npm package | `googleapis` (includes google-auth-library) |
| OAuth type | Desktop app |
| Scopes | `gmail.readonly` + `gmail.send` |
| Polling strategy | `messages.list` with `after:` timestamp, 60-second interval |
| Token refresh | Automatic via googleapis library |
| Key files | `credentials.json`, `token.json` (both gitignored) |

---

## 1. Google Cloud Console Setup

1. Go to https://console.cloud.google.com/
2. Create new project: `gig-lead-responder`
3. Enable Gmail API: https://console.cloud.google.com/apis/library → search "Gmail API" → Enable
4. Create OAuth credentials: https://console.cloud.google.com/apis/credentials → "+ CREATE CREDENTIALS" → "OAuth client ID" → Application type: **Desktop app** → Download JSON as `credentials.json`

## 2. OAuth Consent Screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Choose **External** user type
3. Fill in: App name, your email for support + developer contact
4. Add scopes: `gmail.readonly` + `gmail.send`
5. Add your Gmail as a test user
6. App stays in "Testing" mode — fine for personal use

**The scary "unverified app" warning is normal.** Click Advanced → "Go to [app name] (unsafe)" during first auth.

**To avoid 7-day token expiry:** Publish the app (no verification needed for personal use).

## 3. Scopes

```typescript
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",  // read messages
  "https://www.googleapis.com/auth/gmail.send",       // send messages
];
```

Do NOT use `https://mail.google.com/` (full access) — too broad.

## 4. First-Run Auth Flow

```typescript
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as http from "http";

const CREDENTIALS_PATH = "credentials.json";
const TOKEN_PATH = "token.json";

function loadCredentials(): OAuth2Client {
  const { installed } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  return new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    "http://localhost:3000"
  );
}

export async function getAuthClient(): Promise<OAuth2Client> {
  const client = loadCredentials();

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    client.setCredentials(token);

    // Auto-save refreshed tokens
    client.on("tokens", (newTokens) => {
      const merged = { ...token, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    });
    return client;
  }

  // First-time: open browser for consent
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",  // guarantees refresh_token
  });

  const open = (await import("open")).default;
  await open(authUrl);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, "http://localhost:3000");
      const code = url.searchParams.get("code");
      if (code) {
        res.end("Auth successful! Close this tab.");
        server.close();
        resolve(code);
      }
    });
    server.listen(3000);
    setTimeout(() => { server.close(); reject(new Error("Auth timeout")); }, 120_000);
  });

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return client;
}
```

## 5. Token Storage

`token.json` contains:
```json
{
  "access_token": "ya29...(expires in 1 hour)",
  "refresh_token": "1//0e...(long-lived)",
  "scope": "...",
  "token_type": "Bearer",
  "expiry_date": 1711739482000
}
```

- Add both `credentials.json` and `token.json` to `.gitignore`
- Set file permissions: `chmod 600 credentials.json token.json`

## 6. Polling Implementation

```typescript
import { google, gmail_v1 } from "googleapis";

export async function pollForNewMessages(auth: OAuth2Client): Promise<gmail_v1.Schema$Message[]> {
  const gmail = google.gmail({ version: "v1", auth });

  // Search for recent inbox messages
  const query = `in:inbox after:${Math.floor(Date.now() / 1000) - 120}`;
  const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 20 });

  const stubs = list.data.messages || [];
  // Filter already-seen IDs via dedup module, then fetch full messages:

  const messages: gmail_v1.Schema$Message[] = [];
  for (const stub of stubs) {
    const msg = await gmail.users.messages.get({
      userId: "me", id: stub.id!, format: "full",
    });
    messages.push(msg.data);
  }
  return messages;
}
```

## 7. Decoding Email Bodies

Gmail uses **base64url** encoding (not standard base64):

```typescript
function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf-8");
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { text: string; html: string } {
  let text = "", html = "";
  function walk(part: gmail_v1.Schema$MessagePart | undefined) {
    if (!part) return;
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain") text = decoded;
      if (part.mimeType === "text/html") html = decoded;
    }
    part.parts?.forEach(walk);
  }
  walk(payload);
  return { text, html };
}
```

## 8. Sending Emails

```typescript
export async function sendEmail(auth: OAuth2Client, to: string, subject: string, body: string) {
  const gmail = google.gmail({ version: "v1", auth });
  const raw = [`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset="UTF-8"`, "", body].join("\r\n");
  const encoded = Buffer.from(raw).toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
}
```

## 9. Rate Limits

| Operation | Cost | Limit |
|-----------|------|-------|
| messages.list | 5 units | 250 units/sec/user |
| messages.get | 5 units | |
| messages.send | 100 units | |

At 60-second polling with 5-15 leads/week, you use ~5 units/minute. **Nowhere near the limit.**

## 10. Pitfalls

- **Token expiry in Testing mode:** Publish the app to avoid 7-day refresh token expiry
- **base64url decoding:** Use `Buffer.from(data, "base64url")` — NOT standard `"base64"`
- **Credentials type:** Must be "Desktop app" (key `"installed"` in JSON), not "Web application" (key `"web"`)
- **Empty body:** Some emails have only HTML, no text/plain. Always parse both.
- **Handle `invalid_grant`:** If refresh token is revoked, exit with a clear message to re-auth

## References

- [Gmail API Node.js Quickstart](https://developers.google.com/workspace/gmail/api/quickstart/nodejs)
- [Gmail API messages.list](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list)
- [Gmail API messages.send](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Gmail API Quota](https://developers.google.com/gmail/api/reference/quota)
- [googleapis npm](https://www.npmjs.com/package/googleapis)
