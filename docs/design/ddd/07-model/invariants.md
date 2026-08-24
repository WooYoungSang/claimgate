# Invariants — S-1

Canonical rule records: `R-1` through `R-15` in `governance/knowledge/claimgate-kb.json`.

| Spec | Rule | Enforcement state | Evidence / next test |
|---|---|---|---|
| INV-1 | AI/LLM extractor may propose `CandidateClaim[]` only. | implemented | `packages/core/src/extraction.ts`; `packages/core/test/extraction.test.ts` |
| INV-2 | Claim cannot become `verified` or `corrected` without Source Anchor. | implemented | `packages/core/src/verification.ts`; `verification-state-machine.test.ts` |
| INV-3 | Terminal decisions require reviewer and reviewer audit for projection. | implemented | `verification.ts`; `projection-guards.ts`; `projection-guards.test.ts` |
| INV-4 | Evidence Pack/report/graph include only reviewer-audited verified/corrected claims. | implemented | `evidence.ts`; `projection-guards.ts`; `evidence-pack.test.ts` |
| INV-5 | Risk result requires deterministic non-empty rule trace and rejects AI risk score. | implemented | `risk/index.ts` |
| INV-6 | `proposedAnchor` is never automatically promoted to `SourceAnchor`; a reviewer/source workflow must explicitly accept or reject it. | implemented | D-007; `packages/core/src/source-anchor-workflow.ts`; `packages/core/test/source-anchor-workflow.test.ts`; `scripts/ai-claim-demo.ts` |
| INV-7 | v0 Claim has one primary Source Anchor; composite claims decompose into atomic candidate claims before review/projection. | implemented | D-010; D-039; `packages/core/src/atomic-claim.ts`; `packages/core/test/atomic-claim.test.ts`; multi-anchor guard tests |
| INV-8 | Local Gemma/RAG provenance is metadata, not authority. | implemented | D-042; `packages/core/src/extraction-provenance.ts`; `packages/core/test/extraction-provenance.test.ts`; `packages/ai-local/src/index.ts`; `scripts/ai-claim-demo.ts` |
| INV-9 | Evidence Pack is immutable snapshot; later changes produce a new superseding/reissued pack or a separate revocation record, never mutation of the previous snapshot. | implemented | D-009; D-038; `packages/core/src/evidence.ts`; `packages/core/test/evidence-pack.test.ts` |
| INV-10 | RAG no-hit/conflict must not be silently treated as verified evidence: no-hit is fail-extraction or extracted needs-evidence candidate, while conflict remains extracted input for deterministic risk/reviewer workflow. | implemented | D-011; D-040; `packages/ai-local/src/index.ts`; `packages/ai-local/test/adapter.test.ts`; `scripts/ai-claim-demo.ts`; `scripts/ai-claim-demo.test.mjs` |
| INV-11 | A Claim has one terminal reviewer decision. Reviewer decisions can be guarded by the append-only claim review version before applying `verified`/`corrected`/`rejected`. | implemented | D-013; D-041; `packages/core/src/verification.ts`; `packages/core/test/verification-state-machine.test.ts` |

## Non-invariant constraints

| Spec | Constraint | Owner |
|---|---|---|
| CON-1 | Local Gemma demo calls Ollama-compatible local model tag only. | Extraction adapter / demo host |
| CON-2 | Current RAG retrieval is a repo-local persistent sparse-vector index over MOFA ODA fixtures, not an external vector DB, neural embedding service, or live public-data call. | Demo host |
| CON-3 | v0 in-memory slice allows single terminal reviewer decision; core exposes an expected-version optimistic concurrency hook and pure repository contract; future persistence adapter must preserve compare-and-set / append-only event ordering. | Claim Review / future repository |
| CON-4 | Core owns green sampling mechanism; DomainPack may recommend policy; host application must explicitly pass pack or host policy into the queue. | Domain Pack Policy / host app |

## Refactor consequence

Destructive refactoring may move files only after the target invariant has a domain test. The S-1 executable invariant set is now covered for the local/demo slice. Remaining work is now implementation/product hardening outside the v0 DDD model: optional external/vector-DB retrieval, actual trained fine-tuning artifacts after strict preflight passes and the team runs LoRA training, and a real persistence adapter/server that honors the existing repository contract.
