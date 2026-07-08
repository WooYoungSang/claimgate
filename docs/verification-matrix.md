# ClaimGate Verification Matrix

This matrix is the evaluator-facing trust map for ClaimGate v0. It ties each public claim about the framework to an offline, deterministic command or artifact. The default verification path uses local fixtures only: no API keys, no network calls, no server, no database, no auth layer, and no real LLM/OCR/parser integration.

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
| AI Curator, Not Judge | `pnpm test` (`packages/core/test/extraction.test.ts`) and `docs/ai-extraction-boundary.md` | Offline extractor output stays candidate-only and cannot verify, score risk, or project claims. | It does not evaluate LLM factual quality. Real LLM extraction is out of v0 scope. |
| Deterministic risk with rule trace | `pnpm test/conformance` | Each DomainPack fixture produces deterministic risk levels and non-empty rule traces. | It does not certify a domain as complete; packs own domain judgment coverage. |
| Evidence Pack First | `pnpm test` (`packages/core/test/evidence-pack.test.ts`, `packages/core/test/projectors.test.ts`) | Evidence Pack/report/graph projection accepts only eligible reviewed claims. | Graph DB persistence is not included in v0. |
| Pack reuse | `pnpm demo` and `pnpm test/conformance` | The same app/core can run two packs and produce domain-specific output. | It does not imply pack results are interchangeable across domains. |
| Controlled UI authority | `pnpm lint` and `packages/ui/test/ui-boundary.test.ts` through `pnpm test` | UI remains a controlled component surface and does not own hidden review authority. | It does not include production auth or multi-user workflow. |
| Trust adapter is context only | `pnpm test` (`packages/core/test/trust-adapter.test.ts`) and `docs/opendid-trust-adapter.md` | Mock trust signals cannot replace source anchors, deterministic risk, or reviewer decisions. | It does not perform real DID issuance, wallet, blockchain, or verifier calls. |
| Fresh clone reproducibility | `pnpm install --frozen-lockfile && pnpm eval:framework` | A clean checkout can reproduce the local framework gate from the lockfile. | It does not prove npm publishing or CI/CD release readiness. |
| Framework performance smoke | `pnpm test:perf` (included in `pnpm eval:framework`) | Framework operations complete within documented deterministic fixture budgets. | It is framework throughput/latency only, not LLM answer quality or extraction accuracy. |

## Command composition

| Command | Scope | Offline by default |
|---|---|---:|
| `pnpm lint` | Package boundary lint + package TypeScript lint scripts | Yes |
| `pnpm typecheck` | Workspace TypeScript type checking | Yes |
| `pnpm test` | Build + all package unit tests | Yes |
| `pnpm demo` | Pack-swap fixture demo | Yes |
| `pnpm test/conformance` | Conformance kit + civic/health packs | Yes |
| `pnpm test:e2e` | Deterministic handoff smoke | Yes |
| `pnpm test:perf` | Deterministic framework performance smoke | Yes |
| `pnpm eval:framework` | Evaluator-facing aggregate smoke | Yes |

## Framework performance vs LLM quality

ClaimGate v0 deliberately separates **framework performance** from **LLM quality**:

- Framework performance means deterministic local execution: TypeScript build, state-machine guards, projection guards, conformance checks, demo output, handoff smoke, and fixture performance budgets.
- LLM quality means whether a model extracts correct claims from real-world inputs. ClaimGate v0 does not measure that because real LLM extraction is out of scope.
- The AI adapter boundary is intentionally candidate-only so a future extractor can be evaluated without weakening the core trust invariants.

## Evaluator checklist

1. Confirm Node.js 20+ and pnpm 9+.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm eval:framework`.
4. Inspect this matrix plus `docs/reproducibility.md`, `SECURITY.md`, and `THIRD_PARTY_LICENSES.md`.
5. Treat any network/API-key requirement in the default path as a v0 regression.
