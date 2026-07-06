# warvis-claimgate Codex Harness

이 로컬 Codex 하네스는 WARVIS MCP `devos_harness_install(target=codex)` export 결과를 기준으로 구성한다.

## Project
- project_id: `warvis-claimgate`
- stack: TypeScript, pnpm workspace, React, Vite, Vitest, Playwright, tsup
- commands:
  - install: `pnpm install`
  - test: `pnpm test`
  - demo: `pnpm demo`
  - build: `pnpm build`
  - lint: `pnpm lint`
  - typecheck: `pnpm typecheck`

## ClaimGate implementation rules
- No Anchor, No Claim.
- AI Curator, Not Judge.
- Risk levels are deterministic rule outputs with rule traces, not AI judgments.
- Evidence Pack is the primary output; report/graph are downstream projections.
- `@claimgate/core` stays pure TypeScript and domain-agnostic.
- `@claimgate/ui` uses controlled components only.
- Domain packs may extend core rules, never override core invariants.
- Demo must be fixture-first and offline-reproducible.

## WARVIS MCP usage
- Prefer canonical `mcp__warvis_mcp` tools for project context, harness, lessons, and ShapeOps lifecycle.
- Do not self-approve protected ShapeOps state.
- If a WARVIS write returns `review_required`, surface it rather than pretending completion.
