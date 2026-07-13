# ClaimGate ODA: 공공데이터 기반 AI 서술 검토 제품 기획서

> 2026 외교 공공데이터·AI 활용 경진대회 제품·서비스 부문 제출 원고

## 표지

| 항목 | 내용 |
|---|---|
| 제품명 | ClaimGate ODA |
| 출품 구분 | 제품·서비스 부문 |
| 한 줄 가치제안 | ODA·공공외교 담당자가 AI 생성 국가·사업·성과 설명을 공식 공공데이터 Source Anchor와 연결해 위험 우선으로 검토하고, 정정 결과를 Evidence Pack으로 인계하는 검토 제품 |
| 1차 사용자 | ODA/공공외교 사업의 기획·검토·평가 담당자 |
| 현재 기반 | ClaimGate v0 오프라인·결정론적·fixture-first 범용 프레임워크 [CE-001][CE-002] |
| ODA 출품 구성 | 외교부·KOICA·KF·한아프리카재단 공개데이터를 Source Anchor 후보로 쓰는 ODA DomainPack 구성안 [CE-010][CE-011][CE-012][CE-013][CE-014] |

## 제품 상태 범례

| 범례 | 의미 | 본 기획서 사용 원칙 |
|---|---|---|
| **[현재]** | 현재 ClaimGate v0 프레임워크에서 코드·테스트·문서 근거가 있는 기능 | 제품의 핵심 신뢰 경계와 검토 흐름 설명에 사용 [CE-001][CE-003][CE-004][CE-006][CE-008][CE-009] |
| **[구성]** | 현재 범용 프레임워크 위에 ODA 제출용으로 구성할 DomainPack/fixture 설계 | 외교부 및 산하기관 공개데이터 활용 방안 설명에 사용하되 구현 완료로 쓰지 않음 [CE-010][CE-012][CE-013][CE-014] |
| **[로드맵]** | 승인된 선택적 adapter와 파일럿으로 확장할 계획 | 사업화 순서와 제출 후 운영자 과제에 사용 [CE-020][CE-021] |

## 심사기준 추적 요약

| 심사기준 | 본문 추적 위치 | 핵심 근거 |
|---|---|---|
| 공공데이터 활용 | 3장, 6장 | 외교부 필수 데이터 1건 이상 및 산하기관 데이터 후보를 Source Anchor 후보로 설계 [CE-011][CE-012][CE-013][CE-014] |
| AI 기술 활용 | 2장, 4장 | AI는 후보 claim/proposed anchor만 제안하고 결정론적 규칙이 위험 trace를 산출 [CE-003][CE-006][CE-017] |
| AI 서비스 | 1장, 2장 | 자동 판정이 아니라 source-grounded reviewer workflow [CE-001][CE-002][CE-004] |
| 독창성 | 4장 | green sampling, Evidence Pack First, DomainPack reuse [CE-007][CE-008][CE-015] |
| 발전 가능성 | 5장, 6장 | deterministic QA와 generic framework → ODA fixture DomainPack → adapter → pilot 로드맵 [CE-018][CE-020] |
| ESG혁신 | 5장, 6장 | 공공데이터 기반 AI 서술의 근거 부족 리스크를 줄이는 사회적 가치형 검토 흐름 [CE-016][CE-019][CE-021] |

<div class="page-break"></div>

## 1 목적 또는 배경

### 1.1 문제 정의: AI가 빠르게 쓴 설명은 검토자가 느리게 책임진다

ODA와 공공외교 사업 담당자는 국가 현황, 안전 이슈, 사업 성과, 협력기관, 용어 정의를 반복적으로 작성·검토한다. 생성형 AI는 초안 작성 속도를 높일 수 있지만, 담당자가 최종적으로 확인해야 하는 질문은 여전히 남는다.

