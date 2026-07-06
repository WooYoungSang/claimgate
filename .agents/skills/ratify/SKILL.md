---
name: ratify
description: Bet phase=shipped ratification E2E workflow via bet-ratifier agent
applies_to: [python, any]
---

# /ratify / $ratify
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

## Purpose
Bet을 phase=shipped로 ratify하는 end-to-end workflow. 실제 실행은 `bet-ratifier` agent로 delegate.

## SCOPE_BOUNDARY
- In-scope: Bet ratification (phase=shipped), checkpoint=100 검증, event chain 검증
- Out-of-scope: Bet 생성(lifecycle-architect 영역), UoW 진행(forge skill (`/forge` 또는 `$forge`) 영역)
- Excluded paths: vault 직접 write (Single Writer 경유 필수)

## Tool sequence
1. `devos_get_bet_progress(bet_id)` — phase, checkpoint%, Bet-level `hill_position`, blockers 사전 확인
2. 사용자 `approval_ref` 발급 확인 (approval_ref 없이 ratify 진행 금지)
3. `devos_ratify_projection(bet_id, approval_ref=..., target_phase="shipped")`
4. `devos_advance_bet(bet_id, phase="shipped")` (이미 shipped이면 skip)
5. `devos_checkpoint_bet(bet_id, checkpoint=100, hill_position=10 또는 hill_position_nochange_reason=<reason>)` (이미 100이면 skip)
6. `devos_get_bet_events(bet_id)` → `BET_RATIFIED` 이벤트 확인

## Delegation
We delegate to `bet-ratifier` agent for execution. 위 sequence는 본 skill의 contract.

## Evidence template
- claim: "<one-line factual assertion>"
- evidence_type ∈ {mcp_response, vault_read, test_run, UNKNOWN}
- data_ref: bet_id | event_id | approval_ref | _rev
- confidence_level ∈ {HIGH, MEDIUM, LOW, UNVERIFIED}

## Role mutation permissions
- mutate_code: false
- mutate_vault: true (Single Writer 경유 only)
- mutate_repo_meta: false
- commit_authority: none
