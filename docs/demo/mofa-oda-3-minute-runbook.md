# ClaimGate MOFA ODA 3분 심사 데모 런북

> **목표:** AI가 만든 답을 그대로 믿는 화면이 아니라, 오프라인 후보 주장을 공공데이터 Source Anchor와 결정론적 규칙으로 대조하고 **사람의 판정만** canonical Evidence Pack에 투영되는 흐름을 3분 안에 보여 준다.
>
> **시제품 경계:** 이 데모는 **offline / deterministic / fixture-first**이다. `AI Curator`는 사전 생성 fixture에서 후보를 제안하는 시뮬레이션일 뿐 최종 판정 권한이 없다. live OpenAPI, real LLM, OCR, 서버·DB·auth, production accuracy 평가는 **FUTURE / No-Go**이며 동작하거나 준비됐다고 말하지 않는다.

## 0. 사전 준비 (시연 전, 타이머 제외)

1. Chrome/Chromium 계열 브라우저에서 `https://mofa.warvis.org`를 열고 데스크톱 폭(권장 1280px 이상), 확대 100%로 맞춘다.
2. 첫 화면에 `ClaimGate · MOFA ODA prototype`, `Offline`, `Deterministic`, `Fixture-first`, `No live AI / API / OCR`이 보이는지 확인한다.
3. 탭이 이미 열린 상태라면 새로고침 후 `처음부터`를 눌러 시작 오버레이로 돌아간다. 판정 기록, 선택 주장, Evidence Pack 미리보기가 모두 초기화되어야 한다.
4. 발표자는 다운로드 폴더 쓰기 권한을 확인한다. 다운로드가 차단돼도 `Evidence Pack 미리보기`까지만으로 핵심 검증은 가능하다.
5. 공개 URL의 **페이지 전달**에는 네트워크가 필요하지만, 페이지가 로드된 뒤 검토 데이터와 판정 규칙은 live 공공데이터 API를 호출하지 않는 오프라인 fixture이다.

### 로컬 대체 실행

공개 URL 또는 네트워크가 불안정하면 저장소 루트에서 다음을 실행하고 `http://127.0.0.1:4280`을 연다.

```bash
pnpm --filter @claimgate/example-civic-review-app build
pnpm --filter @claimgate/example-civic-review-app exec vite preview --host 127.0.0.1 --port 4280 --strictPort
```

## 1. 3분 타임라인 (총 180초)

| 구간 | 시간 | 화면 조작 | 발표 멘트와 확인점 |
|---|---:|---|---|
| 오프닝 | 0–20초 | 시작 오버레이에서 파이프라인을 가리킨 뒤 `가이드 데모 시작` | “입력은 **사전 생성 오프라인 fixture**, AI Curator는 **후보 주장 제안 시뮬레이션**, 권한은 **제안 전용·판정 불가**입니다. 결정론적 규칙과 사람 검토자가 판단합니다.” 시작 후 상단 `Offline fixture`, `AI Curator · fixture proposal only`, DomainPack `MOFA ODA Public Data Pack`을 확인한다. |
| 1단계 · 후보 주장 | 20–50초 | `검토할 주장` 큐의 RED, YELLOW, GREEN 세 항목을 차례로 가리키거나 클릭한 뒤 RED로 돌아온다. `다음 단계` | “RED는 ‘안전’ 주장과 **외교부_국가별 안전정보**의 위험·주의가 충돌합니다. YELLOW는 KOICA 사업의 국가·기간이 다릅니다. GREEN은 ODA 용어 정의가 공식 용어사전과 일치하지만 false-negative 방지를 위해 표본 검토합니다.” |
| 2단계 · 근거 비교 | 50–85초 | RED 선택 상태에서 `AI 제안`과 `Source Anchor` 카드, `값 불일치(≠)`, `Public-data provenance`, `판정 규칙`을 순서대로 가리킨다. `다음 단계` | “AI 값 `safe-and-stable`과 Source Anchor 값 `special-travel-advisory-caution`을 타입과 값으로 비교합니다. Source Snapshot은 제목·locator·오프라인 출처 경계를 보존합니다. rule trace `mofa.country-safety-mismatch`가 RED와 `conflict`를 재현하지만 최종 판정은 하지 않습니다.” |
| 3단계 · 사람 판정 | 85–120초 | `근거값으로 정정` → 기본 정정 값과 `판정 사유` 확인 → `판정 기록` → `다음 단계` | “검토자가 근거값과 사유를 직접 확정합니다. audit record에는 `demo-reviewer`와 deterministic fixture 시간이 남습니다. AI나 규칙 엔진이 이 버튼을 대신 누르지 않습니다.” **주의:** 판정 후 해당 주장의 세 판정 버튼은 잠긴다. |
| 4단계 · 결과 투영 | 120–160초 | 오른쪽 `Review outcome`과 가드 사유를 가리킨다. `Evidence Pack 미리보기` → 항목 확인 → 필요 시 `JSON 다운로드` 또는 `Markdown 다운로드` → `×` → `가이드 완료` | “현재는 3건 중 RED 1건이 정정되어 canonical 포함 수가 1입니다. 나머지 대기는 `review-pending`으로 투영이 차단됩니다. 기각한 주장은 `review-rejected`로 제외됩니다. 오직 검증·정정된 주장만 Evidence Pack, 보고서와 그래프의 입력이 됩니다.” 미리보기 footer의 `Offline · deterministic · fixture-first`와 projectable claim 수를 확인한다. |
| 확장성과 종료 | 160–180초 | 가이드 완료 후 상단 DomainPack 선택을 열어 civic / health / `MOFA ODA Public Data Pack`을 보여 주고 MOFA로 복귀 | “같은 ClaimGate 검토 프레임에 civic, health, MOFA ODA 규칙과 fixture를 교체해 씁니다. 오늘 보신 것은 정확도 주장이 아니라, 근거·규칙 trace·사람 판정·투영 가드를 검증하는 오프라인 시제품입니다.” |