- 이 국가 설명은 최신 안전정보와 충돌하지 않는가?
- 이 사업 설명은 실제 공개된 사업명·기간·대상국·성과 표현과 맞는가?
- ODA 용어와 공공외교 성과 표현이 공식 정의나 공개데이터 필드와 어긋나지 않는가?
- 검토 후 정정한 내용을 다음 보고서·브리핑·인수인계에 재사용할 수 있는가?

ClaimGate ODA의 출발점은 “AI가 그럴듯하게 쓴 문장”을 “사람이 책임지고 판단할 수 있는 근거 연결 검토 항목”으로 바꾸는 것이다. 현재 ClaimGate v0는 AI가 만든 공공데이터 주장을 Source Anchor, deterministic risk trace, reviewer decision, Evidence Pack 흐름으로 바꾸는 범용 프레임워크다 [CE-001]. 또한 현재 제품은 자동 판정기가 아니라 “AI Curator, Not Judge” 경계 위에서 사람이 최종 판단하는 reviewer workflow다 [CE-002][CE-009].

### 1.2 기존 수상작 패턴의 제품 설계 원칙화

본 출품은 기존 우수 아이디어를 그대로 모방하지 않는다. 대신 공공데이터·AI 서비스에서 반복적으로 통하는 패턴을 다음 제품 설계 원칙으로 바꾼다.

| 추출 패턴 | ClaimGate ODA 설계 원칙 |
|---|---|
| 구체적 사용자 | ODA/공공외교 사업의 기획·검토·평가 담당자를 1차 사용자로 고정한다. |
| 반복적이고 긴급한 문제 | AI 생성 국가/사업/성과 설명의 근거·시점·용어·기관 불일치를 반복 검토 대상으로 삼는다. |
| 공식 데이터 필드 | 외교부 및 산하기관 공개데이터를 Source Anchor 후보로 연결한다 [CE-011][CE-012][CE-013][CE-014]. |
| AI 보조 | AI는 candidate claim과 proposed anchor만 제안한다 [CE-003]. |
| 검토자의 행동 변화 | 검토자는 모든 문장을 처음부터 읽는 대신 red/yellow/green risk trace와 green sampling 대상을 우선순위로 처리한다 [CE-006][CE-007]. |

### 1.3 제품의 현재성: 아이디어가 아니라 존재하는 프레임워크 기반 출품

이 기획서는 미구현 아이디어만을 제안하지 않는다. 현재 구현된 ClaimGate v0의 신뢰 경계, state machine, 결정론적 risk engine, Evidence Pack projection guard를 기반으로 한다 [CE-001][CE-004][CE-006][CE-008][CE-009]. 다만 외교/ODA DomainPack, 실시간 공공데이터 API adapter, 실제 LLM adapter, 고객·매출·운영 성과는 현재 구현 완료로 주장하지 않는다. 본문에서는 이를 [구성] 또는 [로드맵] 범례로 분리한다 [CE-010][CE-017][CE-020][CE-021].

| 심사기준 대응 | AI 서비스: source-grounded reviewer workflow를 제품 목적에 배치 [CE-001][CE-002]. ESG혁신: 공공데이터 AI 서술의 근거 부족 리스크를 줄이는 방향으로 사회적 가치를 정의 [CE-016]. |
|---|---|

<div class="page-break"></div>

## 2 기능 및 특징

### 2.1 핵심 사용자 시나리오

사용자는 ODA 사업 기획서, 국별 협력 설명, 공공외교 사업 성과 요약, 브리핑 초안처럼 AI가 생성한 국가/사업/성과 설명을 ClaimGate ODA에 넣는다. 시스템은 문장별 candidate claim과 proposed anchor를 제안하고, 공개데이터 후보와의 연결 상태를 검토 항목으로 만든다 [CE-003][CE-005]. 이후 deterministic rule trace가 source existence, value/unit/date/entity mismatch, contradiction, staleness, aggregate-only 같은 위험 신호를 계산한다 [CE-006]. 검토자는 위험도가 높은 항목부터 anchor 확인, 정정, reject를 수행하고, verified/corrected claim만 Evidence Pack으로 인계한다 [CE-004][CE-008][CE-009].

