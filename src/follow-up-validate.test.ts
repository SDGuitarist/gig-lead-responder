import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { generateFollowUpDraft } from "./pipeline/follow-up-generate.js";

// Codex round 2 (reserve/auth range), finding 1: the follow-up draft was stored as the model
// wrote it. Its prompt's rules are now enforced before it is returned; a rejected draft
// throws, and the scheduler retries it later and skips it after its retry cap.
const lead = { id: 1, follow_up_count: 0, event_type: "Wedding", event_date: null, venue: null, client_name: "Ana",
  classification_json: null, compressed_draft: "Hi Ana.", strategic_reserve_json: null } as never;
async function draftFor(text: string) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text }] })) as never);
  try { return await generateFollowUpDraft(lead); } finally { setClaudeRequesterForTests(); }
}

test("follow-up draft check: a draft that breaks the follow-up rules is rejected, never stored", async () => {
  for (const [label, text] of [
    ["price", "I could hold the date for $1,800 if that helps."],
    ["price, no symbol", "I can still do it for 900 if you book this week."],
    ["phone", "Text me at 619-555-0142 when you can."],
    ["email", "Send me a note at alex@example.com anytime."],
    ["link", "Here is a clip: https://youtu.be/abc123"],
    ["signature", "Thought of your first dance today.\nAlex Guillen"],
    ["checking in", "Just checking in on your wedding plans!"],
    ["following up", "Following up on my note about your party."],
    ["four sentences", "One. Two here. Three now. Four too."],
  ] as const) {
    await assert.rejects(draftFor(text), /follow-up draft rejected/, label);
  }
});

test("follow-up draft check: control, a normal follow-up passes as written", async () => {
  for (const ok of ["Thought of your first dance today: \"Bésame Mucho\" on solo guitar is stunning in a garden.",
    "A couple last month had 120 guests at 4:30 on a patio, and the cocktail hour flew by. Happy to share the set list."]) {
    assert.equal(await draftFor(ok), ok);
  }
});
