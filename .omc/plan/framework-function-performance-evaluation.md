# ClaimGate Framework Function & Performance Evaluation

- Project: `warvis-claimgate-framework`
- Repo: `/home/jang/Workspace/warvis-claimgate`
- Date: 2026-07-07 Asia/Seoul
- Evaluation target: ClaimGate Framework v0 after graph/report projection follow-up

## Result

PASS: ClaimGate Framework v0 is functionally ready for downstream artifact work and has a repeatable performance gate.

## AI connection boundary

AI connects through the framework via the `ClaimExtractor` adapter contract, not by bypassing the framework.

- Contract: `ClaimExtractor.extractClaims(source) -> CandidateClaim[]`.
- v0 implementation: `FixtureClaimExtractor`, fully offline and deterministic.
- Future real AI/LLM adapters can implement the same `ClaimExtractor` interface.
- AI authority is intentionally limited to candidate curation:
  - may propose claim text, AI-observed value, subject, and proposed anchor;
  - must not attach anchors as accepted facts;
  - must not verify/correct/reject;
  - must not score risk;
  - must not project to Evidence Pack, Report, or Graph.
- Framework authority remains deterministic rules + reviewer decision:
  - Source Anchor acceptance is a separate core workflow;
  - risk is deterministic rule trace;
  - terminal states require reviewer;
  - only `verified`/`corrected` claims project.

## Added repeatable evaluation scripts

- `pnpm test:perf`
  - builds the workspace;
  - runs a synthetic 5,000-claim core performance evaluation;
  - checks risk queue, reviewer transitions, Evidence Pack projection, graph/report rendering, JSON serialization, fake-work metric;
  - asserts budget and projection invariants.
- `pnpm eval:framework`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm demo`
  - `pnpm test/conformance`
  - `pnpm test:e2e`
  - `pnpm test:perf`

## Functional evaluation evidence

`pnpm eval:framework` passed locally.

| Gate | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS |
| `pnpm demo` | PASS |
| `pnpm test/conformance` | PASS |
| `pnpm test:e2e` | PASS |
| `pnpm test:perf` | PASS |

## Performance evaluation evidence

`pnpm test:perf` synthetic corpus:

| Metric | Value |
|---|---:|
| Claims processed | 5,000 |
| Projected claims | 2,500 |
| Graph nodes | 2,502 |
| Graph edges | 5,000 |
| Markdown report bytes | 661,062 |
| HTML report bytes | 821,195 |
| Evidence Pack JSON bytes | 1,722,821 |
| Total measured core pipeline time | 107.21 ms |
| Budget | 5,000 ms |
| Throughput | 46,637.44 claims/sec |

Timing breakdown from latest `eval:framework` run:

| Stage | Duration |
|---|---:|
| Build deterministic claims and risk inputs | 24.93 ms |
| Evaluate deterministic risk queue | 18.85 ms |
| Apply reviewer terminal decisions | 23.97 ms |
| Create Evidence Pack | 13.43 ms |
| Project graph JSON | 3.97 ms |
| Render Markdown report | 10.65 ms |
| Render HTML report | 4.99 ms |
| Serialize Evidence Pack JSON | 3.79 ms |
| Calculate fake-work reduction | 2.63 ms |

Risk/fake-work summary:

- Total claims: 5,000
- Red: 2,500
- Aggregate-only: 1,250
- Green: 1,250
- Sampled green: 125
- Queued for review: 3,875
- Corrected: 1,250
- Rejected: 1,250
- Projected: 2,500
- Fake-work reduced ratio: 0.225

## Evaluation assertions

The performance script also asserts:

- total evaluated claim count equals synthetic corpus size;
- verified + corrected projectable claims are exactly half the corpus;
- rejected claims do not project to graph;
- rejected claims do not project to report;
- total measured framework pipeline stays under budget.

## Conclusion

ClaimGate Framework v0 is ready to support downstream artifact work:

1. Domain-specific packs can provide deterministic fixtures/rules.
2. AI can be connected through `ClaimExtractor` as a candidate-only adapter.
3. Reviewer workflow can promote only anchored, reviewer-terminal claims.
4. Evidence Pack, graph JSON, Markdown, HTML, UI handoff preview, and e2e smoke are available.
5. Functional and performance gates are repeatable from root scripts.

Remaining non-code caveat:

- `pitch-warvis-claimgate-framework--graph-report-projection` still has ShapeOps `objectives_invalid` because its Pitch frontmatter objectives are scalar strings, not mapping entries expected by the progress calculator. This is a document/lifecycle cleanup item, not a framework runtime blocker.