### 2.2 현재 구현된 제품 핵심

| 기능 | 상태 | 설명 | 근거 |
|---|---|---|---|
| No Anchor No Claim | [현재] | Source Anchor 없는 claim은 `verified` 또는 `corrected`가 될 수 없다. | [CE-004] |
| AI Curator, Not Judge | [현재] | AI adapter는 candidate claim/proposed anchor만 제안하며 사실판정, 위험점수 산정, anchor 부착, reviewer decision, evidence projection 권한을 갖지 않는다. | [CE-003] |
| Source Anchor 모델 | [현재] | excel-cell, pdf-page, dataset-row, text-span, web-link 형태의 anchor와 deterministic anchor ID를 지원한다. | [CE-005] |
| Deterministic risk + rule trace | [현재] | source existence, value/unit/date/entity mismatch, contradiction, staleness, aggregate-only를 deterministic rule trace로 계산한다. | [CE-006] |
| Green sampling | [현재] | low-risk green claim도 전부 무시하지 않고 샘플링 검토 비용에 포함한다. | [CE-007] |
| Evidence Pack First | [현재] | 재사용 산출물은 verified/corrected claims only이며 report/graph는 Evidence Pack의 downstream projection이다. | [CE-008] |
| Human terminal decision | [현재] | terminal state에는 reviewer가 필요하고 audit이 reviewer transition과 corrected value를 남긴다. | [CE-009] |

### 2.3 ODA 제품에서의 기능 흐름

1. **입력**: AI가 생성한 국가/사업/성과 설명을 문장 단위로 분리한다 [구성][CE-012][CE-013][CE-014].
2. **후보 제안**: AI adapter는 candidate claim과 proposed anchor만 제안한다 [현재][CE-003][CE-017].
3. **Anchor 연결**: 외교부 안전정보, KOICA 협력사업/ODA 용어사전, KF 공공외교 사업 정보, 한아프리카재단 공개데이터를 Source Anchor 후보로 매핑한다 [구성][CE-012][CE-013][CE-014].
4. **위험 우선 검토**: deterministic risk trace로 red/yellow/green 검토 순서를 만든다 [현재][CE-006][CE-007].
5. **사람의 최종 결정**: 담당자가 verified/corrected/rejected를 남기고 정정 근거를 기록한다 [현재][CE-009].
6. **Evidence Pack 인계**: verified/corrected claim만 보고서·그래프·후속 검토로 투영한다 [현재][CE-008].

### 2.4 AI 권한 경계

ClaimGate ODA에서 AI는 검토자에게 “볼 만한 주장 후보와 연결해 볼 만한 anchor 후보”를 제안하는 curator다 [CE-003]. AI는 사실판정, 위험점수 산정, 검증 완료 처리, Evidence Pack 투영, reviewer terminal decision을 수행하지 않는다 [CE-003][CE-009]. 현재 제품 근거 역시 실제 LLM 운영이 아니라 fixture 기반 candidate extraction과 future adapter boundary test에 있다 [CE-017]. 따라서 본 출품은 AI를 과장된 자동화 장치가 아니라 공공데이터 검토 업무의 후보 생성 보조로 배치한다.

| 심사기준 대응 | AI 기술 활용: AI 후보 제안과 deterministic rule trace의 역할을 분리 [CE-003][CE-006][CE-017]. AI 서비스: No Anchor No Claim과 human terminal decision으로 검토 서비스를 구성 [CE-004][CE-009]. |
|---|---|

<div class="page-break"></div>

## 3 외교부 및 산하기관 공공데이터 활용 방안

### 3.1 활용 원칙

