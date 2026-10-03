import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-lease-")), "leases.db");
const { initDb } = await import("./db/migrate.js");
const { tryAcquireLease, holdsLease, getLeaseInfo } = await import("./db/runtime-lease.js");

const A = { host: "mac", pid: 101, boot: 5000 };
const B = { host: "mac", pid: 202, boot: 5000 };
const alive = () => true;
const T = 1_791_000_000_000;

test("lease expiry and stale holder: migration v2 creates runtime_lease", () => {
  assert.equal(initDb().pragma("user_version", { simple: true }), 2);
});

test("lease expiry and stale holder: one holder at a time, renewable by itself", () => {
  assert.equal(tryAcquireLease(A, T, alive), true);
  assert.equal(tryAcquireLease(B, T + 1000, alive), false, "B must not take a live lease");
  assert.equal(tryAcquireLease(A, T + 20_000, alive), true, "A renews");
  assert.equal(holdsLease(A, T + 79_000), true);
  assert.equal(holdsLease(B, T + 79_000), false, "a non-holder may not send");
  assert.deepEqual(getLeaseInfo(), { host: "mac", pid: 101, expiresAt: T + 80_000 });
});

test("lease expiry and stale holder: an expired lease passes to a new holder", () => {
  assert.equal(holdsLease(A, T + 80_001), false, "expired lease no longer authorizes A");
  assert.equal(tryAcquireLease(B, T + 80_001, alive), true);
  assert.equal(holdsLease(A, T + 80_002), false);
});

test("lease expiry and stale holder: a dead holder's live lease is taken at once", () => {
  const C = { host: "mac", pid: 303, boot: 5000 };
  // B holds until T+140_001. B's pid is dead, so C takes over before that.
  assert.equal(tryAcquireLease(C, T + 90_000, (pid) => pid !== 202), true);
  // A holder from an earlier boot is dead too, whatever its pid.
  const D = { host: "mac", pid: 303, boot: 9999 };
  assert.equal(tryAcquireLease(D, T + 91_000, alive), true);
});
