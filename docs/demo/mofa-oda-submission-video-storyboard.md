# ClaimGate 외교부 ODA 제출 영상 스토리보드

> **상태:** 촬영 계획 검증 완료 · 실제 영상 촬영/업로드/외부 제출은 미실시
>
> **총 길이:** 180초(3분) · 허용 범위 165–195초
>
> **제품 경계:** offline / deterministic / fixture-first 시제품이다. live OpenAPI, hosted LLM/LLM-as-judge, OCR, 서버·DB·auth, production accuracy는 FUTURE / No-Go다. RTX 4090 Local Gemma는 후보 추출 전용 경로다. 공개 URL의 현재 배포 점검은 실패 5건으로 **보류(pending)** 상태이며 성공으로 제시하지 않는다.

## 촬영 전 체크

- 기준 커밋: `890d427e7bdd296113fbbf7b40480b45f1c757ee`
- 기준 런북: `docs/demo/mofa-oda-3-minute-runbook.md`
- 공개 URL: `https://mofa.warvis.org` — 현재 smoke 결과 FAIL(5건), 로컬 대체 경로 사용
- 로컬 대체: `pnpm --filter @claimgate/example-civic-review-app build` 후 Vite preview
- 실제 촬영자는 각 evidence slot에 파일명 또는 캡처 ID를 기록한다. 빈 slot은 성공 증거가 아니다.

## 180초 shot list

| Shot | 구간 | 길이 | 화면/조작 | 핵심 멘트 | Evidence slot |
|---|---:|---:|---|---|---|
| SHOT-01 | 00:00–00:20 | 20초 | 시작 화면과 파이프라인, `가이드 데모 시작` | AI 후보 제안기는 제안 전용이며 규칙과 사람이 판단한다. 데이터는 오프라인 고정 fixture다. | `video:shot-01:pending` |
| SHOT-02 | 00:20–00:50 | 30초 | MOFA RED/YELLOW/GREEN 큐를 차례로 확인 | 외교부 안전정보 충돌, KOICA 국가·기간 불일치, ODA 정의 일치 표본을 설명한다. | `video:shot-02:pending` |
| SHOT-03 | 00:50–01:25 | 35초 | RED의 AI 제안/출처 근거/규칙 추적 비교 | `mofa.country-safety-mismatch`는 결정론적 검토 우선순위이지 자동 진실 판정이 아니다. | `video:shot-03:pending` |
| SHOT-04 | 01:25–02:00 | 35초 | `근거값으로 정정`, 사유, `판정 기록` | 검토자가 근거값과 사유를 확정하며 AI나 규칙 엔진은 판정 권한이 없다. | `video:shot-04:pending` |
| SHOT-05 | 02:00–02:40 | 40초 | 검토 결과, 근거 묶음 미리보기, JSON/마크다운 다운로드 | 검증·정정된 주장만 투영되고 대기/기각은 차단된다. 다운로드는 오프라인 결과의 정적 내보내기다. | `video:shot-05:pending` |
| SHOT-06 | 02:40–03:00 | 20초 | civic/health/mofa-oda 팩 선택 후 MOFA로 복귀 | 동일 프레임에서 도메인 규칙과 fixture만 교체한다. live API/LLM/OCR과 운영 정확도는 미래 범위다. | `video:shot-06:pending` |

**합계:** 20 + 30 + 35 + 35 + 40 + 20 = **180초**

## 캡처 증거 슬롯

| Evidence ID | 필요한 증거 | 현재 상태 | 성공 판정 |
|---|---|---|---|
| `video:shot-01:pending` | 시작 화면 녹화 구간 또는 프레임 | pending | offline/fixture-first/AI 제안 전용 문구가 보임 |
| `video:shot-02:pending` | 3색 큐 프레임 | pending | RED/YELLOW/GREEN 3건과 MOFA 제목 일치 |
| `video:shot-03:pending` | source/rule 비교 프레임 | pending | 외교부_국가별 안전정보와 rule ID 확인 |
| `video:shot-04:pending` | 사람 판정 프레임 | pending | 정정 값·사유·검토자 기록 확인 |
| `video:shot-05:pending` | Evidence Pack 프레임/다운로드 파일 | pending | 대기/기각 차단, verified/corrected only |
| `video:shot-06:pending` | 3-pack 선택 프레임 | pending | civic/health/mofa-oda 선택 가능 |
| `video:rehearsal-1:pending` | 리허설 실측 시간과 결과 | pending | 165–195초, 예상 상태 100% 일치 |
| `video:rehearsal-2:pending` | 독립 리허설 실측 시간과 결과 | pending | 165–195초, 예상 상태 100% 일치 |

## 공개 배포 보류 기록

2026-07-18 UTC 기준 `pnpm probe:deployment`은 exit 1, failureCount 5였다.

- `root-cache`: cache-control 누락
- `spa-cache`: cache-control 누락
- `html-security-headers`: root/SPA exact policy 불충족
- `js-asset-cache`: `max-age=14400` (immutable 장기 캐시 불충족)
- `css-asset-cache`: `max-age=14400` (immutable 장기 캐시 불충족)

따라서 공개 URL은 페이지 확인 참고값일 뿐 최종 배포 PASS 증거가 아니다. 촬영은 로컬 대체 경로로 재현하며, 공개 환경이 수정되면 같은 명령을 다시 실행해 별도 evidence로 남긴다.

## 촬영 후 완료 조건

- [ ] 실제 영상 길이 165–195초
- [ ] SHOT-01~06 evidence slot 모두 실제 파일/캡처 ID로 교체
- [ ] 독립 리허설 2회가 각각 165–195초이고 예상 상태가 100% 일치
- [ ] 공개 URL을 사용했다면 최신 `pnpm probe:deployment`이 exit 0
- [ ] 영상에서 live API/LLM/OCR, production accuracy, 외부 도입 완료를 주장하지 않음
- [ ] 외부 업로드/제출은 운영자가 별도 승인하고 수행

이 체크리스트가 미완료인 동안 `three-minute-video-verified`는 **pending**이다.
