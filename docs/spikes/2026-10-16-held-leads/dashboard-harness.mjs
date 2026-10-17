// Plan evidence for todo 097 (not a repo test). Run from the repo root: node docs/spikes/2026-10-16-held-leads/dashboard-harness.mjs
// Offline, no network, no API. Runs the REAL inline script of public/dashboard.html under node:vm with a stub `document`,
// then applies a PROTOTYPE of the planned change to a text copy of the script (the real file is never modified) and checks it.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync("public/dashboard.html", "utf8");
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };
const count = (s, needle) => s.split(needle).length - 1;

// ---- extraction assertions ---------------------------------------------------------------------------------------
check(count(html, "<script>\n") === 1, "exactly one inline <script> block (no src)");
const m = html.match(/<script>\n([\s\S]*?)<\/script>/);
const script = m[1];
const close = script.lastIndexOf("})();");
check(close > 0 && script.slice(close + 5).trim() === "", "the script ends with the IIFE close and nothing after it");
const EXPOSE = "\n globalThis.__t = { buildTableRow, buildMobileCard, renderDetailPanel, esc, statusDisplay: typeof statusDisplay === 'function' ? statusDisplay : null, holdNoticeHTML: typeof holdNoticeHTML === 'function' ? holdNoticeHTML : null };\n";

// ---- the document stub: browser-equivalent text-node escaping ----------------------------------------------------
// Serializing a text node: & -> &amp;  < -> &lt;  > -> &gt;  U+00A0 -> &nbsp;  (quotes are NOT escaped in text content).
const serialize = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
function makeStubDocument() {
  const inert = () => new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => "" : p === "length" ? 0 : inert()),
    apply: () => inert(), construct: () => inert(), set: () => true,
  });
  const base = { createElement: () => { let t = ""; return { set textContent(v) { t = v; }, get textContent() { return t; }, get innerHTML() { return serialize(t); } }; } };
  return new Proxy(base, { get: (t, p) => (p in t ? t[p] : inert()) });
}

// ---- load the page: a script text in, { t, fetchCalls } out --------------------------------------------------------
function load(scriptText) {
  const fetchCalls = [];
  const inert = () => new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : inert()), apply: () => inert(), set: () => true });
  const win = { location: { hash: "" } };
  const ctx = vm.createContext({
    document: makeStubDocument(), window: win, location: win.location, navigator: inert(), localStorage: inert(), sessionStorage: inert(),
    fetch: (url) => { fetchCalls.push(String(url)); return new Promise(() => {}); },   // never settles: startup stays inert and deterministic
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}, requestAnimationFrame: () => 0,
    console, URLSearchParams, Date, Math, JSON, Intl, encodeURIComponent, btoa: (s) => s, prompt: () => null,
  });
  const c = scriptText.lastIndexOf("})();");
  vm.runInContext(scriptText.slice(0, c) + EXPOSE + scriptText.slice(c), ctx, { filename: "dashboard-inline.js" });
  return { t: ctx.__t, fetchCalls };
}

// ---- PROTOTYPE of the planned change, applied to a text copy ------------------------------------------------------
const OLD_LOOKUP = "var st = STATUS_DISPLAY[l.status] || { label: esc(l.status), css: '' };";
const MUTE_ROW = "var muted = (l.status === 'sent' || l.status === 'done') ? ' row-muted' : '';";
const MUTE_CARD = "var muted = (l.status === 'sent' || l.status === 'done') ? ' mobile-card-muted' : '';";
const OLD_HEADER = "'</p></div>' +\n      '<div class=\"confidence-summary";
function patched({ escapeReason = true, patchMobile = true, patchMute = true } = {}) {
  check(count(script, OLD_LOOKUP) === 2, "found exactly the two current STATUS_DISPLAY[l.status] reads (table row, mobile card)");
  check(count(script, OLD_HEADER) === 1, "found exactly one detail-panel header insertion point");
  check(count(script, MUTE_ROW) === 1 && count(script, MUTE_CARD) === 1, "found exactly the two muted-style lines (table row, mobile card)");
  const helpers =
    "function isHeld(l) {\n  return l.status === 'sent' && typeof l.hold_reason === 'string' && l.hold_reason !== '';\n}\n" +
    "function statusDisplay(l) {\n  if (isHeld(l)) return { label: 'Held', css: 'held' };\n  return STATUS_DISPLAY[l.status] || { label: esc(l.status), css: '' };\n}\n" +
    "function holdNoticeHTML(l) {\n  if (!isHeld(l)) return '';\n  return '<div class=\"hold-notice\"><strong>Held for you:</strong> ' + " + (escapeReason ? "esc(l.hold_reason)" : "l.hold_reason") + " + '</div>';\n}\n\n";
  let s = script.replace("  /* ── Row builders", helpers + "  /* ── Row builders");
  check(s !== script, "inserted the helpers before the row builders");
  // table row = first read, mobile card = second read
  const i1 = s.indexOf(OLD_LOOKUP);
  s = s.slice(0, i1) + "var st = statusDisplay(l);" + s.slice(i1 + OLD_LOOKUP.length);
  if (patchMobile) { const i2 = s.indexOf(OLD_LOOKUP); s = s.slice(0, i2) + "var st = statusDisplay(l);" + s.slice(i2 + OLD_LOOKUP.length); }
  if (patchMute) {
    s = s.replace(MUTE_ROW, "var muted = (!isHeld(l) && (l.status === 'sent' || l.status === 'done')) ? ' row-muted' : '';");
    s = s.replace(MUTE_CARD, "var muted = (!isHeld(l) && (l.status === 'sent' || l.status === 'done')) ? ' mobile-card-muted' : '';");
  }
  s = s.replace(OLD_HEADER, "'</p>' + holdNoticeHTML(l) + '</div>' +\n      '<div class=\"confidence-summary");
  return s;
}

