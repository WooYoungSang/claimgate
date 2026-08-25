# Security Policy

ClaimGate v0 is an offline, deterministic, fixture-first framework evaluation surface. It intentionally excludes production network and identity infrastructure so reviewers can inspect the trust boundary without secret handling.

## Supported versions

| Version | Supported | Notes |
|---|---:|---|
| `0.0.x` | Yes | Pre-public release readiness branch; APIs may still change before a tagged public release. |

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

The default repository path requires no secrets. Do not commit API keys, wallet seeds, private keys, tokens, credentials, production data, private vault exports, real credentials, production personal data, or non-public source documents. Fixture credentials in `examples/fixtures/mock-credentials.json` are public mock data only.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** workflow so reports are handled as private
GitHub Security Advisories. Do not open a public issue for an unpatched vulnerability. If the advisory
workflow is temporarily unavailable, use the repository owner's public GitHub profile to request a
private reporting channel without including vulnerability details in the request.

Please include:

1. affected package or file path;
2. reproduction steps using offline fixtures only when possible;
3. expected vs. actual security impact;
4. whether the issue could affect trust invariants such as No Anchor No Claim, AI Curator Not Judge, deterministic risk traces, Evidence Pack First, verified/corrected-only projection, source anchors, evidence packs, reviewer notes, or local runtime state.

## v0 security boundaries

- No network is required for runtime demos after dependencies are installed.
- No API key, provider credential, database URL, auth token, or local vault export is required for normal use.
- AI adapters may propose candidate claims/anchors only; they must not verify truth, score final risk, or project claims.
- Trust/provenance adapters are mock/offline in v0 and must not bypass Source Anchors, deterministic risk, or reviewer terminal decisions.
- Public visibility is a separate human-approved step; this readiness branch must not publish or flip repository visibility.

## Evaluator security checklist

- `pnpm eval:framework` runs without secrets.
- Default verification runs without network access.
- AI adapter output remains candidate-only.
- Trust adapter output remains context-only and never replaces source anchors or reviewer decisions.
- UI components remain controlled and do not own hidden verification authority.

## Public release gate

Before a release, maintainers must triage secret/private endpoint/private data findings and confirm that
the default v0 path still requires no API key, provider credential, database URL, auth token, local vault
export, hosted service, OCR service, graph DB, or real DID wallet/issuer/verifier. The optional Local
Gemma path must remain local and candidate-only.

Do not include secrets, private vault exports, real credentials, production personal data, or non-public source documents in reports or committed evidence.
