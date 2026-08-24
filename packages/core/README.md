# @claimgate/core

Pure TypeScript ClaimGate trust-core scaffold. Later Bets fill in state machine, deterministic risk, source anchors, evidence packs, projection guards, and conformance.

## AI extraction boundary

`@claimgate/core` exposes the candidate-only extraction contract:

- `ClaimExtractor` returns `CandidateClaim[]`.
- `FixtureClaimExtractor` is the offline deterministic v0 adapter.
- `extractCandidateClaims` / `assertCandidateClaims` reject AI authority leaks before candidates enter the core claim workflow.
- `describeClaimExtractorBoundary("llm-adapter-boundary")` documents the future provider seam while keeping real provider calls out of v0.

AI may propose candidate claims and source-anchor proposals only. It cannot attach anchors, verify truth, score risk, decide review outcomes, or project Evidence Packs, reports, or graphs.

## Source Anchor workflow

`acceptSourceAnchor`, `acceptProposedSourceAnchor`, and `rejectProposedSourceAnchor` make Source Anchor acceptance explicit. AI extractors may return `proposedAnchor`, but reviewer/source-workflow authority must accept it before it becomes the Claim's primary `SourceAnchor`.

## Reviewer terminal decision concurrency

`claimReviewVersion` exposes the append-only audit length and `applyTerminalReviewerDecision` applies `verified`/`corrected`/`rejected` only when the optional `expectedVersion` matches. This keeps v0 single-terminal-decision behavior executable while leaving repository compare-and-set / event ordering to a future server boundary.

`createInMemoryClaimRepository` is a pure contract adapter for that future boundary: `save({ expectedVersion })` rejects stale writes and preserves the single-winner terminal reviewer decision policy without adding a server or database to v0.

## Extraction provenance

`buildExtractionProvenanceMetadata`, `extractionProvenanceActorId`, and `extractionProvenanceAuditReason` preserve local model, adapter, prompt/tuning-card, and RAG corpus provenance as candidate-only metadata/audit text. Provenance never grants verification, risk, review, or projection authority.

## DomainPack policy recommendations

Core owns deterministic risk queue mechanics. A `DomainPack` may publish `greenSamplingPolicyRecommendation`, and host code can intentionally pass it through `greenSamplingOptionsFromDomainPack`. Core does not invent a hidden global green-sampling default.


## Evidence Pack lifecycle

Evidence Packs are immutable snapshots. `supersedeEvidencePack` and `reissueEvidencePack` create new `generated-with-supersedes` snapshots, while `revokeEvidencePack` returns a separate immutable revocation record without mutating the original pack.


## Atomic Claim decomposition

`decomposeCompositeClaimDraft` converts a multi-fact draft into extracted atomic `CandidateClaim[]` entries. Each atom may carry at most one `proposedAnchor`; multi-anchor or authority-bearing parts fail loud before Claim review.
