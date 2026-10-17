// Todo 097 plan D1-D6: a held lead reads "Held" with its reason, is not faded, and every other status is unchanged.
// Harness (specified in docs/plans/2026-10-16-fix-held-leads-show-as-sent-plan.md, prototype in docs/spikes/2026-10-16-held-leads/):
// the REAL inline script of public/dashboard.html runs under node:vm with a stub document that serializes text the way a
// browser does; the page's own esc() is used unchanged. "The unchanged page" is rebuilt by reversing this change on a copy.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const html = readFileSync(join(import.meta.dirname, "..", "public", "dashboard.html"), "utf8");
const count = (s: string, needle: string): number => s.split(needle).length - 1;

// ---- extraction ----
assert.equal(count(html, "<script>\n"), 1, "exactly one inline <script> block");
const script = html.match(/<script>\n([\s\S]*?)<\/script>/)![1];
const CLOSE = script.lastIndexOf("})();");
assert.ok(CLOSE > 0 && script.slice(CLOSE + 5).trim() === "", "the script ends with the IIFE close and nothing after it");
const EXPOSE = "\n globalThis.__t = { buildTableRow, buildMobileCard, renderDetailPanel, esc };\n";

// ---- the unchanged page: reverse the change on a copy ----
const OLD_LOOKUP = "var st = STATUS_DISPLAY[l.status] || { label: esc(l.status), css: '' };";
const OLD_ROW = "var muted = (l.status === 'sent' || l.status === 'done') ? ' row-muted' : '';";
const OLD_CARD = "var muted = (l.status === 'sent' || l.status === 'done') ? ' mobile-card-muted' : '';";
const NEW_ROW = "var muted = (!isHeld(l) && (l.status === 'sent' || l.status === 'done')) ? ' row-muted' : '';";
const NEW_CARD = "var muted = (!isHeld(l) && (l.status === 'sent' || l.status === 'done')) ? ' mobile-card-muted' : '';";
const NEW_HEADER = "'</p>' + holdNoticeHTML(l) + '</div>' +\n      '<div class=\"confidence-summary";
const OLD_HEADER = "'</p></div>' +\n      '<div class=\"confidence-summary";
function reversed(): string {
  assert.equal(count(script, "var st = statusDisplay(l);"), 2, "two call sites (table row, mobile card)");
  for (const needle of [NEW_ROW, NEW_CARD, NEW_HEADER]) assert.equal(count(script, needle), 1, needle.slice(0, 40));
  return script.split("var st = statusDisplay(l);").join(OLD_LOOKUP).replace(NEW_ROW, OLD_ROW).replace(NEW_CARD, OLD_CARD).replace(NEW_HEADER, OLD_HEADER);
}

// ---- the stub document: browser-equivalent text-node serialization ----
const serialize = (s: unknown): string => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
function inert(): any {
  return new Proxy(function () {}, {
    get: (_t, p) => (p === Symbol.toPrimitive ? () => "" : p === "length" ? 0 : inert()),
    apply: () => inert(), construct: () => inert(), set: () => true,
  });
}
function makeStubDocument(): any {
  const base: Record<string | symbol, unknown> = { createElement: () => { let t = ""; return { set textContent(v: unknown) { t = String(v); }, get textContent() { return t; }, get innerHTML() { return serialize(t); } }; } };
  return new Proxy(base, { get: (t, p) => (p in t ? t[p] : inert()) });
}
function load(scriptText: string): { t: Record<string, (...a: any[]) => string>; fetchCalls: string[]; doc: any } {
  const fetchCalls: string[] = [];
  const win = { location: { hash: "" } };
  const doc = makeStubDocument();
  const ctx = vm.createContext({
    document: doc, window: win, location: win.location, navigator: inert(), localStorage: inert(), sessionStorage: inert(),
    fetch: (url: unknown) => { fetchCalls.push(String(url)); return new Promise(() => {}); }, // never settles: startup stays inert
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}, requestAnimationFrame: () => 0,
    console, URLSearchParams, Date, Math, JSON, Intl, encodeURIComponent, btoa: (s: string) => s, prompt: () => null,
  });
  const c = scriptText.lastIndexOf("})();");
  vm.runInContext(scriptText.slice(0, c) + EXPOSE + scriptText.slice(c), ctx, { filename: "dashboard-inline.js" });
  return { t: (ctx as any).__t, fetchCalls, doc };
}

const page = load(script);
// Built on first use, so a broken call site fails the tests about that behavior instead of the whole file at load.
let oldPage: ReturnType<typeof load> | undefined;
const getOld = (): ReturnType<typeof load> => (oldPage ??= load(reversed()));
const mk = (o: Record<string, unknown> = {}) => ({ id: 7, status: "sent", event_type: "wedding", client_name: "Test", event_date: "2026-11-01", venue: "V", format_recommended: "solo", confidence_score: 80, full_draft: "d", compressed_draft: "c", gate_passed: true, hold_reason: null, ...o });
const HELD = mk({ hold_reason: "Yelp portal reply not verified live (todo 094): Alex sends from Yelp" });

