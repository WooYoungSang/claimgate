# ClaimGate Quickstart

이 문서는 심사자와 첫 기여자가 ClaimGate의 기본 경로를 빠르게 재현하고, 새 DomainPack의 확장 지점을 찾기 위한 최소 안내입니다.

## 1. 준비

- Node.js 20 이상
- pnpm 9 (`package.json`의 `packageManager` 기준)
- 의존성을 최초 설치할 때만 패키지 레지스트리 접근 필요

```bash
git clone https://github.com/WooYoungSang/warvis-claimgate.git
cd warvis-claimgate
pnpm install --frozen-lockfile
```

설치 후 기본 데모와 테스트는 서버, DB, API 키, hosted LLM 없이 로컬 fixture로 실행됩니다.

## 2. 5분 검증

### pack 교체 데모

```bash
pnpm demo
```

기대 결과:

- `civic-data`, `health-data`, `mofa-oda` 세 pack이 차례로 실행됩니다.
- 각 결과에 Source Anchor, 위험 규칙 ID/trace, 사람 판정, Evidence Pack 항목 수가 표시됩니다.
- 마지막 줄에 core/UI 변경 없는 세 pack 교체 완료가 표시됩니다.

### DomainPack 계약 검증

```bash
pnpm test/conformance
```

이 검사는 pack 메타데이터, 선언한 anchor/entity, fixture 기대 결과, 규칙 결정성, 비어 있지 않은 trace, 모든 규칙의 fixture 실행 여부를 확인합니다.

### 전체 프레임워크 게이트

```bash
pnpm eval:framework
```

전체 게이트는 `lint → typecheck → test → demo → conformance → e2e handoff → performance smoke` 순서입니다. 모델 추출 품질이나 실제 공공데이터의 정확도를 평가하지는 않습니다.

## 3. 브라우저 UI 확인

먼저 Vite 앱을 빌드합니다.

```bash
pnpm --filter @claimgate/example-civic-review-app build
pnpm --filter @claimgate/example-civic-review-app exec vite preview \
  --host 127.0.0.1 --port 4280 --strictPort
```

브라우저에서 `http://127.0.0.1:4280`을 엽니다. 화면의 출처 URL은 provenance metadata이며 앱이 실행 중 원격 공공데이터를 조회하지 않습니다.

## 4. 새 DomainPack 추가

### 소유권 경계

`@claimgate/core`가 상태 전이, Source Anchor, 투영 불변 조건과 `DomainPack` 타입을 소유합니다. 새 pack은 도메인 fixture와 판정 규칙을 소유하며 core 불변 조건을 바꿀 수 없습니다.

### 가장 짧은 구현 순서

1. `packs/civic-data` 또는 `packs/mofa-oda`를 `packs/<domain>`으로 복사합니다.
2. 새 `package.json`의 이름을 `@claimgate/pack-<domain>`으로 바꿉니다.
3. `src/index.ts`에서 다음 `DomainPack` 필드를 도메인에 맞게 교체합니다.
   - `id`, `packageName`, `displayName`, `version`, `description`
   - `labels`, `entityTypes`, `anchorKinds`
   - `riskRules`, `reportTemplates`, `fixtures`
4. 각 위험 규칙에 하나 이상의 fixture를 만들고 기대 `ruleId`, `level`, `recommendedState`를 명시합니다.
5. `test/pack.test.ts`에서 `assertDomainPackConformance(pack)`을 호출합니다.
6. 의존성/lockfile을 갱신하고 새 pack만 먼저 검증합니다.

```bash
pnpm install
pnpm --filter @claimgate/pack-<domain> test
pnpm --filter @claimgate/pack-<domain> build
pnpm test/conformance
```

7. `examples/civic-review-app`의 조합 지점에 pack을 추가한 뒤 전체 데모와 gate를 실행합니다.

```bash
pnpm demo
pnpm eval:framework
```

### conformance가 거부해야 하는 것

- 선언하지 않은 Source Anchor kind 또는 entity type
- 두 번 실행했을 때 달라지는 위험 결과
- trace가 없거나 기대 rule ID를 설명하지 못하는 결과
- `aiRiskScore`, `riskScore`, `riskLevel`, `score`처럼 AI/pack에 최종 점수 권한을 암시하는 필드
- fixture가 한 번도 실행하지 않는 위험 규칙

계약 전체는 [`domain-packs.md`](domain-packs.md), 코드 타입은 [`../packages/core/src/domain-pack.ts`](../packages/core/src/domain-pack.ts), 검증 구현은 [`../packages/conformance/src/index.ts`](../packages/conformance/src/index.ts)를 참고하세요.

## 5. Local AI는 선택 사항

기본 프레임워크를 평가하거나 새 DomainPack을 만들 때 GPU와 Ollama는 필요하지 않습니다.

```bash
pnpm test:ai-demo
pnpm rag:build:mofa
pnpm tune:dataset:mofa
```

현재 RAG는 MOFA ODA fixture corpus의 repo-local persistent sparse-vector index입니다. Gemma 4 12B QLoRA adapter는 6개 train fixture로 60-step 학습했으며, 겹치지 않는 holdout fixture 3개에서 strict JSON과 candidate-only 경계를 `3/3`, 금지된 권한 필드 수용 `0`으로 통과해 `BOUNDARY_PASS_SERVING_READY`로 기록됐습니다. 이는 작은 fixture의 형식·권한 경계 증거이며 production-quality 또는 실제 문서 추출 정확도 평가는 아닙니다. Local AI 출력은 항상 후보-only이며 검증, 위험 판정, anchor 승인, reviewer decision, 투영 권한을 갖지 않습니다.

LoRA adapter 경로를 실행할 때는 먼저 엄격한 GPU/Python preflight를 통과해야 합니다. adapter 변수를 생략하면 같은 데모 명령이 후보-only Ollama 경로를 사용합니다.

```bash
pnpm tune:preflight
CLAIMGATE_GEMMA_LORA_ADAPTER=artifacts/local-ai/gemma-candidate-lora-serving-ready \
pnpm demo:ai:gemma
```

## 6. 실패를 해석하는 법

- `pnpm install --frozen-lockfile` 실패: Node/pnpm 버전 또는 lockfile 일치를 확인합니다.
- core state/projection 테스트 실패: No Anchor, No Claim 또는 Evidence Pack First 회귀로 취급합니다.
- conformance 실패: pack metadata, fixture, 규칙 trace, 결정성을 먼저 확인합니다.
- Local AI no-hit: fail-closed가 정상입니다. 임의 후보나 anchor를 생성해 통과시키지 않습니다.
- GPU/Ollama 실패: 선택 경로의 환경 문제이며 기본 `pnpm eval:framework` 결과와 분리해 기록합니다.

세부 명령과 증거 범위는 [`verification-matrix.md`](verification-matrix.md), 깨끗한 clone 재현 절차는 [`reproducibility.md`](reproducibility.md)를 참고하세요.
