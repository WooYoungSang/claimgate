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
- `proposedAnchor` (proposal only; not attached to the `Claim`)
- `fixtureNotes` for deterministic demo annotations such as intentional mismatch fixtures

Forbidden candidate authority:

- terminal states (`verified`, `corrected`, `rejected`)
- attached `anchor` or `sourceValue`
- `riskScore`, `riskLevel`, `riskTrace`
- `reviewerDecision`
- Evidence Pack, Report, or Graph projection fields

Mapped authority labels exposed by core are `verify-truth`, `score-risk`, `attach-anchor`, `reviewer-decision`, and `project-evidence`. They are forbidden for both fixture and future LLM adapter modes.

The boundary preserves ClaimGate invariants: No Anchor No Claim, AI Curator Not Judge, deterministic risk with rule trace, Evidence Pack First, and verified/corrected-only projection.

## Future LLM wiring story

A real LLM/parser adapter can implement `ClaimExtractor` later, but it must be a replacement for candidate generation only:

1. The provider adapter receives a source descriptor or caller-managed source text.
2. The provider adapter returns `CandidateClaim[]` with optional `proposedAnchor` values.
3. ClaimGate calls `extractCandidateClaims` or `assertCandidateClaims` before admitting those candidates.
4. Core creates `extracted` claims only; a separate anchoring/review workflow decides whether proposed anchors become real anchors.
5. Deterministic risk rules, reviewer transitions, Evidence Pack, report, and graph projection remain outside the AI adapter.

Any future provider work requires a separate Bet and No-Go review. That Bet may wire credentials, prompts, retry policy, or provider-specific parsing, but it must still pass the same authority-leak tests and may not grant AI verification, scoring, reviewer, or projection authority.

## What framework performance means

Framework performance measurements in this repository evaluate deterministic ClaimGate operations: fixture loading, state transitions, risk rules, projection guards, and demo composition. They are **not** LLM accuracy, LLM latency, prompt quality, or extraction-quality benchmarks.

## v0 No-Go

v0 explicitly excludes real LLM calls, OCR, general-purpose PDF/Excel parsing, server, DB, auth, multitenancy, online demos, and non-deterministic extraction.
