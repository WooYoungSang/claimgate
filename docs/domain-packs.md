# ClaimGate DomainPack Contract

ClaimGate v0 keeps trust invariants in `@claimgate/core` and domain judgment in `@claimgate/pack-*` packages.

## Boundary

- Core owns invariant types, claim state, anchors, projection guards, and the `DomainPack` TypeScript contract at `@claimgate/core/domain-pack`.
- Packs own domain labels, entity mappings, deterministic risk rules, report templates, and offline fixtures.
- `@claimgate/conformance` validates packs without importing pack code into core.
- Example apps compose a selected pack with core/UI. Swapping packs changes demo behavior without changing core or UI.

## Required pack surface

A pack must provide:

1. Metadata: `id`, `packageName`, `displayName`, `version`, `description`.
2. Labels: claim/reviewer/source copy used by apps.
3. Entity mapping: domain entity type ids and labels.
4. Anchor kinds: the source anchor shapes the pack fixtures use.
5. Risk rules: deterministic rule functions returning `level`, `recommendedState`, and non-empty rule trace.
6. Report templates: deterministic section definitions for pack-specific reports.
7. Fixtures: offline source/claim/anchor examples with expected rule outcomes.

## Conformance

Run conformance through the workspace tests:

```bash
pnpm --filter @claimgate/conformance test
pnpm --filter @claimgate/pack-civic-data test
pnpm --filter @claimgate/pack-health-data test
pnpm --filter @claimgate/pack-mofa-oda test
```

The kit checks metadata completeness, declared anchors/entities, fixture expectations, deterministic rule output, and rule traces.

## Pack-swap demo

```bash
pnpm demo
```

This runs `scripts/swap-pack-demo`, executing the same example app with `civic-data`, `health-data`, and `mofa-oda`. The three semantic story outputs must differ, proving reuse through pack swap rather than core/UI edits. The MOFA ODA pack remains an offline fixture pack: public-data URLs are provenance metadata, not live network integrations.
