# @claimgate/pack-health-data

Deterministic health public-data DomainPack for ClaimGate.

- Fixture: `health-vaccination-stale-period`
- Rule: `health.stale-period`
- Anchor kind: `dataset-row`
- Boundary: offline fixture only; no live API call.

Verify with:

```bash
pnpm --filter @claimgate/pack-health-data test
pnpm test/conformance
```
