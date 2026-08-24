# Bounded Contexts — S-1

Status: DDD Step 12 output for `S-1 Local Gemma/RAG 후보 주장 -> Evidence Pack 검토`.

## Context split

| Bounded Context | Owns | Does not own | Current code surface | Main invariants |
|---|---|---|---|---|
| Extraction Context | `CandidateClaim`, `Proposed Anchor`, `Extraction Provenance`, local Gemma/RAG adapter contract | Source Anchor attachment, risk scoring, reviewer decision, projection | `packages/core/src/extraction.ts`, `packages/ai-local/src/index.ts`, `scripts/ai-claim-demo.ts` | R-1, R-9, R-12, R-14 |
| Claim Review Context | `Claim` lifecycle, primary Source Anchor, source-anchor acceptance workflow, correction, reviewer terminal transition, claim review version, audit trail | Evidence Pack snapshot lifecycle, domain-specific risk semantics, UI state, repository compare-and-set persistence | `packages/core/src/claim.ts`, `source-anchor-workflow.ts`, `verification.ts`, `audit.ts`, `risk/index.ts` | R-2, R-3, R-5, R-9, R-10, R-11 |
| Source Evidence Context | `Source`, `SourceAnchor`, source locator/checksum/excerpt identity | AI extraction, reviewer decision, report rendering | `packages/core/src/source-anchor.ts`, `evidence.ts` | R-2, R-9, R-11 |
| Domain Pack Policy Context | Domain-specific risk rules, fixture expectations, labels, sampling-policy recommendations | Core generic lifecycle guard, UI rendering authority | `packages/core/src/domain-pack.ts`, `packs/*` | R-5, R-15 |
| Evidence Projection Context | `EvidencePackSnapshot`, projection guard, report/graph derivation | Claim mutation, AI extraction, pack-specific risk semantics | `packages/core/src/evidence.ts`, `projection-guards.ts`, `projectors/*` | R-4, R-12, R-13 |
| Review UI Context | Controlled React display and callbacks | Domain decisions, risk authority, projection eligibility | `packages/ui/*`, `examples/civic-review-app/*` | mirrors core; owns no invariant directly |

## Same word, different meaning

| Word | Meaning in context A | Meaning in context B | Boundary rule |
|---|---|---|---|
| Anchor | Extraction: `proposedAnchor`, untrusted proposal | Source Evidence/Claim Review: accepted `SourceAnchor` | Proposed Anchor must pass Source Anchoring Workflow before Claim attachment. |
| Risk | Extraction: forbidden AI authority | Domain Pack/Claim Review: deterministic rule trace and queue disposition | AI output must never include final risk score/level. |
| Evidence | Source Evidence: raw source locator/excerpt/checksum | Evidence Projection: immutable Evidence Pack item | Reports/graphs derive from Evidence Pack Snapshot, not raw AI output. |
| Claim | Extraction: CandidateClaim | Claim Review: lifecycle-protected Claim aggregate | CandidateClaim becomes Claim only through boundary assertion. |
| Model | Local LLM runtime artifact | Domain Model | Local model provenance is metadata, never the domain model. |

## Context ownership decisions

- D-007: Source Anchor promotion belongs to Source Anchoring Workflow, not Extraction Context.
- D-008: Extraction provenance is recorded as non-authoritative metadata.
- D-009: Evidence Pack is immutable snapshot.
- D-010: v0 Claim has single primary anchor; composite claims become atomic subclaims.
- D-012: Core owns sampling mechanism; pack/host owns policy default.

## Anti-context leaks

- `packages/core` must not import `packs/*`, UI, example apps, or Local Gemma runtime dependencies.
- Extraction adapters may propose `CandidateClaim[]`; they must not transition claims.
- UI may display and request callbacks; it must not verify, score, or project claims internally.
- DomainPack may define domain risk semantics; it must not override core projection guards.
