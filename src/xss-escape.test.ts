import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirrors browser esc() from index.html — keep in sync manually
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function kvHTML(pairs: [string, string][]): string {
  return pairs.map(([label, value]) =>
    `<div class="kv"><span class="kv-label">${esc(label)}</span><span class="kv-value">${esc(value)}</span></div>`
  ).join("");
}

describe("XSS escaping — kvHTML", () => {
  it("escapes XSS in value", () => {
    const html = kvHTML([["Test", '<img src=x onerror=alert(1)>']]);
    assert.ok(!html.includes("<img"), "Should not contain raw <img tag");
    assert.ok(html.includes("&lt;img"), "Should contain escaped &lt;img");
  });

  it("escapes XSS in label", () => {
    const html = kvHTML([['<script>alert(1)</script>', "safe"]]);
    assert.ok(!html.includes("<script>"), "Should not contain raw <script> tag");
    assert.ok(html.includes("&lt;script&gt;"), "Should contain escaped script tag");
  });

  it("handles empty strings", () => {
    const html = kvHTML([["Label", ""]]);
    assert.ok(html.includes("kv-value"), "Should still render kv-value span");
  });

  it("escapes ampersands", () => {
    const html = kvHTML([["Test", "AT&T"]]);
    assert.ok(html.includes("AT&amp;T"), "Should escape ampersand");
  });

  it("escapes double quotes", () => {
    const html = kvHTML([["Test", 'He said "hello"']]);
    assert.ok(html.includes("&quot;hello&quot;"), "Should escape double quotes");
  });
});
