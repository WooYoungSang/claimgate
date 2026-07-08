# ClaimGate Framework

ClaimGate is an offline, deterministic, source-grounded claim review framework for public-data AI outputs. It helps teams pull risky AI-produced claims into a human review workflow where every accepted claim must trace back to a source anchor and auditable evidence.

## v0 invariants

- **No Anchor, No Claim**: a claim without a Source Anchor cannot become a verified or corrected claim.
- **AI Curator, Not Judge**: AI may propose candidate claims and anchors, but it never verifies truth, scores final risk, or projects claims.
- **Risk-first Review**: deterministic rules create red/yellow/green/aggregate-only queues with rule traces; green sampling protects against false negatives.
- **Evidence Pack First**: the reusable artifact is an Evidence Pack before any report or graph projection.
- **Verified/corrected-only projection**: only `verified` and `corrected` states may project into downstream artifacts.

## Workspace structure

```text
packages/core/          # @claimgate/core: pure TypeScript trust contracts and later invariant engine
packages/ui/            # @claimgate/ui: controlled React components; no hidden review authority
packs/civic-data/       # @claimgate/pack-civic-data: fixture/rule/copy boundary scaffold
packs/health-data/      # @claimgate/pack-health-data: second domain-pack scaffold
examples/civic-review-app/  # thin React/Vite composition using core + UI + swappable packs
docs/                   # architecture and package-boundary notes
fixtures/               # offline deterministic fixture landing zone
scripts/                # local validation helpers
```

## Quickstart

Requires Node.js 20+ and pnpm 9.

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

`pnpm eval:framework` is the evaluator-facing one-command smoke. It runs lint, typecheck, tests, demo, DomainPack conformance, handoff smoke, and framework performance evaluation using local fixtures only. `pnpm demo` remains available when you only want to see the pack-swap demo.

No server, database, auth, OCR, real LLM extraction, API key, network service, or network demo is included in the v0 default path. Framework performance smoke measures deterministic local framework throughput; it is not a claim about LLM extraction quality.

## Evaluator trust pack

Evaluator evidence lives in:

- [`docs/verification-matrix.md`](docs/verification-matrix.md) — maps invariants to deterministic commands and evidence.
- [`docs/reproducibility.md`](docs/reproducibility.md) — fresh clone and no-network/default determinism guide.
- [`SECURITY.md`](SECURITY.md) — v0 security boundary and no-secret default.
- [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) — direct dependency license notes for review.

The verification matrix explicitly separates ClaimGate framework behavior from future LLM quality evaluation.

## Package boundaries

- `@claimgate/core` is framework-independent TypeScript. It must not import UI, React, examples, or domain packs.
- `@claimgate/ui` exports controlled React components only. Host apps own state and reviewer authority.
- `@claimgate/pack-*` packages own domain-specific fixtures, copy, and deterministic rule metadata.
- `examples/*` packages compose core + UI + packs and may use app-state helpers such as Zustand.

See [`docs/package-boundaries.md`](docs/package-boundaries.md) for the scaffold boundary contract.

## OSS-first submission strategy

ClaimGate v0 is scaffolded for open-source submission from the start: MIT license, reproducible offline install/test/demo commands, explicit package boundaries, and deterministic fixture-first demos. Publishing to npm and CI/CD are intentionally out of scope for this Bet.
