import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Spawns the real src/server.ts. dotenv never overwrites a variable that is
// already set, so every .env name that could reach outside is pinned here to
// a dead or empty value, and the DB is a throwaway file.
function isolatedEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const dir = mkdtempSync(join(tmpdir(), "glr-start-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: "0",
    DATABASE_PATH: join(dir, "leads.db"),
    GMAIL_CREDENTIALS_PATH: join(dir, "no-credentials.json"),
    GMAIL_TOKEN_PATH: join(dir, "no-token.json"),
    GMAIL_CREDENTIALS_JSON: "",
    GMAIL_TOKEN_JSON: "",
    DRY_RUN: "true",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    TWILIO_FROM_NUMBER: "",
    TWILIO_TO_NUMBER: "",
    PF_INTEL_API_URL: "",
    PF_INTEL_SERVER_API_KEY: "",
    DASHBOARD_USER: "alex",
    DASHBOARD_PASS: "a-long-enough-pass",
    COOKIE_SECRET: "a-cookie-secret-of-32-characters!",
    ...overrides,
  };
  delete env.NODE_TEST_CONTEXT;
  delete env.RAILWAY_ENVIRONMENT;
  return env;
}

// Resolves with the exit code, or with the listen line if the server came up.
function startServer(env: NodeJS.ProcessEnv): Promise<{ code: number | null; listening?: string; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], { env });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    const onData = (d: Buffer) => {
      out += d;
      const m = out.match(/^LISTENING (\S+)$/m);
      if (m) {
        clearTimeout(timer);
        child.kill("SIGKILL");
        resolve({ code: null, listening: m[1], out });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

for (const missing of ["DASHBOARD_USER", "DASHBOARD_PASS", "COOKIE_SECRET"]) {
  test(`refuses start without creds: ${missing} empty outside production`, async () => {
    const r = await startServer(isolatedEnv({ [missing]: "" }));
    assert.equal(r.listening, undefined, r.out);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(missing));
  });
}

test("dashboard listens on 127.0.0.1 only", async () => {
  const r = await startServer(isolatedEnv({}));
  assert.ok(r.listening, r.out);
  assert.match(r.listening!, /^127\.0\.0\.1:\d+$/);
});

test("sessionAuth refuses requests when creds are missing, whatever NODE_ENV says", async () => {
  const { sessionAuth } = await import("./auth.js");
  const saved = { u: process.env.DASHBOARD_USER, p: process.env.DASHBOARD_PASS, n: process.env.NODE_ENV };
  delete process.env.DASHBOARD_USER;
  delete process.env.DASHBOARD_PASS;
  process.env.NODE_ENV = "development";
  let status = 0;
  let nextCalled = false;
  const res = { status(s: number) { status = s; return this; }, json() { return this; } };
  try {
    sessionAuth({ headers: {}, cookies: {} } as never, res as never, () => { nextCalled = true; });
  } finally {
    if (saved.u !== undefined) process.env.DASHBOARD_USER = saved.u;
    if (saved.p !== undefined) process.env.DASHBOARD_PASS = saved.p;
    if (saved.n !== undefined) process.env.NODE_ENV = saved.n; else delete process.env.NODE_ENV;
  }
  assert.equal(nextCalled, false);
  assert.equal(status, 500);
});
