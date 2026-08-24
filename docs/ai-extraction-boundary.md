# AI Extraction Boundary

ClaimGate v0 treats AI extraction as a **candidate curator only**. The extractor may propose claim text, AI-observed values, and possible source anchors, but it must not verify truth, attach anchors, score risk, make reviewer decisions, or project claims.

This boundary exists so demo users can understand the offline fixture flow today and the future LLM wiring point later without confusing AI output with ClaimGate authority.

## v0 implementation

- Contract: `ClaimExtractor.extractClaims(source) -> CandidateClaim[]`.
- Offline adapter: `FixtureClaimExtractor` reads deterministic fixtures supplied by the caller.
- Fixture loader: `parseExtractionFixture` validates JSON-like fixture payloads before use.
- Boundary assertion: `extractCandidateClaims` and `assertCandidateClaims` reject authority leaks from any extractor implementation.
- Candidate conversion: `createExtractedClaimFromCandidate` / `createExtractedClaimsFromCandidates` creates core `Claim` objects in `state: "extracted"` only.
- Boundary metadata: `describeClaimExtractorBoundary("llm-adapter-boundary")` documents the future adapter mode while keeping provider calls forbidden in v0.

## Authority boundary

Allowed candidate capabilities:

- `candidate-claim-proposal`
- `source-anchor-proposal`

Allowed candidate fields:

- `id`, `text`, `subject`, `aiValue`
- `state: "extracted"`
- `proposedAnchor` (proposal only; not attached to the `Claim` until `acceptProposedSourceAnchor` or another reviewer/source workflow accepts it)
- `fixtureNotes` for deterministic demo annotations such as intentional mismatch fixtures

Forbidden candidate authority:

- terminal states (`verified`, `corrected`, `rejected`)
- attached `anchor` or `sourceValue`
- `riskScore`, `riskLevel`, `riskTrace`
- `reviewerDecision`
- Evidence Pack, Report, or Graph projection fields

Mapped authority labels exposed by core are `verify-truth`, `score-risk`, `attach-anchor`, `reviewer-decision`, and `project-evidence`. They are forbidden for both fixture and future LLM adapter modes.

The boundary preserves ClaimGate invariants: No Anchor No Claim, AI Curator Not Judge, deterministic risk with rule trace, Evidence Pack First, and verified/corrected-only projection.

## Local LLM wiring story

`@claimgate/ai-local` implements the local Ollama/Gemma `ClaimExtractor` boundary as a replacement for candidate generation only. The current submission recording path uses Local Gemma 4 12B through an Ollama-compatible endpoint on the RTX 4090 node. Automated tests may use test-double Ollama responses, but public product/demo copy must describe the real local Gemma path.

1. The provider adapter receives a source descriptor or caller-managed source text.
2. The provider adapter returns `CandidateClaim[]` with optional `proposedAnchor` values.
3. ClaimGate calls `extractCandidateClaims` or `assertCandidateClaims` before admitting those candidates.
4. `@claimgate/core` source-anchor workflow APIs accept or reject proposed anchors under reviewer/source-workflow authority; AI output alone never attaches an anchor.
5. RAG no-hit/conflict behavior is explicit: no-hit fails extraction or creates an extracted needs-evidence candidate without fabricated anchors; conflict candidates remain extracted input for deterministic risk/reviewer workflow.
6. Core creates `extracted` claims only; a separate anchoring/review workflow decides whether proposed anchors become real anchors.
7. Deterministic risk rules, reviewer transitions, Evidence Pack, report, and graph projection remain outside the AI adapter.

Any provider work must still pass the same authority-leak tests and may not grant AI verification, scoring, reviewer, or projection authority. Local model files, fine-tuned weights, and runtime services stay outside git; ClaimGate records model/RAG provenance without treating the model as a judge.

## What framework performance means

Framework performance measurements in this repository evaluate deterministic ClaimGate operations: fixture loading, state transitions, risk rules, projection guards, and demo composition. They are **not** LLM accuracy, LLM latency, prompt quality, fine-tuning quality, or extraction-quality benchmarks.

## v0 No-Go

The default v0 evaluation path explicitly excludes network LLM calls, OCR, general-purpose PDF/Excel parsing, server, DB, auth, multitenancy, hosted online demos, and non-deterministic extraction. The optional video recording path may call a local Gemma/Ollama-compatible runtime, but that runtime still has candidate-only authority and is not required for CI or clean-clone verification.
