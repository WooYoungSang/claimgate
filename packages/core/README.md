# @claimgate/core

Pure TypeScript ClaimGate trust-core scaffold. Later Bets fill in state machine, deterministic risk, source anchors, evidence packs, projection guards, and conformance.

## AI extraction boundary

`@claimgate/core` exposes the candidate-only extraction contract:

- `ClaimExtractor` returns `CandidateClaim[]`.
- `FixtureClaimExtractor` is the offline deterministic v0 adapter.
- `extractCandidateClaims` / `assertCandidateClaims` reject AI authority leaks before candidates enter the core claim workflow.
- `describeClaimExtractorBoundary("llm-adapter-boundary")` documents the future provider seam while keeping real provider calls out of v0.

AI may propose candidate claims and source-anchor proposals only. It cannot attach anchors, verify truth, score risk, decide review outcomes, or project Evidence Packs, reports, or graphs.