경진대회는 외교부, KOICA, KF, 한·아프리카재단 개방데이터를 활용하는 제품·서비스 개발을 허용하며, 외교부 공공데이터 1건 이상 활용이 필수다 [CE-011]. ClaimGate ODA는 이 조건을 “외교부 데이터 1건을 단순 표시”하는 방식이 아니라, ODA/공공외교 AI 서술의 Source Anchor 후보로 활용하는 방식으로 충족하도록 설계한다 [CE-012][CE-013][CE-014].

현재 구현된 DomainPack은 civic/health fixture pack이며 외교/ODA pack은 아직 없다 [CE-010]. 따라서 아래 활용 방안은 [구성]과 [로드맵]으로 표시하며, 현재 실시간 API 연동 완료로 쓰지 않는다 [CE-010][CE-020].

### 3.2 공개데이터 후보와 제품 내 역할

| 데이터 | 제품 내 활용 | 상태 | 근거 |
|---|---|---|---|
| 외교부_국가별 안전정보 (`https://www.data.go.kr/data/15000760/openapi.do`) | 국가/지역별 안전 공지 문장을 Source Anchor 후보로 삼아 AI 생성 국가·시점·위험유형 설명을 검토한다. | [구성] | [CE-012] |
| 한국국제협력단_국가별 협력사업 (`https://www.data.go.kr/data/15099198/openapi.do?recommendDataYn=Y`) | 수원국별 ODA 사업 개요·유형·기간·성과 문장을 Source Anchor 후보로 삼아 사업 설명과 성과 표현을 검토한다. | [구성] | [CE-013] |
| 한국국제협력단_ODA 용어사전 (`https://www.data.go.kr/data/15052909/fileData.do?recommendDataYn=Y`) | ODA 용어 정의의 단위·개념 불일치 검토용 보조 Source Anchor 후보로 사용한다. | [구성] | [CE-013] |
| 한국국제교류재단_공공외교 사업 정보 (`https://www.data.go.kr/data/15099202/openapi.do`) | 공공외교 사업명·기관·기간·성과 설명의 출처/기간/기관 불일치를 검토한다. | [구성] | [CE-014] |
| 한아프리카재단_아프리카혁신스타트업디렉터리 (`https://www.data.go.kr/data/15099203/openapi.do`) | 아프리카 혁신 스타트업·국가·분야 정보의 엔티티/국가명 불일치를 검토한다. | [구성] | [CE-014] |
| 한아프리카재단_지자체_아프리카 교류협력 사례 (`https://www.data.go.kr/data/15113634/fileData.do`) | 지자체-아프리카 교류협력 사례를 ODA/공공외교 협력 네트워크 설명 검토 후보로 사용한다. | [구성] | [CE-014] |

### 3.3 데이터 결합 방식

ClaimGate ODA는 공공데이터를 단순 조회 화면에 나열하지 않는다. 각 공개데이터의 필드를 Source Anchor 후보로 바꾸고, AI 생성 문장의 국가명·사업명·기관명·기간·성과 표현·용어 정의와 비교 가능한 검토 단위로 만든다 [CE-005][CE-012][CE-013][CE-014]. 이때 risk trace는 결정론적 규칙으로 생성되며 AI가 위험점수를 직접 부여하지 않는다 [CE-006].

예를 들어 “A국은 최근 안전 위험이 낮아 협력사업 확대에 적합하다”라는 AI 생성 문장은 다음 검토 항목으로 분해될 수 있다.

- 국가/지역명 anchor 후보: 외교부_국가별 안전정보 [CE-012]
- 사업 존재/기간 anchor 후보: 한국국제협력단_국가별 협력사업 [CE-013]
- 표현·용어 anchor 후보: 한국국제협력단_ODA 용어사전 [CE-013]
- 검토 결과 인계: verified/corrected claim만 Evidence Pack에 포함 [CE-008]

| 심사기준 대응 | 공공데이터 활용: 외교부 필수 데이터와 산하기관 공개데이터를 Source Anchor 후보로 구체화 [CE-011][CE-012][CE-013][CE-014]. AI 기술 활용: 데이터 비교는 AI 판정이 아니라 deterministic rule trace로 수행 [CE-006]. |
|---|---|

