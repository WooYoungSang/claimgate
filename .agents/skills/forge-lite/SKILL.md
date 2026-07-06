---
name: forge-lite
description: Run the ceremony-lite forge lane for R3 or LOW-risk UoWs. The lane compresses authoring ceremony, not lifecycle events — all 9 DevSession events still fire in canonical order.
argument-hint: "<project_id> <uow_id> [risk_tier=R3] [risk_level=LOW] [implementer=codex|claude] [-- <inline spec>]"
allowed-tools: Bash Read Edit Write Glob Grep Agent(warvis-initiator) Agent(warvis-maker) Agent(warvis-verifier) Agent(warvis-finisher) Agent(ctrl-tower-codex-dispatcher)
model: sonnet
host_environments: [claude, codex]
---

# /forge-lite / $forge-lite
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

Forge-lite is the ceremony-lite sibling of `/forge` (Claude) / `$forge` (Codex) for R3 or LOW-risk UoWs. The main session remains the coordinator. The lane reduces subagent ceremony and generated prose, but it does not skip lifecycle events, evidence, lesson preparation, verification, Rule 8 review handling, Gate/Handoff protections, or Safety R1-R8.

> single-UoW 경량 경로라도 그 UoW는 parent Bet의 Agent Execution Contract(AEC: Work Order·Ownership Boundary·Done/Acceptance Criteria, 헌법 2026-06-26)에서 파생된 작업 계약이다 — Done When/Acceptance를 Bet AEC와 정합 유지한다(전체 AEC 8요소는 `/forge` Blueprint 참조).

## Eligibility Gate

Before any lifecycle write, call the equivalent of `assert_lite_eligible_or_redirect(risk_tier, risk_level)` from `src/context_devos/orchestration/session/risk_tier.py`.

- Eligible: `risk_tier=R3` or `risk_level=LOW`.
- Blocked: `risk_level=HIGH` or `risk_level=CRITICAL`, even when `risk_tier=R3`.
- Blocked fallback: tell the operator to use `/forge` (Claude) or `$forge` (Codex).
- Do not set or use `registration_only_skip`.

If the gate blocks, stop before `devos_start_dev_session`. Do not create a partial DevSession.

## Full Event Order

Forge-lite must still fire these 9 events in this order:

1. `HEALTH_CHECK_REPORTED`
2. `DEV_SESSION_STARTED`
3. `DEV_SESSION_PLANNED`
4. `DEV_SESSION_ADVANCED`
5. `DEV_SESSION_UPDATED`
6. `EVIDENCE_RECORDED`
7. `DEV_SESSION_VERIFIED`
8. `LESSON_PREPARED`
9. `DEV_SESSION_ENDED`

The lite lane compresses authoring content only. It may use an auto-generated thin `evidence_ref` and a one-paragraph auto `lesson_payload`, but both payloads must be non-empty so the existing fail-closed guards remain active.

## Three-Spawn Lane

### Spawn 1: Quickstart (Ignite + Blueprint)

Use `warvis-initiator` for quickstart orchestration.

Tasks:

1. Read Vault OS / Ops Control / System Home / task-specific source context in the mandatory order.
2. Run `devos_health_check(project_id)` and require `HEALTH_CHECK_REPORTED`, `identity_state="exact_match"`, `indexed=true`, and `queryable=true`.
3. Apply the eligibility gate before session start. Call
   `mcp__warvis-mcp__devos_validate_build_eligibility({ bet_id, project_id })`
   (hard-enforce, not self-reported): `build_eligible=false` → stop and report
   `blockers[]` as a review item (no self-accept, Rule 8); `build_eligible=null`
   (degraded) → warn and defer to operator; `build_eligible=true` → proceed.
   Then apply the lite risk_tier gate (`assert_lite_eligible_or_redirect`).
4. Run lightweight baseline discovery for `test_cmd`, `lint_cmd`, and target files.
5. Call `devos_start_dev_session(project_id, uow_id)`.
6. Create a single atomic milestone for the R3/LOW-risk UoW.
7. Call `devos_plan_dev_session(...)` with that milestone and the verification strategy.

