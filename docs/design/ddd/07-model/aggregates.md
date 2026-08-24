# Aggregates — S-1

Aggregate boundaries are derived from invariants, not object affinity.

## AGG-1 Claim

Root: `Claim`

Consistency boundary:

- lifecycle state;
- primary `SourceAnchor`;
- source value / AI value;
- correction record;
- extraction provenance references in audit/metadata;
- reviewer decision version;
- audit trail.

Protects:

- R-1, R-2, R-3, R-5, R-9, R-10, R-11, R-12, R-14.

Allowed operations:

- create extracted Claim from accepted CandidateClaim;
- attach accepted Source Anchor;
- apply deterministic risk disposition;
- transition to reviewer terminal decision;
- record correction.

Forbidden operations:

- promote `proposedAnchor` automatically;
- terminal decision without reviewer;
- projection from extracted/anchored/rejected;
- mutation of prior claim snapshot;
- composite multi-fact claim pretending one anchor proves all facts; use `decomposeCompositeClaimDraft` before Claim review.

## AGG-2 EvidencePack

Root: `EvidencePackSnapshot` / current `EvidencePack` implementation.

Consistency boundary:

- generated timestamp;
- referenced Sources;
- projectable claim items;
- extraction provenance metadata;
- immutable snapshot identity;
- supersede/reissue lifecycle relation as a new snapshot;
- revocation as a separate immutable lifecycle record.

Protects:

- R-4, R-12, R-13.

Allowed operations:

- create snapshot from projectable claims and sources;
- render report/graph from snapshot;
- supersede/reissue by a new snapshot;
- record revocation as a separate lifecycle record without mutating the snapshot.

Forbidden operations:

- mutate existing pack after generation;
- include non-projectable claim;
- treat Local Gemma metadata as verification authority.

## AGG-3 DomainPackPolicy

Root candidate: `DomainPack` as policy carrier, possibly split later.

Consistency boundary:

- domain risk rule set;
- expected fixture results;
- report template labels;
- sampling policy recommendation.

Protects:

- R-5, R-15.

Allowed operations:

- evaluate domain rule deterministically;
- provide policy recommendation to host/core mechanism;
- pass conformance tests.

Forbidden operations:

- bypass core projection guard;
- write terminal reviewer decisions;
- mutate Claim lifecycle directly.

## Model lock note

`ExtractionProvenance` is a Value Object copied into both Claim creation audit text and Evidence Pack metadata. `DomainPackPolicy` carries only recommendations; host code must explicitly choose whether to apply them through the core queue mechanism.
