/**
 * Gmail OAuth Bootstrap Script
 *
 * Run once to authorize Gmail access:
 *   npx tsx scripts/gmail-auth.ts
 *
 * Prerequisites:
 *   1. Download OAuth credentials from Google Cloud Console
 *   2. Save as credentials.json in project root
 *
 * Uses port 3001 (not 3000) to avoid conflict with the Express server.
 * Saves token to data/gmail-token.json with 0600 permissions.
 */
import { google } from "googleapis";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";

const CREDENTIALS_PATH = "credentials.json";
const TOKEN_PATH = "data/gmail-token.json";
const CALLBACK_PORT = 3001;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

async function main() {
  // Load credentials
  let credentials: { installed: { client_id: string; client_secret: string } };
  try {
    credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
  } catch {
    console.error(`\nError: ${CREDENTIALS_PATH} not found.`);
    console.error("\nTo set up Gmail API credentials:");
    console.error("1. Go to https://console.cloud.google.com/apis/credentials");
    console.error("2. Create OAuth 2.0 Client ID (Desktop app type)");
    console.error("3. Download JSON and save as credentials.json in this directory\n");
    process.exit(1);
  }

  const { client_id, client_secret } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    `http://localhost:${CALLBACK_PORT}`
  );

  // Generate auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to guarantee refresh_token
  });

  console.log("\n=== Gmail OAuth Authorization ===\n");
  console.log("Opening browser for Google sign-in...");
  console.log("If the browser doesn't open, visit this URL:\n");
  console.log(authUrl);
  console.log("");

  // Open browser
  const open = (await import("open")).default;
  await open(authUrl);

  // Start local server to catch the redirect
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end("Authorization denied. You can close this tab.");
        server.close();
        reject(new Error(`Auth error: ${error}`));
        return;
      }

      if (code) {
        res.end("Authorization successful! You can close this tab and return to the terminal.");
        server.close();
        resolve(code);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(`Waiting for authorization on http://localhost:${CALLBACK_PORT} ...`);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Authorization timed out after 2 minutes."));
    }, 120_000);
  });

  // Exchange code for tokens
  const { tokens } = await oAuth2Client.getToken(code);

  // Save token with restricted permissions
  mkdirSync("data", { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });

  console.log(`\nToken saved to ${TOKEN_PATH}`);
  console.log("Gmail API is ready. You can now start the automation.\n");
}

main().catch((err) => {
  console.error("Auth failed:", err.message);
  process.exit(1);
});
