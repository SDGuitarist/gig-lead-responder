---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - performance-oracle
  - architecture-strategist
  - code-simplicity-reviewer
---

## Review Context

TypeScript/Node/Express app — 5-stage AI pipeline for generating gig lead responses.
Branch `feat/gig-lead-pipeline` adds the entire pipeline from scratch (greenfield).
Key risk: solo/duo rates were estimated and have been corrected. Pipeline uses Claude API
for classification, generation, and verification with a rewrite loop.
Feed-Forward risk: portal automation fragility and pipeline never being live-tested (now resolved).
