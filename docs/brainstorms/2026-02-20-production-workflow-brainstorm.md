---
title: "Production Workflow — Automated Lead Response"
date: 2026-02-20
supersedes: docs/brainstorms/2026-02-20-production-loop-brainstorm.md
handoff: docs/SYSTEM_ARCHITECTURE_HANDOFF.md
---

# Production Workflow Brainstorm

## What We're Building

A fully automated lead response system across 4 channels (Squarespace, Yelp, The Bash, GigSalad) that wraps the existing 5-stage AI pipeline in delivery infrastructure. High-confidence drafts auto-send. Low-confidence drafts wait for Alex's approval via SMS.

## Why This Approach (Not the Previous One)

The previous architecture (Mailgun inbound email parsing) was built on a false premise: that platform notification emails contain lead data. They don't. GigSalad emails say "Eilynn would like a quote for a Funeral/Memorial Service on March 19, 2026" — no venue, no budget, no guest count, no details. The actual lead data lives behind platform login.

**New approach:** Use Gmail watch to detect notification emails, then either:
- Reply directly (Yelp email reply, Squarespace Gmail API reply) — zero risk
- Follow token link with Playwright bot to scrape lead data and submit quote — medium risk, Phase 2

## Key Decisions Made

1. **Phased build order:** Squarespace + Yelp first (zero risk), The Bash second, GigSalad third
2. **Auto-send with confidence gate:** Pipeline's own verification gate determines confidence. High = auto-send after timer. Low = hold for human.
3. **Timer split:** 5 min (platform leads), 30 min (direct leads)
4. **Bot risk accepted conditionally:** Research runs in parallel. Decision after Agent 1 returns findings.
5. **Reviews backup:** Screenshot and download platform reviews before any bot goes live
6. **Audit plan:** Log all auto-sends with confidence scores. Validate threshold after 30 days.

## What Was Invalidated

- Mailgun inbound email parsing (emails have no lead data)
- iOS Shortcut leading hypothesis (superseded by full automation)
- Manual copy-paste as unavoidable (Playwright can submit quotes)

## Open Questions (For Research Agents)

1. Do The Bash / GigSalad use bot detection? What's the suspension risk?
2. Do email token links expire? What's the window?
3. Does Squarespace support native form webhooks?
4. Does Yelp reply-by-email actually work for vendor responses?
5. What's the 1/9 gut check failure mode in the pipeline?
6. What's the actual first-responder advantage on these platforms?

## Next Steps

1. Run 5 research agents in parallel (see SYSTEM_ARCHITECTURE_HANDOFF.md)
2. Plan Phase 1 (Squarespace + Yelp — zero risk, highest conversion)
3. Build Phase 1 while research completes
4. Make bot go/no-go decision after Agent 1 returns
