# ClaimGate ShapeOps 포트폴리오 정합화 및 운영자 closeout 런북

> **현재 판정:** 선행 6개 Bet의 코드는 `main`에 병합됐지만 ShapeOps `phase`는 모두 `reviewing`이다. 이 문서는 ship/ratify 결과가 아니라, 별도 reviewer와 인간 운영자가 다음 Gate를 판단하기 위한 입력 패킷이다.

## 1. 포트폴리오 사실 스냅샷

| Bet | 코드 병합 | 현재 phase | 검증 근거 | 남은 작업 / 다음 Gate |
|---|---|---|---|---|
| 브라우저 geometry 회귀 | `bb3c993` | `reviewing` | 3팩 × 6 viewport, 48 측정, 3733 검사, cleanup self-test | 별도 reviewer 확인 후 인간 lifecycle 비준 |
| 3팩 판정 흐름 E2E | `b9daa72` | `reviewing` | 기각·정정·검증·초기화, 399 검사, JSON/마크다운 결정론 | 별도 reviewer 확인 후 인간 lifecycle 비준 |
| 한글 런북/화면 문구 | `91fc4d0` | `reviewing` | 화면 문구 24, 판정 버튼 3, 가이드 target 4, 6단계, mutation 18 | 독립 리허설 2회 실측 후 인간 closeout |
| clean clone 재현성 | `f4af33f` | `reviewing` | offline frozen install, hard timeout, process cleanup, failure report | carry-forward NIT 3건 검토 후 인간 closeout |
| 배포/Cloudflare hardening | `890d427` | `reviewing` | 로컬 배포 계약 37개, 원자 release/rollback, Caddy 정책 | 운영 Caddy 적용 승인 → 공개 probe exit 0 → 인간 closeout |
| 외교부 제출 영상/증거 | `ff7973c` | `reviewing` | 180초 6-shot storyboard, evidence validator 34개, Git 객체 결속 | 실제 영상·리허설·업로드·제출과 인간 closeout |

**정합성 요약:** 대상 6 / `main` 병합 6 / `reviewing` 6 / `shipped` 0 / agent 자기 승인 0.

## 2. 공개 배포의 현재 사실

저장소의 Caddy hardening은 구현됐지만 production node에는 아직 적용되지 않았다. 공개 read-only probe는 exit 1이며 정확히 다음 5개 실패를 관측했다.

1. `root-cache`
2. `spa-cache`
3. `html-security-headers`
4. `js-asset-cache`
5. `css-asset-cache`

따라서 `mofa.warvis.org`가 DNS/HTTPS로 열리는 사실과 배포 정책 PASS를 혼동하지 않는다. 완료하려면 운영자가 production Caddy 변경을 승인·적용한 뒤 `pnpm probe:deployment`을 다시 실행해 exit 0을 별도 evidence로 남겨야 한다.

## 3. 영상과 리허설의 현재 사실

- 180초/6-shot storyboard만 검증됐다.
- 실제 3분 영상은 촬영되지 않았다.
- 영상은 업로드되거나 외부 제출되지 않았다.
- 독립 리허설 2회는 요구되지만 실측값은 0회다.
- `video:shot-01`~`06`, `video:rehearsal-1`~`2`의 8개 evidence slot은 모두 pending이다.

촬영·업로드·외부 제출은 이 Forge가 수행하거나 성공으로 표기하지 않는다.

## 4. clean clone carry-forward NIT

다음 세 항목은 현재 PASS를 뒤집는 blocker가 아니라, 후속 강화 여부를 인간 reviewer가 결정할 carry-forward다.

1. 이름이 `node_modules`인 symlink 탐지 강화
2. signal self-test 준비 완료 시점 경쟁(race) 제거
3. 통합 failure JSON report assertion 강화

## 5. 제품 경계

ClaimGate v0와 외교부 ODA 시제품은 계속 **offline / deterministic / fixture-first**다. 다음 항목은 FUTURE / No-Go이며 구현·운영 정확도·도입 완료로 주장하지 않는다.

- live OpenAPI
- real LLM
- OCR
- 서버
- DB
- auth
- production accuracy
- agent의 자기 ratify/ship
- agent의 외부 배포·업로드·제출

## 6. 운영자 Gate 순서

1. **증거 검토:** `artifacts/portfolio/claimgate-shapeops-closeout.json`과 각 immutable merge/evidence ref를 별도 reviewer가 확인한다.
2. **배포 Gate:** production Caddy 변경 승인·적용 후 공개 probe exit 0을 확보한다.
3. **영상 Gate:** 실제 영상 165–195초, shot 6개, 독립 리허설 2회 실측, evidence slot 8개를 채운다.
4. **제출 Gate:** 업로드·외부 제출은 인간 운영자가 별도 승인하고 수행한다.
5. **Lifecycle Gate:** reviewer verdict와 운영자 `approval_ref`를 근거로 각 Bet의 보호 전이를 실행한다. 이 문서 생성 시점에는 어떤 terminal transition도 수행하지 않았다.

## 7. 중단 조건

- 선행 Bet 중 하나라도 canonical graph가 `reviewing`이 아니거나 repository merge ref가 해소되지 않음
- 공개 probe 실패를 숨기거나 성공으로 바꿔 적어야 함
- 영상·리허설 evidence slot이 비어 있는데 완료로 처리해야 함
- FUTURE / No-Go를 현재 구현으로 주장해야 함
- 별도 reviewer와 인간 승인 없이 ship/ratify/accepted handoff를 요구함

위 조건에서는 상태 전이를 멈추고 divergence 또는 operator review item만 남긴다.
