# ClaimGate ODA 제출 자산 매니페스트

생성일: 2026-07-13 KST

> **내부 검증 문서 — 외부 제출 금지**
> 외부 제출 대상은 아래 PDF 3개다. 개인정보·날짜·서명은 운영자가 직접 기입한다.

## 최종 제출 파일

| 파일 | 공식 양식 대응 | 페이지 | 상태 |
|---|---|---:|---|
| `claimgate-oda-participation-application.pdf` | 공식 HWP 붙임1의 남색 붙임띠·하늘색 제목띠·표 구조를 Markdown/CSS 벡터 서식으로 재현, 제품정보 사전 입력 | 2 | 개인정보·서명 입력 필요 |
| `claimgate-oda-product-service-proposal.pdf` | 공식 HWP **붙임3 헤더·색상·표 구조**를 반영한 표지 + 공식 6개 목차 순서 | 9 | 제출 가능 |
| `claimgate-oda-privacy-consent.pdf` | 공식 HWP 붙임4 문구와 구조를 Markdown/CSS 벡터 서식으로 재현 | 1 | 날짜·성명·서명 입력 필요 |
| `claimgate-oda-submission-ready.zip` | 위 PDF 3개만 포함 | - | 압축 무결성 PASS |

기존 `*.docx` 및 `*.reference.*` 파일은 편집·비교 참고용이며 최종 제출본이 아니다.

## 공식 양식 정합성

- 공식 공고문 HWP SHA-256: `d0dd894d15f08f42e93cc81461b0e42669a4fff03417249bb2f15c537e524721`
- 참가신청서는 편집 가능한 Markdown/CSS 벡터 문서이며, 개인정보 동의서도 편집 가능한 Markdown/CSS 벡터 문서로 전환했다.
- 참가신청서는 이미지 캡처 없이 텍스트와 표로 구성했고 `제품 또는 서비스 개발` 항목 및 ClaimGate ODA 정보를 입력했다.
- 제품 기획서는 붙임3의 남색 `붙임3` 표지, 하늘색 제목띠, 기본정보 표, 공식 6개 작성 항목을 동일한 순서로 반영했다.
- 기획서 분량은 9쪽으로 공식 제한 10쪽 이내다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| PDF 구조/텍스트 추출 | PASS |
| A4 용지 | PASS — 세 문서 모두 `595.276 x 841.89 pts` |
| 페이지 수 | PASS — 신청서 2 / 기획서 9 / 동의서 1 |
| 필수 문구 검색 | PASS |
| `심사기준 대응`, 내부 CE ID, 수상작 메타 제거 | PASS |
| 시각 검수 | PASS — 원본 크기 PNG 렌더링으로 체크·한글·표 잘림 확인 |
| ZIP 무결성 | PASS — 3 files, no errors |

## SHA-256

| SHA-256 | 파일 |
|---|---|
| `bf7a5f2a1574699080a2d7de3512655d0a432f34a145a7552cd5d709c703e92e` | `claimgate-oda-participation-application.pdf` |
| `a3b909cb5e2a0d3729bd0aedb37907edd886cc1ab866988fd0d98f1916d999f9` | `claimgate-oda-product-service-proposal.pdf` |
| `ae6292bafb9699dd1a450852778344191562fd940f1af304c9e8466091080e10` | `claimgate-oda-privacy-consent.pdf` |
| `b27ebd43f6afeafabc346d80f618976784b933a1895d81e03a13dbf085475019` | `claimgate-oda-submission-ready.zip` |
| `287ea978397bebe91adc591572d47db79578aaaf0278f92a8b6cf2532254548c` | `claimgate-oda-product-service-proposal.md` |

## 운영자 마무리

1. `SUBMISSION-CHECKLIST.txt`를 보며 개인정보를 기입한다.
2. 가장 안전한 방식은 출력 후 자필 작성·서명하고 다시 PDF로 스캔하는 것이다.
3. 공고문은 전자서명 허용 여부를 명시하지 않으므로 마우스로 그린 서명만 사용하기보다 자필 서명을 권장한다.
4. 최종 접수에는 PDF 3개만 첨부하고 이 매니페스트와 체크리스트는 제출하지 않는다.
