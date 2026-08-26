# ClaimGate — 2026 오픈소스 개발자대회 배점 대응표

공식 근거: [심사 기준 및 배점 안내](https://osscontest.kr/notice/41), [출품작 제출 가이드](https://osscontest.kr/notice/39)
확인일: 2026-08-26 KST

이 문서는 점수를 예측하지 않는다. 공식 평가항목마다 심사자가 재현할 수 있는 증거와 아직 없는 증거를 구분한다.

## 1차 평가(서면) — 30점

| 공식 기준 | 공식 평가항목 | 배점 | ClaimGate 증거 | 사실 기반 판정 |
|---|---|---:|---|---|
| 프로젝트 구조 및 코드 완성도 | 코드 가독성, 주석 활용도, 구조 합리성, 목적에 맞는 기능 수행 | 6 | strict TypeScript monorepo, `@claimgate/core` 순수 경계, UI/DomainPack/AI-local 분리, `pnpm eval:framework` | 자동 검증 가능 |
| 오픈소스 프로젝트로의 발전 가능성 | 진행 중이거나 향후 발전할 가능성 | 6 | civic/health/MOFA ODA DomainPack 3종, conformance kit, `ROADMAP.md`, 공개 확장 계약 | 확장 구조·계획 존재; 외부 채택은 미검증 |
| 개발 문서의 구체성 | 구체적이고 이해하기 쉬우며 목적에 맞는 문서 | 6 | `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, package docs, clean-clone/runbook 검증 | 명령으로 재현 가능 |
| 프로젝트 혁신성 | 기술력과 기술적 수준(최신 기술 활용 정도) | 6 | Source Anchor→deterministic risk→Human Review→Evidence Pack, candidate-only local Gemma/RAG/QLoRA 권한 경계 | bounded holdout 통과; production 정확도는 주장하지 않음 |
| 프로젝트 협업 및 관리체계 | 협업 방식과 관리체계의 안정성·체계성; Issue/Review/PR/Commit/커뮤니티 이력 참고 | 6 | `GOVERNANCE.md`, `CODE_OF_CONDUCT.md`, 구조화 Issue forms, focused PR/maintainer decision 절차, kbctl SSOT, 120+ commits, 공개 roadmap Issues #1~#3 | single-maintainer 체계와 실제 공개 Issue 운영 시작; 외부 contributor/PR 이력 없음 |

## 2차 평가(발표) — 70점

| 공식 기준 | 공식 평가항목 | 배점 | ClaimGate 증거 | 사실 기반 판정 |
|---|---|---:|---|---|
| 작품발표(PT) | 개발 계획 수행, 발표자료 완성도, 정보 전달력 | 10 | 공식 결과보고서 본문 5쪽 이내, 실제 UI 화면, 3분 이내 영상, 배점 대응표 | 자료 준비; 실제 발표 평가는 별도 |
| 활용성 | OSS 경쟁력과 실제 사용·활용 가능성 | 15 | offline fixture quickstart, reviewer workflow, 교체 가능한 DomainPack, Evidence Pack export | 로컬 사용 가능; 실사용 기관 성과는 없음 |
| 작품 데모(완성도) | 체계적 데모, 표현, 질의응답의 안정적 수행 | 10 | MOFA ODA RED/YELLOW/GREEN, 정정·검증·export 경로, deterministic fallback | 녹화 데모 존재; 현장 Q&A는 미검증 |
| 커뮤니티 확장 가능성 | 품질관리·개발 방법론·로드맵, 참여와 지적 자산 공유 | 5 | `CONTRIBUTING.md`, `GOVERNANCE.md`, `ROADMAP.md`, Issue forms, DomainPack conformance, `v0.2 Community Expansion` milestone과 Issues #1~#3 | 참여 경로와 실제 roadmap issue 공개; 외부 참여 실적 없음 |
| 오픈소스SW 적절성 | 다양한 OSS를 적절히 도입·활용하고 정상 운영 | 15 | MIT 프로젝트, React/Vite/Vitest/tsup, Go Bubble Tea tooling, SBOM, clean-clone build/test | 로컬 정상 운영 검증 |
| 기능테스트 | 에러·버그·정지·종료 등 비정상 동작 없이 운영 | 10 | unit/conformance/e2e/runbook/clean-clone/deployment/submission negative controls | 자동 게이트 존재; production 운영은 범위 밖 |
| 라이선스 검증 | 라이선스 분석·식별·충돌 여부 | 5 | `LICENSE`, `THIRD_PARTY_LICENSES.md`, SPDX 2.3 SBOM(의존성 30개), Gemma 4 Apache-2.0 disclosure, 결과보고서 붙임 1·2 | deterministic 재생성·충돌 검사 가능 |

## 제출 적격성 게이트

- 결과보고서 본문은 5쪽 이내이며 붙임 1(SBOM)은 필수, AI 사용 시 붙임 2도 포함한다.
- ZIP에는 결과보고서 DOCX와 PDF만 넣는다. 중복수혜 확인서는 해당하는 경우에만 추가한다.
- 대표 공개 저장소 URL 1개와 3분 이내 YouTube 시연영상 URL을 결과보고서에 기재한다.
- 결과보고서·소스코드·시연영상 중 하나라도 없으면 심사 대상에서 제외된다.
- 홈페이지 상태 `제출 완료`와 `출품작 제출 완료 안내` 메일을 모두 확인한다.
- 최종 자동 검증은 접수번호 `1143`, 공개 YouTube URL, 공개 저장소 HTTP 접근, 원격 HEAD 동기화를 모두 확인해 `READY`를 출력한다.