<div class="page-break"></div>

## 4 차별성 및 독창성

### 4.1 차별점: 생성보다 검토, 요약보다 근거 인계

많은 AI 서비스는 문서를 더 빨리 생성하거나 요약하는 데 초점을 둔다. ClaimGate ODA는 그 다음 단계, 즉 “그 문장을 공공기관 담당자가 책임 있게 검토하고 인계할 수 있는가”를 제품의 중심에 둔다 [CE-001][CE-002]. 따라서 출력물의 속도보다 Source Anchor, risk trace, reviewer decision, Evidence Pack으로 이어지는 검토 가능성을 우선한다 [CE-004][CE-006][CE-008][CE-009].

### 4.2 독창성 1: Green sampling으로 false-negative 방어

검토 시스템이 red/yellow만 보여주면 green으로 분류된 문장의 오류를 놓칠 수 있다. ClaimGate v0는 low-risk green claim도 모두 무시하지 않고 샘플링 검토 비용에 포함한다 [CE-007]. ODA 담당자에게 이는 “위험 높은 문장 먼저”와 “안전해 보이는 문장 일부 확인”을 동시에 제공하는 운영 설계다 [CE-007].

### 4.3 독창성 2: Evidence Pack First

ClaimGate는 보고서나 그래프를 바로 생성하기보다 verified/corrected claim만 Evidence Pack에 넣고, report/graph는 그 downstream projection으로 둔다 [CE-008]. 이 구조는 ODA 사업 검토에서 중요한 “나중에 누가 어떤 근거로 정정했는가”를 남기고, 보고서·브리핑·후속 평가로 인계 가능한 단위를 만든다 [CE-008][CE-009].

### 4.4 독창성 3: DomainPack reuse

현재 구현된 DomainPack은 civic/health fixture pack이며 ODA DomainPack은 아직 없다 [CE-010]. 그러나 핵심 차별점은 동일한 core/UI contract 위에 다른 domain judgment를 재사용할 수 있다는 점이다 [CE-015]. ODA 제품은 이 재사용 구조를 활용해 외교부·KOICA·KF·한아프리카재단 공개데이터에 맞춘 DomainPack을 구성하는 방식으로 확장한다 [CE-012][CE-013][CE-014][CE-015].

### 4.5 차별화 요약

| 비교 축 | 일반 생성형 AI 활용 | ClaimGate ODA |
|---|---|---|
| AI 역할 | 초안 생성 또는 요약 중심 | candidate claim/proposed anchor 제안 보조 [CE-003] |
| 검토 기준 | 사람이 별도 판단 | No Anchor No Claim + deterministic risk trace [CE-004][CE-006] |
| 낮은 위험 항목 | 대개 통과 처리 | green sampling으로 일부 확인 [CE-007] |
| 산출물 | 문서 또는 요약문 | verified/corrected claim 기반 Evidence Pack [CE-008] |
| 확장 방식 | 도메인별 별도 구현 가능성 | DomainPack reuse로 domain judgment 분리 [CE-015] |

| 심사기준 대응 | 독창성: green sampling, Evidence Pack First, DomainPack reuse를 차별 설계로 제시 [CE-007][CE-008][CE-015]. 발전 가능성: 동일 core/UI contract 위에 ODA DomainPack으로 확장 [CE-015][CE-020]. |
|---|---|

<div class="page-break"></div>

## 5 기대효과

### 5.1 담당자 업무 변화

ClaimGate ODA가 목표로 하는 변화는 “AI가 대신 결정한다”가 아니라 “검토자가 무엇을 먼저 확인할지 명확해진다”이다 [CE-002][CE-006][CE-009]. ODA/공공외교 담당자는 AI 생성 설명을 한 문장씩 무작위로 읽는 대신 다음 순서로 처리한다.

