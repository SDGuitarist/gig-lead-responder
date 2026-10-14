import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { verifyGate } from "./pipeline/verify.js";
import { VERIFY_CASES, VAGUE_GATE_CASES, sectionOf, snapshotForm, voiceBlockOf } from "./verify-prompt-cases.js";
import { GUT_CHECK_KEYS } from "./types.js";

// Plan docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md (Revision 1b), VG1-VG10. Names start "Vague Gate VG<n>".
// The vague-quote definition is held here as its own copy: the test is the pin. Snapshots are intentionally stale on
// any unrelated edit to buildVerifyPrompt (refresh only in a "snapshot refresh:" commit with the prompt diff).
const VAGUE_6B = [
  "### 6b. Lead-Specificity Check",
  "This lead is vague and its format was assumed: the form gave no date, venue or guest count, so the opening cannot cite them. The first sentence passes only if it repeats or restates a fact or an uncertainty the lead itself supplied. The minimum anchor is ONE of: the occasion or event type the lead wrote (a birthday, a wedding, a party); the time frame the lead wrote (next month, this winter, spring); the lead's own stated doubt (\"not sure what kind of music\"); or a CONCRETE format the lead itself named, which shows in the classification's `format_requested` (a lead that wrote \"a solo guitarist\" supplied that format; a generic word such as \"musician\", \"live music\", \"entertainment\" or \"music\" names no format and is NOT an anchor). Any one is enough. A format that does NOT appear in `format_requested` (\"solo guitar\", \"a duo\" chosen by the app) is an assumption, not a fact the lead supplied, and is NOT an anchor. References that could be said to any inquiry do NOT qualify: \"your event\", \"this inquiry\", \"what you're looking for\", \"the right fit\", \"the right music\", \"what would work best\".",
  "- Look at the FIRST sentence of the draft",
  "- Deletion test: remove the words that came from this lead; if the sentence still works for any inquiry → lead_specific_opening = false",
  "- Pass: \"Your mom's birthday, and you're not sure what kind of music: that is the right place for one question.\"",
  "- Pass (a format the lead named, format_requested = \"a solo guitarist\"): \"A solo guitarist for your mom's birthday: that is a clear ask, and one question settles the rest.\"",
  "- Fail (compliment): \"What a wonderful way to celebrate!\"",
  "- Fail (generic acknowledgement): \"You're looking for the right music for your event.\"",
  "- Fail (assumed format only, solo): \"A solo guitarist is a lovely way to set the tone.\"",
  "- Fail (assumed format only, duo): \"A duo is a warm way to fill an evening.\"",
  "- Fail (a generic word only, format_requested = \"live music\"): \"Live music is a great idea for your event.\"",
  "",
].join("\n");
const VAGUE_LINE = "- lead_specific_opening: Apply section 6b (vague quote mode): the first sentence repeats a fact or an uncertainty this lead supplied, or a format the lead itself named; the format the app assumed does not count, and generic references that fit any inquiry do not count.";
const PREFIX = "- lead_specific_opening:";
const MODE_IDS = ["S8", "S13", "S17", "S18"];
const VOICE_BLOCK_SHA256 = "a48c4fbed16d76a2c64c6326d912d45c29f5a3aec1c0c47e832149afb8fc89ef";

const ALL = [...VERIFY_CASES, ...VAGUE_GATE_CASES];
const caseOf = (id: string) => { const c = ALL.find((x) => x.id === id); assert.ok(c, `case ${id}`); return c; };
const build = (id: string, options?: { openingRule?: "default" }) =>
  (buildVerifyPrompt as (c: unknown, p: unknown, o?: unknown) => string)(caseOf(id).classification, caseOf(id).pricing, options);
const form = (id: string, options?: { openingRule?: "default" }) => snapshotForm(build(id, options));
const snap = (name: string) => readFileSync(`src/fixtures/verify-prompt-baseline/${name}.txt`, "utf-8");
const lineWith = (prompt: string, prefix: string) => {
  const found = prompt.split("\n").filter((l) => l.startsWith(prefix));
  assert.equal(found.length, 1, prefix);
  return found[0];
};

describe("Vague Gate VG1: the vague-quote mode carries the definition", () => {
  for (const id of MODE_IDS) {
    it(`Vague Gate VG1 ${id} has the vague-quote 6b and opening line exactly`, () => {
      const prompt = form(id);
      assert.equal(sectionOf(prompt, "6b"), VAGUE_6B);
      assert.equal(lineWith(prompt, PREFIX), VAGUE_LINE);
    });
  }
});

describe("Vague Gate VG2: everything else is byte-equal to its snapshot", () => {
  // S0 is plan 1's intentionally stale pre-change clarification snapshot (its G6); VG5 covers clarification mode.
  const ids = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S9", "S10", "S11", "S12", "S14", "S15", "S16"];
  for (const id of ids) {
    it(`Vague Gate VG2 ${id} equals its snapshot and has no vague-quote text`, () => {
      const prompt = form(id);
      assert.equal(prompt, snap(id));
      assert.ok(!prompt.includes("its format was assumed"));
    });
  }
});

