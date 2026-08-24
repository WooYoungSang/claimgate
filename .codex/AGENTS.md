# ClaimGate Codex Harness

- Active model target: `gpt-5.6-sol`.
- Context/design SSOT: `./kbctl` over `governance/knowledge/claimgate-kb.json`.
- Query the KB before architecture, DDD, refactor, contest, or demo work.
- Use narrow subagents from `.codex/agents` only when they improve quality or speed.
- Keep hooks deterministic and local.
- Preserve ClaimGate invariants: No Anchor, No Claim; AI Curator, Not Judge; deterministic risk; Evidence Pack First; core purity.
