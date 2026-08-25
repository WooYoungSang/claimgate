# ClaimGate — 2026 오픈소스 개발자대회 배점 대응표

공식 기준: <https://osscontest.kr/notice/41>
확인일: 2026-08-25 KST

## 1차 평가 — 30점

| 기준 | 배점 | ClaimGate 증거 | 자체 상태 |
|---|---:|---|---|
| 프로젝트 구조 및 코드 완성도 | 6 | strict TypeScript monorepo, core/UI/DomainPack/AI-local 경계, 192 workspace tests, `pnpm eval:framework` | 강점 |
| 오픈소스 프로젝트 발전 가능성 | 6 | MIT, DomainPack 확장 구조, civic/health/MOFA ODA 3개 팩, roadmap | 강점 |
| 개발 문서의 구체성 | 6 | README, package boundaries, reproducibility, security, verification matrix, kbctl SSOT | 강점 |
| 프로젝트 혁신성 | 6 | No Anchor No Claim, AI Curator Not Judge, deterministic risk, Green Sampling, Evidence Pack First | 강점 |
| 프로젝트 협업 및 관리체계 | 6 | 125 commits, CONTRIBUTING, SECURITY, kbctl, automated gates. 개인 개발이므로 PR·review·community 활동 이력은 제한적 | 보완 필요 |

## 2차 평가 — 70점

| 기준 | 배점 | ClaimGate 증거 | 자체 상태 |
|---|---:|---|---|
| 작품발표(PT) | 10 | 결과보고서 5P 이내, 실제 화면·아키텍처·검증 근거, 3분 이내 자막 시연영상 | 준비 |
| 활용성 | 15 | 공공데이터/보건/시민데이터 주장 검토, DomainPack 재사용, reviewer workflow | 강점 |
| 작품 데모(완성도) | 10 | MOFA ODA RED/YELLOW/GREEN flow, 정정·검증·Evidence Pack export, offline reproducibility | 강점 |
| 커뮤니티 확장 가능성 | 5 | CONTRIBUTING, DomainPack conformance kit, package boundaries. 실제 외부 contributor 활동은 아직 없음 | 보완 필요 |
| 오픈소스SW 적절성 | 15 | MIT source, React/Vite/Vitest/Go TUI, 공개 저장소, SBOM, AI model license annex | 강점 |
| 기능테스트 | 10 | unit/conformance/e2e/runbook/clean-clone/deployment contract/submission negative controls | 강점 |
| 라이선스 검증 | 5 | LICENSE, THIRD_PARTY_LICENSES, `pnpm licenses list --json`, 결과보고서 SBOM, AI 모델 명세 | 강점 |

## 제출 제외 위험

- 결과보고서 원본과 PDF 둘 다 ZIP에 포함되어야 한다.
- 대표 공개 저장소 URL 1개가 결과보고서에 있어야 한다.
- 3분 이내 시연영상을 YouTube에 업로드하고 URL을 결과보고서에 넣어야 한다.
- SBOM은 필수이며, Gemma 경로를 설명하므로 AI 모델 활용·라이선스 명세서도 포함한다.
- `접수번호`, YouTube URL, 공개 저장소 최신 push 중 하나라도 빠지면 최종 제출본이 아니다.
