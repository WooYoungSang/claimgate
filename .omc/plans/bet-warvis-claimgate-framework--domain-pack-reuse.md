# Domain Pack Reuse Forge Plan

## UoW
- uow-warvis-claimgate-framework--domain-pack-reuse-contract-conformance-packs-demo

## Wave
1. DomainPack contract + conformance kit + two fixture packs + pack-swap demo

## Acceptance trace
- ADR-009 DomainPack extension contract
- ADR-010 Conformance testing strategy
- FR domain-pack-contract-and-console
- FR conformance-kit
- FR example-app-and-pack-swap
- NFR reusability-conformance

## File-disjoint recovery
Initial lease request including packages/core/src/index.ts conflicted with source-evidence lane. Implementation avoids index.ts and uses @claimgate/core/domain-pack subpath export.
