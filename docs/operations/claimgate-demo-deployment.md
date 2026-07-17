# ClaimGate 외교부 ODA 데모 배포·복구 런북

이 문서는 `mofa.warvis.org`의 **기존 노드 + Caddy + Cloudflare** 경계를 유지하면서 정적 데모를 반복 배포하는 절차다. 저장소가 자동화하는 범위는 정적 빌드 검증, 버전 디렉터리 배치, 활성 링크의 원자 교체, 공개 읽기 스모크, 실패 시 자동 롤백이다.

## 1. 안전 경계

- Cloudflare 토큰, 원본 인증서, 개인키, `.env`를 읽거나 출력하거나 저장소에 넣지 않는다.
- DNS 레코드 생성·수정, Cloudflare SSL/TLS 모드 변경, Caddy 서비스 reload는 운영자 Gate다.
- `live OpenAPI`, `real LLM`, OCR, 서버·DB·auth는 이 정적 데모와 무관하며 계속 No-Go다.
- 공개 스모크는 `GET`, DNS 조회, TLS handshake만 수행하는 읽기 전용 관측이다.
- 자격증명이 필요한 단계는 자동 성공으로 기록하지 않는다. 아래 운영자 체크리스트에 `미실시`로 남긴다.

## 2. 저장소 계약 검증

```bash
pnpm test:deployment
pnpm build
pnpm test:runbook
pnpm test:judge-flow
pnpm test:geometry
```

`pnpm test:deployment`는 다음 실패 변이를 고정한다.

1. 유효하지 않은 artifact와 credential-shaped 파일·심볼릭 링크
2. 비원자적이거나 release 디렉터리 밖을 가리키는 `current`
3. 배포 전·후 스모크 실패와 자동 롤백
4. SPA fallback 누락
5. HTML/fallback 장기 cache 또는 asset의 짧은 cache
6. 잘못된 asset `Content-Type`
7. DNS 부재, TLS 검증 실패·만료, 평문 HTTP

## 3. Caddy 정적 호스팅 계약

저장소 설정은 [`scripts/deploy/Caddyfile`](../../scripts/deploy/Caddyfile)이다.

- site root: `{$CLAIMGATE_SITE_ROOT:/srv/claimgate/current}`
- SPA fallback: `try_files {path} /index.html`
- HTML 및 fallback: `Cache-Control: no-cache, no-store, must-revalidate`
- 정적 asset: `Cache-Control: public, max-age=31536000, immutable`
- `Content-Type`: Caddy `file_server`의 확장자 기반 판정
- TLS: Caddy의 표준 자동 HTTPS. DNS challenge plugin이나 Cloudflare 토큰을 저장소 설정에 두지 않는다.

운영자는 적용 전에 Caddy 설치 환경에서 다음을 실행한다. 이 명령은 설정을 검사할 뿐 DNS나 토큰을 변경하지 않는다.

```bash
caddy validate --config scripts/deploy/Caddyfile --adapter caddyfile
```

Caddy 서비스 설정 교체와 reload는 기존 노드 운영 절차와 별도 승인에 따른다.

## 4. 원자 배포

릴리스 ID는 커밋 SHA처럼 재사용하지 않는 경로 안전 식별자를 사용한다. 배포 계정은 `/srv/claimgate`에 쓰기 권한이 있어야 하고, 이 디렉터리만 배포 스크립트가 소유한다.

```bash
pnpm --filter @claimgate/example-civic-review-app build

pnpm deploy:static -- \
  --artifact examples/civic-review-app/dist \
  --release-root /srv/claimgate \
  --release-id "$(git rev-parse --short=12 HEAD)" \
  --smoke-url https://mofa.warvis.org
```

디렉터리 구조는 다음과 같다.

```text
/srv/claimgate/
├── releases/
│   ├── <previous-release>/
│   └── <new-release>/
└── current -> releases/<active-release>
```

스크립트는 artifact를 `releases/.staging-*`에 복사하고 재검증한 다음 불변 버전 디렉터리로 `rename`한다. 그 뒤 임시 상대 symlink를 `current`로 원자 교체한다. 기존 release 디렉터리는 덮어쓰지 않으며, 복사 실패 시 staging을 지워 같은 release ID로 안전하게 재시도할 수 있다.

배포 중에는 release root의 `.deploy.lock`을 원자 획득한다. 동시에 실행된 배포는 `DEPLOYMENT_LOCKED`로 실패한다. 배포 후 성공 확정과 rollback 직전에는 `current`가 이번 배포 release인지 다시 비교하므로, 다른 주체가 활성 release를 바꾼 경우 각각 `CURRENT_CONFLICT`, `ROLLBACK_CONFLICT`로 실패하고 제3의 release를 덮어쓰지 않는다.

### 결과 판정

- 배포 전 스모크 실패: `PRE_DEPLOY_SMOKE_FAILED`, `current` 변경 없음
- 배포 후 스모크 성공: `status=deployed`, 새 release 활성
- 배포 후 스모크 실패: `POST_DEPLOY_SMOKE_FAILED`, 직전 release 복원 후 rollback 스모크 실행
- 성공 검사 중 활성 release 변경: `CURRENT_CONFLICT`, 제3의 release 유지
- rollback 직전 활성 release 변경: `ROLLBACK_CONFLICT`, 제3의 release 유지
- `rollbackVerified=false`: 링크는 복원됐어도 공개 복구가 검증되지 않은 상태이므로 Gate 실패

