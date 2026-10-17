// Plan evidence for todo 097 (not a repo test). Run from the repo root: npx tsx docs/plans/2026-10-16-held-leads-spikes/router-fixtures.ts
// Offline, synthetic text, no API. Runs the SAME fixtures against (a) the current router and (b) a temp copy with the ONE planned change
// (the cross-family reason loses both interpolated values). Prints PASS/FAIL per check so the checks can be seen to discriminate.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");
const SENT = ["ZZSENTINEL", "412 Palm", "abc123", "ZZRECOMMENDED", "9 Elm", "xyz"];
const FIXED = "Cross-family format correction (the client asked for a different kind of act than the one recommended)";

const src = readFileSync(join(root, "src/automation/router.ts"), "utf8");
const OLD = "reasons.push(`Cross-family format correction: ${classification.format_requested} → ${classification.format_recommended}`);";
if (src.split(OLD).length !== 2) throw new Error("expected exactly one cross-family push in router.ts");
const patched = src.replace(OLD, `reasons.push("${FIXED}");`);
const dir = mkdtempSync(join(tmpdir(), "glr-router-"));
const rewrite = (s: string) => s.replace(/from "\.\.\//g, `from "${root}/src/`).replace(/from "\.\/types\.js"/g, `from "${root}/src/automation/types.js"`);
writeFileSync(join(dir, "router-new.ts"), rewrite(patched));
writeFileSync(join(dir, "router-old.ts"), rewrite(src));
const oldR = (await import(pathToFileURL(join(dir, "router-old.ts")).href)).routeLead;
const newR = (await import(pathToFileURL(join(dir, "router-new.ts")).href)).routeLead;

const out = (o: Record<string, unknown> = {}): any => ({
  classification: { format_requested: "solo", format_recommended: "solo", flagged_concerns: [], vagueness: "clear", action: "quote", stealth_premium: false, venue_name: "ZZSENTINEL venue", client_first_name: "ZZSENTINEL", organization_name: "ZZSENTINEL org", ...o },
  pricing: { quote_price: 900 }, verified: true,
});
const lead = (o: Record<string, unknown> = {}): any => ({ platform: "gigsalad", parseConfidence: "high", enriched: true, portalUrl: "https://portal.test/ZZSENTINEL", clientName: "ZZSENTINEL", rawText: "ZZSENTINEL 412 Palm St token=abc123", ...o });

// Fixture list: name, lead, output, expected ordered reasons under the NEW wording (null = auto-send), and whether it must hold.
const REQ = "mariachi ZZSENTINEL 412 Palm St token=abc123";
const fixtures: Array<{ name: string; lead: any; out: any; expected: string[] | null }> = [
  { name: "F-A cross-family only (family word present)", lead: lead(), out: out({ format_requested: REQ, format_recommended: "solo" }), expected: [FIXED] },
  { name: "F-B many branches at once (yelp, low, unenriched, gate fail, price, flagged, cross-family, vague)",
    lead: lead({ platform: "yelp", parseConfidence: "low", enriched: false }),
    out: { ...out({ format_requested: REQ, format_recommended: "solo", flagged_concerns: ["ZZSENTINEL concern"], vagueness: "vague", action: "one_question" }), pricing: { quote_price: 5000 }, verified: false },
    expected: ["Low parse confidence — manual review required", "Yelp lead not enriched from portal — truncated message", "Yelp portal reply not verified live (todo 094): Alex sends from Yelp", "Verification gate failed after retries", "Quote $5000 exceeds threshold $3000", "1 flagged concern(s)", FIXED, "Vague lead — needs clarifying question"] },
  { name: "F-C missing portal URL (gigsalad, no portalUrl)", lead: lead({ portalUrl: undefined }), out: out(), expected: ["Missing portal URL — cannot submit reply"] },
  { name: "F-D high-value assumption", lead: lead(), out: out({ action: "assume_and_quote", stealth_premium: true }), expected: ["High-value assumption (stealth premium + assumed quote)"] },
  { name: "F-E unconstrained format_recommended string", lead: lead(), out: out({ format_requested: REQ, format_recommended: "ZZRECOMMENDED 9 Elm token=xyz" }), expected: [FIXED] },
  { name: "F-F same family (solo -> duo): overshoot control, must NOT hold", lead: lead(), out: out({ format_requested: "solo", format_recommended: "duo" }), expected: null },
  { name: "F-G clean lead, no sentinel in the decision inputs: must NOT hold", lead: lead(), out: out(), expected: null },
];

let bad = 0;
const check = (ok: boolean, msg: string) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };
for (const f of fixtures) {
  const n: any = newR(f.lead, f.out, 3000), o: any = oldR(f.lead, f.out, 3000);
  console.log(`\n${f.name}`);
  check(n.action === o.action, `decision identical old vs new (${o.action})`);
  check(JSON.stringify(n.reasons ?? null) === JSON.stringify(f.expected), `NEW exact ordered reasons ${f.expected ? `(${f.expected.length})` : "(none: auto-send)"}`);
  const joinedNew = (n.reasons ?? []).join("; "), joinedOld = (o.reasons ?? []).join("; ");
  check(!SENT.some((s) => joinedNew.includes(s)), "NEW reasons contain no sentinel");
  const oldLeaks = SENT.some((s) => joinedOld.includes(s));
  const needsLeak = f.expected?.includes(FIXED);
  console.log(`      (control) OLD router ${oldLeaks ? "LEAKS a sentinel" : "no sentinel"}; ${needsLeak ? "a leak is expected here" : "no leak expected here"}`);
  if (needsLeak) check(oldLeaks, "OLD router leaks on this fixture, so the sentinel check can fail (it discriminates)");
}
console.log(bad === 0 ? "\nALL CHECKS PASS" : `\n${bad} CHECK(S) FAILED`);
process.exit(bad === 0 ? 0 : 1);