## 2. 세 시나리오의 정확한 이야기

### RED — 외교부 안전정보 불일치

- 큐 제목: `안전하다는 AI 주장, 외교부 국가별 안전정보와 충돌`
- AI 제안: `제한 없이 현장 활동이 가능한 안전 지역`
- 공공데이터 근거: `특별여행주의보 및 신변안전 유의 지역`
- Source Snapshot 제목: `외교부_국가별 안전정보`
- rule trace: `mofa.country-safety-mismatch` → `red` → `conflict`
- 권장 시연 판정: `근거값으로 정정`; 기본 사유를 읽고 `판정 기록`한다.

### YELLOW — KOICA 사업 국가·기간 불일치

- 큐 제목: `KOICA 사업 국가·기간 정보에 추가 확인이 필요`
- AI 제안: Country B, 2022–2026년
- Source Anchor: Country A, 2021–2025년, 시행기관 KOICA
- rule trace: `koica.project-period-or-country-mismatch` → `yellow` → `needs-evidence`
- 의미: 자동 오류 확정이 아니라 검토자에게 국가·기간·기관 확인을 요구한다.

### GREEN — ODA 정의 일치 표본

- 큐 제목: `ODA 용어 정의가 공식 용어사전과 일치`
- Source Snapshot 제목: `한국국제협력단_ODA 용어사전`
- rule trace: `oda.term-definition-match` → `green` → `needs-evidence`
- 의미: 값이 일치해도 자동 검증하지 않는다. GREEN 표본 검토로 근거 누락과 false negative를 방어한다.

## 3. 판정·투영 가드 설명

- `기각`: 판정 사유를 기록하고 canonical Evidence Pack에서 제외한다. 결과 영역에 `review-rejected`가 표시된다.
- `근거값으로 정정`: Source Anchor 값을 확정하고 사유를 기록한다. 정정된 주장은 투영 가능하다.
- `검증 완료`: Source Anchor와 일치함을 사람이 확인하고 사유를 기록한다. 검증된 주장은 투영 가능하다.
- 판정 전 항목: `review-pending`; canonical Evidence Pack 투영이 차단된다.
- `Evidence Pack 미리보기`는 투영 가능한 항목이 0개면 비활성화된다. 검증 또는 정정 후 활성화된다.
- 미리보기의 `JSON 다운로드`와 `Markdown 다운로드`는 동일한 오프라인 검토 결과의 정적 export이다.

## 4. 장애 복구와 정확한 폴백

