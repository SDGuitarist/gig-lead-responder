// Port helper (plan 0.5): compares every price in Alex's private Project rate
// cards (~/Data/gig-lead-responder/) with src/data/rates.ts. Prints counts and
// differences only. Usage: npx tsx scripts/port-rate-compare.ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { FLAMENCO_TRIO_3H_DANCER_2H_RATES, MARIACHI_FULL_OUTSIDE_SD_RATES, RATE_TABLES } from "../src/data/rates.js";
const TABLES: Record<string, unknown> = { ...RATE_TABLES, mariachi_full_outside_sd: MARIACHI_FULL_OUTSIDE_SD_RATES,
  flamenco_trio_dancer_2h: { "3": FLAMENCO_TRIO_3H_DANCER_2H_RATES } };
const DATA = `${homedir()}/Data/gig-lead-responder`;
const extraction = readFileSync(`${DATA}/Gig_Lead_Response_System_4.0_Extraction.md`, "utf8").split("\n");
function projectFile(n: number): string {
  const st = extraction.findIndex((l) => l.startsWith(`=== FILE ${n} of 19`));
  const en = extraction.findIndex((l, i) => i > st && l.startsWith("=== END FILE"));
  return extraction.slice(st + 1, en).filter((l) => !l.startsWith("`````")).join("\n");
}
const cards: Array<[string, string, (sec: string, sub: string) => string | null]> = [
  ["Solo/Duo", readFileSync(`${DATA}/Rate_Card_Solo_Duo.md`, "utf8"), (sec, sub) =>
    sec.startsWith("B2C: Solo Guitar") ? "solo" : sec.startsWith("B2C: Duo") ? "duo" : sec.startsWith("B2C: Flamenco Duo") ? "flamenco_duo"
    : sec.startsWith("Sourced Cultural Music") ? (sub === "solo" ? "sourced_cultural_solo" : sub === "duo" ? "sourced_cultural_duo" : null) : null],
  ["Trio/Ensemble", projectFile(3), (sec, sub) =>
    sub.startsWith("B2C Pricing: Flamenco Trio Full") ? "flamenco_trio_full" : sub.startsWith("B2C Pricing: Flamenco Trio Hybrid") ? "flamenco_trio"
    : sec.startsWith("Mariachi: Full") ? (sub.startsWith("B2C Pricing: San Diego County") ? "mariachi_full" : sub.startsWith("B2C Pricing: Outside San Diego County") ? "mariachi_full_outside_sd" : null)
    : sec.startsWith("Mariachi: 4-Piece") ? "mariachi_4piece"
    : sub.startsWith("Trio (3") ? "sourced_cultural_trio" : sub.startsWith("Quartet") ? "sourced_cultural_quartet" : sub.startsWith("5-Piece") ? "sourced_cultural_5piece" : null],
  ["Bolero", projectFile(4), (sec) => sec.startsWith("B2C Pricing: Bolero Trio") ? "bolero_trio" : null],
];
const num = (s: string) => Number(s.replace(/[$,]/g, ""));
let parsed = 0, same = 0; const diffs: string[] = [];
for (const [card, text, map] of cards) {
  let sec = "", sub = "", dur = "", variant = "";
  for (const line of text.split("\n")) {
    let m;
    if ((m = /^## (.*)/.exec(line))) { sec = m[1]; sub = ""; dur = ""; continue; }
    if ((m = /^### (.*)/.exec(line))) { sub = m[1]; dur = ""; const d = /^([\d.]+)-Hour/.exec(sub); if (d) dur = d[1]; if (card === "Bolero" && d) sub = ""; continue; }
    if ((m = /^\*\*(Solo|Duo)\*\*/.exec(line))) { sub = m[1].toLowerCase(); continue; }
    if ((m = /^(?:#### |\*\*)([\d.]+)-Hour(.*)/.exec(line))) { dur = m[1]; variant = m[2].replace(/[*:]/g, "").trim(); }
    const inline = /^\*\*([\d.]+) hrs?\b[^:]*:\*\*/.exec(line); if (inline) dur = inline[1];
    const base = map(sec, sub); const fmt = base === "flamenco_trio" && /Dancer 2 Hours/.test(variant) ? "flamenco_trio_dancer_2h" : base; if (!fmt || !dur) continue;
    for (const t of line.matchAll(/(T1|T2P|T2D|T3P|T3D)(?::\*\*)?\s*\$([\d,]+)(?:\s*\/\s*\$([\d,]+))?/g)) {
      const tier = t[1], a = num(t[2]), f = t[3] ? num(t[3]) : a; parsed++;
      const code = (TABLES as any)[fmt]?.[dur]?.[tier];
      const tag = `${card} | ${fmt} | ${dur}h${variant ? " (" + variant + ")" : ""} | ${tier}`;
      if (!code) diffs.push(`${tag} | card $${a}/$${f} | code: (none)`);
      else if (code.anchor === a && code.floor === f) same++;
      else diffs.push(`${tag} | card $${a}/$${f} | code $${code.anchor}/$${code.floor}`);
    }
  }
}
console.log(`parsed ${parsed} card prices; ${same} match the code; ${diffs.length} differ or are missing`);
console.log(diffs.join("\n"));
