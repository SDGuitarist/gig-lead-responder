# Brainstorm: Verified-False Handler

**Date:** 2026-02-21
**Status:** Ready for planning

## Problem

When the pipeline returns `verified: false` (all 3 generate+verify attempts
exhausted), the draft still outputs with no guard rail. Nothing downstream
distinguishes it from a `verified: true` response. If auto-send is ever wired
up, an unverified draft goes out just like a verified one.

**Current behavior:** `verified: false` only affects:
- Console label: `(unverified — best attempt)`
- Confidence score: loses 20 points
- JSON output: `verified` field is `false`

No branching logic. No hold. No review queue.

## What We're Building

A handler that intercepts `verified: false` drafts and routes them through
human review before sending, with a 10-minute auto-send timer as a fallback
so leads don't go cold.

**Flow:**
1. Pipeline finishes with `verified: false`
2. Draft is flagged as "needs review" with fail reasons, confidence score,
   and a 10-minute deadline
3. If the user approves/edits within 10 min → send their version
4. If the timer expires → auto-send the best attempt anyway

**Rationale:** A late response to a lead is worse than an imperfect response.
The 3-attempt retry loop already means the draft is the best the pipeline can
produce — holding it indefinitely waiting for human review loses the lead.

## Key Decisions

### Review interface: Dashboard (future), terminal (now)

End goal is a web dashboard showing queued drafts with approve/edit/reject
buttons, confidence score, fail reasons, and classification context side by
side. But there's no auto-send yet — leads are run manually from the terminal.

**Decision:** Design the handler interface so the review mechanism is
swappable. Build a terminal placeholder first (console prompt with
approve/edit/reject), upgrade to dashboard later without throwing anything away.

### Timer behavior: 10-minute auto-send

If no human action within 10 minutes, send the best attempt. This prevents
the review step from becoming a bottleneck. The assumption is that the draft
passed some gut checks (just not all 8/10) and is better than no response.

**Open question:** Should the timer be configurable? Should `no_viable_scope`
redirects have a different timer (or no auto-send at all, since a bad redirect
could burn the relationship)?

### What "send" means

There's no send mechanism yet. For now, "send" just means "output to console
as approved." The handler should emit a structured event that a future send
layer can consume.

## Approach

Build in two layers:

1. **ReviewEvent interface** — structured object emitted when `verified: false`,
   containing the draft, gate result, classification, confidence score, and
   deadline timestamp. This is the contract between pipeline and review UI.

2. **Terminal handler** — reads ReviewEvent, prints the draft + fail reasons,
   prompts for approve/edit/reject. Starts a 10-min countdown. This is the
   swappable piece — dashboard replaces it later.

`verified: true` drafts skip the handler entirely and go straight to output
(or future auto-send).

## What We're NOT Building (YAGNI)

- Dashboard UI (future phase)
- SMS/Twilio notification (evaluated, rejected for now — clunky editing via text)
- Automatic escalation to a different template on failure
- Retry with a different model or temperature
- Persistent review queue / database (terminal handler is ephemeral)

## Open Questions

1. ~~Should `no_viable_scope` redirects have a longer timer or skip auto-send?~~
   **Resolved: Skip auto-send for `no_viable_scope` redirects.** A bad redirect
   ("you can't afford me") burns the relationship permanently — there's no
   second chance. A late redirect is less damaging than a poorly worded one.
   These are also low-budget leads unlikely to convert, so the urgency to
   respond instantly is lower.

2. ~~Should low-confidence verified drafts also get flagged?~~
   **Resolved: No — only flag `verified: false`.** Low confidence on a simple
   lead just means there was nothing complex to activate (no stealth premium,
   no competition, no concerns). The draft is fine — the score reflects pipeline
   activation, not draft quality. If verified drafts turn out to be bad in
   practice, that's a verify gate calibration issue, not a handler issue.

3. When the dashboard exists, should verified drafts show up there too (for
   optional review), or only unverified ones?

## Three Questions

1. **Hardest decision in this session?** Timer auto-send vs indefinite hold.
   Auto-send accepts the risk of sending an imperfect draft; indefinite hold
   accepts the risk of losing the lead. Chose auto-send because the pipeline's
   best attempt after 3 tries is likely decent — it just didn't clear the
   verification bar.

2. **What did you reject, and why?** SMS notification as the review interface.
   It's the fastest to respond to, but editing a multi-paragraph draft via text
   reply is painful, and it requires Twilio infrastructure that doesn't exist yet.

3. **Least confident about going into the next phase?** Whether the 10-minute
   timer is the right default. Too short and you never catch it; too long and
   the lead goes cold. Might need real-world data to calibrate.
