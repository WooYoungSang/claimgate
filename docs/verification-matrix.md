# ClaimGate Verification Matrix

This matrix is the evaluator-facing trust map for ClaimGate v0. It ties each public claim about the framework to an offline, deterministic command or artifact. The default verification path uses local fixtures only: no API keys, no network calls, no server, no database, no auth layer, no hosted LLM, and no OCR/parser integration. The submission demo target is a local RTX 4090 Ollama/Gemma candidate-extraction path; it does not grant AI judgment authority and must be verified on the GPU node before recording.

## One-command evaluator smoke

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

`pnpm eval:framework` is the primary smoke for framework readiness. It chains boundary linting, TypeScript checks, unit tests, demo, DomainPack conformance, handoff smoke, and framework performance evaluation.

## Verification coverage

| ClaimGate claim | Evidence command / artifact | What it proves | What it does not claim |
|---|---|---|---|
| No Anchor, No Claim | `pnpm test` (`packages/core/test/verification-state-machine.test.ts`, `packages/core/test/projection-guards.test.ts`) | Unanchored claims cannot reach verified/corrected terminal states or downstream projection. | It does not parse real PDFs/CSVs/XLSX files. v0 uses fixtures. |
| AI Curator, Not Judge | `pnpm test` (`packages/core/test/extraction.test.ts`) and `docs/ai-extraction-boundary.md` | Extractor output stays candidate-only and cannot verify, score risk, attach accepted Source Anchors, or project claims. | It does not evaluate LLM factual quality. The local Ollama/Gemma path is a candidate-extraction demo only. |
| Deterministic risk with rule trace | `pnpm test/conformance` | Each DomainPack fixture produces deterministic risk levels and non-empty rule traces; every declared riskRule must be exercised by at least one fixture. | It does not certify a domain as complete; packs own domain judgment coverage. |
| Evidence Pack First | `pnpm test` (`packages/core/test/evidence-pack.test.ts`, `packages/core/test/projectors.test.ts`) | Evidence Pack/report/graph projection accepts only eligible reviewed claims. | Graph DB persistence is not included in v0. |
| Pack reuse | `pnpm demo` and `pnpm test/conformance` | The same app/core can run civic, health, and MOFA ODA packs and produce domain-specific output. | It does not imply pack results are interchangeable across domains. |
| Controlled UI authority | `pnpm lint` and `packages/ui/test/ui-boundary.test.ts` through `pnpm test` | UI remains a controlled component surface and does not own hidden review authority. | It does not include production auth or multi-user workflow. |
| Trust adapter is context only | `pnpm test` (`packages/core/test/trust-adapter.test.ts`) and `docs/opendid-trust-adapter.md` | Mock trust signals cannot replace source anchors, deterministic risk, or reviewer decisions. | It does not perform real DID issuance, wallet, blockchain, or verifier calls. |
| Fresh clone reproducibility | `pnpm install --frozen-lockfile && pnpm eval:framework` | A clean checkout can reproduce the local framework gate from the lockfile. | It does not prove npm publishing or CI/CD release readiness. |
| Framework performance smoke | `pnpm test:perf` (included in `pnpm eval:framework`) | Framework operations complete within documented deterministic fixture budgets. | It is framework throughput/latency only, not LLM answer quality or extraction accuracy. |
| Local Ollama/Gemma guard | `pnpm test:ai-demo` | Optional Ollama endpoint must be local HTTP, model tag must be local/non-URL, and AI-proposed anchors are not auto-promoted. | It does not prove local model quality or availability on the evaluator machine. |
| Local sparse-vector RAG boundary | `pnpm test:ai-demo`, `pnpm rag:build:mofa`, and GPU-node `pnpm demo:ai:gemma` evidence | RAG no-hit fails closed and demo output/Evidence Pack metadata disclose the repo-local persistent sparse-vector index. | It does not prove external vector DB retrieval, online retrieval, or production-quality fine-tuned Gemma artifacts; strict tuning preflight plus recorded local smoke training only prove the LoRA pipeline can run. |
| Project-local knowledge index | `pnpm test:kbctl` and `./kbctl list document` | The optional Go CLI can verify the ClaimGate-local KB and query migrated document records. | It is not part of the v0 runtime/demo path and does not replace public release hygiene review. |

## Command composition

| Command | Scope | Offline by default |
|---|---|---:|
| `pnpm lint` | Package boundary lint + package TypeScript lint scripts | Yes |
| `pnpm typecheck` | Workspace TypeScript type checking | Yes |
| `pnpm test` | Build + all package unit tests | Yes |
| `pnpm demo` | Pack-swap fixture demo | Yes |
| `pnpm test/conformance` | Conformance kit + civic/health/MOFA ODA packs | Yes |
| `pnpm test:e2e` | Deterministic handoff smoke | Yes |
| `pnpm test:perf` | Deterministic framework performance smoke | Yes |
| `pnpm eval:framework` | Evaluator-facing aggregate smoke | Yes |
| `pnpm test:kbctl` | Optional ClaimGate-local knowledge/doc index CLI smoke | Yes |
| `pnpm test:ai-demo` | Local Gemma/Ollama boundary tests using test-double Ollama responses and local loopback negative cases | Yes |
| `pnpm demo:ai:gemma` | Actual RTX 4090 local Ollama/Gemma candidate-only walkthrough | Requires the local GPU node and running Ollama endpoint |

## Framework performance vs LLM quality

ClaimGate v0 deliberately separates **framework performance** from **LLM quality**:

- Framework performance means deterministic local execution: TypeScript build, state-machine guards, projection guards, conformance checks, demo output, handoff smoke, and fixture performance budgets.
- LLM quality means whether a model extracts correct claims from real-world inputs. ClaimGate v0 does not measure that. The local RTX 4090 Ollama/Gemma command demonstrates the candidate-only adapter seam, not extraction quality, production RAG quality, or fine-tuning results.
- The AI adapter boundary is intentionally candidate-only so a future extractor can be evaluated without weakening the core trust invariants.

## Evaluator checklist

1. Confirm Node.js 20+ and pnpm 9+.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm eval:framework`.
4. Inspect this matrix plus `docs/reproducibility.md`, `SECURITY.md`, and `THIRD_PARTY_LICENSES.md`.
5. Treat any network/API-key requirement in the default path as a v0 regression.


### Local Gemma LoRA prototype inference boundary

`pnpm tune:infer:prototype` loads the local PEFT adapter and evaluates the tiny candidate-only dataset. Current expected status is `BOUNDARY_PASS_SERVING_BLOCKED` for raw strict JSON: parse/candidate-only/text-match can pass and `postprocessedCandidateBoundaryReady` can be true while strict JSON-only output remains blocked. This is evidence for the tuning pipeline and safe first-JSON boundary parsing, not production extraction quality.
