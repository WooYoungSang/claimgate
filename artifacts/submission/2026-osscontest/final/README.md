# OSS Contest 최종 제출 폴더

## 공식 필수 제출물

1. 결과보고서 원본 DOCX
2. 결과보고서 PDF
3. 공개 GitHub 대표 저장소 URL 1개
4. 3분 이내 YouTube 시연영상 URL
5. 결과보고서 붙임1 SBOM
6. 결과보고서 붙임2 AI 모델 활용·라이선스 명세

DOCX와 PDF는 하나의 ZIP으로 업로드한다. 영상은 별도 파일이 아니라 YouTube URL을 결과보고서에
기재한다. 소스코드는 ZIP에 넣지 않고 대표 공개 저장소 URL을 기재한다.

## 현재 생성된 파일

- `2026 오픈소스 개발자대회 결과보고서_접수번호(ClaimGate).docx`
- `2026 오픈소스 개발자대회 결과보고서_접수번호(ClaimGate).pdf`
- `claimgate-osscontest-demo.mp4` — 77.88초, 1280×720, 자막형 실제 UI 시연
- `report-contact-sheet.png`, `video-contact-sheet.png` — 내부 시각 검수용

## 최종 생성에 필요한 운영자 값

```bash
OSSCONTEST_RECEIPT_NUMBER='<접수번호>' \
OSSCONTEST_TEAM_NAME='ClaimGate' \
OSSCONTEST_VIDEO_URL='https://youtu.be/<video-id>' \
python3 scripts/generate-osscontest-final-report.py
```

영상 업로드 후 위 명령으로 DOCX/PDF를 다시 만들고 ZIP을 생성한다. GitHub 저장소는
`https://github.com/WooYoungSang/warvis-claimgate`이며, 현재 로컬 커밋을 push해 공개 URL과 제출 코드가
일치해야 한다.

## 홈페이지 제출 순서

`접수 및 조회 → 출품작 제출 → 제출하기 → ZIP 업로드 → 출품작 제출 완료하기`

마지막으로 사이트 상태가 `제출 완료`인지, `출품작 제출 완료 안내` 메일을 수신했는지 모두 확인한다.