1. anchor가 없거나 충돌 가능성이 큰 red/yellow 항목을 우선 확인한다 [CE-004][CE-006].
2. green 항목도 sampling 대상으로 일부 확인한다 [CE-007].
3. 정정한 claim은 reviewer audit과 함께 남긴다 [CE-009].
4. verified/corrected claim만 Evidence Pack으로 넘겨 후속 보고서·브리핑·평가에 재사용한다 [CE-008].

### 5.2 공공데이터 활용 효과

외교부_국가별 안전정보는 국가·지역 안전 서술의 Source Anchor 후보가 되고, KOICA 데이터는 ODA 사업 개요·기간·성과·용어 설명의 anchor 후보가 된다 [CE-012][CE-013]. KF와 한아프리카재단 데이터는 공공외교·아프리카 협력 서술의 기관·사업·네트워크 설명 검토 후보가 된다 [CE-014]. 이 방식은 공공데이터를 “검색 결과”가 아니라 “AI 문장을 검토하는 기준점”으로 전환한다 [CE-005][CE-011].

### 5.3 사회적 가치와 ESG혁신

ODA와 공공외교 문서는 협력국, 수혜자, 국제 파트너, 공공기관의 신뢰와 연결된다. ClaimGate ODA는 공공데이터 기반 AI claim review를 통해 unsupported policy/business narrative risk를 줄이는 방향의 사회적 가치를 지향한다 [CE-016]. 현재 근거는 measured social impact가 아니라 보수적인 검토 흐름과 deterministic framework workload에 있다 [CE-016][CE-019].

### 5.4 검증 가능성

현재 QA framing은 offline deterministic scenario validation을 지원하지만 외부 production QA나 user acceptance를 입증하지 않는다 [CE-018]. 따라서 기대효과는 다음처럼 보수적으로 제시한다.

| 효과 영역 | 제출 시 표현 | 상태 | 근거 |
|---|---|---|---|
| 검토 우선순위 | 위험 우선 검토와 green sampling으로 담당자 검토 순서를 구조화한다. | [현재]/[구성] | [CE-006][CE-007] |
| 근거 인계 | verified/corrected claim만 Evidence Pack으로 전달한다. | [현재] | [CE-008] |
| ODA 적용성 | 외교부·산하기관 공개데이터를 anchor 후보로 구성할 수 있다. | [구성] | [CE-012][CE-013][CE-014] |
| 품질 검증 | 오프라인 결정론 시나리오 검증으로 framework 동작을 확인할 수 있다. | [현재] | [CE-018] |
| 성능 표현 | deterministic framework workload 범위에서만 성능을 설명한다. | [현재] | [CE-019] |

| 심사기준 대응 | 발전 가능성: offline deterministic scenario validation 기반으로 ODA fixture 확장 검증 계획을 제시 [CE-018]. ESG혁신: 공공데이터 AI 서술의 근거 부족 리스크 감소라는 보수적 사회 가치로 한정 [CE-016][CE-019]. |
|---|---|

<div class="page-break"></div>

## 6 사업(창업) 계획

### 6.1 제품화 원칙

사업계획은 현재 구현된 generic framework를 과장하지 않고, ODA fixture DomainPack, 승인된 선택적 adapter, pilot 순서로 확장한다 [CE-020]. 외부 제출, public release, portal action, protected go/no-go는 운영자 작업으로 남긴다 [CE-021].

### 6.2 단계별 로드맵

