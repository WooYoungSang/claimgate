---
id: ddd-questions
title: 도메인 질문 백로그
status: generated
type: ddd-view
---

# 도메인 질문 백로그

> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고
> `./kbctl render questions`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.

모르는 것은 메우지 않고 질문으로 남긴다.

```
UNKNOWN → 도메인 질문 → 답 → 도메인 규칙 → 모델 갱신
```

**열린 질문 0 · 답한 질문 8**

| 키 | 질문 | 출처 | 상태 | 우선순위 | 추천 | 막는 시나리오 | 답 |
|---|---|---|---|---|---|---|---|
| KG-1 | Gemma가 제안한 proposedAnchor를 어떤 조건에서 실제 Source Anchor로 승격할 수 있는가? | S-1 | ANSWERED | P0 | proposedAnchor는 절대 자동 승격하지 않는다. Source anchoring workflow가 sourceId/kind/locator/excerpt를 검토해 accept하면 AttachSourceAnchor command가 실제 Source Anchor를 붙인다. | S-1 | D-007: proposedAnchor는 자동 승격되지 않고 source anchoring workflow가 accept할 때만 실제 Source Anchor가 된다. |
| KG-2 | RAG 검색 결과가 없거나 서로 충돌할 때 후보 주장은 rejected가 되는가, needs-evidence가 되는가, 아니면 추출 단계에서 제외되는가? | S-1 | ANSWERED | P1 | RAG no-hit은 extraction failure 또는 needs-evidence candidate로 분리하고, RAG conflict는 extracted candidate 유지 후 deterministic risk에서 conflict로 보낸다. | S-1 | D-011: RAG no-hit은 extraction failure 또는 needs-evidence candidate, RAG conflict는 extracted 유지 후 deterministic risk conflict. |
| KG-3 | 동일 claim id 또는 동일 source anchor에 대해 두 검토자가 동시에 다른 terminal decision을 내리면 어떤 결정이 정본인가? | S-1 | ANSWERED | P0-after-server | 현재 v0 in-memory slice에서는 단일 reviewer terminal decision만 허용한다고 문서화한다. repository/server가 생기면 optimistic concurrency와 append-only decision event ordering을 도입한다. | S-1 | D-013/D-041/D-044: v0는 단일 reviewer terminal decision만 허용한다. core는 claimReviewVersion + applyTerminalReviewerDecision(expectedVersion)로 optimistic concurrency hook을 제공하고, ClaimRepository.save(expectedVersion)로 future repository/server compare-and-set 경계를 모델링한다. 실제 persistence adapter는 append-only decision event ordering을 보존해야 한다. |
| KG-4 | 튜닝된 Gemma 모델 산출물의 버전, 데이터셋, 프롬프트/어댑터 버전은 Claim audit 또는 Evidence Pack metadata 중 어디에 보존해야 하는가? | S-1 | ANSWERED | P0 | Gemma model tag, adapter id, prompt/tuning-card version, RAG corpus ids는 EvidencePack metadata와 Claim create audit reason/actor id에 보존한다. 단, 이 metadata는 authority가 아니라 provenance다. | S-1 | D-008/D-042: model tag, adapter id, prompt/tuning-card version, RAG corpus ids, retrieval mode, tuning artifact status, and aiAuthority=candidate-only are preserved via core ExtractionProvenance helpers in EvidencePack metadata and Claim creation audit reason/actor id. They remain provenance, never verification authority. |
| KG-5 | Evidence Pack 생성 후 Claim이 수정되면 기존 pack은 불변 snapshot으로 남는가, 아니면 pack 재발행/폐기 이벤트가 필요한가? | S-1 | ANSWERED | P1 | EvidencePack은 생성 시점의 immutable snapshot으로 취급한다. Claim이 이후 바뀌면 새 pack을 발행하고 이전 pack을 수정하지 않는다. | S-1 | D-009: EvidencePack은 immutable snapshot이며 이후 변경은 새 pack 발행 또는 supersede 관계로 표현한다. |
| KG-6 | green으로 분류된 후보의 샘플링 비율은 pack별 정책인가, 전체 ClaimGate 정책인가? | S-1 | ANSWERED | P2 | core는 sampling mechanism만 제공하고 sampling policy default는 DomainPack 또는 host application이 정한다. | S-1 | D-012/D-043: core owns deterministic sampling mechanism only. DomainPack may publish greenSamplingPolicyRecommendation, and host application must intentionally pass pack or host options into buildRiskQueue; no hidden global green sampling default exists. |
| KG-7 | Claim이 여러 Source Anchor를 필요로 하는 복합 주장일 때 하나의 anchor만으로 verified/corrected를 허용할 수 있는가? | S-1 | ANSWERED | P0 | v0 Claim은 single primary Source Anchor를 유지하되, composite claim은 Claim을 atomic subclaims로 분해한다. multi-anchor aggregate는 별도 scenario에서 다룬다. | S-1 | D-010: v0는 single primary Source Anchor와 atomic subclaim decomposition을 사용하고 multi-anchor aggregate는 별도 scenario로 미룬다. |
| KG-9 | RTX 4090 node에서 Ollama-compatible Gemma 4 12B endpoint를 어떤 model tag와 port로 실행·고정하고 영상 전 smoke evidence를 남길 것인가? | S-1 | ANSWERED | P0 | Use pnpm demo:ai:gemma as the video AI path on the RTX 4090 node. Capture terminal output showing provider=ollama, model=gemma4:12b, aiAuthority=candidate-only, RAG retrieval mode, and correction Evidence Pack. | S-1 | D-035: use CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b with pnpm demo:ai:gemma on the RTX 4090 node; the smoke passed and produced provider=ollama/model=gemma4:12b Evidence Pack metadata. |

