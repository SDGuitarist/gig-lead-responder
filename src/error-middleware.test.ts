import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import http from "node:http";
import { asyncHandler } from "./utils/async-handler.js";
import { errorHandler } from "./utils/error-handler.js";
import { createApp } from "./app.js";

/** Build a minimal Express app with the global error handler and optional extra routes. */
function createTestApp(...routes: Array<[string, string, RequestHandler]>) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  // Default test routes
  app.get("/sync-throw", (_req: Request, _res: Response) => {
    throw new Error("sync boom");
  });

  app.get(
    "/async-reject",
    asyncHandler(async (_req: Request, _res: Response) => {
      throw new Error("async boom");
    })
  );

  app.get("/headers-sent", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.flushHeaders();
    next(new Error("after flush"));
  });

  // Insert extra routes before the error handler
  for (const [method, path, handler] of routes) {
    (app as any)[method](path, handler);
  }

  app.use(errorHandler);
  return app;
}

function request(
  server: http.Server,
  method: string,
  path: string,
  body?: string,
  contentType?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: addr.port,
      path,
      method,
      headers: contentType ? { "Content-Type": contentType } : {},
    };
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode!,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf-8"),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Start a server, run a callback, then close it. */
async function withServer(
  app: express.Express,
  fn: (server: http.Server) => Promise<void>
) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    await fn(server);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Global error middleware", () => {
  const app = createTestApp();
  const server = http.createServer(app);

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("should start test server", (_, done) => {
    server.listen(0, "127.0.0.1", () => done());
  });

  it("returns 400 with parse error message for malformed JSON", async () => {
    const res = await request(
      server,
      "POST",
      "/sync-throw",
      "{ not valid json }",
      "application/json"
    );
    assert.equal(res.status, 400);
    const json = JSON.parse(res.body);
    // Should contain the actual parse error, NOT "Internal server error"
    assert.ok(
      json.error.toLowerCase().includes("unexpected") ||
        json.error.toLowerCase().includes("json"),
      `Expected JSON parse error message, got: ${json.error}`
    );
    assert.notEqual(json.error, "Internal server error");
  });

  it("catches async rejections via asyncHandler and returns 500", async () => {
    const res = await request(server, "GET", "/async-reject");
    assert.equal(res.status, 500);
    const json = JSON.parse(res.body);
    assert.equal(json.error, "Internal server error");
    assert.ok(!json.error.includes("async boom"));
  });

  it("catches sync throws and returns 500 with generic message", async () => {
    const res = await request(server, "GET", "/sync-throw");
    assert.equal(res.status, 500);
    const json = JSON.parse(res.body);
    assert.equal(json.error, "Internal server error");
    assert.ok(!json.error.includes("sync boom"));
  });

  it("does not double-respond when headers already sent", async () => {
    const res = await request(server, "GET", "/headers-sent");
    // Status is 200 because headers were flushed before the error
    assert.equal(res.status, 200);
    // Server should still be alive after the headersSent path
    const res2 = await request(server, "GET", "/sync-throw");
    assert.equal(res2.status, 500);
  });

  it("preserves legacy redirects, static assets, and 404s in the real app", async () => {
    const realApp = createApp();

    await withServer(realApp, async (srv) => {
      const rootRes = await request(srv, "GET", "/");
      assert.equal(rootRes.status, 302);
      assert.equal(rootRes.headers.location, "/dashboard.html");

      const legacyRes = await request(srv, "GET", "/index.html");
      assert.equal(legacyRes.status, 302);
      assert.equal(legacyRes.headers.location, "/dashboard.html");

      const dashboardRes = await request(srv, "GET", "/dashboard.html");
      assert.equal(dashboardRes.status, 200);
      assert.ok(
        dashboardRes.headers["content-type"]?.includes("text/html"),
        `Expected HTML content-type, got: ${dashboardRes.headers["content-type"]}`
      );

      // Unmatched route returns 404 from the real middleware stack
      const res = await request(srv, "GET", "/nonexistent");
      assert.equal(res.status, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error, "Not found");

      // Static serving still works (catch-all didn't shadow express.static)
      const cssRes = await request(srv, "GET", "/dashboard.css");
      assert.equal(cssRes.status, 200);
      assert.ok(
        cssRes.headers["content-type"]?.includes("text/css"),
        `Expected CSS content-type, got: ${cssRes.headers["content-type"]}`
      );

      // Healthcheck still works (existing non-static route)
      const healthRes = await request(srv, "GET", "/health");
      assert.equal(healthRes.status, 200);
      const healthJson = JSON.parse(healthRes.body);
      assert.equal(healthJson.status, "ok");
    });
  });

  it("never exposes raw message on 5xx even if err.expose is true", async () => {
    const appWith5xx = createTestApp([
      "get",
      "/5xx-exposed",
      (_req: Request, _res: Response, next: NextFunction) => {
        const err: any = new Error("secret db info");
        err.status = 500;
        err.expose = true;
        next(err);
      },
    ]);

    await withServer(appWith5xx, async (srv) => {
      const res = await request(srv, "GET", "/5xx-exposed");
      assert.equal(res.status, 500);
      const json = JSON.parse(res.body);
      assert.equal(json.error, "Internal server error");
      assert.ok(!res.body.includes("secret"));
    });
  });
});
