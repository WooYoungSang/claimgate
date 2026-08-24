# Destructive DDD Refactor Roadmap

This roadmap mirrors `.omx/plans/claimgate-destructive-ddd-refactor.md` for repository readers.

## Current slice

- Scenario: `S-1 Local Gemma/RAG 후보 주장 → Evidence Pack 검토`
- Use case: `UC-1 ReviewLocalGemmaCandidateIntoEvidencePack`
- Canonical KB: `governance/knowledge/claimgate-kb.json`

## Rule

No destructive source-code refactor starts until the current behaviour is locked by tests and the affected Knowledge Gaps are either answered or explicitly deferred.

## Gate order

1. Current Reality Lock
2. Discovery Lock
3. Language/Event/Context Lock
4. Invariant/Aggregate Lock
5. Vertical Slice Implementation Model
6. Destructive Refactor Execution
7. Feedback / Metaphor Retirement

## First destructive target, after gates

DONE: Extracted a first-class Local Gemma/RAG candidate extractor and provenance boundary into `packages/ai-local` outside `packages/core`; `scripts/ai-claim-demo.ts` now composes it without granting AI risk/reviewer/projection authority.

## Commands

```bash
./kbctl verify
./kbctl render all --out .
pnpm test:kbctl
pnpm --filter @claimgate/core test -- extraction.test.ts product-manifesto-docs.test.ts
pnpm test:ai-demo
pnpm demo:ai:gemma
```
