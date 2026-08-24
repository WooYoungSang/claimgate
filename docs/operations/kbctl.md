# kbctl 사용법

## 역할과 경계

`kbctl`은 프로젝트 로컬 JSON 지식 정본을 조회하고 원자적으로 변경하는 Go CLI다.

- 소스: `tools/kbctl`
- 바이너리: `./kbctl`
- 기본 KB: `governance/knowledge/claimgate-kb.json`
- 실행 기준 위치: 워크스페이스 루트

ClaimGate 기본 작업에서는 다른 프로젝트의 KB를 `--kb`로 지정하지 않는다. 마이그레이션/복구 검증 때만 명시 경로를 사용한다.

## 빌드와 검증

```bash
cd tools/kbctl
GOFLAGS=-buildvcs=false go test ./...
GOFLAGS=-buildvcs=false go vet ./...
GOFLAGS=-buildvcs=false go build -trimpath -o ../../kbctl .
cd ../..
./kbctl verify
```

ClaimGate는 Git 저장소이지만, 재현 가능한 로컬 빌드를 위해 `-buildvcs=false`를 유지한다.

## 공통 명령

```bash
./kbctl get <kind> <id>
./kbctl list <kind> [--filter field=value ...]
./kbctl search <query> [--kind kind1,kind2]
./kbctl create <kind> <id> --field name=value [--field name=value ...]
./kbctl update <kind> <id> --field name=value [--field name=value ...]
./kbctl verify
```

`create`와 `update`의 `--field name=@path`는 파일 내용을 문자열 필드로 읽는다.

### 지원 kind

```text
document decision incident open_issue lesson roadmap workpacket wave
change scenario rule question metaphor mapping delta term event command aggregate usecase
```

`get`, `list`, `search`는 JSON을 출력한다. `list --filter`는 문자열 필드의 정확한 일치이며,
`search`는 kind별 narrative 필드에서 대소문자를 무시한 부분 문자열을 찾는다.

## ClaimGate 문서 색인

기본 KB는 ClaimGate의 README, 제출, 검증, 패키지 경계, 보안, 재현성 문서를 `document` 레코드로 색인한다. FisherMan의 도메인 레코드는 복사하지 않았다.

```bash
./kbctl verify
./kbctl list document
./kbctl get document DOC-README-MD
./kbctl get document DOC-CLAIMGATE-PROJECT-BRIEF
./kbctl search 본질 --kind document,decision,lesson
./kbctl search 현재 --kind document,decision,open_issue
./kbctl search Evidence --kind document
./kbctl search OSSContest --kind document,decision,open_issue
```

`document` 레코드는 다음 필드를 갖는다.

- `id`: `DOC-...` 형태의 stable local id
- `path`: repo-root 상대 문서 경로
- `title`: 문서 제목
- `summary`: 검색용 요약
- `status`: `canonical` 또는 `supporting`


## ClaimGate 프로젝트 브리프

출품 준비 중 컨텍스트를 잃으면 `DOC-CLAIMGATE-PROJECT-BRIEF`를 먼저 읽는다. 이 레코드는
ClaimGate의 한 줄 정의, 본질, 목표, 철학, 구현된 표면, 의도적으로 제외한 표면, 출품 전 남은
public export hygiene를 연결한다.

```bash
./kbctl get document DOC-CLAIMGATE-PROJECT-BRIEF
./kbctl search 철학 --kind document,decision,lesson
./kbctl search "AI 판단기" --kind document,decision
./kbctl search "public export" --kind document,open_issue,workpacket
```

브리프 본문은 `docs/claimgate-project-brief.md`에 있고, KB에는 검색 가능한 문서 레코드와 결정
`D-004`~`D-006`, 교훈 `L-3`, 이슈 `OI-003`이 함께 기록된다.

## 설계 변경 감사 이력

`change`는 append-only `CHG-n` 감사 레코드다. 일반 `create change`와 `update change`는 거부된다.

```bash
./kbctl change create CHG-1 \
  --subject D-NEW \
  --supersedes D-OLD \
  --affected '["D-OLD","D-NEW","R-1"]' \
  --reason '실거래 브로커로 전환' \
  --migration 'paper 상태를 보존하고 live 설정을 별도 생성' \
  --rollout 'paper → shadow → limited live' \
  --rollback 'live route 차단 후 paper 복귀' \
  --evidence 'shadow verification report' \
  --actor 'operator' \
  --effective-at '2026-08-17T00:00:00Z' \
  --status accepted

./kbctl change get CHG-1
./kbctl change history D-NEW
./kbctl change impact CHG-1
./kbctl change diff CHG-1 CHG-2
./kbctl render changes --out .
```

`change create`는 다음을 자동 기록한다.

- `recorded_at`
- subject와 superseded record의 compact JSON snapshot
- `before_hash`, `after_hash` SHA-256
- subject·supersedes·affected record 참조 검증