| 단계 | 목표 | 산출물 | 상태 | 근거 |
|---|---|---|---|---|
| 1단계: Generic framework 정리 | 현재 ClaimGate v0의 No Anchor No Claim, AI boundary, risk trace, Evidence Pack First를 제출 가능한 제품 언어로 정리 | 제품 설명, 데모 시나리오, evidence trace | [현재] | [CE-001][CE-003][CE-004][CE-006][CE-008] |
| 2단계: ODA fixture DomainPack | 외교부·KOICA·KF·한아프리카재단 공개데이터 후보를 fixture로 구성 | ODA DomainPack fixture, sample claim set, public-data anchor mapping | [로드맵] | [CE-010][CE-012][CE-013][CE-014][CE-020] |
| 3단계: 승인된 선택적 adapter | 운영자 승인 후 필요한 범위에서 공개데이터 adapter와 LLM adapter를 붙임 | read-only data adapter, AI candidate extraction adapter, boundary tests | [로드맵] | [CE-017][CE-020][CE-021] |
| 4단계: Pilot | ODA/공공외교 담당자 대상 제한 파일럿으로 검토 흐름, 산출물 형식, 책임 경계를 검증 | pilot checklist, acceptance notes, 개선 backlog | [로드맵] | [CE-020][CE-021] |

### 6.3 초기 고객·운영 가설

초기 사용자는 ODA/공공외교 사업의 기획·검토·평가 담당자다. 이들은 공고문, 사업 제안서, 국별 협력 설명, 성과 보고, 보도자료 초안에서 반복적으로 국가·사업·기관·성과·용어 설명을 검토한다. ClaimGate ODA는 문서 생산 도구가 아니라 검토 우선순위와 근거 인계를 제공하는 내부 검토 보조 제품으로 시작한다 [CE-001][CE-002][CE-008].

운영 모델은 다음과 같다.

- **공공기관 내부 검토 보조**: ODA 사업 설명 초안의 Source Anchor 연결과 risk trace 검토 [CE-006][CE-012][CE-013].
- **공공외교 사업 성과 검토**: KF/한아프리카재단 공개데이터 후보와 기관·기간·사업명 anchor 확인 [CE-014].
- **증거 인계 패키지**: verified/corrected claim만 Evidence Pack으로 묶어 후속 보고서 작성팀에 전달 [CE-008].

### 6.4 수익화와 확장 방향

초기에는 제품 완성도와 공공데이터 적합성을 검증하는 파일럿을 우선한다 [CE-020]. 이후 DomainPack reuse 구조를 활용해 ODA 외에도 보건, 시민데이터, 국제협력, 공공조달 등 공공데이터 claim review가 필요한 영역으로 확장할 수 있다 [CE-015]. 단, 고객·매출·운영 지표는 파일럿 이후 운영자 승인과 별도 검증을 거쳐 제시한다 [CE-020][CE-021].

| 심사기준 대응 | 발전 가능성: generic framework → ODA fixture DomainPack → 승인된 선택적 adapter → pilot 순서의 제품화 로드맵 [CE-020]. ESG혁신: 외부 제출·공개·go/no-go를 운영자 책임으로 분리해 공공 신뢰 경계를 유지 [CE-021]. |
|---|---|

<div class="page-break"></div>

## 제품 시나리오 상세: 검토자의 하루

### 입력

ODA 담당자는 AI가 작성한 다음 유형의 설명을 검토한다.

- “협력국 A는 최근 안전 상황이 안정적이므로 신규 사업 추진 여건이 양호하다.”
- “KOICA B 사업은 C 분야 성과를 냈고 다음 단계 확장이 가능하다.”
- “D 공공외교 사업은 E 기관과 연계되어 아프리카 혁신 생태계와 연결된다.”

### 처리

**[구성]** 현재 generic framework 원리를 ODA fixture DomainPack에 적용하면, ClaimGate ODA는 각 문장을 candidate claim으로 분리하고 proposed anchor를 제안하는 흐름으로 구성된다 [CE-003][CE-010]. 국가 안전 표현은 외교부_국가별 안전정보 anchor 후보로, ODA 사업 설명은 한국국제협력단_국가별 협력사업 및 한국국제협력단_ODA 용어사전 anchor 후보로, 공공외교·아프리카 협력 설명은 한국국제교류재단_공공외교 사업 정보와 한아프리카재단 공개데이터 anchor 후보로 연결한다 [CE-012][CE-013][CE-014].

### 검토

