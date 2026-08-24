# Implementation Model Proposal — UC-1

This is the target shape for the destructive DDD refactor. It is not yet implemented.

## Current pain

`packages/core/src/*` already protects important invariants, but boundaries are implicit and the Local Gemma/RAG adapter is now first-class in `packages/ai-local`, while the MOFA demo remains a script-level application slice. A destructive refactor should make contexts explicit without putting model runtime dependencies into core.

## Target package/context shape

```text
packages/core/src/
  claim-review/
    domain/
      claim.ts
      claim-lifecycle.ts
      reviewer-decision.ts
      correction.ts
      audit.ts
    application/
      create-extracted-claim.ts
      attach-source-anchor.ts
      apply-risk-disposition.ts
      apply-reviewer-decision.ts
  source-evidence/
    domain/
      source.ts
      source-anchor.ts
      proposed-anchor.ts
      source-anchoring-workflow.ts
  evidence-projection/
    domain/
      evidence-pack-snapshot.ts
      projection-guard.ts
    application/
      create-evidence-pack.ts
      render-report.ts
      project-graph.ts
  domain-pack-policy/
    domain/
      domain-pack.ts
      risk-rule.ts
      sampling-policy.ts
  extraction-boundary/
    domain/
      candidate-claim.ts
      extraction-provenance.ts
      claim-extractor.ts

packages/local-gemma-rag/   # or examples/local-gemma-rag if kept demo-only
  src/
    gemma-rag-extractor.ts
    lexical-rag-retriever.ts
    ollama-client.ts
    tuning-card.ts
```

## Migration order

1. Add tests for missing invariants without moving code.
2. DONE: Introduce explicit Source Anchor acceptance workflow APIs (`acceptSourceAnchor`, `acceptProposedSourceAnchor`, `rejectProposedSourceAnchor`) while keeping `CandidateClaim.proposedAnchor` as proposal-only.
3. DONE: Extract Local Gemma/RAG adapter from `scripts/ai-claim-demo.ts` into `packages/ai-local`.
4. DONE: Port demo script to call the new adapter and reviewer/source anchor acceptance workflow.
5. Split core source files into context folders while preserving public exports.
6. DONE: Delete duplicate script-local Ollama/RAG guard logic from `scripts/ai-claim-demo.ts`.
7. DONE: Add Evidence Pack supersede/reissue/revocation lifecycle APIs without mutating previous snapshots.
8. DONE: Add atomic claim decomposition API for composite drafts while preserving single-primary-anchor Claim model.
9. Run full verification.

## Compatibility policy

- Preserve existing public exports until the contest demo is stable.
- Allow internal file path moves if package export surface remains stable.
- Any intentional breaking API change needs an ADR and migration note.

## No-Go

- Do not import Local Gemma/Ollama dependencies into `packages/core`.
- Do not add server/DB/auth as part of this refactor.
- Do not model multi-anchor Claim in UC-1; decompose into atomic claims instead.
