// Who this process is, for the same-host lease (plan 0.2).
import { execFileSync } from "node:child_process";
import { hostname } from "node:os";
import type { LeaseHolder } from "../db/runtime-lease.js";

/** Exact boot time from macOS; 0 (no boot check, pid check only) if unreadable. */
function bootTimeSec(): number {
  try {
    const out = execFileSync("sysctl", ["-n", "kern.boottime"], { encoding: "utf8" });
    return Number(/sec = (\d+)/.exec(out)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

let me: LeaseHolder | null = null;

export function currentHolder(): LeaseHolder {
  me ??= { host: hostname(), pid: process.pid, boot: bootTimeSec() };
  return me;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}
