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
packs/civic-data/       # @claimgate/pack-civic-data: deterministic civic fixture/rule/copy pack
packs/health-data/      # @claimgate/pack-health-data: deterministic health fixture/rule/copy pack
packs/mofa-oda/         # @claimgate/pack-mofa-oda: offline MOFA/KOICA fixture pack for ODA demo
examples/civic-review-app/  # thin React/Vite composition using core + UI + swappable packs
docs/                   # architecture and package-boundary notes
fixtures/               # offline deterministic fixture landing zone
scripts/                # local validation helpers
tools/kbctl/            # optional Go CLI for project-local JSON knowledge/doc index
tools/fmon/             # Bubble Tea TUI over the kbctl read model
governance/knowledge/   # ClaimGate-local kbctl knowledge base
```

## Quickstart

Requires Node.js 20+ and pnpm 9 for the framework path. Optional `kbctl` knowledge tooling requires Go 1.22+.

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

For the video Local LLM path, first run `pnpm test:video-preflight`, then use the RTX 4090 node with a local Ollama-compatible Gemma 4 12B model. RAG now uses a repo-local persistent sparse-vector index over the MOFA ODA fixture corpus, and the repo includes candidate-only Gemma tuning dataset/preflight scripts. The tuning preflight is strict and must pass free VRAM/dependency checks before any LoRA run is claimed. A local candidate-only Gemma 4 12B LoRA smoke/prototype artifact can be generated under ignored `artifacts/local-ai/gemma-candidate-lora-smoke/`; the public repo still contains no committed production fine-tuned model artifact, external vector database, hosted LLM, or production online retrieval path:

```bash
# Requires local Ollama-compatible Gemma 4 12B on the RTX 4090 node.
pnpm rag:build:mofa
pnpm tune:dataset:mofa
pnpm tune:preflight
pnpm tune:train:smoke
pnpm tune:eval:prototype
pnpm tune:infer:prototype # boundary eval only; first-JSON postprocessing can consume candidates, raw strict JSON remains serving-blocked
CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b OLLAMA_BASE_URL=http://127.0.0.1:29134 pnpm demo:ai:gemma
```

`pnpm eval:framework` is the evaluator-facing one-command smoke. It runs lint, typecheck, tests, demo, DomainPack conformance, handoff smoke, and framework performance evaluation using local fixtures only. `pnpm demo` remains available when you only want to see the pack-swap demo.

No server, database, auth, OCR, hosted LLM, API key, network service, external vector DB, committed production fine-tuned model artifact, or network demo is included in the v0 default path. The local Ollama/Gemma command is candidate-only and may not verify, score, anchor, or project claims. Framework performance smoke measures deterministic local framework throughput; it is not a claim about LLM extraction quality.

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

## Product language boundary

ClaimGate should be described as a source-grounded review framework, not an AI judge. Safe wording is: AI proposes candidates; deterministic rules surface risk; reviewers verify, correct, or reject; Evidence Packs carry the reusable proof. Trust signals and graph/report views provide context or projection only; they never replace Source Anchors or reviewer decisions.

## Project-local knowledge index

ClaimGate includes an optional `kbctl` CLI migrated from the WARVIS FisherMan tooling and reset for ClaimGate context. It indexes ClaimGate docs in `governance/knowledge/claimgate-kb.json` without copying FisherMan domain records.

```bash
pnpm test:kbctl
./kbctl get document DOC-CLAIMGATE-PROJECT-BRIEF
./kbctl list document
./kbctl search 본질 --kind document,decision,lesson
./kbctl search 현재 --kind document,decision,open_issue
./kbctl search Evidence --kind document
```

See [`docs/operations/kbctl.md`](docs/operations/kbctl.md).

The migrated ClaimGate FMON dashboard reads operational state only through `kbctl` JSON output:

```bash
pnpm test:tooling
./fmon
./fmon --once
```

See [`tools/fmon/README.md`](tools/fmon/README.md) for keys, layout, and the fail-closed data contract.

## OSS-first submission strategy

ClaimGate v0 is scaffolded for open-source submission from the start: MIT license, reproducible offline install/test/demo commands, explicit package boundaries, deterministic fixture-first demos, and submission-ready language that does not exceed implemented offline deterministic behavior. Publishing to npm and CI/CD are intentionally out of scope for this Bet.
