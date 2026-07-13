# 2026 외교 공공데이터·AI 활용 경진대회 Claim-Evidence Matrix

## RED evidence — owned file absence before creation

| RED ID | Claim | Evidence refs | Evidence type | Result |
|---|---|---|---|---|
| RED-001 | 본 U1 시작 시점에 이 파일(`docs/submission/2026-mofa-ai/claim-evidence-matrix.md`)은 존재하지 않았다. | command: `test ! -e docs/submission/2026-mofa-ai/claim-evidence-matrix.md; echo "absent_exit=$?"` → `absent_exit=0` (worktree: `/home/jang/Workspace/warvis-claimgate-worktrees/product-proposal-delivery-claimgate-oda`, branch: `forge/product-proposal-delivery-claimgate-oda`) | command | 이 파일은 RED 확인 이후 U1 소유 범위에서 새로 생성되었다. |

## Scope and anti-overclaim rules

- **Matrix purpose**: 2026 외교 공공데이터·AI 활용 경진대회 제안서의 주장과 근거를 보수적으로 연결한다.
- **Current product scope**: 현재 구현된 것은 외교/ODA 특화 제품이 아니라 `ClaimGate v0`의 오프라인·결정론적·fixture-first 범용 프레임워크다.
- **Planned ODA composition scope**: 외교부/산하기관 공개데이터를 활용하는 ODA 제안 구성은 이 문서에서 **ODA_PRODUCT_COMPOSITION**으로만 표시한다. 이는 현재 구현 완료 주장이 아니다.
- **Unsupported claims**: 현재 코드/테스트/명령으로 입증되지 않는 정확도, 시간절감, 고객, 운영 API, 실제 LLM, OCR, 서버, DB, 인증, 실시간 운영 성능은 `CUT` 또는 `FUTURE_ROADMAP`으로만 둔다.

## Official requirement anchors

공식 요구사항은 저장소의 원본 HWP `docs/competition-source/외교 공공데이터 · AI 활용 경진대회 개최 공고문.hwp`를 기준으로 한다. 다음 명령으로 텍스트를 재현하고, 아래 표의 **검색 표제어**로 해당 항목을 확인한다.

```bash
PYTHONPATH=/tmp/pyhwp /tmp/pyhwp/bin/hwp5html --html \
  --output /tmp/claimgate-oda-official-notice.html \
  'docs/competition-source/외교 공공데이터 · AI 활용 경진대회 개최 공고문.hwp'
```

HWP 표의 셀 경계 때문에 일부 심사기준은 HTML에서 여러 `span`으로 분리된다. SEC 표제어는 전체 문구로, JC 표제어는 아래에 적은 토큰 쌍으로 확인한다.

### Official sections — covered 6/6

| Section ID | Official section | Official evidence ref | Coverage rows |
|---|---|---|---|
| SEC-1 | 제품 또는 서비스의 목적 또는 배경 | official HWP; 검색 표제어: `제품 또는 서비스의 목적 또는 배경` | CE-001, CE-002, CE-016 |
| SEC-2 | 제품 또는 서비스의 기능 및 특징 | official HWP; 검색 표제어: `제품 또는 서비스의 기능 및 특징` | CE-003, CE-004, CE-005, CE-006, CE-017 |
| SEC-3 | 외교부 및 산하기관 공공데이터 활용 방안 | official HWP; 검색 표제어: `외교부 및 산하기관 공공데이터 활용 방안`, `외교부 공공데이터 1건 이상` | CE-010, CE-011, CE-012, CE-013, CE-014 |
| SEC-4 | 기존 제품(서비스)와 차별성 및 독창성 | official HWP; 검색 표제어: `기존 제품(서비스)와 차별성 및 독창성` | CE-007, CE-008, CE-015 |
| SEC-5 | 기대효과 | official HWP; 검색 표제어: `기대효과` | CE-018, CE-019 |
| SEC-6 | 제품 및 서비스의 사업(창업) 계획 | official HWP; 검색 표제어: `제품 및 서비스의 사업(창업) 계획` | CE-020, CE-021 |

### Judging criteria — covered 6/6

