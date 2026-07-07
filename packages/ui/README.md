# @claimgate/ui

Controlled React primitives for ClaimGate review surfaces.

## Boundary

- Props in, callbacks out: host apps own claim state, reviewer decisions, and projection authority.
- Components do not score truth, verify facts, project claims, call servers, or store hidden review state.
- Copy uses source, reviewer, evidence, and projection language. It must not imply that AI verified a fact.

## Components

- `RiskQueue` — deterministic risk-trace queue ordered red/yellow/green.
- `DualReviewConsole` — reviewer action surface for source-grounded decisions.
- `SourceAnchorViewer` — original-source anchor display.
- `ClaimDiffPanel` — candidate/source/reviewer value comparison.
- `CorrectionSuggestionPanel` — reviewer correction proposal actions.
- `EvidencePackPreview` — verified/corrected-only projection preview.
- `FakeWorkReductionStats` — operational estimate after green sampling cost.
- `ReviewShell` — minimal invariant shell retained from scaffold.

## Development

```bash
pnpm --filter @claimgate/ui test
pnpm --filter @claimgate/ui build
```
