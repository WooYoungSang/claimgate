# Reproducibility and Offline Demo Gate

ClaimGate v0 is designed to be reproducible from a fresh clone using Node.js 20+ and pnpm 9.

## Clean-room commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm demo
```

Additional gates used by the framework:

```bash
pnpm test/conformance
pnpm test:e2e
pnpm test:perf
```

## Offline / no-network runtime contract

After dependencies are installed, ClaimGate demos and tests must run without a server, database, auth service, OCR service, real LLM provider, graph database, or online verifier. Fixture packs and example apps should use checked-in deterministic data only.

Allowed network use for this v0 release gate:

- package installation from the configured package registry during `pnpm install`;
- explicit human/operator release actions outside this repository.

Disallowed in v0 runtime/demo paths:

- real LLM extraction or provider calls;
- OCR or general-purpose PDF/Excel parsing services;
- hosted API/server/database/auth/multitenancy;
- graph DB projection as a runtime dependency;
- real DID wallet/issuer/verifier integration;
- online demos that change outputs nondeterministically.

## Determinism checks

- Same fixture input should produce the same risk levels, rule traces, Evidence Pack projection, report projection, and graph projection bytes.
- Only `verified` and `corrected` claims may project into Evidence Pack, Report, or Graph surfaces.
- AI adapter outputs are candidate inputs only; deterministic risk and human reviewer terminal transitions remain authoritative.

## Go/no-go rule

- **GO** if a fresh clone can run the clean-room commands and the runtime remains fixture-first/offline.
- **NO-GO** if any demo or test requires secrets, local vault state, network APIs, mutable external state, or private runtime services.
