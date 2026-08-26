# YouTube 시연영상 업로드 값

## 업로드 파일

`claimgate-osscontest-demo.mp4`

- 길이: 77.88초
- 해상도: 1280×720
- 실제 ClaimGate MOFA ODA UI 흐름
- 화면 내 한글 자막 포함
- 별도 음성 없음

## 제목

```text
[ClaimGate] AI 공공데이터 주장을 근거와 사람의 판정으로 검토하는 오픈소스 프레임워크
```

## 설명

```text
ClaimGate는 AI가 만든 공공데이터 주장을 Source Anchor, 결정론적 위험 규칙,
사람의 최종 판정, Evidence Pack으로 연결하는 MIT 오픈소스 claim review framework입니다.

이 영상은 오프라인 MOFA ODA fixture에서 다음 흐름을 시연합니다.
1. AI 후보 주장과 공식 데이터 근거 비교
2. RED/YELLOW/GREEN 결정론적 rule trace
3. 사람 검토자의 검증·정정
4. 검증·정정된 주장만 Evidence Pack으로 투영

Public repository:
https://github.com/WooYoungSang/warvis-claimgate

Reproduce:
pnpm install --frozen-lockfile
pnpm demo
pnpm eval:framework

Local AI boundary:
- repo-local sparse RAG
- bounded Gemma 4 12B QLoRA candidate extractor
- AI는 검증·위험판정·Source Anchor 승인·reviewer decision 권한을 갖지 않습니다.
- production accuracy 또는 실제 문서 정확도를 주장하지 않습니다.

License: MIT
2026 오픈소스 개발자대회 출품작
```

## 권장 설정

- 공개 범위: `일부 공개` 또는 `공개`
- 아동용 콘텐츠: 아니요
- 카테고리: 과학기술
- 썸네일: `youtube-thumbnail.png`
- 태그: `오픈소스, ClaimGate, 공공데이터, AI, RAG, Gemma, Evidence Pack, TypeScript`

## URL 반영

업로드 후 공유 URL을 사용해 최종 보고서를 다시 생성한다.

```bash
OSSCONTEST_RECEIPT_NUMBER='<접수번호>' \
OSSCONTEST_TEAM_NAME='ClaimGate' \
OSSCONTEST_VIDEO_URL='https://youtu.be/<video-id>' \
pnpm build:osscontest-report

pnpm test:osscontest-final
```
