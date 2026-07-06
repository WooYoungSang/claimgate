# ClaimGate Package Boundaries

ClaimGate v0 is an offline, deterministic pnpm monorepo.

- `packages/core`: pure TypeScript trust core contracts and invariants. No React, UI, domain-pack, server, DB, auth, or network imports.
- `packages/ui`: controlled React components only. It receives state and callbacks from the host app; it does not verify, score, or project claims.
- `packs/*`: domain-pack metadata, fixture names, copy, and deterministic rule identifiers. Packs can depend on core contracts but core cannot depend on packs.
- `examples/*`: thin compositions that wire a pack into the core/UI boundary for demos.

Wave 0 intentionally provides scaffold contracts, not the later full risk engine, source parser, AI adapter, trust adapter, or reviewer console.
