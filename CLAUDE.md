# ClaimGate Claude/Codex Guide

This repository uses `AGENTS.md` as the primary agent guide. The same rules apply here:

- Use `./kbctl` and `governance/knowledge/claimgate-kb.json` as the repo-local context and design authority.
- Keep ClaimGate offline, deterministic, fixture-first, and source-grounded.
- Preserve the core invariants: No Anchor, No Claim; AI Curator, Not Judge; deterministic risk; Evidence Pack First; core purity.
- Do not call private lifecycle or operator MCP services for project context. Replace repo-local context lookups with `./kbctl` queries.
- Verify with the smallest relevant command before claiming completion.