검토자는 red/yellow risk trace를 먼저 확인한다 [CE-006]. source가 없거나 날짜·기관·사업명·용어가 맞지 않는 claim은 corrected 또는 rejected로 처리한다 [CE-004][CE-009]. low-risk green claim도 일부 sampling해 false-negative를 방어한다 [CE-007].

### 인계

최종적으로 verified/corrected claim만 Evidence Pack으로 묶인다 [CE-008]. Evidence Pack은 후속 보고서, 브리핑, 평가 검토의 근거 묶음으로 사용되며, report/graph는 이 Evidence Pack 이후의 downstream projection이다 [CE-008].

### 제품 상태 재확인

이 시나리오는 현재 generic framework의 검토 원리를 ODA fixture DomainPack에 적용하는 구성안이다 [CE-010][CE-020]. 현재 제출 원고는 ODA DomainPack과 실시간 adapter가 이미 운영 중이라고 쓰지 않는다 [CE-010][CE-017][CE-021].

<div class="page-break"></div>

## Evidence ID 요약

| 구분 | 사용 CE ID | 본문 역할 |
|---|---|---|
| 현재 제품 핵심 | CE-001, CE-002, CE-003, CE-004, CE-005, CE-006, CE-007, CE-008, CE-009, CE-015, CE-017, CE-018, CE-019 | ClaimGate v0의 검토 흐름, AI boundary, state guard, risk trace, Evidence Pack, DomainPack reuse, deterministic validation 설명 |
| ODA 구성 | CE-010, CE-011, CE-012, CE-013, CE-014, CE-016 | 외교/ODA DomainPack 미구현 사실, 경진대회 데이터 활용 조건, 공개데이터 후보와 사회적 가치 framing 설명 |
| 로드맵/운영자 경계 | CE-020, CE-021 | generic framework → ODA fixture DomainPack → 승인된 선택적 adapter → pilot 로드맵 및 외부 제출/공개/go-no-go 운영자 작업 경계 |
| 금지 주장 가드레일 | CE-022 | 현재 근거로 말할 수 없는 제품 주장 배제 기준 |

## 제출 전 운영자 체크리스트

- [ ] 외부 제출 포털 업로드, 참가자 개인정보 입력, 서명 또는 직인 처리는 운영자가 수행한다 [CE-021].
- [ ] 외교부_국가별 안전정보 1건 이상 활용 조건이 최종 제출 양식에서 명시되어 있는지 확인한다 [CE-011][CE-012].
- [ ] ODA DomainPack, 실시간 API adapter, 실제 LLM adapter는 현재 구현 완료가 아니라 [구성]/[로드맵]으로 표시되어 있는지 확인한다 [CE-010][CE-017][CE-020].
- [ ] 고객·매출·운영 성과와 같은 외부 실적 표현은 파일럿 이후 별도 근거가 생기기 전까지 제외한다 [CE-020][CE-021].
- [ ] 본문에 [현재]/[구성]/[로드맵] 범례가 유지되고 모든 핵심 주장이 CE ID로 추적되는지 확인한다.
- [ ] PDF 변환 후 10쪽 이하인지 확인한다. 본 원고는 9개 논리 페이지로 설계되어 있다.

## 최종 문장

ClaimGate ODA는 ODA·공공외교 담당자가 AI 생성 설명을 그대로 믿거나 전면 배제하지 않고, 공식 공공데이터 Source Anchor와 deterministic risk trace를 통해 검토·정정·인계하도록 돕는 제품이다 [CE-001][CE-002][CE-006][CE-008]. 현재 제품의 강점은 범용 ClaimGate v0 프레임워크의 보수적 신뢰 경계에 있으며, ODA 출품의 다음 단계는 외교부 및 산하기관 공개데이터를 fixture DomainPack으로 구성하고 승인된 adapter와 pilot으로 검증 범위를 넓히는 것이다 [CE-010][CE-011][CE-020][CE-021].