const mkLead = (o = {}) => ({ id: 7, status: "sent", event_type: "wedding", client_name: "Test", event_date: "2026-11-01", venue: "V", format_recommended: "solo", confidence_score: 80, full_draft: "d", compressed_draft: "c", gate_passed: true, hold_reason: null, ...o });

// ---- controls on the harness itself ----------------------------------------------------------------------------------
console.log("\nControls on the harness");
const orig = load(script);
check(orig.fetchCalls.length === 3 && orig.fetchCalls.every((u) => u.startsWith("/api/")), `startup made exactly 3 /api/ fetches, none answered (${orig.fetchCalls.join(", ")})`);
const el = makeStubDocument().createElement("div"); el.textContent = "<b>&\"' ";
check(el.innerHTML === "&lt;b&gt;&amp;\"'&nbsp;", "S1 stub serializes a text node to the independent expected string (quotes untouched, NBSP -> &nbsp;)");
check(orig.t.esc("<img src=x onerror=1>") === "&lt;img src=x onerror=1&gt;", "S2 the page's REAL esc() returns the independent expected string");
check(orig.t.esc("") === "" && orig.t.esc(null) === "", "S3 the real esc() returns '' for '' and null");

// ---- D tests on the prototype ------------------------------------------------------------------------------------------
const P = load(patched());
console.log("\nD1 held lead, table row and mobile card");
const held = mkLead({ hold_reason: "Yelp portal reply not verified live" });
for (const [name, fn] of [["table row", "buildTableRow"], ["mobile card", "buildMobileCard"]]) {
  const o = P.t[fn](held);
  check(o.includes('status-badge held">Held<') && !o.includes(">Sent<"), `D1 ${name}: badge says Held (class held) and not Sent`);
}
console.log("\nD2 every other status is byte-identical to today's page (overshoot control)");
const labels = { received: "Pending", sending: "Sending", sent: "Sent", done: "Done", failed: "Failed" };
for (const [status, label] of Object.entries(labels)) {
  for (const fn of ["buildTableRow", "buildMobileCard"]) {
    const l = mkLead({ status, hold_reason: null });
    const a = orig.t[fn](l), b = P.t[fn](l);
    check(a === b && a.includes(`>${label}<`), `D2 ${status} ${fn}: identical output and label "${label}"`);
  }
}
{ const l = mkLead({ status: "weird<x>", hold_reason: null }); check(orig.t.buildTableRow(l) === P.t.buildTableRow(l) && P.t.buildTableRow(l).includes("weird&lt;x&gt;"), "D2 unknown status keeps the escaped fallback"); }
{ const l = mkLead({ status: "done", hold_reason: "stale text" }); check(orig.t.buildTableRow(l) === P.t.buildTableRow(l), "D2 a non-sent status never shows Held even if hold_reason is set"); }
console.log("\nD6 held rows are not faded; other sent/done rows still are");
{ const t = P.t.buildTableRow(held), c = P.t.buildMobileCard(held);
  check(!t.includes("row-muted") && !c.includes("mobile-card-muted"), "D6 a held row and a held card carry no muted class");
  const plain = mkLead({ hold_reason: null });
  check(P.t.buildTableRow(plain).includes("row-muted") && P.t.buildMobileCard(plain).includes("mobile-card-muted"), "D6 a plain sent row and card still carry the muted class"); }
console.log("\nD3/D4 detail panel");
const R = 'ZZREASON <img src=x onerror=1>&"';
const d = P.t.renderDetailPanel(mkLead({ hold_reason: R }));
check(d.includes('Held for you:</strong> ZZREASON &lt;img src=x onerror=1&gt;&amp;"</div>'), "D3 reason is escaped, exact expected output");
check(!d.includes("<img src=x") && count(d, "ZZREASON") === 1 && /<div class="hold-notice">[^<]*<strong>[^<]*<\/strong> ZZREASON[^<]*<\/div>/.test(d), "D3 reason appears once, as element text only (not in an attribute)");
check(P.t.renderDetailPanel(mkLead({ hold_reason: null })) === orig.t.renderDetailPanel(mkLead({ hold_reason: null })) && !P.t.renderDetailPanel(mkLead()).includes("hold-notice"), "D4 a non-held detail panel is byte-identical to today's and has no hold-notice");
console.log("\nD5 wiring and mutation checks (each must be CAUGHT)");
check(count(patched(), "STATUS_DISPLAY[l.status]") === 1, "D5 STATUS_DISPLAY[l.status] is read in exactly one place after the change");
{ const M = load(patched({ escapeReason: false })); const o = M.t.renderDetailPanel(mkLead({ hold_reason: R })); check(o.includes("<img src=x"), "MUTATION 1 caught: without esc() the raw <img appears, so D3 would fail"); }
{ const M = load(patched({ patchMobile: false })); const o = M.t.buildMobileCard(held); check(!o.includes('status-badge held">Held<'), "MUTATION 2 caught: leaving the mobile card unpatched loses the Held badge, so D1 would fail"); }
{ const M = load(patched({ patchMute: false })); check(M.t.buildTableRow(held).includes("row-muted"), "MUTATION 3 caught: leaving the muted lines unpatched keeps a held row faded, so D6 would fail"); }
console.log(bad === 0 ? "\nALL CHECKS PASS" : `\n${bad} CHECK(S) FAILED`);
process.exit(bad === 0 ? 0 : 1);
