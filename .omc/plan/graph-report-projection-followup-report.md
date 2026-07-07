# ClaimGate Graph Report Projection Follow-up Report

- Project: `warvis-claimgate-framework`
- Pitch: `pitch-warvis-claimgate-framework--graph-report-projection`
- Repo: `/home/jang/Workspace/warvis-claimgate`
- Date: 2026-07-07 Asia/Seoul
- Scope: small follow-up to make framework QA/handoff/e2e testing explicit for graph/report projection UI surfaces.

## Source/Pitch status

- Vault note exists at `20-projects/10-pitches/pitch-warvis-claimgate-framework--graph-report-projection.md`.
- Scoped graph reproject succeeded with `upserted: 1`.
- Pitch remains `phase: shaping`; this follow-up does not self-approve or lifecycle-ship the Pitch.
- `devos_get_goal_progress` is still degraded because the Pitch frontmatter `objectives` are scalar strings rather than mapping entries expected by the progress calculator.

## Implemented follow-up

- Added `ImpactGraphView` controlled UI primitive for Evidence Pack graph JSON projection.
- Added `ImpactReport` controlled UI primitive for Markdown/HTML report handoff preview.
- Added UI view-model contracts for graph/report projection.
- Added `packages/ui/test/impact-projection.test.ts` to prove exported UI surfaces do not own hidden authority or imply AI verification.
- Added root scripts:
  - `pnpm test:e2e`
  - `pnpm test:handoff`
- Added `scripts/handoff-smoke.ts` end-to-end smoke that builds packages, creates claims, enforces reviewer terminal decisions, projects Evidence Pack to graph/report, excludes rejected claims, and renders the UI handoff surfaces.

## TDD evidence

RED:

- `pnpm --filter @claimgate/ui test -- --run test/impact-projection.test.ts` failed because `ImpactGraphView` was not exported.
- `pnpm test:e2e` failed because `@claimgate/ui` did not provide `ImpactGraphView`.

GREEN:

- `pnpm --filter @claimgate/ui test -- --run test/impact-projection.test.ts` PASS.
- `pnpm test:e2e` PASS with `ClaimGate handoff smoke PASS`.

## QA / handoff / e2e gates

| Gate | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS |
| `pnpm build` | PASS |
| `pnpm demo` | PASS |
| `pnpm test/conformance` | PASS |
| `pnpm test:e2e` | PASS |
| `pnpm test:handoff` | Alias to e2e handoff smoke |

## Handoff acceptance notes

- The projection UI is controlled: props in, callbacks out, no hidden state ownership.
- The graph/report components are read-only views over Evidence Pack projection data.
- AI output is not promoted; reviewer-approved `verified`/`corrected` Evidence Pack items remain the only projection source.
- The e2e smoke proves a `rejected` claim stays out of graph/report projection.
- No graph DB, real LLM, OCR, parser, server, auth, wallet, or network dependency was introduced.
