# Security Policy

ClaimGate v0 is an offline, deterministic framework evaluation surface. It intentionally excludes production network and identity infrastructure so reviewers can inspect the trust boundary without secret handling.

## Supported scope

This repository currently supports the v0 local evaluation surface:

- pure TypeScript core contracts and invariant guards;
- controlled React UI components;
- offline DomainPack fixtures and conformance tests;
- fixture-only AI extraction adapter boundary;
- mock-only trust adapter boundary.

## Out of scope for v0

The following are not implemented and should not be treated as security-reviewed production features:

- real LLM extraction;
- OCR or general-purpose document parsing;
- server, database, auth, multitenancy, or hosted APIs;
- graph DB persistence;
- real DID wallet, issuer, verifier, blockchain, or credential network integration;
- online demos or network-dependent verification.

## Secret handling

The default repository path requires no secrets. Do not commit API keys, wallet seeds, private keys, tokens, credentials, or production data. Fixture credentials in `examples/fixtures/mock-credentials.json` are public mock data only.

## Reporting issues

For now, report security issues through the project maintainers/operators for this repository. Include:

1. affected package or doc;
2. reproduction steps using local commands when possible;
3. whether the issue can affect trust invariants such as No Anchor No Claim, AI Curator Not Judge, deterministic risk traces, Evidence Pack First, or verified/corrected-only projection.

## Evaluator security checklist

- `pnpm eval:framework` runs without secrets.
- Default verification runs without network access.
- AI adapter output remains candidate-only.
- Trust adapter output remains context-only and never replaces source anchors or reviewer decisions.
- UI components remain controlled and do not own hidden verification authority.

## Public release gate

Public visibility is a separate human-approved step. Before any repository visibility flip, reviewers must triage secret/private endpoint/private data findings and confirm that v0 still requires no API key, provider credential, database URL, auth token, local vault export, hosted service, real LLM extraction, OCR service, graph DB, or real DID wallet/issuer/verifier.

Do not include secrets, private vault exports, real credentials, production personal data, or non-public source documents in reports or committed evidence.