| Criterion ID | Judging criterion | Official evidence ref | Coverage rows |
|---|---|---|---|
| JC-1 | 공공데이터 활용 | official HWP; 검색 표제어: `공공데이터 활용` | CE-010, CE-011, CE-012, CE-013, CE-014 |
| JC-2 | AI 기술 활용 | official HWP; 검색 토큰: `AI`, `기술 활용` | CE-003, CE-006, CE-017 |
| JC-3 | AI 서비스 | official HWP; 검색 토큰: `AI`, `서비스` | CE-002, CE-004, CE-017 |
| JC-4 | 독창성 | official HWP; 검색 표제어: `독창성` | CE-007, CE-008, CE-015 |
| JC-5 | 발전 가능성 | official HWP; 검색 토큰: `발전`, `가능성` | CE-009, CE-018, CE-020 |
| JC-6 | ESG혁신 | official HWP; 검색 토큰: `ESG`, `혁신` | CE-016, CE-019, CE-021 |

## Public data candidates for planned ODA fixture composition

These are exact public-data names/URLs for proposal composition. They are **not** current implemented data integrations.

| Data ID | Exact public-data name | URL | Planned use in proposal | Layer | Disposition |
|---|---|---|---|---|---|
| DATA-001 | 외교부_국가별 안전정보 | https://www.data.go.kr/data/15000760/openapi.do | 국가/지역별 안전 공지 문장을 Source Anchor 후보로 삼아 AI 생성 문장의 국가·시점·위험유형 불일치를 검토하는 ODA 협력국 리스크 fixture 후보 | ODA_PRODUCT_COMPOSITION | FUTURE_ROADMAP until an ODA DomainPack fixture is implemented |
| DATA-002 | 한국국제협력단_국가별 협력사업 | https://www.data.go.kr/data/15099198/openapi.do?recommendDataYn=Y | 수원국별 ODA 사업 개요·유형·기간·성과 문장을 Source Anchor 후보로 삼아 사업 설명/성과 주장 검토 fixture 후보 | ODA_PRODUCT_COMPOSITION | FUTURE_ROADMAP until an ODA DomainPack fixture is implemented |
| DATA-003 | 한국국제협력단_ODA 용어사전 | https://www.data.go.kr/data/15052909/fileData.do?recommendDataYn=Y | ODA 용어 정의의 단위/개념 불일치 검토용 보조 Source Anchor 후보 | ODA_PRODUCT_COMPOSITION | FUTURE_ROADMAP until an ODA DomainPack fixture is implemented |
| DATA-004 | 한국국제교류재단_공공외교 사업 정보 | https://www.data.go.kr/data/15099202/openapi.do | 공공외교 사업명·기관·기간·성과 설명의 출처/기간/기관 불일치 검토 fixture 후보 | ODA_PRODUCT_COMPOSITION | FUTURE_ROADMAP until an ODA DomainPack fixture is implemented |
| DATA-005 | 한아프리카재단_아프리카혁신스타트업디렉터리 | https://www.data.go.kr/data/15099203/openapi.do | 아프리카 혁신 스타트업·국가·분야 정보의 엔티티/국가명 불일치 검토 fixture 후보 | ODA_PRODUCT_COMPOSITION | FUTURE_ROADMAP until an ODA DomainPack fixture is implemented |
| DATA-006 | 한아프리카재단_지자체_아프리카 교류협력 사례 | https://www.data.go.kr/data/15113634/fileData.do | 지자체-아프리카 교류협력 사례를 ODA/공공외교 협력 네트워크 설명 검토 fixture 후보로 사용 | ODA_PRODUCT_COMPOSITION | FUTURE_ROADMAP until an ODA DomainPack fixture is implemented |

## Claim-evidence matrix