describe("Vague Gate VG2b: the mode cases equal their refreshed snapshots", () => {
  for (const id of MODE_IDS) {
    it(`Vague Gate VG2b ${id} equals its refreshed snapshot`, () => assert.equal(form(id), snap(id)));
  }
});

describe("Vague Gate VG3: the three other clarification lines are not the clarification text", () => {
  for (const id of ["S8", "S13"]) {
    it(`Vague Gate VG3 ${id} keeps preempted_questions, budget_acknowledged and genre_default_stated`, () => {
      const pre = snap(id === "S8" ? "S8-pre-vague-gate" : "S13-pre-vague-gate");
      const now = form(id);
      for (const prefix of ["- preempted_questions:", "- budget_acknowledged:", "- genre_default_stated:"]) {
        assert.equal(lineWith(now, prefix), lineWith(pre, prefix), prefix);
        assert.ok(!lineWith(now, prefix).includes("clarification mode"), `${prefix} has no clarification text`);
      }
    });
  }
});

describe("Vague Gate VG4: the seam changes only the vague-quote mode, and production calls omit it", () => {
  it("Vague Gate VG4 a call with no options equals a call with {}", () => {
    for (const c of ALL) assert.equal(build(c.id), build(c.id, {}), c.id);
  });

  it("Vague Gate VG4 the default rule restores the pre-change prompt for the mode cases", () => {
    for (const id of MODE_IDS) {
      const pre = snap(id === "S8" ? "S8-pre-vague-gate" : `${id}-pre-vague-gate`);
      assert.equal(form(id, { openingRule: "default" }), pre, id);
    }
  });

  it("Vague Gate VG4 the default rule changes nothing for every other case (positive control: it changes the mode cases)", () => {
    for (const c of ALL.filter((x) => !MODE_IDS.includes(x.id))) assert.equal(build(c.id, { openingRule: "default" }), build(c.id), c.id);
    for (const id of MODE_IDS) assert.notEqual(build(id, { openingRule: "default" }), build(id), id);
  });

  it("Vague Gate VG4 verifyGate builds the same system prompt as buildVerifyPrompt, with and without the option", async () => {
    const seen: string[] = [];
    const gate = { validation_line: "v", best_line: "b", concern_traceability: [], scene_quote: "q", scene_type: "cinematic",
      competitor_test: false, gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass", fail_reasons: [] };
    setClaudeRequesterForTests((async (request: { system?: unknown }) => {
      seen.push(typeof request.system === "string" ? request.system : JSON.stringify(request.system));
      return { id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn", stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(gate) }] };
    }) as never);
    try {
      const c = caseOf("S8");
      const drafts = { full_draft: "x", compressed_draft: "x", compressed_word_count: 1 };
      await (verifyGate as (...a: unknown[]) => Promise<unknown>)(drafts, c.classification, c.pricing);
      await (verifyGate as (...a: unknown[]) => Promise<unknown>)(drafts, c.classification, c.pricing, { openingRule: "default" });
    } finally { setClaudeRequesterForTests(); }
    assert.equal(seen.length, 2);
    assert.ok(seen[0].includes("its format was assumed"), "no options: the vague-quote text");
    assert.ok(!seen[1].includes("its format was assumed"), "default rule: today's strict text");
  });
});

describe("Vague Gate VG5: clarification mode still has plan 1's text", () => {
  it("Vague Gate VG5 S0 has the clarification definition and not the vague-quote one", () => {
    const sec = sectionOf(form("S0"), "6b");
    assert.ok(sec.includes("the form gave no date, venue, guest count or format"));
    assert.ok(!sec.includes("its format was assumed"));
  });
});

describe("Vague Gate VG6: the voice block is pinned", () => {
  it("Vague Gate VG6 every case's voice block hashes to the pinned value", () => {
    for (const c of ALL) {
      const block = voiceBlockOf(build(c.id));
      assert.equal(createHash("sha256").update(block).digest("hex"), VOICE_BLOCK_SHA256, c.id);
    }
  });
});

describe("Vague Gate VG7: the change is exactly the two spans", () => {
  for (const id of MODE_IDS) {
    it(`Vague Gate VG7 ${id}: the pre-change prompt with the two spans replaced equals the new prompt`, () => {
      const pre = snap(id === "S8" ? "S8-pre-vague-gate" : `${id}-pre-vague-gate`);
      const patched = pre.replace(sectionOf(pre, "6b"), VAGUE_6B).replace(lineWith(pre, PREFIX), VAGUE_LINE);
      assert.notEqual(patched, pre, "the replacement did something");
      assert.equal(form(id), patched);
    });
  }
});

describe("Vague Gate VG8: the anchors and the examples are literal", () => {
  it("Vague Gate VG8 the four anchors, 'Any one is enough' and both assumed-format fail examples are present", () => {
    const sec = sectionOf(form("S8"), "6b");
    for (const needle of ["the occasion or event type the lead wrote", "the time frame the lead wrote", "the lead's own stated doubt",
      "or a CONCRETE format the lead itself named", "a generic word such as \"musician\", \"live music\", \"entertainment\" or \"music\" names no format", "Any one is enough",
      "Fail (assumed format only, solo): \"A solo guitarist is a lovely way to set the tone.\"",
      "Fail (assumed format only, duo): \"A duo is a warm way to fill an evening.\""]) assert.ok(sec.includes(needle), needle);
  });
});

describe("Vague Gate VG9: the verifier can see that the lead named the format", () => {
  it("Vague Gate VG9 S17's classification in the prompt carries format_requested, and S13's is empty", () => {
    assert.ok(build("S17").includes("\"format_requested\": \"a solo guitarist\""));
    assert.ok(build("S13").includes("\"format_requested\": \"\""));
    assert.equal(sectionOf(form("S17"), "6b"), VAGUE_6B);
  });
});

describe("Vague Gate VG11: a generic format_requested word is not a format anchor", () => {
  it("Vague Gate VG11 S18 (format_requested = live music) is in the mode, the text names the generic words, and S17 differs from S18 only in the field", () => {
    assert.ok(build("S18").includes("\"format_requested\": \"live music\""));
    const sec = sectionOf(form("S18"), "6b");
    assert.equal(sec, VAGUE_6B);
    for (const w of ["\"musician\"", "\"live music\"", "\"entertainment\"", "\"music\""]) assert.ok(sec.includes(w), w);
    assert.ok(sec.includes("names no format and is NOT an anchor"));
    assert.ok(sec.includes("Fail (a generic word only, format_requested = \"live music\")"));
    // bounded inventory of the accepted anchor: S17 (a concrete named format) and the rejected generic S18 share one text
    assert.equal(sectionOf(form("S17"), "6b"), sec);
  });
});

describe("Vague Gate VG10: production call sites omit the option", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === "fixtures" ? [] : walk(p)) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });

  // Every use of the identifier `verifyGate` in a source file, classified. Allowed: the declaration, a plain import
  // specifier (no `as` alias), and a direct call. Anything else (an alias, a re-export, an assignment, passing it as an
  // argument) is a use this guard cannot reason about, so it FAILS. Bounded limit, stated: a NEW module that wraps the
  // gate by calling a DIFFERENT function (not `verifyGate`) is not seen; the three direct calls are the inventory.
  const classify = (text: string, fileName: string) => {
    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
    const calls: Array<{ where: string; args: number; mentionsOpeningRule: boolean }> = [];
    const other: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && node.text === "verifyGate") {
        const parent = node.parent;
        const where = `${fileName}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        if (ts.isCallExpression(parent) && parent.expression === node) {
          calls.push({ where, args: parent.arguments.length, mentionsOpeningRule: parent.getText().includes("openingRule") });
        } else if (ts.isFunctionDeclaration(parent) && parent.name === node) {
          // the declaration
        } else if (ts.isImportSpecifier(parent) && !parent.propertyName && parent.name === node) {
          // a plain import
        } else {
          other.push(`${where} (${ts.SyntaxKind[parent.kind]})`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return { calls, other };
  };

  it("Vague Gate VG10 exactly three verifyGate calls in src (parsed), three arguments, no openingRule, and no alias, re-export or other use", () => {
    const calls: string[] = [];
    const other: string[] = [];
    for (const f of walk("src")) {
      const r = classify(readFileSync(f, "utf-8"), f);
      for (const c of r.calls) {
        assert.equal(c.args, 3, `${c.where} passes ${c.args} arguments`);
        assert.ok(!c.mentionsOpeningRule, `${c.where} mentions openingRule`);
        calls.push(c.where);
      }
      other.push(...r.other);
    }
    assert.deepEqual(other, [], "an alias, re-export or other use of verifyGate in production source");
    assert.equal(calls.length, 3, calls.join("\n"));
  });

  it("Vague Gate VG10 control: the guard finds a multiline call, ignores a string and a comment, and flags an alias, a re-export and an assignment", () => {
    const direct = classify('const a = "verifyGate(x, y, z, { openingRule: 1 })"; // verifyGate(a, b, c, d)\nawait verifyGate(\n  drafts,\n  c,\n  p,\n  { openingRule: "default" },\n);', "x.ts");
    assert.deepEqual(direct.calls.map((c) => c.args), [4]);
    assert.deepEqual(direct.other, []);
    const alias = classify('import { verifyGate as vg } from "./pipeline/verify.js";\nexport { verifyGate } from "./pipeline/verify.js";\nconst f = verifyGate;', "y.ts");
    assert.equal(alias.other.length, 3, alias.other.join(", "));
    // positive control: the real declaration and the real import are allowed
    const real = classify('export async function verifyGate(a: number) { return a; }\nimport { verifyGate } from "./v.js";', "z.ts");
    assert.deepEqual(real.other, []);
  });
});
