# OSS Contest 최종 제출 폴더

공식 근거: [출품작 제출 가이드](https://osscontest.kr/notice/39), [심사 기준 및 배점 안내](https://osscontest.kr/notice/41)

## 공식 제출 계약

1. 공식 결과보고서 본문: **5쪽 이내**
2. 결과보고서 붙임 1: **SBOM 필수**
3. 결과보고서 붙임 2: **AI 사용 시 모델·라이선스 명세 필수**
4. 프로젝트 등록 URL: **대표 공개 저장소 1개**
5. 시연영상: **3분 이내 YouTube URL**
6. 업로드 ZIP: 결과보고서 DOCX + PDF만 포함
7. 중복수혜 확인서: 해당하는 경우에만 ZIP에 추가

영상 파일과 소스코드는 ZIP에 넣지 않는다. 기타 산출물은 대표 저장소 안에서 연결한다.

## 생성·검증

```bash
OSSCONTEST_RECEIPT_NUMBER='<접수번호>' \
OSSCONTEST_TEAM_NAME='ClaimGate' \
OSSCONTEST_VIDEO_URL='https://youtu.be/<video-id>' \
pnpm build:osscontest-report

pnpm test:osscontest-final
```

검증기는 두 단계를 분리한다.

- `ARTIFACT PASS`: 본문 5쪽 제한, 붙임, 영상 길이·해상도, manifest hash, ZIP 내용을 검증했다.
- `READINESS BLOCKED`: 접수번호/YouTube URL/공개 저장소 접근/원격 push 중 미완료 항목이 남았다.
- `READY`: 위 외부 값과 공개 원격 HEAD까지 확인됐다.

placeholder가 남은 draft도 시각·무결성 검증을 위해 생성할 수 있지만 최종 제출본은 아니다.

## 현재 폴더의 내부 검수 자료

- `claimgate-osscontest-demo.mp4`: YouTube 업로드 전 로컬 원본(3분 이내)
- `report-contact-sheet.png`, `video-contact-sheet.png`: 내부 시각 검수용이며 ZIP 제외
- `SUBMISSION-MANIFEST.json`: 파일명·SHA-256·외부 URL readiness 확인용이며 ZIP 제외
- `../sbom/`: SPDX 2.3 SBOM, license review, Gemma 4 Apache-2.0 disclosure, SHA-256 증거

## 홈페이지 최종 확인

`접수 및 조회 → 출품작 제출 → 제출하기 → 파일 업로드 → 출품작 제출 완료하기`

마감 전 홈페이지 상태가 `제출 완료`인지 확인하고 `출품작 제출 완료 안내` 메일까지 수신해야 정상 완료다.
