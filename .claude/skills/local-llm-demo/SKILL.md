---
name: local-llm-demo
description: Use for Gemma/Ollama/RAG demo wiring while preserving AI Curator, Not Judge.
---

# ClaimGate local LLM demo preparation

1. Query `./kbctl` first for relevant decisions, questions, scenarios, rules, terms, events, commands, aggregates, use cases, and workpackets.
2. If behavior is unknown, create or update a Knowledge Gap with `./kbctl create question ...` / `./kbctl update question ...`.
3. Make only scoped repo changes.
4. Verify with `./kbctl verify` plus the smallest relevant project command.
5. Report changed files and evidence.