## 결정 질문지

추천안은 확정 규칙이 아니다. 선택된 답만 `ANSWERED`로 전환한다.

### KG-1

Gemma가 제안한 proposedAnchor를 어떤 조건에서 실제 Source Anchor로 승격할 수 있는가?

**우선순위:** P0

**선택지**

A: reviewer/source workflow acceptance required; B: deterministic exact-match auto-accept for fixture only; C: never use proposedAnchor

**추천:** proposedAnchor는 절대 자동 승격하지 않는다. Source anchoring workflow가 sourceId/kind/locator/excerpt를 검토해 accept하면 AttachSourceAnchor command가 실제 Source Anchor를 붙인다.

**추천 근거:** AI Curator Not Judge와 No Anchor No Claim을 동시에 지키려면 제안과 부착 권한을 분리해야 한다.

**확정 답:** D-007: proposedAnchor는 자동 승격되지 않고 source anchoring workflow가 accept할 때만 실제 Source Anchor가 된다.

### KG-2

RAG 검색 결과가 없거나 서로 충돌할 때 후보 주장은 rejected가 되는가, needs-evidence가 되는가, 아니면 추출 단계에서 제외되는가?

**우선순위:** P1

**선택지**

A: no-hit rejects extraction; B: no-hit creates needs-evidence candidate; C: no-hit/conflict both enter review queue

**추천:** RAG no-hit은 extraction failure 또는 needs-evidence candidate로 분리하고, RAG conflict는 extracted candidate 유지 후 deterministic risk에서 conflict로 보낸다.

**추천 근거:** 추출 단계에서 truth judgment를 하지 않으면서도 출처 부족과 출처 충돌을 다르게 관찰할 수 있다.

**확정 답:** D-011: RAG no-hit은 extraction failure 또는 needs-evidence candidate, RAG conflict는 extracted 유지 후 deterministic risk conflict.

### KG-3

동일 claim id 또는 동일 source anchor에 대해 두 검토자가 동시에 다른 terminal decision을 내리면 어떤 결정이 정본인가?

**우선순위:** P0-after-server

**선택지**

A: single terminal decision invariant; B: latest reviewer wins; C: quorum/appeal workflow

**추천:** 현재 v0 in-memory slice에서는 단일 reviewer terminal decision만 허용한다고 문서화한다. repository/server가 생기면 optimistic concurrency와 append-only decision event ordering을 도입한다.

**추천 근거:** 현재 제품에는 서버/DB가 없으므로 정책을 과하게 구현하지 않되, future persistence가 생길 때 aggregate version이 필요함을 숨기지 않는다.

**확정 답:** D-013/D-041/D-044: v0는 단일 reviewer terminal decision만 허용한다. core는 claimReviewVersion + applyTerminalReviewerDecision(expectedVersion)로 optimistic concurrency hook을 제공하고, ClaimRepository.save(expectedVersion)로 future repository/server compare-and-set 경계를 모델링한다. 실제 persistence adapter는 append-only decision event ordering을 보존해야 한다.

### KG-4

