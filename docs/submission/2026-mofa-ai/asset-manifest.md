# ClaimGate ODA PDF Asset Manifest

생성일: 2026-07-13 KST

작업 범위: U3 렌더링·시각 QA — PDF 산출물과 재현 가능한 자산 매니페스트 작성

## Deliverables

| Path | Role | Result |
|---|---|---|
| `docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf` | 제출용 A4 PDF | 생성 완료, 9쪽, A4 |
| `docs/submission/2026-mofa-ai/asset-manifest.md` | 렌더링·검증·해시 매니페스트 | 생성 완료 |

## Inputs and source provenance

| Path | Usage | Mutation policy | Provenance |
|---|---|---|---|
| `docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.md` | PDF 본문 원고 | read-only | 한국어 제출 원고. 9개 논리 페이지를 `<div class="page-break"></div>`로 지정. |
| `docs/submission/2026-mofa-ai/claim-evidence-matrix.md` | 공식 섹션/심사기준/CE trace 검증 | read-only | SEC-1~SEC-6 및 JC-1~JC-6 coverage matrix. |
| `docs/[26-390](보도자료) 외교 공공데이터와 AI, 국민의 아이디어로 창업의 기회를 열어갑니다.pdf` | 공고/대회 provenance | read-only | 운영자가 제공한 보도자료 PDF. |
| `docs/외교 공공데이터 · AI 활용 경진대회 개최 공고문.hwp` | 공고/요구사항 provenance | read-only | 운영자가 제공한 개최 공고문 HWP. |
| `docs/외교 공공데이터 · AI 활용 경진대회 포스터.png` | 공고/대회 provenance | read-only | 운영자가 제공한 포스터 PNG. |

## Renderer and tool versions

| Tool | Version / observed result |
|---|---|
| Renderer | `/home/jang/.local/bin/weasyprint` |
| WeasyPrint | `WeasyPrint version 66.0` |
| Python Markdown | `markdown 3.8.2` |
| pdfinfo | `pdfinfo version 22.02.0` |
| pdftotext | `pdftotext version 22.02.0` |
| pdftoppm | `pdftoppm version 22.02.0` |
| LibreOffice | `LibreOffice 7.3.7.2 30(Build:2)` |
| Primary Korean font | `NotoSansCJK-Regular.ttc: "Noto Sans CJK KR" "Regular"` |
| Serif fallback | `NotoSerifCJK-Regular.ttc: "Noto Serif CJK KR" "Regular"` |
| Mono fallback | `NotoSansCJK-Regular.ttc: "Noto Sans Mono CJK KR" "Regular"` |

Renderer notes:
- Temporary converter and HTML/CSS were written only under `/tmp/claimgate-oda-render`.
- Repository-stored conversion scripts, HTML, CSS, or PNG previews were not added.
- Python Markdown extensions used: `tables`, `sane_lists`, `smarty`.
- CSS set `@page size: A4`, explicit page breaks for `.page-break`, navy/teal visual language, Noto CJK font stack, URL/code overflow wrapping, non-splitting rows/headings/tables where possible, and footer page counters.

## PDF metadata

Command:

```bash
pdfinfo docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf
```

Observed result:

| Field | Value |
|---|---|
| Title | `ClaimGate ODA 제품·서비스 제안서` |
| Producer | `WeasyPrint 66.0` |
| Pages | `9` |
| Page size | `595.276 x 841.89 pts (A4)` |
| File size | `546105 bytes` |
| PDF version | `1.7` |

Acceptance: **PASS** — physical pages are 9, which is <=10, and page size is A4.

## Verification commands and results

### 1. RED: output absence before creation

Command:

```bash
ls -l docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf \
      docs/submission/2026-mofa-ai/asset-manifest.md
```

Observed result before rendering:

```text
ls: cannot access 'docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf': No such file or directory
ls: cannot access 'docs/submission/2026-mofa-ai/asset-manifest.md': No such file or directory
```

Acceptance: **PASS** — both owned outputs were absent before U3 creation.

### 2. Render PDF

Command:

```bash
python3 /tmp/claimgate-oda-render/render.py
/home/jang/.local/bin/weasyprint \
  /tmp/claimgate-oda-render/claimgate-oda-product-service-proposal.html \
  docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf
```

Observed result: **PASS** — WeasyPrint completed with exit code 0 and produced the target PDF.

### 3. Text extraction checks

Command:

```bash
pdftotext -layout \
  docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf \
  /tmp/claimgate-oda-render/proposal.txt
```

Required Korean title / official sections / judging criteria extraction:

| Text | Result |
|---|---|
| `ClaimGate ODA: 공공데이터 기반 AI 서술 검토 제품 기획서` | OK |
| `1 목적 또는 배경` | OK |
| `2 기능 및 특징` | OK |
| `3 외교부 및 산하기관 공공데이터 활용 방안` | OK |
| `4 차별성 및 독창성` | OK |
| `5 기대효과` | OK |
| `6 사업(창업) 계획` | OK |
| `공공데이터 활용` | OK |
| `AI 기술 활용` | OK |
| `AI 서비스` | OK |
| `독창성` | OK |
| `발전 가능성` | OK |
| `ESG혁신` | OK |

Acceptance: **PASS** — Korean text and all required official coverage labels are extractable.

### 4. Visual QA rendering

Commands:

```bash
pdftoppm -png -r 120 \
  docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf \
  /tmp/claimgate-oda-render/qa-final-review2/page
```

