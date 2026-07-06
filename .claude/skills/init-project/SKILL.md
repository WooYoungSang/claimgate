---
name: init-project
description: New project bootstrap bundle — devos_init_project + devos_harness_install
applies_to: [python, any]
---

# /init-project / $init-project
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

## Purpose
신규 프로젝트 부트스트랩. ShapeOps lifecycle ready 상태로 즉시 진입.

## SCOPE_BOUNDARY
- In-scope: 신규 프로젝트 init + harness install (Claude Code/Codex target)
- Out-of-scope: 기존 프로젝트 마이그레이션 (별도 skill 권장)
- Excluded paths: 비-Python stack 자동 추론 (사용자 명시 필요)

## Tool sequence
1. `devos_init_project(project_id, project_dir, ...)` — ShapeOps project 노드 생성 + 기본 ADR/Pitch placeholder
2. `devos_harness_install(target="all", project_dir=...)` — Claude Code + Codex harness 설치
3. `devos_validate_project(project_id)` — identity_state=exact_match, indexed=true, queryable=true 확인
4. (optional) `devos_health_check(project_id)` — HEALTH_CHECK_REPORTED 이벤트 emit

순서 불변: `devos_init_project` 가 반드시 `devos_harness_install` 보다 먼저 실행되어야 한다.

## Evidence template
- claim: "<one-line factual assertion>"
- evidence_type ∈ {mcp_response, file_read, test_run, UNKNOWN}
- data_ref: project_id | target | install_path
- confidence_level ∈ {HIGH, MEDIUM, LOW, UNVERIFIED}

## Role mutation permissions
- mutate_code: true (신규 프로젝트 디렉터리 한정)
- mutate_vault: true (Single Writer, ShapeOps project 노드)
- mutate_repo_meta: true (.claude/, .codex/, .agents/ harness 설치)
- commit_authority: none (사용자 결정에 위임)
