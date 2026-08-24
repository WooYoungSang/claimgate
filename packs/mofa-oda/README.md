# @claimgate/pack-mofa-oda

Deterministic MOFA/KOICA ODA public-data DomainPack for ClaimGate.

Current scope is offline fixture-only:

- `mofa-country-safety-mismatch` — MOFA country safety warning mismatch, `red/conflict`.
- `koica-project-period-mismatch` — KOICA cooperation project period mismatch, `yellow/needs-evidence`.
- `koica-oda-term-definition-match` — KOICA ODA glossary definition match, `green/needs-evidence`.

The public data portal URLs are provenance metadata. This pack does not call live OpenAPI/file endpoints, does not claim production public-data freshness, and does not let AI judge truth.

Verify with:

```bash
pnpm --filter @claimgate/pack-mofa-oda test
pnpm test/conformance
```