Return JSON: `{ stage, dev_session_id, risk_tier, risk_level, milestone, test_cmd, lint_cmd, blockers }`.

### Spawn 2: Hammer

**Implementer (default `codex`)**: the single milestone is implemented by the Codex MCP implementer.
- **`implementer=codex` (default), Claude host**: spawn `ctrl-tower-codex-dispatcher` (Agent-spawn wrapper, never call `mcp__codex__codex` directly — CODEX-MCP-PATTERN §6 Rule 0), injecting `.claude/codex-roles/implementer.md` as developer-instructions, sandbox `danger-full-access`, worktree-isolated. The main session records the close-the-loop evidence (`devos_record_evidence` → `devos_record_implementation_attempt`) from the returned envelope.
- **`implementer=codex`, Codex host (`$forge-lite`)**: use the native Codex implementer directly (no dispatcher) and apply the Codex standalone operating contract (`codex_operating_profile`) from `.codex/codex-roles/implementer.md` (`model: gpt-5.5`, `reasoning_effort: medium`, `verbosity: low`, brief tool preamble, batched independent reads, action-gated early stop, Rule 8 no-self-approval, no vault write, no push).
- **`implementer=claude`**: use `warvis-maker` for the single milestone.

Tasks (executed by the chosen implementer, main session records lifecycle events):

1. Advance the DevSession to IMPLEMENT with `devos_advance_dev_session`.
2. Acquire a lease before editing (H12/C5): `devos_acquire_fencing_token(resource_kind=<bet|uow|file_set>, resource_id=<bet_id|uow_id>, holder=dev_session_id, ttl_sec=1800, file_paths=[<target files>])`. 경량 single-UoW lane은 보통 `file_set`(resource_id=uow_id)이지만, Bet AEC Ownership Boundary 단위로 묶으려면 `bet`(resource_id=bet_id) 또는 `uow`도 선택 가능하다(충돌 검출은 kind-agnostic). On `conflict_reason="FILE_OVERLAP"` → report blocker, do not edit.
3. Complete the single milestone with the requested code/test changes.
4. Call `devos_update_dev_session` with a concise progress snapshot.
5. Build an inline evidence bundle:
   - `bundle_type`: `test_run`
   - `summary`: concise test/lint result
   - `output_tail`: final command tail
6. Call `devos_record_evidence` immediately after the milestone, supplying `safety_class` (R3/LOW lite lane → typically "C", floor build/test) and a flat `typed_verification` dict {build, test, static?} of evidence_ref strings.
7. Release the lease with `devos_release_fencing_token` after the milestone.

Return JSON: `{ stage, dev_session_id, files_changed, evidence_ref, final_test_output, final_lint_output, blockers }`.

### Spawn 3: Temper + Quench

Use `warvis-verifier` for verification, then `warvis-finisher` only after PASS or PASS_WITH_WARN. If the local harness requires separate specialist calls for verifier and finisher, the main session may make both calls inside this lane step, but must preserve the event order.

Verifier tasks:

1. Run the agreed verification commands.
2. Call `devos_verify_dev_session(..., evidence_ref=<non-empty evidence_ref>, typed_verification=<same flat {build, test, static?} dict>, safety_class="C")` (R3/LOW lite lane → class C; graph node value wins if present).
3. Return PASS, PASS_WITH_WARN, or BLOCK.

Finisher tasks, only after PASS or PASS_WITH_WARN:

1. Generate a one-paragraph auto `lesson_payload` from the milestone, files changed, and evidence refs.
2. Call `devos_prepare_lesson(..., lesson_payload=<non-empty paragraph>)`.
3. If `devos_prepare_lesson` returns `review_required`, stop and return HITL_REQUIRED. Do not call `devos_end_dev_session`.
4. Call `devos_end_dev_session(...)` with the final summary.

Return JSON: `{ stage, dev_session_id, verdict, lesson_id, final_summary, blockers }`.

## Final Report

Report the UoW ID, DevSession ID, event list, files changed, verification commands, evidence ref, lesson ID or review status, and whether the lane remained within R3/LOW-risk scope. Never claim a Bet, Gate, Handoff, Lesson, or ship boundary is approved by this lane.
