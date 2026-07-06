---
name: dev-session
description: Standard ShapeOps DevSession workflow — context bootstrap to lesson preparation. SSOT for single-cycle DevSession lifecycle; multi-stage UoW forging belongs to `/forge` (Claude) or `$forge` (Codex).
applies_to: [python, any]
---

# /dev-session / $dev-session
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

> Vault OS SSOT (mandatory · non-negotiable): `99_constitution/vault-os.md` (Obsidian, WARVIS vault). Open: `obsidian://open?vault=WARVIS&file=99_constitution%2Fvault-os`. Agent Contract §0.1 applies.

## Purpose
ShapeOps DevSession 한 사이클 (UoW 또는 phase 단위)을 정해진 라이프사이클 이벤트 체인에 따라 실행한다.

## SCOPE_BOUNDARY
- In-scope: 단일 DevSession 운영 (start → end), evidence record, lesson prepare.
- Out-of-scope: 다단계 UoW forge 파이프라인 (→ `/forge` 또는 `$forge`), Bet ship ratification (→ `/ratify` 또는 `$ratify`), 신규 프로젝트 부트스트랩 (→ `/init-project` 또는 `$init-project`).
- Excluded paths: Obsidian vault 직접 쓰기 (Single Writer 경유 필수).

## Tool sequence (contract)

이 skill은 lifecycle event chain의 **contract** 다. 실제 도구 호출 execution은 `dev-session-runner` agent에 위임된다 (`src/context_devos/harness/registry/agents/dev-session-runner.md`). 본 skill을 invoke하면 main Claude/Codex session이 runner agent를 spawn하여 다음 11-step sequence를 실행한다.

### Phase 0 — Identity prerequisite
1. `devos_health_check(project_id)` — identity_state=exact_match, indexed=true, queryable=true.

### Phase 1 — Context bootstrap
2. `devos_retrieve_context(project_id, query, mode)` — project chunks.
3. `devos_get_role_tool_allowlist(role)` — advisory persona tool boundary.
4. `devos_get_relevant_lessons(query, project_id)` — 관련 lessons.

### Phase 2 — Session lifecycle
5. `devos_start_dev_session(...)` — HEALTH_CHECK_REPORTED → DEV_SESSION_STARTED.
6. `devos_plan_dev_session(...)` — DEV_SESSION_PLANNED.
7. 반복: `devos_advance_dev_session(...)` → `devos_update_dev_session(...)` — DEV_SESSION_ADVANCED → DEV_SESSION_UPDATED.
8. `devos_record_evidence(...)` — EVIDENCE_RECORDED.
8a. (Optional, additive) `devos_record_implementation_attempt(...)` — IMPLEMENTATION_ATTEMPT_RECORDED. Closed-loop write-back when an implementer (e.g. Codex MCP) finished a UoW: advances UoW status to `ready_for_verify` only (Rule 8 — `status=passed` is never an auto-ratify). `DEV_SESSION_VERIFIED` accepts either `EVIDENCE_RECORDED` or `IMPLEMENTATION_ATTEMPT_RECORDED` as precursor.
9. `devos_verify_dev_session(...)` — DEV_SESSION_VERIFIED.
10. `devos_prepare_lesson(...)` — LESSON_PREPARED. `approval_ref` 필수.
11. `devos_end_dev_session(...)` — DEV_SESSION_ENDED.

순서 불변. 어떤 단계라도 스킵하려면 사람 승인 필요. lifecycle event chain은 vault-os.md §0.1 rule #8 (no self-approval)을 준수.

## L4/L5 governance (active during the flow)

이 lifecycle 은 다음 거버넌스 게이트와 맞물려 동작한다. runner agent 는 단계별로 해당 입력을 공급해야 한다 — 누락 시 서버 게이트가 fail-closed.

- **Lease before edits (C5 / H12)**: 코드 편집 단계 진입 전 `devos_acquire_fencing_token(resource_kind="file_set", resource_id, holder, ttl_sec, file_paths=[...])` 로 file_set lease 를 취득한다. 겹치는 lease 가 있으면 `conflict_reason="FILE_OVERLAP"` 으로 거절되며, 종료 시 `devos_release_fencing_token` 으로 반납한다 (warvis-maker 책임). Bet AEC Ownership Boundary 단위로 묶을 땐 `resource_kind="bet"`(resource_id=bet_id)도 옵션이다 — 충돌 검출은 kind-agnostic(file_paths 교집합). UoW 9-event 흐름 자체는 무변경.
- **Prior-art at Bet shaping (C9 / H17)**: 새 Bet 의 shaping→shaped 전이는 `WARVIS_PRIOR_ART_GATE_ENFORCE` 가 ON 일 때 `prior_art_refs[]` 또는 `problem_statement` lesson recall hit 을 요구한다. lesson 작성은 검색 가능하도록 — finisher 가 prior_art 가능 형태로 lesson 을 남긴다.
- **safety_class + typed_verification at verify (C6 / H13·H16)**: planner 가 risk_level 에서 도출한 `safety_class` (A/B/C) 를 verify 단계로 전달, verifier 가 `typed_verification` flat dict 의 floor 를 채운다 — A={build,test,static,fr_trace,hazard} / B={build,test,static} / C={build,test}. floor 누락은 verify 거절.
- **Appetite ceilings (C7 / H14)**: `WARVIS_AGENT_APPETITE_MAX_{ITER,TOKENS,WALLCLOCK_MS}` 가 호출 회수/토큰/wallclock 상한을 강제한다. Safety R4 에 의해 상한 상향은 `approver_actor_class="human"` 만 허용 — agent 가 자기 상한을 늘리는 시도는 denied.

## review_required enforcement (mandatory)

`devos_prepare_lesson(...)` 응답이 `status == "review_required"` 또는 `shapeops_projection.status == "review_required"` 이면:
- 즉시 stop. **`devos_end_dev_session` 호출 금지.**
- BLOCK / HITL_REQUIRED envelope을 반환 (review_id + reason 포함).
- Lesson을 보존하되 vault merge는 사람 승인 대기 상태로 유지.

이 enforcement는 protected ShapeOps lifecycle boundary (Lesson permanent / HANDOFF accepted / Ship ratified)에서 self-approval을 차단한다.

## Delegation
- 도구 호출 실행: `dev-session-runner` agent를 spawn.
- 다단계 UoW forge가 필요하면: 이 skill 대신 `/forge` (Claude) 또는 `$forge` (Codex) 사용.

## Evidence template
- claim: "<one-line factual assertion>"
- evidence_type ∈ {mcp_response, file_read, test_run, UNKNOWN}
- data_ref: session_id | event_id | approval_ref | _rev
- confidence_level ∈ {HIGH, MEDIUM, LOW, UNVERIFIED}

## Role mutation permissions
- mutate_code: true (UoW 내 코드/테스트)
- mutate_vault: true (Single Writer 경유 only — lesson/journal)
- mutate_repo_meta: false
- commit_authority: local
