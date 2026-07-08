# ClaimGate Reproducibility Guide

ClaimGate v0 is designed for deterministic, offline evaluation from a fresh clone. The default evaluator path uses fixture data committed to the repository and does not require API keys, network services, hosted databases, auth, OCR, real LLM calls, or DID infrastructure.

## Environment

- Node.js: 20 or newer
- Package manager: pnpm 9 (declared in `package.json`)
- Repository state: clean checkout with `pnpm-lock.yaml`

## Fresh clone path

```bash
git clone <repo-url> claimgate
cd claimgate
pnpm install --frozen-lockfile
pnpm eval:framework
```

For an already checked-out worktree where dependencies are missing, the expected recovery is the same install command:

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

## Clean-room commands

The minimal public-release clean-room command set is:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm demo
```

Additional framework gates are:

```bash
pnpm test/conformance
pnpm test:e2e
pnpm test:perf
```

## What `pnpm eval:framework` runs

`pnpm eval:framework` chains:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm demo`
5. `pnpm test/conformance`
6. `pnpm test:e2e`
7. `pnpm test:perf`

The command is intentionally framework-focused. It verifies deterministic behavior and package boundaries; it does not call or judge a real LLM.

## Determinism contract

- Fixtures are local files under `examples/fixtures/` and pack-owned test fixtures.
- DomainPack conformance expects stable risk levels and rule traces.
- Evidence Pack/report/graph projection tests admit only reviewed `verified` or `corrected` claims.
- The performance smoke uses deterministic fixture workloads and local timers only.
- Pack-swap demo output should differ by selected pack while preserving the same core/UI contracts.
- Same fixture input should produce the same risk levels, rule traces, Evidence Pack projection, report projection, and graph projection bytes.
- AI adapter outputs remain candidate inputs only; deterministic risk and human reviewer terminal transitions remain authoritative.

## Offline / no-network runtime contract

After dependencies are installed, ClaimGate demos and tests must run without a server, database, auth service, OCR service, real LLM provider, graph database, online verifier, API keys, or model-provider credentials. Fixture packs and example apps should use checked-in deterministic data only.

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

If a future integration needs any of the above, it must be opt-in and must not be part of `pnpm eval:framework` unless the v0 scope is explicitly revised.

## Interpreting failures

- Missing `node_modules` or missing local binaries means dependencies have not been installed; run `pnpm install --frozen-lockfile`.
- Test failures in state-machine, projection, extraction, or trust-adapter files are trust-invariant regressions.
- Performance smoke failures indicate framework budget drift, not LLM-quality drift.
- Any default network dependency is a v0 reproducibility regression.

## Public-release go/no-go rule

- **GO** if a fresh clone can run the clean-room commands and the runtime remains fixture-first/offline.
- **NO-GO** if any demo or test requires secrets, local vault state, network APIs, mutable external state, private runtime services, real LLM extraction, OCR services, graph DB projection as a runtime dependency, or real DID wallet/issuer/verifier integration.
