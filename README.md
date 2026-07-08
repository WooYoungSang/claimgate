# ClaimGate Framework

ClaimGate is an offline, deterministic, source-grounded claim review framework for public-data AI outputs. It helps teams pull risky AI-produced claims into a human review workflow where every accepted claim must trace back to a source anchor and auditable evidence.

## v0 invariants

- **No Anchor, No Claim**: a claim without a Source Anchor cannot become a verified or corrected claim.
- **AI Curator, Not Judge**: AI may propose candidate claims and anchors, but it never verifies truth, scores final risk, or projects claims.
- **Risk-first Review**: deterministic rules create red/yellow/green/aggregate-only queues with rule traces; green sampling protects against false negatives.
- **Evidence Pack First**: the reusable artifact is an Evidence Pack before any report or graph projection.
- **Fake Work Reduced**: the goal is lower net reviewer effort after sampling cost, not hands-free truth automation.
- **Verified/corrected-only projection**: only `verified` and `corrected` states may project into downstream artifacts.

See [`docs/product-manifesto.md`](docs/product-manifesto.md) for the invariant-to-code/test map and [`docs/submission-language-kit.md`](docs/submission-language-kit.md) for submission-safe report and video language.

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
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm demo
```

`pnpm demo` runs an offline deterministic demo that composes `@claimgate/core`, `@claimgate/ui`, and two `@claimgate/pack-*` packages. No server, database, auth, OCR, real LLM extraction, or network demo is included in v0.

## Package boundaries

- `@claimgate/core` is framework-independent TypeScript. It must not import UI, React, examples, or domain packs.
- `@claimgate/ui` exports controlled React components only. Host apps own state and reviewer authority.
- `@claimgate/pack-*` packages own domain-specific fixtures, copy, and deterministic rule metadata.
- `examples/*` packages compose core + UI + packs and may use app-state helpers such as Zustand.

See [`docs/package-boundaries.md`](docs/package-boundaries.md) for the scaffold boundary contract.

## Product language boundary

ClaimGate should be described as a source-grounded review framework, not an AI judge. Safe wording is: AI proposes candidates; deterministic rules surface risk; reviewers verify, correct, or reject; Evidence Packs carry the reusable proof. Trust signals and graph/report views provide context or projection only; they never replace Source Anchors or reviewer decisions.

## OSS-first submission strategy

ClaimGate v0 is scaffolded for open-source submission from the start: MIT license, reproducible offline install/test/demo commands, explicit package boundaries, deterministic fixture-first demos, and submission-ready language that does not exceed implemented offline deterministic behavior. Publishing to npm and CI/CD are intentionally out of scope for this Bet.
