# @claimgate/pack-civic-data

Deterministic civic public-data DomainPack for ClaimGate.

- Fixture: `civic-budget-mismatch`
- Rule: `civic.budget-variance`
- Anchor kind: `dataset-row`
- Boundary: offline fixture only; no live API call.

Verify with:

```bash
pnpm --filter @claimgate/pack-civic-data test
pnpm test/conformance
```
