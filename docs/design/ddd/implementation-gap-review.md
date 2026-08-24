# ClaimGate DDD Implementation Gap Review — S-1

Status: first-pass DDD review for the scenario `S-1 Local Gemma/RAG 후보 주장 → Evidence Pack 검토`.

Canonical modelling records live in `governance/knowledge/claimgate-kb.json`; generated views are under `docs/design/ddd/**`.

## Scenario under review

```text
사용자가 AI 답변 또는 문서에서 후보 주장 추출을 요청한다.
Local Gemma 4 12B + RAG extracts candidate claims only.
ClaimGate attaches Source Anchors, applies deterministic risk rules, records reviewer decisions, and projects only verified/corrected claims into Evidence Pack/report/graph.
```

## Confirmed implementation facts

| Area | Fact | Evidence |
|---|---|---|
| AI boundary | Extractors return `CandidateClaim[]`; authority-smuggling fields such as risk, reviewer decision, projection, or attached anchor are rejected. | `packages/core/src/extraction.ts:32-60`, `packages/core/src/extraction.ts:90-111`, `packages/core/test/extraction.test.ts:58-132` |
| Claim lifecycle | Current state flow is `extracted -> anchored -> needs-evidence/conflict/aggregate-only -> verified/corrected/rejected`. | `packages/core/src/claim.ts:4-12`, `packages/core/src/verification.ts:34-43` |
| No Anchor, No Claim | `verified` and `corrected` require a Source Anchor. | `packages/core/src/verification.ts:45-67`, `packages/core/test/verification-state-machine.test.ts:79-103` |
| Reviewer terminal guard | Terminal decisions require a reviewer; projection also checks reviewer audit integrity. | `packages/core/src/verification.ts:61-72`, `packages/core/src/projection-guards.ts:55-80` |
| Evidence Pack First | Evidence Packs filter to projectable verified/corrected claims and fail fast if referenced sources are missing. | `packages/core/src/evidence.ts:43-85`, `packages/core/test/evidence-pack.test.ts:58-142` |
| Deterministic risk | Risk rejects AI-provided risk scores and requires non-empty rule traces. | `packages/core/src/risk/index.ts:130-194` |
| Local Gemma/RAG demo adapter | `packages/ai-local` now owns the Ollama-compatible local model adapter, persistent sparse-vector RAG index, and candidate-only tuning dataset helpers; `scripts/ai-claim-demo.ts` composes them with the MOFA ODA vertical slice. Automated tests use test-double Ollama responses only. | `packages/ai-local/src/index.ts`; `packages/ai-local/test/adapter.test.ts`; `scripts/ai-claim-demo.ts`; `scripts/build-local-rag-index.ts`; `scripts/build-gemma-tuning-dataset.ts` |
| MOFA ODA pack | MOFA ODA fixtures and deterministic rules cover country safety, project mismatch, and ODA term definition. | `packs/mofa-oda/src/index.ts:95-236` |

## Implicit bounded contexts

| Context | Current code surface | Model assessment |
|---|---|---|
| Claim Review Context | `claim.ts`, `verification.ts`, `risk/index.ts`, `audit.ts` | Strongest core context. It already protects state transition, anchor, correction, and reviewer audit invariants. |
| Extraction Context | `extraction.ts`, `scripts/ai-claim-demo.ts` | Boundary exists as `@claimgate/ai-local`; the demo script remains an application composition slice rather than the adapter owner. |
| Source Evidence Context | `source-anchor.ts`, `evidence.ts` | Anchor value objects are strong; Source identity/provenance lifecycle is still thin. |
| Domain Pack Context | `domain-pack.ts`, `packs/*` | Pack contract exists. Policy ownership for green sampling and domain-specific reviewer rules needs clarification. |
| Projection Context | `projection-guards.ts`, `projectors/*`, `evidence.ts` | Projection guard is strong; Evidence Pack supersede/reissue/revocation lifecycle is now explicitly modelled as immutable follow-up records. |
| Review UI Context | `packages/ui/*`, `examples/civic-review-app/*` | UI is controlled-component oriented. It composes state but is not a domain owner. |

## Current design holes / Knowledge Gaps

These are now recorded in kbctl as `KG-*` and linked to `R-*`/`M-*` records.

