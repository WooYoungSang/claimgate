---
id: ddd-events
title: 명령과 사건
status: generated
type: ddd-view
---

# 명령과 사건

> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고
> `./kbctl render events`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.

명령이 도메인 행위를 부르고, 그 행위가 성공하면 과거형 사건이 남는다.

```
Command
   ↓
Domain Logic
   ↓
Event
```

## 명령

| 키 | 명령 | 행위자 | 시나리오 | 선행조건 | 만드는 사건 | spec |
|---|---|---|---|---|---|---|
| CMD-1 | ExtractCandidateClaims | Local Gemma/RAG extractor | S-1 | source text exists; RAG corpus exists | EVT-1 |  |
| CMD-2 | CreateExtractedClaimFromCandidate | ClaimGate core | S-1 | CandidateClaim passes authority boundary | EVT-2 |  |
| CMD-3 | AttachSourceAnchor | Source anchoring workflow | S-1 | Claim is extracted; accepted Source Anchor exists | EVT-3 |  |
| CMD-4 | ApplyRiskDisposition | Deterministic risk engine | S-1 | Claim is anchored; domain risk rule selected | EVT-4 |  |
| CMD-5 | ApplyReviewerCorrection | Reviewer | S-1 | Claim is conflict or can be dispositioned to conflict; reviewer exists | EVT-5 |  |
| CMD-6 | CreateEvidencePack | ClaimGate projection boundary | S-1 | Claims and referenced Sources are available | EVT-6 |  |

## 사건

| 키 | 사건(과거형) | 시나리오 | 만든 명령 | 설명 | spec |
|---|---|---|---|---|---|
| EVT-1 | CandidateClaimsExtracted | S-1 | CMD-1 | Local Gemma/RAG 또는 fixture extractor가 CandidateClaim[]을 반환했다. |  |
| EVT-2 | ClaimCreatedAsExtracted | S-1 | CMD-2 | CandidateClaim이 core Claim extracted 상태로 변환됐다. |  |
| EVT-3 | SourceAnchorAttached | S-1 | CMD-3 | 검토 워크플로가 Claim에 권한 있는 Source Anchor를 연결했다. |  |
| EVT-4 | RiskDispositionApplied | S-1 | CMD-4 | 결정론적 risk rule trace가 Claim을 needs-evidence/conflict/aggregate-only 상태로 이동시켰다. |  |
| EVT-5 | ClaimCorrectedByReviewer | S-1 | CMD-5 | Reviewer가 source value 기준으로 Claim을 corrected terminal state로 전환했다. |  |
| EVT-6 | EvidencePackCreated | S-1 | CMD-6 | projectable claim만 Evidence Pack item으로 포함됐다. |  |
