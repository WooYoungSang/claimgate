# ClaimGate Submission Evidence Map

This file is the evidence index for the competition report in [`docs/competition-report.md`](competition-report.md). It is intentionally conservative: if a claim cannot be tied to a repo file, test, or command, the report should not state it as completed behavior.

## Evidence policy

- **Framework behavior** means deterministic TypeScript code, tests, fixture packs, or local scripts in this repository.
- **LLM quality** is not claimed in v0. The AI adapter is fixture-only and candidate-only; it proves a boundary, not model accuracy.
- **Performance numbers** are command-run evidence, not a universal benchmark. They apply to the synthetic fixture path in `scripts/framework-performance-eval.ts` on the local verification run.
- **Projection claims** apply only to `verified` and `corrected` claims, never to `extracted`, `anchored`, `needs-evidence`, `conflict`, `aggregate-only`, or `rejected` claims.

## Invariant evidence matrix

| Invariant / narrative claim | Evidence files | Validation command |
|---|---|---|
| No Anchor, No Claim: a claim cannot become `verified` or `corrected` without a Source Anchor. | `packages/core/src/verification.ts`; `packages/core/test/verification-state-machine.test.ts`; `packages/core/test/source-anchor.test.ts` | `pnpm test -- --run packages/core/test/verification-state-machine.test.ts packages/core/test/source-anchor.test.ts` |
| AI Curator, Not Judge: AI extraction can propose candidates and proposed anchors only. | `packages/core/src/extraction.ts`; `packages/core/src/fixture-loader.ts`; `packages/core/test/extraction.test.ts`; `docs/ai-extraction-boundary.md` | `pnpm test -- --run packages/core/test/extraction.test.ts` |
| Deterministic risk with rule trace: risk is rule-based and rejects AI-provided risk scores. | `packages/core/src/risk/index.ts`; `packages/core/test/risk/risk-engine.test.ts`; `packages/core/test/risk/risk-queue.test.ts` | `pnpm test -- --run packages/core/test/risk/risk-engine.test.ts packages/core/test/risk/risk-queue.test.ts` |
| Evidence Pack First and verified/corrected-only projection. | `packages/core/src/evidence.ts`; `packages/core/src/projection-guards.ts`; `packages/core/src/projectors/report.ts`; `packages/core/src/projectors/graph.ts`; `packages/core/test/evidence-pack.test.ts`; `packages/core/test/projection-guards.test.ts`; `packages/core/test/projectors.test.ts` | `pnpm test -- --run packages/core/test/evidence-pack.test.ts packages/core/test/projection-guards.test.ts packages/core/test/projectors.test.ts` |
| Reviewer terminal decisions are explicit and audited. | `packages/core/src/audit.ts`; `packages/core/src/verification.ts`; `packages/core/test/verification-state-machine.test.ts` | `pnpm test -- --run packages/core/test/verification-state-machine.test.ts` |
| Core/pack/UI boundary: core is pure trust logic, packs own domain judgment, UI is controlled. | `docs/package-boundaries.md`; `packages/core/test/core-boundary.test.ts`; `packages/ui/test/ui-boundary.test.ts`; `packages/conformance/test/conformance.test.ts`; `packs/*/test/pack.test.ts` | `pnpm lint && pnpm test/conformance` |
| Two domain packs demonstrate reuse through conformance and pack swap. | `packages/conformance/src/index.ts`; `packs/civic-data/src/index.ts`; `packs/health-data/src/index.ts`; `scripts/swap-pack-demo` | `pnpm test/conformance && pnpm demo` |
| Trust adapter is mock context only and cannot replace anchors/risk/reviewer decisions. | `packages/core/src/trust-adapter.ts`; `packages/core/test/trust-adapter.test.ts`; `docs/opendid-trust-adapter.md` | `pnpm test -- --run packages/core/test/trust-adapter.test.ts` |
| Offline deterministic handoff path exists. | `scripts/handoff-smoke.ts`; `examples/civic-review-app/src/demo.ts`; fixture/data files under `packs/*` and `examples/fixtures` | `pnpm test:e2e` |
| Performance evaluation is for the framework pipeline only, not LLM quality. | `scripts/framework-performance-eval.ts` | `pnpm test:perf` |

## Quantitative claim ledger

Only the following quantitative claims are currently supported for the report. They should be restated with command evidence, not as broad production benchmarks.

| Claim | Latest local evidence |
|---|---|
| Synthetic evaluation uses 5,000 deterministic claims. | `pnpm test:perf` output: `claimCount: 5000`. |
| Projection includes 2,500 claims in that synthetic run. | `pnpm test:perf` output: `projectedClaimCount: 2500`. The script asserts this is exactly half of the synthetic corpus because only verified/corrected states project. |
| Graph projection in that synthetic run emits 2,502 nodes and 5,000 edges. | `pnpm test:perf` output: `graphNodes: 2502`, `graphEdges: 5000`. |
| Report rendering and serialization are deterministic local operations. | `pnpm test:perf` output: `markdownBytes: 661062`, `htmlBytes: 821195`, `jsonBytes: 1722821` for the latest run. |
| The synthetic framework pipeline stayed below the configured 5,000 ms budget in the latest run. | `pnpm test:perf` output: `totalDurationMs: 110.13`, `budgetMs: 5000`, `throughputClaimsPerSecond: 45400.89`. |
| Fake-work-reduced is measured after green sampling cost, not guessed. | `pnpm test:perf` output: `focusedReviewCount: 3875`, `sampledGreenCount: 125`, `skippedReviewCount: 1125`, `fakeWorkReducedRatio: 0.225`. |

## Unsupported or explicitly out-of-scope claims

Do not claim any of the following for v0:

- ClaimGate automatically determines truth.
- ClaimGate eliminates hallucinations.
- A real LLM, OCR, PDF parser, Excel parser, server, database, auth layer, graph database, or real DID wallet/verifier is implemented.
- The mock trust adapter verifies claims.
- The synthetic performance run proves production latency for arbitrary documents or real LLM calls.
- Green claims are ignored without sampling; green sampling is part of the review-cost accounting.

## Repeatable gate bundle

Run this bundle before submission review:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm demo
pnpm test/conformance
pnpm test:e2e
pnpm test:perf
```
