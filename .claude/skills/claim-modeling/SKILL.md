---
name: claim-modeling
description: Use for DDD/domain modelling, knowledge gaps, language, events, invariants, aggregates, and use cases.
---

# ClaimGate DDD modelling through kbctl

1. Query `./kbctl` first for relevant decisions, questions, scenarios, rules, terms, events, commands, aggregates, use cases, and workpackets.
2. If behavior is unknown, create or update a Knowledge Gap with `./kbctl create question ...` / `./kbctl update question ...`.
3. Make only scoped repo changes.
4. Verify with `./kbctl verify` plus the smallest relevant project command.
5. Report changed files and evidence.