| 증상 | 복구 절차 |
|---|---|
| 시작 화면에서 키보드 포커스가 보이지 않음 | `Tab` 또는 `Shift+Tab`으로 두 시작 버튼 사이를 이동한다. 그래도 보이지 않으면 새로고침 후 `가이드 데모 시작`을 클릭한다. 시작 오버레이는 배경을 비활성화하고 포커스를 내부에 유지한다. |
| 가이드가 엉뚱한 패널에 포커스하거나 스크롤이 빗나감 | `가이드 건너뛰기` → 상단 `가이드 데모`로 재시작한다. 완전 초기화가 필요하면 `처음부터`를 누른다. `처음부터`는 판정 기록과 가이드 상태를 함께 지운다. |
| 판정 또는 Evidence Pack 대화상자가 닫히지 않음 | `Esc`, 우측 상단 `×`, 또는 어두운 배경 클릭 중 하나로 닫는다. 닫은 뒤 원래 조작 버튼으로 포커스가 복귀하는지 확인한다. |
| `다음 단계`가 3단계에서 비활성화됨 | 정상 가드다. `기각`·`근거값으로 정정`·`검증 완료` 중 하나를 선택하고 비어 있지 않은 `판정 사유`로 `판정 기록`해야 활성화된다. |
| Evidence Pack 버튼이 비활성화됨 | 아직 검증·정정된 항목이 없다. RED 항목을 `근거값으로 정정`하고 `판정 기록`한다. 기각만으로는 활성화되지 않는다. |
| 가이드 도중 DomainPack을 잘못 바꿈 | pack 변경은 진행 중 가이드를 종료한다. 상단 `가이드 데모`를 눌러 MOFA 가이드를 다시 시작한다. |
| 공개 URL이 느리거나 끊김 | 새로고침은 한 번만 시도한다. 계속 실패하면 위 로컬 대체 실행으로 전환한다. live 공공데이터 API 전환이나 임의 데이터 입력으로 우회하지 않는다. |
| 다운로드가 차단됨 | 브라우저 다운로드 권한을 허용하고 다시 누른다. 허용할 수 없으면 Static preview와 projectable claim 수만 확인하고 “다운로드 미검증”으로 명시한다. |
| 화면 폭이 좁아 오른쪽 패널이 아래로 내려감 | 브라우저 폭을 넓히거나 확대를 90–100%로 조정한다. 반응형 레이아웃의 정상 동작이며 데이터 누락이 아니다. |

## 5. 예상 체크포인트와 중단 기준

### 진행 체크포인트

- [ ] 시작 화면에 offline / deterministic / fixture-first 및 AI proposal-only 경계가 보인다.
- [ ] MOFA 큐에 RED·YELLOW·GREEN 3건이 있고 위 제목과 일치한다.
- [ ] RED Source Snapshot이 `외교부_국가별 안전정보`이며 `값 불일치`를 표시한다.
- [ ] 세 rule ID가 각각 기대한 risk와 recommended state를 표시한다.
- [ ] 판정 모달에 정정 값 또는 판정 사유가 있고 `판정 기록` 후 audit record가 생긴다.
- [ ] pending은 `review-pending`, rejected는 `review-rejected`로 투영이 차단/제외된다.
- [ ] 검증·정정된 항목만 canonical 포함 수와 Static preview에 나타난다.
- [ ] JSON/Markdown 다운로드는 성공했거나 “다운로드 미검증”으로 분명히 기록한다.

### 즉시 중단하고 “시제품 검증 실패”로 보고할 조건

- Source Anchor 없이 항목이 검증·정정되거나 Evidence Pack에 포함된다.
- pending 또는 rejected 항목이 canonical Evidence Pack 미리보기에 포함된다.
- rule ID·risk·recommended state가 위 시나리오와 다르거나 실행마다 결과가 달라진다.
- 검토자 판정과 사유 없이 Evidence Pack에 항목이 투영된다.
- 런타임이 live OpenAPI, real LLM, OCR, 서버·DB·auth를 요구하거나 호출한다.
- 공개 URL 장애를 제품 정확도 또는 공공데이터 정확도 문제로 잘못 설명해야만 시연을 이어갈 수 있다.

---

## 한 페이지 퀵 큐

**00:00** `가이드 데모 시작`
“오프라인 fixture → AI 후보 제안 시뮬레이션 → 제안 전용. 규칙과 사람이 판단합니다.”

**00:20** 큐 RED → YELLOW → GREEN → RED
“외교부 안전 충돌 / KOICA 국가·기간 불일치 / ODA 정의 일치 표본입니다.” → `다음 단계`

**00:50** `AI 제안` ≠ `Source Anchor` → provenance → `mofa.country-safety-mismatch`
“Source Snapshot과 deterministic trace는 판단 근거이지 최종 판정자가 아닙니다.” → `다음 단계`

**01:25** `근거값으로 정정` → `판정 사유` → `판정 기록`
“사람이 값과 사유를 확정하고 audit record를 남깁니다.” → `다음 단계`

**02:00** outcome: 정정 1, 대기 2, canonical 포함 1
“pending은 차단, rejected는 제외, verified/corrected만 투영합니다.”

**02:15** `Evidence Pack 미리보기` → Static preview → JSON/Markdown → `×` → `가이드 완료`

**02:40** DomainPack civic / health / MOFA 확인
“동일 프레임, 도메인 규칙·fixture 교체. live API·real LLM·OCR·운영 정확도는 FUTURE / No-Go입니다.”

**03:00 STOP** — 핵심 체크포인트 미충족 시 다음 화면으로 넘어가지 말고 중단 기준에 따라 보고한다.