| Gap | Why it matters | KB |
|---|---|---|
| Proposed anchor promotion policy needed executable workflow. | DONE: `acceptSourceAnchor`, `acceptProposedSourceAnchor`, and `rejectProposedSourceAnchor` make reviewer/source workflow acceptance explicit before final Source Anchor attachment. | `KG-1`, `R-9`, `M-2`, `D-037`; `packages/core/src/source-anchor-workflow.ts`; `packages/core/test/source-anchor-workflow.test.ts` |
| RAG no-hit/conflict policy needed reusable API. | DONE: `assessRagGrounding`, `assertRagGroundingForExtraction`, `createNoHitNeedsEvidenceCandidate`, and `retainRagConflictCandidate` make no-hit/conflict behavior explicit without granting evidence authority. | `KG-2`, `R-14`, `D-040`; `packages/ai-local/src/index.ts`; `packages/ai-local/test/adapter.test.ts` |
| Concurrent reviewer terminal decisions needed an explicit v0 policy/API. | DONE: `claimReviewVersion` exposes the append-only audit length, `applyTerminalReviewerDecision(expectedVersion)` rejects stale/second terminal decisions, and `ClaimRepository.save(expectedVersion)` models future compare-and-set persistence without adding a server/DB. | `KG-3`, `R-10`, `M-3`, `D-041`, `D-044`; `packages/core/src/verification.ts`; `packages/core/src/claim-repository.ts`; `packages/core/test/verification-state-machine.test.ts`; `packages/core/test/claim-repository.test.ts` |
| Local tuning provenance needed reusable audit/metadata model. | DONE: `buildExtractionProvenanceMetadata`, `extractionProvenanceActorId`, and `extractionProvenanceAuditReason` preserve provider/model/adapter/prompt/RAG/tuning-card provenance in candidate-only Evidence Pack metadata and Claim creation audit. | `KG-4`, `R-12`, `D-042`; `packages/core/src/extraction-provenance.ts`; `packages/core/test/extraction-provenance.test.ts`; `scripts/ai-claim-demo.ts` |
| Evidence Pack lifecycle needed explicit immutable follow-up records. | DONE: generated packs remain immutable; supersede/reissue creates a new `generated-with-supersedes` snapshot; revoke returns a separate immutable revocation record. | `KG-5`, `M-1`, `D-038`; `packages/core/src/evidence.ts`; `packages/core/test/evidence-pack.test.ts` |
| Green sampling ownership needed explicit pack/host boundary. | DONE: core owns deterministic queue mechanics; DomainPack can publish `greenSamplingPolicyRecommendation`; host code must intentionally pass `greenSamplingOptionsFromDomainPack` or custom options. | `KG-6`, `R-15`, `D-043`; `packages/core/src/domain-pack.ts`; `packages/core/src/risk/index.ts`; `packages/conformance/src/index.ts`; `packs/mofa-oda/src/index.ts` |
| Multi-anchor composite claims needed safe decomposition. | DONE: `decomposeCompositeClaimDraft` turns a multi-fact draft into extracted atomic `CandidateClaim[]`; each atom can carry at most one proposed anchor and authority fields still fail loud. | `KG-7`, `R-11`, `M-4`, `D-039`; `packages/core/src/atomic-claim.ts`; `packages/core/test/atomic-claim.test.ts` |
| Documentation used to carry older “no model call in v0” language. | The repo now has a verified RTX 4090 local Gemma demo path in `scripts/ai-claim-demo.ts`; docs must distinguish local candidate extraction from hosted LLM, LLM-as-judge, production vector RAG, and fine-tuning claims. | `docs/ai-extraction-boundary.md`, `docs/package-boundaries.md`, `docs/demo/*` |
| Local Gemma adapter package exists and source-anchor acceptance is first-class. | DONE: `@claimgate/ai-local` owns local Ollama/RAG guards; `@claimgate/core` owns reviewer/source workflow acceptance; the MOFA demo composes both. | `packages/ai-local/src/index.ts`; `packages/core/src/source-anchor-workflow.ts`; `scripts/ai-claim-demo.ts` |

## Aggregate assessment

### `Claim` aggregate — mostly present

Current implementation already behaves like a `Claim` aggregate:

- state, anchor, correction, and audit move together;
- external code cannot validly jump to terminal/projected states through public APIs;
- tests cover malformed forged states at projection time.

Boundary note: aggregate is function-based immutable data, not class-based. That is acceptable in TypeScript, but application/repository code must call `applyTerminalReviewerDecision` with the current `claimReviewVersion` and persist through the repository contract instead of bypassing it with object spreads.

### `EvidencePack` aggregate/snapshot — implemented for v0 lifecycle

`createEvidencePack` creates deterministic pack output and protects projectability. `supersedeEvidencePack`/`reissueEvidencePack` create new immutable snapshots with `generated-with-supersedes` lifecycle, and `revokeEvidencePack` records revocation separately without mutating the original pack. Extraction provenance is candidate-only metadata, not authority. Remaining lifecycle work is registry/repository storage policy once server/persistence exists.

### `DomainPackPolicy` — implemented as pack-owned policy recommendation

`DomainPack` owns deterministic rule semantics, fixture expectations, report labels/templates, and optional green sampling policy recommendations. Core owns the generic mechanism and conformance guard; the host application decides whether to adopt the pack recommendation or supply an explicit override.

This closes the earlier ambiguity: no hidden global sampling default exists in core.

## First vertical slice to harden next

Choose one use case only:

```text
UC-1 ReviewLocalGemmaCandidateIntoEvidencePack
```

Recommended implementation hardening order:

1. Keep `@claimgate/ai-local` outside core and continue using it as the first-class local adapter boundary.
2. Extend tests that simulate a Gemma response with:
   - valid `CandidateClaim[]`;
   - authority leak;
   - malformed JSON;
   - proposed anchor that is not automatically attached.
3. DONE: Add explicit domain records/tests for proposed-anchor acceptance:
   - proposed anchor accepted by reviewer/source workflow;
   - proposed anchor rejected but candidate retained;
   - generic accepted source anchor is attached by reviewer authority, not AI authority.
   DONE: broaden no-hit/conflict policy into `@claimgate/ai-local` RAG grounding policy APIs.
4. DONE: Preserve Evidence Pack metadata and Claim creation audit for extractor provenance without making AI authoritative:
   - model tag;
   - RAG corpus ids;
   - prompt/tuning card version;
   - adapter id.
5. Update public docs to say:
   - automated tests use test-double Ollama responses while the video path is real RTX 4090 local Gemma;
   - optional recording path is local Gemma/Ollama runtime;
   - fine-tuned model is supported by local model tag, not currently trained in-repo.

## Current verdict

The core trust model is stronger than the product docs imply: the S-1 DDD model is now implemented and tested for the local/demo slice. The biggest DDD holes are no longer source-anchor promotion, Evidence Pack lifecycle, atomic decomposition, RAG no-hit/conflict policy, v0 reviewer-decision concurrency, extraction provenance, or green sampling ownership.

The next safe move is not to widen the domain model again. It is product/engineering hardening: keep `UC-1` stable, record the real submission video, optionally train/register a real local Gemma model tag, and only then implement a persistence adapter/server that honors the already-defined repository contract.