## 5. 공개 읽기 스모크

```bash
pnpm probe:deployment
```

출력은 관측 시각과 `environment=public-read-only`를 포함한다. 검증 항목은 다음과 같다.

- URL이 HTTPS인지
- DNS가 하나 이상의 주소로 해석되는지
- TLS 1.2 이상, 인증서 검증 성공, 만료 전인지
- `/`이 `200 text/html`이고 앱 셸과 module asset을 포함하는지
- root, SPA fallback, asset의 최종 redirect URL이 HTTPS이고 `mofa.warvis.org` 원본을 유지하는지
- 존재하지 않는 `__claimgate_spa_probe__` 경로가 같은 앱 셸과 동일한 버전 asset 경로/hash로 fallback되는지
- HTML/fallback이 no-cache인지
- JS/CSS asset이 올바른 `Content-Type`과 1년 immutable cache를 가지는지
- `nosniff`, 정확한 `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, CSP가 있는지

DNS, TLS, fetch와 본문 읽기는 개별 제한을 누적하지 않고 전체 probe 하나의 hard deadline을 공유한다. 의존 호출이 abort를 무시해도 보고서는 제한 시간 안에 실패로 닫힌다.

Cloudflare의 `server`, `cf-ray`, `cf-cache-status`는 관측값으로만 기록하고 통과 조건으로 가장하지 않는다.

## 6. Cloudflare 운영자 Gate

다음 항목은 저장소 자동화 범위가 아니다.

| 항목 | 운영자 확인 | 증거 |
|---|---|---|
| `mofa.warvis.org`가 기존 노드의 승인된 DNS target을 가리킴 | 미실시 | Cloudflare dashboard 변경 이력 또는 승인된 export |
| Proxy 상태와 SSL/TLS 모드가 조직 정책에 맞음 | 미실시 | 민감값을 제거한 설정 캡처 |
| Caddy 설정 validate/reload 완료 | 미실시 | 종료 코드와 서비스 journal의 비밀 제거 요약 |
| `pnpm probe:deployment` 녹색 | 미실시 | JSON 출력 artifact |

토큰 값, Zone ID 전체 값, 원본 IP가 비밀로 분류된 환경 정보는 증거에 복사하지 않는다.

### 2026-07-17 공개 읽기 관측

`2026-07-17T15:08:47.288Z`에 `pnpm probe:deployment`를 실행했다. HTTPS, DNS 4개 주소, TLS 1.3과 인증서 유효성, root/SPA `200 text/html`, 동일 shell asset(`/assets/index-VN1YndhQ.js`), asset `200 text/javascript`, Cloudflare edge는 통과했다. 다음 4개 조건은 실패했다.

1. root 응답에 `Cache-Control`이 없다.
2. SPA fallback 응답에 `Cache-Control`이 없다.
3. asset cache가 `max-age=14400`이며 1년 immutable 정책이 아니다.
4. 현재 공개 응답이 이 문서의 정확한 5종 보안 헤더 정책을 모두 충족하지 않는다.

저장소의 `scripts/deploy/Caddyfile`에는 이를 교정하는 cache split과 보안 헤더 정책이 포함되어 있고 로컬 `caddy validate`를 통과했지만, 공개 노드에는 적용하지 않았다. 관측 시 `/srv/claimgate` release root가 없고 비대화형 `sudo` 권한도 없어 Caddy 교체/reload를 수행하지 않았다. DNS, Cloudflare 토큰, 인증서 또는 서비스 설정은 읽거나 변경하지 않았다. 운영자 적용·reload 증거가 생긴 뒤 `pnpm probe:deployment`를 다시 실행해야 Gate를 통과할 수 있다.

## 7. 롤백 리허설과 장애 대응

자동 롤백의 결정적 리허설은 외부 사이트를 깨뜨리지 않고 실행한다.

```bash
node --test --test-name-pattern="post-switch smoke failure" scripts/deploy/release.test.mjs
```

실제 배포에서 `POST_DEPLOY_SMOKE_FAILED`가 발생하면 다음 순서로 대응한다.

1. 출력의 `rollbackPerformed`와 `rollbackVerified`를 확인한다.
2. `readlink /srv/claimgate/current`가 직전 `releases/<id>`인지 확인한다.
3. `pnpm probe:deployment`를 다시 실행한다.
4. 실패 release 디렉터리는 즉시 삭제하지 않고 원인 분석 대상으로 격리한다.
5. 공개 복구가 녹색이 아니면 Caddy/Cloudflare 운영자 Gate로 승격한다.

## 8. 릴리스 증거 체크리스트

- [ ] `pnpm test:deployment` 종료 코드 0
- [ ] 빌드·타입 검사·런북·심사 흐름·geometry 검증 종료 코드 0
- [ ] 배포 JSON의 release ID와 이전/현재 release 경로 기록
- [ ] 공개 probe JSON과 관측 시각 기록
- [ ] rollback injection 종료 코드 0
- [ ] `git diff --check` 종료 코드 0
- [ ] 변경 파일에 `.env`, key/certificate, token 값 0건
- [ ] DNS/토큰 변경은 별도 운영자 승인·증거가 없으면 `미실시`