Preview artifacts created only under `/tmp/claimgate-oda-render/qa-final-review2`:
- `page-1.png` … `page-9.png`
- `contact-sheet.png`

Visual inspection method:
- Contact sheet inspected with `view_image` for all 9 pages.
- Representative full-page inspections were performed for cover/table-heavy/end pages during iteration.

| Page | Logical content | Blank | Clipping / cut-off | Overflow / overlap | Readability | Result |
|---:|---|---|---|---|---|---|
| 1 | Cover, product state legend, judging criteria summary | No | None observed | None observed | Readable; value proposition emphasized | PASS |
| 2 | 목적 또는 배경 | No | None observed | None observed | Readable | PASS |
| 3 | 기능 및 특징 | No | None observed | None observed | Table and CE tags readable | PASS |
| 4 | 공공데이터 활용 방안 | No | None observed | URL wrapping contained in table | Readable | PASS |
| 5 | 차별성 및 독창성 | No | None observed | None observed | Readable | PASS |
| 6 | 기대효과 | No | None observed | None observed | Readable | PASS |
| 7 | 사업(창업) 계획 | No | None observed | None observed | Table and callout readable | PASS |
| 8 | 제품 시나리오 상세 | No | None observed | None observed | Readable | PASS |
| 9 | Evidence ID 요약, 운영자 체크리스트, 최종 문장 | No | None observed | None observed | Readable | PASS |

Acceptance: **PASS** — no blank pages, clipping, URL/table overflow, overlapping text, or unreadably tiny text observed.

### 5. Scope and whitespace checks

Commands:

```bash
git diff --check -- docs/submission/2026-mofa-ai/asset-manifest.md
git diff --check -- docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf
git diff --name-only
git status --short
```

Expected/observed result:
- `git diff --check` for the markdown manifest: PASS, no output.
- `git diff --check` for the PDF path: PASS, no output.
- No tracked-file diff outside the owned deliverables was introduced by this rendering task.
- 메인 저장소에서 운영자 제공 원본은 `docs/` 루트의 untracked 파일로 보존되며, 렌더링 작업은 해당 입력을 수정하거나 커밋하지 않았다.

## SHA-256

Command:

```bash
sha256sum \
  docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.md \
  docs/submission/2026-mofa-ai/claim-evidence-matrix.md \
  docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf \
  'docs/[26-390](보도자료) 외교 공공데이터와 AI, 국민의 아이디어로 창업의 기회를 열어갑니다.pdf' \
  'docs/외교 공공데이터 · AI 활용 경진대회 개최 공고문.hwp' \
  'docs/외교 공공데이터 · AI 활용 경진대회 포스터.png'
```

| SHA-256 | Path |
|---|---|
| `d24fd3edaaf1deb6d6fc71c1c58c77c17490092bf766afa0fc3306bd268b6ad4` | `docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.md` |
| `976f322930420464b2abaddb80221ce5910b00eae35722e4c41f1866d690094e` | `docs/submission/2026-mofa-ai/claim-evidence-matrix.md` |
| `3bb23e495052bd7873fe41e678baa057c8f840ba0b8b45857f3ccb116c315ca5` | `docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.pdf` |
| `78aa307528f1f63e5f302b7a52e42a2fb4f2c5cc721dad9132515b2387e1e621` | `docs/[26-390](보도자료) 외교 공공데이터와 AI, 국민의 아이디어로 창업의 기회를 열어갑니다.pdf` |
| `d0dd894d15f08f42e93cc81461b0e42669a4fff03417249bb2f15c537e524721` | `docs/외교 공공데이터 · AI 활용 경진대회 개최 공고문.hwp` |
| `8c4bb0be792ed02f3dec3c7bbf8a8b6497f327011279fd1bb7beb11b0fa8f05d` | `docs/외교 공공데이터 · AI 활용 경진대회 포스터.png` |

## Product / ODA / roadmap boundaries

| Boundary | Statement |
|---|---|
| 현재 제품 | ClaimGate v0의 오프라인·결정론적·fixture-first 범용 프레임워크, No Anchor No Claim, AI Curator Not Judge, Source Anchor, deterministic risk trace, green sampling, Evidence Pack First, human terminal decision은 현재 제품 기반으로 표현한다. |
| ODA 구성 | 외교부·KOICA·KF·한아프리카재단 공개데이터 활용은 ODA DomainPack/fixture 구성안으로 표현한다. 현재 운영 중인 실시간 ODA API 연동 또는 배포 완료 제품으로 표현하지 않는다. |
| 로드맵 | 실제 LLM adapter, 실시간 공공데이터 adapter, 고객 pilot, 매출·운영 지표는 운영자 승인 후 로드맵/파일럿 검증 대상으로 표현한다. |
| 금지 주장 | 외부 production QA, user acceptance, measured social impact, 현재 ODA DomainPack 운영 완료, 실시간 API adapter 구현 완료, 실제 LLM 운영 완료는 현재 근거로 주장하지 않는다. |

## Operator-only boundaries

- 외부 제출 포털 업로드는 운영자 전용이다.
- 참가자 개인정보 입력, 서명, 직인, 기관 대표성 확인은 운영자 전용이다.
- public release, portal action, protected go/no-go, 외부 제출 후 커뮤니케이션은 운영자 전용이다.
- 본 작업자는 PDF 렌더링과 파일 검증만 수행했으며, 제출·개인정보·서명 작업은 수행하지 않았다.
