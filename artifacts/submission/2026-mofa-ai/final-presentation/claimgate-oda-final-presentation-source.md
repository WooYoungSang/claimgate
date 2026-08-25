# ClaimGate ODA 최종 발표자료 원고

## 1. 표지

**ClaimGate ODA**
AI가 쓴 문장을 근거와 책임이 있는 주장으로

- 2026 외교 공공데이터·AI 활용 경진대회
- 제품·서비스 개발 부문
- 핵심 메시지: **No Anchor, No Claim**

## 2. 문제

생성형 AI는 초안을 빠르게 만들지만 다음을 보장하지 않는다.

- 국가 안전정보가 최신 공식 데이터와 일치하는가
- 사업 대상국·기관·기간·성과가 공개된 사업정보와 일치하는가
- 누가 어떤 근거를 확인하고 무엇을 정정했는가

공공기관 설명 자료의 작은 오류는 정책 판단과 대외 신뢰의 위험으로 이어진다.

## 3. 해결 방식

1. AI가 후보 주장과 근거 후보만 제안한다.
2. 담당자가 공식 데이터의 행·필드·문장 범위를 Source Anchor로 연결한다.
3. 결정론적 규칙이 불일치와 출처 부족을 추적한다.
4. 사람이 검증·정정·기각한다.
5. 검증·정정된 주장만 Evidence Pack으로 인계한다.

## 4. 제품 데모

- 외교부 국가별 안전정보 충돌: RED
- KOICA 국가·기간 추가 확인: YELLOW
- ODA 용어 정의 일치: GREEN + sampling
- 사람의 판정 전에는 근거 묶음 투영 차단

## 5. 외교 공공데이터 활용

현재 오프라인 fixture로 구현된 데이터:

- 외교부_국가별 안전정보
- 한국국제협력단_국가별 협력사업
- 한국국제협력단_ODA 용어사전

향후 읽기 전용 어댑터 확장:

- 한국국제교류재단 공공외교 사업 정보
- 한·아프리카재단 공개데이터

현재 URL은 provenance이며 실시간 OpenAPI 연동을 주장하지 않는다.

## 6. 차별성

- **AI Curator, Not Judge**: AI는 후보만 제안한다.
- **No Anchor, No Claim**: 근거 없는 주장은 완료 상태가 될 수 없다.
- **Deterministic Risk**: 위험 표시는 명시적 규칙과 trace로 계산한다.
- **Green Sampling**: 낮은 위험 항목도 표본 검토한다.
- **Evidence Pack First**: 검토된 주장과 근거를 재사용 가능한 산출물로 인계한다.

## 7. 구조와 신뢰 경계

- `@claimgate/core`: Claim, Source Anchor, review state, risk, Evidence Pack
- `@claimgate/ui`: 권한 없는 controlled React UI
- `@claimgate/pack-*`: 도메인 fixture와 판단 규칙
- `@claimgate/ai-local`: 후보 추출과 RAG provenance만 담당

AI는 verify, risk authority, accepted anchor attachment, projection 권한을 갖지 않는다.

## 8. 구현 및 검증 현황

- civic / health / MOFA ODA 3개 DomainPack
- workspace unit tests 192개 통과
- core tests 103개, local-AI tests 20개
- conformance tests 8개, UI tests 6개
- 오프라인·결정론적 기본 경로
- submission overclaim / video preflight / kbctl 검증 통과

## 9. 제품화 계획

1. 검토 엔진과 Evidence Pack 안정화
2. ODA DomainPack 시제품 검증
3. 제한된 실무 파일럿과 검토 비용 측정
4. 필요한 범위의 읽기 전용 데이터·AI 후보 추출 어댑터 연결

초기 적용은 문서 생성 전체가 아니라 국가 안전·사업 정보·성과 설명 등 고위험 문장 검토에 집중한다.

## 10. 마무리

AI가 초안을 빠르게 쓰게 한다면, ClaimGate ODA는 그 문장을 사람이 근거와 함께 책임질 수 있게 한다.

**공공데이터 AI 시대의 마지막 문은 Claim Gate입니다.**
