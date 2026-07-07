# AI Extraction Boundary

ClaimGate v0 treats AI extraction as a **candidate curator only**.
The extractor may propose claim text, AI-observed values, and possible source anchors, but it must not verify truth, attach anchors, score risk, make reviewer decisions, or project claims.

## v0 implementation

- Contract: `ClaimExtractor.extractClaims(source) -> CandidateClaim[]`.
- Offline adapter: `FixtureClaimExtractor` reads deterministic fixtures supplied by the caller.
- Fixture loader: `parseExtractionFixture` validates JSON-like fixture payloads before use.
- Candidate conversion: `createExtractedClaimFromCandidate` / `createExtractedClaimsFromCandidates` creates core `Claim` objects in `state: "extracted"` only.

## Authority boundary

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

The boundary preserves ClaimGate invariants: No Anchor No Claim, AI Curator Not Judge, deterministic risk with rule trace, Evidence Pack First, and verified/corrected-only projection.

## Upgrade path

A real LLM/parser adapter can implement `ClaimExtractor` later, but it must return the same `CandidateClaim[]` contract and pass the same authority-leak tests. The adapter boundary is the only replacement point.

v0 explicitly excludes real LLM calls, OCR, general-purpose PDF/Excel parsing, server, DB, auth, multitenancy, online demos, and non-deterministic extraction.
