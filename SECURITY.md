# Security Policy

ClaimGate v0 is an offline, deterministic, fixture-first framework. It does not include a hosted service, production database, authentication system, OCR pipeline, real LLM extraction, or real DID wallet/issuer/verifier in v0.

## Supported versions

| Version | Supported | Notes |
|---|---:|---|
| `0.0.x` | Yes | Pre-public release readiness branch; APIs may still change before a tagged public release. |

## Reporting a vulnerability

Before the repository is made public, report security issues through the private project operator/reviewer channel. After a public release, the project should replace this paragraph with a public contact such as a security email address or GitHub Security Advisory workflow.

Please include:

- affected package or file path;
- reproduction steps using offline fixtures only;
- expected vs. actual security impact;
- whether the issue could leak source anchors, evidence packs, reviewer notes, or local runtime state.

Do not include secrets, private vault exports, real credentials, production personal data, or non-public source documents in reports.

## v0 security boundaries

- No network is required for runtime demos after dependencies are installed.
- No API key, provider credential, database URL, auth token, or local vault export is required for normal use.
- AI adapters may propose candidate claims/anchors only; they must not verify truth, score final risk, or project claims.
- Trust/provenance adapters are mock/offline in v0 and must not bypass Source Anchors, deterministic risk, or reviewer terminal decisions.
- Public visibility is a separate human-approved step; this readiness branch must not publish or flip repository visibility.
