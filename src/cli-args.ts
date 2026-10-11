import type { Platform } from "./types.js";

// CLI arguments for src/index.ts (payment-terms plan P14). Parsed BEFORE the API-key check, so a bad value always
// gets the usage and exit 2. --platform names where a hand-run lead came from (GigSalad / The Bash: no payment terms).
const PLATFORMS: readonly Platform[] = ["gigsalad", "thebash", "direct", "yelp", "squarespace"];
export const CLI_USAGE = `usage: echo 'lead text' | npx tsx src/index.ts [--json] [--verbose] [--platform <${PLATFORMS.join("|")}>]`;

export type CliArgs = { ok: true; json: boolean; verbose: boolean; platform?: Platform } | { ok: false; error: string };

export function parseCliArgs(argv: string[]): CliArgs {
  let platform: Platform | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json" || a === "--verbose") continue;
    if (a === "--platform") {
      const v = argv[++i];
      if (!v || !(PLATFORMS as readonly string[]).includes(v)) return { ok: false, error: `--platform needs one of: ${PLATFORMS.join(", ")}` };
      platform = v as Platform;
      continue;
    }
    return { ok: false, error: `unknown argument: ${a}` };
  }
  return { ok: true, json: argv.includes("--json"), verbose: argv.includes("--verbose"), platform };
}
