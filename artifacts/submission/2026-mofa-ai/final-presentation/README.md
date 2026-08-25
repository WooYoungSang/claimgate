# ClaimGate ODA 발표심사 제출 패키지

확인일: 2026-08-25 KST

## 공식 공개 요구사항

외교부 공식 공고는 발표 대상자에게 **발표자료(자유양식, 프레젠테이션 파일 등)**를 요구하며,
세부 제출 방식은 개별 안내한다고 명시한다.

- 공식 공고: <https://www.mofa.go.kr/www/brd/m_4075/view.do?seq=369403>
- 공개 공고에는 발표자료의 페이지 수, 발표 시간, 파일 확장자 제한이 없다.
- 따라서 이 패키지는 16:9, 10장, 5분 기본 발표안으로 구성했다.

## 제출 파일 선택

| 상황 | 파일 |
|---|---|
| 사이트가 PDF 한 파일을 요구 | `claimgate-oda-final-presentation.pdf` |
| PowerPoint 원본을 요구 | `claimgate-oda-final-presentation.pptx` |
| 내부 발표 준비 | `claimgate-oda-speaker-notes.md` |
| 전체 보관/인계 | `claimgate-oda-final-presentation-package.zip` |

## 외부 업로드 금지 파일

- `claimgate-oda-final-presentation-source.md`: 재생성 원고
- `assets/`: 실제 시제품 화면과 검수용 contact sheet
- `SUBMISSION-MANIFEST.json`, `SHA256SUMS.txt`: 내부 무결성 검증용

## 발표 전 3분 데모

발표 중 시연이 허용되면 기존 `docs/demo/mofa-oda-3-minute-runbook.md`를 사용한다. 네트워크 상태와
무관하게 로컬 `http://127.0.0.1:4280` 경로를 우선한다. 공개 공고는 영상 업로드를 발표자료의
필수물로 지정하지 않았으므로 영상 파일을 최종 제출물로 과장하지 않는다.

## 표현 경계

- 현재 구현: 오프라인·결정론적 MOFA ODA fixture 시제품, Local Gemma 후보 추출 경계, Evidence Pack
- 향후 범위: live OpenAPI, 운영 배포 hardening, 실무 파일럿, 운영 정확도/시간 절감 측정
- 금지 표현: 자동 진실판정, hallucination 제거, production accuracy, live 외교부 API 연동 완료
