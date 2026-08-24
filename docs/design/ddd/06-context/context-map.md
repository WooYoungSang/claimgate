# Context Map — S-1

```text
[Extraction Context]
  Local Gemma/RAG or mock
  -> CandidateClaimsExtracted
  -> CandidateClaim[] + ProposedAnchor? + ExtractionProvenance
        |
        | anti-corruption boundary: assertCandidateClaims
        v
[Claim Review Context]
  ClaimCreatedAsExtracted
  -> SourceAnchorAttached
  -> RiskDispositionApplied
  -> ClaimCorrectedByReviewer / ClaimVerified / ClaimRejected
        |
        | projection guard: projectable verified/corrected + reviewer audit + anchor
        v
[Evidence Projection Context]
  EvidencePackCreated
  -> EvidencePackSnapshot
  -> Report projection
  -> Graph projection
```

## Upstream/downstream relationships

| Upstream | Downstream | Contract | Notes |
|---|---|---|---|
| Extraction | Claim Review | `CandidateClaim[]` only | No risk/reviewer/projection authority crosses. |
| Source Evidence | Claim Review | `SourceAnchor` accepted by workflow | `proposedAnchor` is not enough. |
| Domain Pack Policy | Claim Review | deterministic `DomainRiskDecision` / generic `RiskResult` | Rule trace required. |
| Claim Review | Evidence Projection | projectable Claim only | verified/corrected + reviewer audit + current anchor. |
| Evidence Projection | Review UI | read-only pack/report/graph view models | UI owns presentation only. |

## Published language

Use these terms in code/docs:

- Candidate Claim
- Proposed Anchor
- Source Anchor
- Source Anchoring Workflow
- Claim
- Risk Disposition
- Reviewer Decision
- Extraction Provenance
- Evidence Pack Snapshot
- Domain Pack Policy

Do not use the discovery metaphor vocabulary as production model names.
