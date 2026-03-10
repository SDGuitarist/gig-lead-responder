import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from "express";
import http from "node:http";
import { asyncHandler } from "./utils/async-handler.js";

/**
 * The exact error handler from src/server.ts (with the 4xx-only expose fix).
 * Duplicated here so tests don't import the full server with its side effects.
 */
const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const message = err instanceof Error ? err.message : String(err);

  if (res.headersSent) {
    res.end();
    return;
  }

  const status =
    typeof (err as any).status === "number" &&
    (err as any).status >= 400 &&
    (err as any).status < 600
      ? (err as any).status
      : 500;

  const clientMessage =
    status >= 400 && status < 500 && (err as any).expose === true && message
      ? message
      : "Internal server error";

  res.status(status).json({ error: clientMessage });
};

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

  it("returns 404 JSON for unmatched routes when catch-all is present", async () => {
    const app = express();
    app.get("/exists", (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: "Not found" });
    });
    app.use(errorHandler);

    await withServer(app, async (srv) => {
      // Unmatched route returns 404
      const res = await request(srv, "GET", "/nonexistent");
      assert.equal(res.status, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error, "Not found");

      // Matched route still works
      const res2 = await request(srv, "GET", "/exists");
      assert.equal(res2.status, 200);
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
