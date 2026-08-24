# ClaimGate Package Boundaries

ClaimGate v0 is an offline, deterministic pnpm monorepo.

- `packages/core`: pure TypeScript trust core contracts and invariants. No React, UI, domain-pack implementation, server, DB, auth, or network imports. DomainPack is exposed only as a type contract via `@claimgate/core/domain-pack`.
- `packages/conformance`: reusable offline conformance kit for `DomainPack` packages. It depends on core contracts and may be used by packs/tests; core never imports it.
- `packages/ui`: controlled React components only. It receives state and callbacks from the host app; it does not verify, score, or project claims.
- `packs/*`: domain-pack labels, entity mapping, deterministic risk rules, report templates, and fixtures. Packs can depend on core contracts and conformance tests, but core cannot depend on packs.
- `examples/*`: thin compositions that wire a selected pack into the core/UI boundary for demos. Pack swap changes behavior without core/UI changes.

v0 default verification no-go remains: no network LLM provider, OCR, general parser, server, DB, auth, multitenancy, graph DB, or real DID wallet/issuer/verifier. The optional Local Gemma/Ollama demo path belongs outside `packages/core`; `packages/ai-local` owns the local adapter/RAG guard and must stay behind the candidate-only `ClaimExtractor` boundary.
