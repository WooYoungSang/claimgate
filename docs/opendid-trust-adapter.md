# OpenDID Trust Adapter Boundary

ClaimGate v0 treats OpenDID/VC as an optional trust context extension, not as core verification authority.

## Boundary

- `@claimgate/core/trust-adapter` defines an offline `TrustAdapter` contract and deterministic mock credential evaluator.
- Mock credentials live in `examples/fixtures/mock-credentials.json`.
- Audit events may carry an optional `trustCredentialRef` so a reviewer decision can reference a credential context.

## Non-authority invariant

Trust signals never:

- replace Source Anchors;
- decide deterministic risk;
- verify, correct, or reject claims;
- bypass the human reviewer requirement for terminal states;
- call a DID wallet, issuer, verifier, blockchain, network service, server, DB, or auth layer.

The authoritative ClaimGate v0 chain remains:

1. Source Anchor exists.
2. Deterministic risk/rule trace classifies review context.
3. Human reviewer verifies/corrects/rejects.
4. Evidence Pack projection includes only verified/corrected claims.

## Mock-only fixture

The fixture includes public mock IDs and mock signatures only. It intentionally contains no private keys, seeds, tokens, wallets, or issuer/verifier network configuration.

Use wording such as "credential context attached" or "mock trust signal present." Do not say "DID verified the claim."
