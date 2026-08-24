---
id: ddd-glossary
title: 편재 언어 용어집
status: generated
type: ddd-view
---

# 편재 언어 용어집

> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고
> `./kbctl render glossary`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.

문서와 Go 식별자는 같은 Ubiquitous Language를 사용한다. 발견용 메타포 어휘는 Production Model에 넣지 않는다.
**「무엇이 아닌가」가 정의만큼 중요하다.**

| 키 | 문서어 | Go | 종류 | 정의 | 무엇이 아닌가 | spec |
|---|---|---|---|---|---|---|
| T-1 | Candidate Claim | CandidateClaim | value-object/adapter-output | AI 또는 fixture extractor가 제안한 extracted 상태 후보 주장. ClaimGate core Claim으로 전환되기 전에는 권한 있는 검토 산출물이 아니다. | Verified Claim, reviewer decision, Evidence Pack item |  |
| T-2 | Claim | Claim | aggregate-root-candidate | ClaimGate 검토 생명주기를 가진 주장 단위. 상태, 값, source anchor, correction, audit trail을 함께 가진다. | AI answer 전체, Source, Evidence Pack |  |
| T-3 | Source Anchor | SourceAnchor | value-object | Claim이 참조하는 원문 근거 위치. dataset row, text span, PDF page, web link 등으로 식별된다. | AI proposedAnchor 자체, source value 전체, reviewer decision |  |
| T-4 | Risk Disposition | RiskResult | value-object/domain-decision | 결정론적 risk rule trace가 만든 level, queue bucket, recommended review state. | AI score, reviewer terminal decision |  |
| T-5 | Reviewer Decision | Reviewer | actor | verified, corrected, rejected 같은 terminal transition을 발생시키는 사람 검토 행위자. | LLM output, deterministic risk engine |  |
| T-6 | Evidence Pack | EvidencePack | aggregate/snapshot | projectable claim item과 source metadata를 포함하는 재사용 가능한 근거 묶음. | Report, Graph, raw AI answer |  |
| T-7 | Domain Pack | DomainPack | bounded-context-extension | 도메인별 labels, entity types, anchor kinds, risk rules, report templates, fixtures를 제공하는 교체 가능 판단 팩. | Core invariant implementation, UI component |  |
| T-8 | Proposed Anchor | proposedAnchor | value-object/proposal | AI extractor가 후보 claim과 함께 제안한 근거 위치 후보. Source anchoring workflow가 accept하기 전에는 권한 있는 Source Anchor가 아니다. | Source Anchor, reviewer accepted evidence, projection input | INV-6 |
| T-9 | Extraction Provenance | ExtractionProvenance | value-object/metadata | 후보 추출에 사용된 local model tag, adapter id, prompt 또는 tuning card version, RAG corpus id 목록을 기록한 추적 정보. | truth score, reviewer decision, risk trace | INV-8 |
| T-10 | Atomic Claim | AtomicClaim | modelling-rule | 하나의 primary Source Anchor로 검토 가능한 최소 주장 단위. 복합 주장은 여러 Atomic Claim으로 분해되어야 한다. | long AI answer, multi-fact paragraph, Evidence Pack | INV-7 |
| T-11 | Evidence Pack Snapshot | EvidencePackSnapshot | aggregate/snapshot | 생성 시점의 projectable claim과 source metadata를 고정한 불변 근거 묶음. 이후 변경은 새 snapshot 또는 supersede 관계로 표현한다. | mutable report draft, current claim database, graph view | INV-9 |
| T-12 | Sampling Policy | RiskQueueOptions | policy | green claim false-negative 방어를 위해 어느 비율/최소 건수를 샘플 검토할지 정하는 정책. mechanism은 core, default ownership은 pack 또는 host app이다. | risk rule trace, AI risk score | CON-4 |
| T-13 | Source Anchoring Workflow | AttachAnchorInput | application/domain workflow | CandidateClaim 또는 Claim의 근거 후보를 검토해 권한 있는 Source Anchor로 부착할지 결정하는 workflow. | LLM extraction, risk scoring, terminal reviewer decision | INV-6 |
