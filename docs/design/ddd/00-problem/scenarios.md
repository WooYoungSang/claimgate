---
id: ddd-scenarios
title: 비즈니스 시나리오
status: generated
type: ddd-view
---

# 비즈니스 시나리오

> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고
> `./kbctl render scenarios`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.

**한 번에 하나만 `ACTIVE`다.** 나머지는 진술만 적어 두고 모델링하지 않는다.

| 키 | 시나리오 | 상태 | 나르는 불변식 |
|---|---|---|---|
| S-1 | Local Gemma/RAG 후보 주장 → Evidence Pack 검토 | ACTIVE |  |

## S-1 · Local Gemma/RAG 후보 주장 → Evidence Pack 검토

| | |
|---|---|
| **상태** | ACTIVE |
| **행위자** | 공공데이터 검토자 |
| **방아쇠** | 사용자가 AI 답변 또는 문서에서 후보 주장 추출을 요청한다. |
| **바라는 결과** | 출처 앵커와 사람 검토를 통과한 주장만 Evidence Pack, report, graph로 투영된다. |
| **비즈니스 중요성** | OSSContest 데모의 핵심 시나리오이며 ClaimGate의 AI Curator Not Judge, No Anchor No Claim, Evidence Pack First 원칙을 동시에 검증한다. |