| Row ID | Claim | Layer | Exact evidence refs | Evidence type | Official section | Judging criterion | Disposition |
|---|---|---|---|---|---|---|---|
| CE-001 | ClaimGate는 AI가 만든 공공데이터 주장을 사람이 검토 가능한 Source Anchor, deterministic risk trace, reviewer decision, Evidence Pack 흐름으로 바꾸는 프레임워크다. | CURRENT_PRODUCT | `docs/competition-report.md:5-17`; `docs/product-manifesto.md:1-10`; `packages/core/src/claim.ts:4-12` | repo_doc + code | SEC-1 제품 또는 서비스의 목적 또는 배경 | JC-3 AI 서비스 | USE_IN_PROPOSAL |
| CE-002 | 현재 제품은 자동 진실판정기가 아니라 “AI Curator, Not Judge” 경계 위에 세워진 source-grounded reviewer workflow다. | CURRENT_PRODUCT | `docs/competition-report.md:19-31`; `docs/product-manifesto.md:21-28`; `docs/ai-extraction-boundary.md:1-15` | repo_doc | SEC-1 제품 또는 서비스의 목적 또는 배경 | JC-3 AI 서비스 | USE_IN_PROPOSAL |
| CE-003 | AI adapter는 v0에서 candidate claim/proposed anchor만 내며 verify truth, score risk, attach anchor, reviewer decision, project evidence 권한을 갖지 않는다. | CURRENT_PRODUCT | `packages/core/src/extraction.ts:32-60`; `packages/core/test/extraction.test.ts:58-70,84-111,113-132`; `docs/ai-extraction-boundary.md:16-40` | code + test + repo_doc | SEC-2 제품 또는 서비스의 기능 및 특징 | JC-2 AI 기술 활용 | USE_IN_PROPOSAL |
| CE-004 | No Anchor No Claim: Source Anchor 없는 claim은 `verified` 또는 `corrected`가 될 수 없다. | CURRENT_PRODUCT | `packages/core/src/verification.ts:45-63`; `packages/core/test/verification-state-machine.test.ts:79-103`; `docs/product-manifesto.md:13-19`; `docs/submission-evidence-map.md:14-17` | code + test + repo_doc | SEC-2 제품 또는 서비스의 기능 및 특징 | JC-3 AI 서비스 | USE_IN_PROPOSAL |
| CE-005 | Source Anchor는 excel-cell, pdf-page, dataset-row, text-span, web-link를 지원하고 deterministic anchor ID를 만든다. | CURRENT_PRODUCT | `packages/core/src/source-anchor.ts:1-57,59-82`; `packages/core/test/source-anchor.test.ts:4-60`; `packages/core/src/claim.ts:96-130` | code + test | SEC-2 제품 또는 서비스의 기능 및 특징 | JC-1 공공데이터 활용 | USE_IN_PROPOSAL |
| CE-006 | Risk-first Review는 source existence, value/unit/date/entity mismatch, contradiction, staleness, aggregate-only를 deterministic rule trace로 계산하며 AI-provided risk score를 거부한다. | CURRENT_PRODUCT | `packages/core/src/risk/index.ts:6-18,30-65,130-194`; `packages/core/test/risk/risk-engine.test.ts:22-74`; `docs/product-manifesto.md:29-35` | code + test + repo_doc | SEC-2 제품 또는 서비스의 기능 및 특징 | JC-2 AI 기술 활용 | USE_IN_PROPOSAL |
| CE-007 | Green sampling은 low-risk green claim을 모두 무시하지 않고 샘플링 비용을 review-cost accounting에 포함한다. | CURRENT_PRODUCT | `packages/core/src/risk/index.ts:67-88,196-221,250-271,324-330`; `packages/core/test/risk/fake-work-reduction.test.ts:26-51`; `docs/product-manifesto.md:29-35,45-51`; `docs/submission-evidence-map.md:40-49` | code + test + repo_doc | SEC-4 기존 제품(서비스)와 차별성 및 독창성 | JC-4 독창성 | USE_IN_PROPOSAL |
| CE-008 | Evidence Pack First: reusable output은 verified/corrected claims only이며 report/graph는 Evidence Pack의 downstream projection이다. | CURRENT_PRODUCT | `packages/core/src/evidence.ts:8-29,43-85`; `packages/core/src/projection-guards.ts:16-51,83-102`; `scripts/handoff-smoke.ts:41-60`; `docs/competition-report.md:69-72` | code + script + repo_doc | SEC-4 기존 제품(서비스)와 차별성 및 독창성 | JC-4 독창성 | USE_IN_PROPOSAL |
| CE-009 | Human terminal decisions are mandatory: terminal states require reviewer; audit records the reviewer transition and corrected values. | CURRENT_PRODUCT | `packages/core/src/verification.ts:61-71,77-91,94-101`; `packages/core/test/verification-state-machine.test.ts:105-118,204-230,233-260`; `docs/submission-evidence-map.md:20` | code + test + repo_doc | SEC-2 제품 또는 서비스의 기능 및 특징 | JC-5 발전 가능성 | USE_IN_PROPOSAL |
| CE-010 | 현재 구현된 DomainPack은 civic/health fixture pack이며 외교/ODA pack은 아직 없다. 따라서 “ODA 제품” 주장은 현재 구현 완료가 아니라 planned fixture composition이다. | CURRENT_PRODUCT | `docs/domain-packs.md:1-11,24-42`; `packs/civic-data/src/index.ts:23-62`; `packs/health-data/src/index.ts:23-63`; `docs/package-boundaries.md:5-11` | repo_doc + code | SEC-3 외교부 및 산하기관 공공데이터 활용 방안 | JC-1 공공데이터 활용 | USE_WITH_LIMIT: explicitly say current generic framework, not implemented ODA pack |
| CE-011 | 경진대회는 외교부, KOICA, KF, 한·아프리카재단 개방데이터를 활용하는 제품/서비스 개발을 허용하며, 외교부 공공데이터 1건 이상 활용이 필수다. | ODA_PRODUCT_COMPOSITION | official HWP + reproduction command above; 검색 표제어: `외교부 공공데이터 1건 이상`, `한국국제협력단`, `한국국제교류재단`, `한·아프리카재단` | official_hwp_extract + command | SEC-3 외교부 및 산하기관 공공데이터 활용 방안 | JC-1 공공데이터 활용 | USE_IN_PROPOSAL |
| CE-012 | Planned ODA fixture composition can use `외교부_국가별 안전정보` as a Source Anchor candidate for country safety claims, but this is not currently wired into a pack. | ODA_PRODUCT_COMPOSITION | DATA-001 URL; `packages/core/src/domain-pack.ts:52-88`; `packages/core/src/source-anchor.ts:37-57` | official_data_portal + code | SEC-3 외교부 및 산하기관 공공데이터 활용 방안 | JC-1 공공데이터 활용 | FUTURE_ROADMAP until fixture added |
| CE-013 | Planned ODA fixture composition can use `한국국제협력단_국가별 협력사업` and `한국국제협력단_ODA 용어사전` to review ODA project/terminology claims, but current repo has no KOICA fixture. | ODA_PRODUCT_COMPOSITION | DATA-002 URL; DATA-003 URL; `packs/civic-data/src/index.ts:44-61`; `packs/health-data/src/index.ts:44-60` show current non-ODA fixture shape only | official_data_portal + code | SEC-3 외교부 및 산하기관 공공데이터 활용 방안 | JC-1 공공데이터 활용 | FUTURE_ROADMAP until fixture added |
| CE-014 | Planned ODA/public-diplomacy composition can use `한국국제교류재단_공공외교 사업 정보`, `한아프리카재단_아프리카혁신스타트업디렉터리`, and `한아프리카재단_지자체_아프리카 교류협력 사례`; current repo must not claim these are live integrations. | ODA_PRODUCT_COMPOSITION | DATA-004 URL; DATA-005 URL; DATA-006 URL; `docs/reproducibility.md:72-90`; `docs/submission-evidence-map.md:40-49` | official_data_portal + repo_doc | SEC-3 외교부 및 산하기관 공공데이터 활용 방안 | JC-1 공공데이터 활용 | FUTURE_ROADMAP until fixture added |
| CE-015 | DomainPack reuse is the main reusability/differentiation claim: the same core/UI contract can host different domain judgment without moving domain logic into core. | CURRENT_PRODUCT | `packages/core/src/domain-pack.ts:76-88`; `packages/conformance/src/index.ts:36-88`; `packs/civic-data/test/pack.test.ts:6-17`; `packs/health-data/test/pack.test.ts:6-17`; `docs/domain-packs.md:1-11,24-42` | code + test + repo_doc | SEC-4 기존 제품(서비스)와 차별성 및 독창성 | JC-4 독창성 | USE_IN_PROPOSAL |
| CE-016 | ODA/social-value framing should be “public-data AI claim review reduces unsupported policy/business narrative risk,” not measured social impact, customer adoption, or real-world accuracy. | ODA_PRODUCT_COMPOSITION | official HWP + reproduction command above; 검색 표제어: `기대효과`; `docs/submission-evidence-map.md:27-49`; `docs/competition-report.md:114-118`; `docs/qa-simulation-harness.md:180-194` | official_hwp_extract + repo_doc | SEC-5 기대효과 | JC-6 ESG혁신 | USE_WITH_LIMIT |
| CE-017 | A real LLM is not implemented; current AI evidence is fixture-only candidate extraction and future adapter boundary tests. | CURRENT_PRODUCT | `docs/ai-extraction-boundary.md:42-60`; `packages/core/test/extraction.test.ts:102-132`; `docs/competition-report.md:77-82,114-118`; `docs/reproducibility.md:72-90` | repo_doc + test | SEC-2 제품 또는 서비스의 기능 및 특징 | JC-2 AI 기술 활용 | USE_WITH_LIMIT: present as AI boundary, not live LLM |
| CE-018 | QA framing is supported for offline deterministic scenario validation, not external production QA or user acceptance. | CURRENT_PRODUCT | `docs/qa-simulation-harness.md:1-31,33-48`; `scripts/run-simulation-qa.mjs:1-22,45-110`; `package.json:18-20` | repo_doc + script | SEC-5 기대효과 | JC-5 발전 가능성 | USE_IN_PROPOSAL |
| CE-019 | Performance framing is supported only for deterministic framework workload; it is not LLM latency, extraction accuracy, or production latency. | CURRENT_PRODUCT | `scripts/framework-performance-eval.ts:20-24,61-63,117-140`; `docs/submission-evidence-map.md:27-38,40-49`; `docs/verification-matrix.md:41-47` | script + repo_doc | SEC-5 기대효과 | JC-6 ESG혁신 | USE_WITH_LIMIT |
| CE-020 | Business/창업 plan may describe a roadmap from generic framework → ODA DomainPack fixture → optional real adapters, but cannot claim a launched service, customers, or revenue. | FUTURE_ROADMAP | official HWP + reproduction command above; 검색 표제어: `제품 및 서비스의 사업(창업) 계획`; `docs/competition-submission.md:69-88`; `docs/reproducibility.md:99-102`; `docs/submission-evidence-map.md:40-49` | official_hwp_extract + repo_doc | SEC-6 제품 및 서비스의 사업(창업) 계획 | JC-5 발전 가능성 | FUTURE_ROADMAP |
| CE-021 | External submission, public release, portal action, and protected go/no-go remain human/operator actions; this repo lane provides evidence only. | FUTURE_ROADMAP | `docs/competition-submission.md:9-15,69-88`; official HWP + reproduction command above; 검색 표제어: `접수`, `개인정보 수집·이용 동의서` | repo_doc + official_hwp_extract | SEC-6 제품 및 서비스의 사업(창업) 계획 | JC-6 ESG혁신 | USE_WITH_LIMIT |
| CE-022 | “ClaimGate eliminates hallucinations,” “automatically determines truth,” “proves real-world fact-checking accuracy,” “saves X% reviewer time,” “has live MOFA API integration,” and “uses actual LLM/OCR/parser” are unsupported current claims. | CURRENT_PRODUCT | `docs/submission-evidence-map.md:40-49`; `docs/qa-simulation-harness.md:5-8,180-194`; `scripts/run-simulation-qa.mjs:23-43,80-84`; `docs/product-manifesto.md:53-69` | repo_doc + script | SEC-1 제품 또는 서비스의 목적 또는 배경 | JC-3 AI 서비스 | CUT |

## Coverage summary

- **Official sections covered**: 6/6 — SEC-1, SEC-2, SEC-3, SEC-4, SEC-5, SEC-6.
- **Judging criteria covered**: 6/6 — JC-1 공공데이터 활용, JC-2 AI 기술 활용, JC-3 AI 서비스, JC-4 독창성, JC-5 발전 가능성, JC-6 ESG혁신.
- **Layer coverage**: `CURRENT_PRODUCT`, `ODA_PRODUCT_COMPOSITION`, `FUTURE_ROADMAP` all appear in the matrix.
- **What this matrix demonstrates**: ClaimGate currently supports a conservative, evidence-backed proposal narrative for a generic source-grounded claim review framework; an ODA-specific MOFA public-data product can be proposed as a planned DomainPack/fixture composition using the listed public-data sources.
- **What this matrix does not demonstrate**: It does not prove an implemented MOFA/ODA DomainPack, live public-data API integration, real LLM extraction, OCR/PDF/Excel parser, production service, customer traction, operational accuracy, or reviewer time-saving beyond deterministic fixture/framework evidence.
