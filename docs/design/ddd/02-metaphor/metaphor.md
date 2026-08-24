---
id: ddd-metaphor
title: 은유 원장과 델타
status: generated
type: ddd-view
---

# 은유 원장과 델타

> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고
> `./kbctl render metaphor`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.

**은유는 도메인 모델이 아니라 그것을 찾기 위한 임시 가설이다.**
`RETIRED`가 된 영역은 설계 근거로 인용할 수 없다.

## 은퇴 원장

| 키 | 영역 | 상태 | 유효한 곳 | 무효한 곳 | 델타 |
|---|---|---|---|---|---|
| MET-1 | 검문소 / 게이트 | PARTIAL | 후보 주장을 통과/보류/기각시키는 흐름, 권한 없는 AI 후보와 책임 있는 reviewer decision의 분리 | Evidence Pack snapshot 재발행, 동시 reviewer 충돌, multi-anchor composite claim, tuning/model provenance 보존 | M-1 M-2 M-3 M-4 |

## 매핑 — 빌려온 구조

이 표는 대응 가설이며 Domain Model이나 Ubiquitous Language가 아니다.

| 키 | 메타포 | 도메인 | 의미 | 신뢰도 | 불일치 후보 | 질문 후보 |
|---|---|---|---|---|---|---|
| MAP-1 | 검문 대상 | CandidateClaim | 아직 통과하지 못한 AI 제안 후보 | HIGH | 후보는 source anchor proposal을 포함할 수 있지만 권한 있는 anchor는 아니다. | KG-1 |
| MAP-2 | 신분증/증빙 | Source Anchor | claim이 참조하는 원문 근거 위치 | HIGH | 복합 claim은 여러 근거를 요구할 수 있다. | KG-7 |
| MAP-3 | 검문 규칙 | Deterministic Risk Rule | 출처와 후보 값을 비교해 review queue 상태를 추천하는 규칙 | HIGH | 도메인팩별 규칙/green sampling 정책의 소유권은 더 쪼개야 한다. | KG-6 |
| MAP-4 | 검문관 | Reviewer | terminal decision을 남길 수 있는 사람 행위자 | MEDIUM | 동시 검토자 충돌, reviewer 권한/역할 모델은 아직 없다. | KG-3 |
| MAP-5 | 통과 기록 | Evidence Pack | 검토된 claim과 source/audit를 묶은 재사용 가능한 산출물 | MEDIUM | pack은 통과 순간의 불변 snapshot인지 재발행 대상인지 정책이 필요하다. | KG-5 |

## 공격 기록 — 어디서 깨지는가

여섯 축의 내용은 Delta로 확정되기 전의 공격 결과다.

| 메타포 | 상태 | 시간 | 동시성 | 권한 | 일관성 | 실패 |
|---|---|---|---|---|---|---|
| MET-1 |  |  |  |  |  |  |

## 델타 — 은유가 깨진 자리

잘 맞는 부분보다 안 맞는 부분이 값지다. 모든 행이 질문으로 이어진다.

| 키 | 은유가 말하는 것 | 도메인이 실제로 | 불일치 | 축 | 질문 |
|---|---|---|---|---|---|
| M-1 | 검문소 | Evidence Pack projection | 검문소는 통과 후 문서의 불변 snapshot과 재발행 생명주기를 설명하지 못한다. | 시간 | KG-5 |
| M-2 | 검문소 | Source Anchor attachment | 검문소는 후보가 제안한 앵커와 검토자가 실제로 부착한 앵커의 권한 차이를 흐리게 만든다. | 권한 | KG-1 |
| M-3 | 검문소 | Reviewer terminal decision | 검문소는 여러 검토자가 동시에 판단하거나 충돌하는 audit/event ordering 문제를 설명하지 못한다. | 동시성 | KG-3 |
| M-4 | 검문소 | Composite public-data claim | 검문소의 단일 확인증 이미지는 하나의 Claim이 여러 출처 앵커를 요구할 수 있는 경우를 설명하지 못한다. | 일관성 | KG-7 |
