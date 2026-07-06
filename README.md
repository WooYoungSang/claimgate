# warvis-claimgate

ClaimGate는 공공데이터 기반 AI 산출물의 위험 claim만 원문 근거(Source Anchor)와 함께 사람이 검토·수정·승인하게 하는 source-grounded claim review toolkit입니다.

## Core Principles

- **No Anchor, No Claim**: Source Anchor 없는 claim은 공식 claim으로 승격하지 않습니다.
- **AI Curator, Not Judge**: AI는 후보와 위험 신호를 제안하고, 최종 판단은 사람이 합니다.
- **Risk-first Review**: 모든 claim 전수 검토가 아니라 green/yellow/red/aggregate-only Risk Queue로 우선순위를 나눕니다.
- **Evidence Pack First**: graph/report보다 감사 가능한 Evidence Pack을 1차 산출물로 둡니다.
- **Fake Work Reduced**: 반복 검토와 재확인 업무 감소를 제품 가치로 측정합니다.

## Planned Stack

- TypeScript strict
- pnpm workspace
- React + Vite
- Vitest
- Playwright smoke tests
- tsup or Vite library mode

## Planned Repository Shape

```text
packages/core/          # pure TypeScript trust core
packages/ui/            # controlled React UI components
packs/<domain>/         # domain pack: rules, copy, fixtures, templates
examples/<domain>-app/  # thin app composition for pack-swap demos
docs/                   # architecture and quickstart
```

## Initial Commands

```bash
pnpm install
pnpm test
pnpm build
pnpm demo
```
