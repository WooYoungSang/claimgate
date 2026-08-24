---
id: ddd-stories
title: 도메인 스토리
status: generated
type: ddd-view
---

# 도메인 스토리

> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고
> `./kbctl render stories`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.

DDD 용어를 붙이지 않고 평범한 말로, 실제로 무슨 일이 일어나는지 적은 것이다.

## S-1 · Local Gemma/RAG 후보 주장 → Evidence Pack 검토

```
사용자가 AI 답변을 입력한다. Local Gemma 4 12B RAG 추출기는 공공데이터 RAG 문맥을 참고해 후보 주장만 제안한다. 후보는 extracted 상태의 Claim으로 변환된다. 검토 워크플로는 후보에 원문 Source Anchor를 연결한다. 결정론적 도메인 규칙은 AI 값과 출처 값을 비교해 risk disposition을 만든다. 충돌하면 검토자가 출처 값을 기준으로 정정한다. verified 또는 corrected 상태와 reviewer audit을 가진 주장만 Evidence Pack에 들어간다. Evidence Pack에서만 report와 graph가 파생된다.
```