`./kbctl verify`는 스냅샷 해시 변조, 끊어진 참조, 추적된 subject의 무기록 변경을 실패로 보고한다.

## DDD 기록 예시

```bash
./kbctl create scenario S-1 \
  --field 'title=핵심 시나리오' \
  --field 'status=ACTIVE' \
  --field 'outcome=기대 결과' \
  --field 'importance=비즈니스 중요성' \
  --field 'actor=행위자' \
  --field 'trigger=시작 조건' \
  --field 'story=@/tmp/domain-story.txt'

./kbctl create question KG-1 \
  --field 'question=이 상태에서 취소할 수 있는가?' \
  --field 'source=M-1' \
  --field 'status=OPEN' \
  --field 'blocks=S-1'

./kbctl create rule R-1 \
  --field 'statement=취소 가능 여부는 아직 확인되지 않았다.' \
  --field 'scenario=S-1' \
  --field 'status=UNKNOWN' \
  --field 'question=KG-1'
```

DDD ID 형식은 `S-n`, `R-n`, `KG-n`, `MET-n`, `MAP-n`, `M-n`, `T-n`, `EVT-n`,
`CMD-n`, `AGG-n`, `UC-n`이다.

## 렌더링

```bash
./kbctl render scenarios
./kbctl render all --out .
```

지원 view는 `changes`, `scenarios`, `stories`, `rules`, `metaphor`, `questions`, `glossary`,
`events`다. `--out`을 생략하면 stdout에 출력하고, 지정하면 `changes`는 `docs/design/changes.md`,
DDD view는 `docs/design/ddd` 아래에 생성한다.

## 운영 기록

```bash
./kbctl create decision D-002 \
  --field 'decision=결정 내용' \
  --field 'rationale=근거' \
  --field 'status=accepted'

./kbctl create lesson L-2 \
  --field 'lesson=재사용할 교훈' \
  --field 'status=raw' \
  --field 'reuse=다음 작업에서 적용하는 방법'
```

Lesson 상태는 `raw`, `distilled`, `verified`, `evergreen`, `stale`, `retired`다.
`verified`와 `evergreen`에는 `evidence`가 필요하다.

## 계획 명령

```bash
./kbctl roadmap set <stage> --status <value> [--evidence text] [--note text]
./kbctl wave create <wave> --goal <text> --parallelism <text>
./kbctl wave set <wave> [--goal text] [--parallelism text]
./kbctl workpacket create <wave> <id> \
  --depends-on '[]' \
  --exclusive-file-lease '["path"]' \
  --delivers <text> \
  --done-when <text> \
  --status not_started
./kbctl workpacket set <id> --status <status> [--evidence text] [--next-step text]
./kbctl workpacket rewire <id> --depends-on '["PKT-1"]'
```

workpacket은 구현 lifecycle `status`와 별도로 다음 Human Review Gate `review_status`를 선택적으로
가질 수 있다.

```text
IMPLEMENTING AI_VERIFYING READY_FOR_HUMAN_REVIEW HUMAN_REWORK
HUMAN_ACCEPTED COMMIT_READY DONE
```

또한 `aec`, `acceptance_criteria`, `implementation_plan`은 세 필드를 항상 함께 등록해야 한다.
각 값은 `claimgate.aec/v1`, `claimgate.ac/v1`, `claimgate.implementation-plan/v1` 스키마를
따르는 JSON 문자열이다. `update`와 `verify`는 부분 등록, 빈 실행 기준, 비연속 plan step,
negative control 누락을 fail-closed로 거부한다.

현재 구현은 첫 번째 wave를 자동 생성하지 못한다. `waves`가 비어 있는 새 KB에서는 이 기능을
사용하기 전에 초기화 기능을 보강해야 한다.

## FMON 운영 대시보드

`tools/fmon`은 `kbctl list`와 `kbctl verify` 출력만 사용하는 Bubble Tea read-model TUI다.
KB JSON을 직접 열지 않으며, 명령 실패나 JSON 계약 약화가 발생하면 fallback 없이 오류 화면을
표시한다.

```bash
pnpm test:fmon
./fmon
./fmon --refresh 10s
./fmon --once
```

## 주의사항

- 별도의 `init`, `help`, `version` 명령이 없다.
- 기본 KB 경로는 현재 작업 디렉터리에 상대적이므로 루트에서 실행한다.
- `update --field`는 기존 배열/객체 필드를 덮어쓰지 못한다.
- `reset ddd`는 모든 DDD 레코드를 비우는 파괴적 명령이며 Lesson은 유지한다.
- `verify`는 인덱스 일치뿐 아니라 참조 무결성과 “Scenario는 정확히 하나만 ACTIVE” 같은 모델링 Gate를 검사한다.
