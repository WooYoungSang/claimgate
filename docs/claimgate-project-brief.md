# ClaimGate Project Brief

이 문서는 `kbctl`로 즉시 검색할 수 있도록 ClaimGate의 구현, 본질, 목표, 철학, 현재 구현 상태를 한곳에 정리한 프로젝트 브리프다. 공개 출품 문구는 이 브리프보다 과장되면 안 된다.

## 한 줄 정의

ClaimGate는 AI가 생성한 공공데이터 기반 주장을 곧바로 믿거나 배포하지 않고, 출처 앵커·결정론적 위험 규칙·사람 검토·Evidence Pack을 통과시켜 재사용 가능한 근거로 바꾸는 오프라인 검증 프레임워크다.

## 본질

ClaimGate의 본질은 “AI 판단기”가 아니라 “Claim Gate”다. AI 출력은 후보 주장일 뿐이고, ClaimGate는 그 후보가 출처 근거를 갖췄는지, 어떤 위험 큐에 놓여야 하는지, 사람이 어떤 결정과 감사 이벤트를 남겼는지, 최종 산출물이 Evidence Pack으로 재현될 수 있는지를 검문한다.

핵심 대상은 공공데이터·보고서·자료 기반 AI 응답에서 자주 발생하는 다음 문제다.

- 출처 없는 수치·기간·기관·지명 단정
- 출처와 충돌하는 AI 요약
- 맞아 보이지만 검토 표본에 포함되어야 하는 green claim
- 검토자 결정 없이 보고서·그래프·신뢰 뱃지로 투영되는 주장
- 데모에서는 그럴듯하지만 재현 가능한 검증 명령이 없는 출품물

## 목표

1. 공공데이터 AI 결과를 출처 중심 human-in-the-loop 검토 흐름으로 바꾼다.
2. “No Anchor, No Claim”을 코드와 테스트로 강제한다.
3. AI 품질 주장을 과장하지 않고, v0에서는 오프라인 fixture-first 프레임워크 성능과 신뢰 경계만 증명한다.
4. 도메인팩 교체로 시민 예산, 보건 통계, 외교부 ODA 같은 영역을 같은 검토 프레임워크에 태운다.
5. 출품 심사자가 `pnpm eval:framework`와 문서만으로 재현성과 범위를 확인할 수 있게 한다.

## 철학

- **AI Curator, Not Judge**: AI는 후보와 앵커를 제안할 수 있지만 진실 판정, 최종 위험 판정, 투영 권한을 갖지 않는다.
- **No Anchor, No Claim**: 출처 앵커가 없는 주장은 verified/corrected가 될 수 없고 Evidence Pack, report, graph로 나갈 수 없다.
- **Risk-first Review**: 먼저 위험 큐를 나누고 규칙 trace를 남긴다. green도 표본 검토 대상이다.
- **Evidence Pack First**: 재사용 가능한 산출물은 보고서 문장이 아니라 출처·검토자·감사 이벤트가 묶인 Evidence Pack이다.
- **Fake Work Reduced**: 자동화 목표는 사람이 빠지는 것이 아니라 샘플링 비용까지 포함한 순검토 부담을 줄이는 것이다.
- **Submission Honesty**: 구현되지 않은 LLM 품질, OCR, 서버, DB, DID, 실시간 API를 구현된 것처럼 말하지 않는다.

## 현재 구현 상태

### 구현됨

- pnpm monorepo 기반 TypeScript strict workspace.
- `@claimgate/core`: 순수 TypeScript core. Claim lifecycle, Source Anchor, reviewer terminal guard, correction record, audit trail, Evidence Pack, projection guard, candidate-only extraction boundary, offline mock trust adapter를 제공한다.
- 상태 흐름: `extracted → anchored → needs-evidence|conflict|aggregate-only → verified|corrected|rejected`.
- `@claimgate/ui`: React controlled component 표면. RiskQueue, SourceAnchorViewer, EvidencePackPreview, ImpactReport, ImpactGraphView, review console 계열 컴포넌트가 있으며 숨은 검토 권한을 갖지 않는다.
- `@claimgate/conformance`: DomainPack이 fixture, risk rule, rule trace, expected decision을 만족하는지 확인하는 deterministic conformance kit.
- DomainPack 3종: `civic-data`, `health-data`, `mofa-oda`. 각 pack은 오프라인 fixture와 deterministic risk rule을 가진다.
- 예제 앱: `examples/civic-review-app`는 core, UI, pack을 조합하고 pack swap demo 및 review outcome 흐름을 검증한다.
- 검증 스크립트: `pnpm eval:framework`, `pnpm test`, `pnpm demo`, `pnpm test/conformance`, `pnpm test:e2e`, `pnpm test:perf`, `pnpm test:submission-control-plane`, `pnpm test:simulation-qa`.
- 지식 도구: `tools/kbctl`은 ClaimGate-local JSON KB를 조회·검색·검증하고, 문서/결정/이슈/교훈/로드맵/workpacket을 기록한다.
- 제출 문서 표면: README, verification matrix, reproducibility guide, security boundary, third-party license notes, competition report/demo/script 계열 문서가 있다.

### 의도적으로 구현하지 않음

- 네트워크/호스팅 LLM 추출, OCR, 범용 PDF/Excel parser. 단, 출품 영상용 Local Gemma/Ollama 경로는 후보 추출 전용 adapter로만 취급한다.
- 서버, DB, auth, multitenancy, SaaS 운영 기능.
- 실제 DID wallet/issuer/verifier, graph DB, blockchain 호출.
- 네트워크 의존 데모 또는 API key가 필요한 기본 경로. 기본 검증은 mock/fixture-first이며 Local Gemma 모델 파일과 튜닝 산출물은 git 밖의 선택 런타임이다.

### 출품 전 남은 일

- 공개 제출용 sanitized export branch 또는 export script 작성.
- `.claude`, `.codex`, `.agents`, 내부 AGENTS/CLAUDE 운영 지시, private endpoint/reference 등 비공개 운영 표면 제거 또는 격리.
- OSSContest용 최종 개발보고서, 3분 시연 영상, 소스 URL, 포털 제출은 사람/운영자 액션으로 마감.

## kbctl 사용 시작점

컨텍스트를 잃었을 때는 아래 명령부터 실행한다.

```bash
pnpm test:kbctl
./kbctl get document DOC-CLAIMGATE-PROJECT-BRIEF
./kbctl search 본질 --kind document,decision,lesson
./kbctl search 현재 --kind document,decision,open_issue
./kbctl list workpacket
```