describe("dashboard harness controls (todo 097)", () => {
  it("startup made exactly 3 /api/ fetches and none was answered", () => {
    assert.equal(page.fetchCalls.length, 3);
    assert.ok(page.fetchCalls.every((u) => u.startsWith("/api/")), page.fetchCalls.join(", "));
  });
  it("S1 the stub serializes a text node to an independent expected string (quotes untouched, NBSP becomes &nbsp;)", () => {
    const el = page.doc.createElement("div"); el.textContent = "<b>&\"' ";
    assert.equal(el.innerHTML, "&lt;b&gt;&amp;\"'&nbsp;");
  });
  it("S2 the page's real esc() returns the independent expected strings", () => {
    assert.equal(page.t.esc("<img src=x onerror=1>"), "&lt;img src=x onerror=1&gt;");
    assert.equal(page.t.esc(""), "");
    assert.equal(page.t.esc(null), "");
  });
});

describe("held lead display (todo 097)", () => {
  it("D1 a held lead reads Held (class held), not Sent, in the table row and the mobile card", () => {
    for (const fn of ["buildTableRow", "buildMobileCard"]) {
      const o = page.t[fn](HELD);
      assert.ok(o.includes('status-badge held">Held<'), fn);
      assert.ok(!o.includes(">Sent<"), fn);
    }
  });

  it("D2 every other status is byte-identical to the unchanged page, with today's labels", () => {
    const labels: Record<string, string> = { received: "Pending", sending: "Sending", sent: "Sent", done: "Done", failed: "Failed" };
    for (const [status, label] of Object.entries(labels)) {
      for (const fn of ["buildTableRow", "buildMobileCard"]) {
        const l = mk({ status, hold_reason: null });
        const a = getOld().t[fn](l);
        assert.equal(page.t[fn](l), a, `${status} ${fn}`);
        assert.ok(a.includes(`>${label}<`), `${status} ${fn} label ${label}`);
      }
    }
    const weird = mk({ status: "weird<x>", hold_reason: null });
    assert.equal(page.t.buildTableRow(weird), getOld().t.buildTableRow(weird));
    assert.ok(page.t.buildTableRow(weird).includes("weird&lt;x&gt;"));
    const doneStale = mk({ status: "done", hold_reason: "stale text" }); // a non-sent status never shows Held
    assert.equal(page.t.buildTableRow(doneStale), getOld().t.buildTableRow(doneStale));
    assert.equal(page.t.buildMobileCard(doneStale), getOld().t.buildMobileCard(doneStale));
  });

  it("D3 the reason is escaped in the detail panel, appears once, and only as element text", () => {
    const d = page.t.renderDetailPanel(mk({ hold_reason: 'ZZREASON <img src=x onerror=1>&"' }));
    assert.ok(d.includes('Held for you:</strong> ZZREASON &lt;img src=x onerror=1&gt;&amp;"</div>'), d.slice(0, 400));
    assert.ok(!d.includes("<img src=x"));
    assert.equal(count(d, "ZZREASON"), 1);
    assert.match(d, /<div class="hold-notice">[^<]*<strong>[^<]*<\/strong> ZZREASON[^<]*<\/div>/);
  });

  it("D4 a lead that is not held gets a detail panel byte-identical to the unchanged page, with no hold-notice", () => {
    for (const l of [mk({ hold_reason: null }), mk({ status: "done" }), mk({ status: "failed" })]) {
      assert.equal(page.t.renderDetailPanel(l), getOld().t.renderDetailPanel(l));
      assert.ok(!page.t.renderDetailPanel(l).includes("hold-notice"));
    }
    assert.ok(page.t.renderDetailPanel(HELD).includes("Held for you:"));
  });

  it("D5 STATUS_DISPLAY[l.status] is read in exactly one place", () => {
    assert.equal(count(script, "STATUS_DISPLAY[l.status]"), 1);
  });

  it("D6 a held row and card are not faded; a plain sent row and card, and a done one, still are", () => {
    assert.ok(!page.t.buildTableRow(HELD).includes("row-muted"));
    assert.ok(!page.t.buildMobileCard(HELD).includes("mobile-card-muted"));
    for (const status of ["sent", "done"]) {
      const l = mk({ status, hold_reason: null });
      assert.ok(page.t.buildTableRow(l).includes("row-muted"), status);
      assert.ok(page.t.buildMobileCard(l).includes("mobile-card-muted"), status);
    }
  });
});
