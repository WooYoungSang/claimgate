# UC-1 ReviewLocalGemmaCandidateIntoEvidencePack

## Input

- AI answer text or document text.
- RAG corpus, currently MOFA ODA fixtures.
- RTX 4090 Local Gemma/Ollama extractor. Automated tests may stub the Ollama response, but the product path is not mock-based.
- Reviewer identity.

## Actor

- Public-data reviewer.
- Local Gemma/RAG extractor is an upstream candidate proposer, not an authority actor.

## Flow

1. `ExtractCandidateClaims`
   - Extractor returns `CandidateClaim[]`.
   - Boundary rejects authority leaks.
   - Event: `CandidateClaimsExtracted`.
2. `CreateExtractedClaimFromCandidate`
   - Candidate becomes `Claim` in `extracted` state only.
   - Event: `ClaimCreatedAsExtracted`.
3. `AttachSourceAnchor`
   - Source Anchoring Workflow accepts or rejects `proposedAnchor`/retrieved source.
   - Accepted anchor becomes primary `SourceAnchor`.
   - Event: `SourceAnchorAttached`.
4. `ApplyRiskDisposition`
   - Deterministic risk rule emits non-empty trace and review state.
   - Event: `RiskDispositionApplied`.
5. `ApplyReviewerCorrection` or `VerifyClaim` / `RejectClaim`
   - Reviewer makes terminal decision.
   - Event: `ClaimCorrectedByReviewer` / future event names.
6. `CreateEvidencePack`
   - Projectable claims only.
   - Extraction provenance copied as metadata, not authority.
   - Event: `EvidencePackCreated`.
7. Report and graph derive from Evidence Pack Snapshot.

## Failure paths

| Failure | Expected behaviour |
|---|---|
| Extractor returns risk/reviewer/projection fields | Reject with authority leak error. |
| RAG no-hit | Do not verify. `assessRagGrounding` chooses fail-extraction or extracted needs-evidence candidate depending host setting. |
| RAG conflict | `retainRagConflictCandidate` keeps extracted candidate input; deterministic risk/reviewer workflow resolves conflict. |
| Proposed anchor not accepted | Claim remains unanchored/non-terminal; no projection. |
| Missing reviewer | Terminal transition fails. |
| Missing source metadata | Evidence Pack creation fails. |
| Local Gemma unavailable | Demo fails loud; recording is blocked until the RTX 4090 local Ollama/Gemma endpoint is restored. |

## Acceptance tests to add before destructive code move

- valid local extractor output becomes extracted Claim only;
- proposed anchor is not automatically attached;
- accepted proposed anchor goes through Source Anchoring Workflow;
- provenance appears in audit/pack metadata without authority;
- EvidencePack snapshot remains stable after later Claim copy changes;
- DONE: RAG no-hit and conflict paths are explicit;
- mock and optional local Gemma paths still satisfy the same boundary.
