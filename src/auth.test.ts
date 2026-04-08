import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "./app.js";

process.env.DASHBOARD_USER = "dashboard-user";
process.env.DASHBOARD_PASS = "pass:with:colon";
process.env.COOKIE_SECRET = "test-cookie-secret";

function request(
  server: http.Server,
  method: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode!,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

async function withServer(
  fn: (server: http.Server) => Promise<void>,
) {
  const server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    await fn(server);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from("dashboard-user:pass:with:colon").toString("base64")}`;
}

describe("csrfGuard", () => {
  it("allows Basic Auth POSTs without CSRF header (not auto-attached by browsers)", async () => {
    await withServer(async (server) => {
      const res = await request(server, "POST", "/logout", {
        Authorization: basicAuthHeader(),
      });

      // Basic Auth is not auto-attached by browsers, so CSRF is not a risk
      assert.equal(res.status, 200);
    });
  });

  it("allows authenticated POSTs when the dashboard CSRF header is present", async () => {
    await withServer(async (server) => {
      const res = await request(server, "POST", "/logout", {
        Authorization: basicAuthHeader(),
        "X-Requested-With": "dashboard",
      });

      assert.equal(res.status, 200);
      assert.equal(JSON.parse(res.body).success, true);
    });
  });
});