튜닝된 Gemma 모델 산출물의 버전, 데이터셋, 프롬프트/어댑터 버전은 Claim audit 또는 Evidence Pack metadata 중 어디에 보존해야 하는가?

**우선순위:** P0

**선택지**

A: EvidencePack metadata only; B: Claim audit only; C: both metadata and audit with authority disclaimer

**추천:** Gemma model tag, adapter id, prompt/tuning-card version, RAG corpus ids는 EvidencePack metadata와 Claim create audit reason/actor id에 보존한다. 단, 이 metadata는 authority가 아니라 provenance다.

**추천 근거:** 출품 영상에서는 local model provenance를 보여줘야 하지만 AI가 검증 주체로 오해되면 안 된다.

**확정 답:** D-008/D-042: model tag, adapter id, prompt/tuning-card version, RAG corpus ids, retrieval mode, tuning artifact status, and aiAuthority=candidate-only are preserved via core ExtractionProvenance helpers in EvidencePack metadata and Claim creation audit reason/actor id. They remain provenance, never verification authority.

### KG-5

Evidence Pack 생성 후 Claim이 수정되면 기존 pack은 불변 snapshot으로 남는가, 아니면 pack 재발행/폐기 이벤트가 필요한가?

**우선순위:** P1

**선택지**

A: immutable snapshot and supersede; B: mutable latest pack; C: regenerate without history

**추천:** EvidencePack은 생성 시점의 immutable snapshot으로 취급한다. Claim이 이후 바뀌면 새 pack을 발행하고 이전 pack을 수정하지 않는다.

**추천 근거:** Evidence Pack First 원칙은 재현 가능한 감사 산출물이 핵심이므로 과거 pack mutation은 피해야 한다.

**확정 답:** D-009: EvidencePack은 immutable snapshot이며 이후 변경은 새 pack 발행 또는 supersede 관계로 표현한다.

### KG-6

green으로 분류된 후보의 샘플링 비율은 pack별 정책인가, 전체 ClaimGate 정책인가?

**우선순위:** P2

**선택지**

A: core-owned fixed default; B: DomainPack policy; C: host app policy with pack recommendation

**추천:** core는 sampling mechanism만 제공하고 sampling policy default는 DomainPack 또는 host application이 정한다.

**추천 근거:** 도메인마다 false-negative risk tolerance가 다르므로 core에 단일 비율을 박으면 도메인 정책이 core로 새어 들어온다.

**확정 답:** D-012/D-043: core owns deterministic sampling mechanism only. DomainPack may publish greenSamplingPolicyRecommendation, and host application must intentionally pass pack or host options into buildRiskQueue; no hidden global green sampling default exists.

### KG-7

Claim이 여러 Source Anchor를 필요로 하는 복합 주장일 때 하나의 anchor만으로 verified/corrected를 허용할 수 있는가?

**우선순위:** P0

**선택지**

A: single primary anchor only; B: multi-anchor Claim now; C: decompose composite claim into atomic claims

**추천:** v0 Claim은 single primary Source Anchor를 유지하되, composite claim은 Claim을 atomic subclaims로 분해한다. multi-anchor aggregate는 별도 scenario에서 다룬다.

**추천 근거:** 현재 SourceAnchor/Claim model과 demo를 보존하면서 복합 주장의 허위 단일 앵커 문제를 피할 수 있다.

**확정 답:** D-010: v0는 single primary Source Anchor와 atomic subclaim decomposition을 사용하고 multi-anchor aggregate는 별도 scenario로 미룬다.

### KG-9

RTX 4090 node에서 Ollama-compatible Gemma 4 12B endpoint를 어떤 model tag와 port로 실행·고정하고 영상 전 smoke evidence를 남길 것인가?

**우선순위:** P0

**선택지**

A: Ollama default 127.0.0.1:11434 with gemma4:12b tag; B: documented alternate local port/model tag via env vars

**추천:** Use pnpm demo:ai:gemma as the video AI path on the RTX 4090 node. Capture terminal output showing provider=ollama, model=gemma4:12b, aiAuthority=candidate-only, RAG retrieval mode, and correction Evidence Pack.

**추천 근거:** The product demo is no longer mock-based; actual local model runtime readiness must be proven before recording.

**확정 답:** D-035: use CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b with pnpm demo:ai:gemma on the RTX 4090 node; the smoke passed and produced provider=ollama/model=gemma4:12b Evidence Pack metadata.
