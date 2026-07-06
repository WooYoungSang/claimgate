---
name: ctrl-tower-dispatch
description: Dispatch Codex MCP implementer/reviewer lanes from Claude Code with the shared Codex x Claude collaboration contract.
host_environments: [claude]
---

# ctrl-tower-dispatch

Use this skill when a Claude Code orchestrator needs to hand a bounded SG/UoW to Codex MCP, then recover the implementation envelope for independent code-reviewer and architect passes.

디스패치 단위(uow-slug 인자)는 보존하되, 그 작업 계약은 parent Bet의 Agent Execution Contract(AEC, 헌법 2026-06-26)에서 파생된다 — dispatch prompt는 AEC의 Agent Assignment·Work Order·Ownership Boundary와 Done/Acceptance Criteria를 boundary 입력으로 전달한다(UoW는 그 AEC의 한 단위; 9-event 런타임은 직교/보존).

## Contract

- Claude Code remains orchestrator: spec authoring, worktree setup, reviewer dispatch, ratify gate, push, and Jenkins polling.
- Codex MCP runs as implementer inside the assigned worktree using `mcp__codex__codex`.
- Role prompts are installable project assets:
  - `.claude/codex-roles/implementer.md` for Codex `developer-instructions`.
  - `.claude/codex-roles/cr.md` for read-only code review.
  - `.claude/codex-roles/architect.md` for read-only architecture review.
- The Codex implementer returns the YAML envelope via stdout / MCP return value only. **The implementer MUST NOT write or commit envelope-backup files.** Envelope-backup ownership is the orchestrator's (Phase 7 T1-SG-1, §10): Claude writes the canonical backup to `.omx/campaigns/<campaign-id>/envelopes/<uow-slug>-<wave-id>.json` before ratify.
- Claude must not treat a Codex envelope as approval. Dispatch code-reviewer and architect in separate read-only contexts.

## Dispatch Triage (direct-vs-delegate)

### Dispatch Triage (direct-vs-delegate) — 결정론적 게이트
디스패치 전 아래 신호를 임계와 비교해 판정한다 (LLM 추론 금지):
  est_changed_lines / touched_files / risk_tier(R1 High·R2 Med·R3 Low) / repetition(반복·기계적 여부)
판정:
- DIRECT (Claude 메인이 직접 처리, 위임 생략): est_changed_lines ≤ 15 AND touched_files ≤ 2 AND risk_tier == R3 AND not repetition
- DELEGATE (Codex MCP 위임, ctrl-tower-codex-dispatcher 경유): 그 외 전부 (중대/다파일/반복/R1·R2)
- 경계·모호 → DELEGATE (안전측 기본값)

## Sandbox = `danger-full-access`

Codex MCP MUST run with `sandbox=danger-full-access` (operator-acknowledged,
orchestration-pattern §3.1, F1). The alternative `workspace-write` is
unusable because git worktree metadata (`.git/worktrees/<sg>/index.lock`)
lives outside the writable cone and the sandbox blocks it, leaving the
implementer unable to stage commits. Prompt-injection risk is contained by
(a) running each Codex lane inside an isolated git worktree, (b) the
no-push policy enforced by the orchestrator, and (c) the Don't Touch list
inside `.claude/codex-roles/implementer.md`. The PreToolUse hook
`.claude/hooks/ctrl-tower-mcp-guard.sh` denies any `mcp__codex__codex` call
whose `cwd` is not a registered git worktree.

## Dispatch Recipe

1. Create an isolated worktree and verify the base commit.
2. Read `.claude/codex-roles/implementer.md`.
3. Invoke `mcp__codex__codex` once with the worktree `cwd`, SG prompt, and implementer role as `developer-instructions`. `sandbox` MUST equal `danger-full-access` (see above). Codex returns the envelope via stdout / MCP return value only.
4. Parse the returned YAML envelope and write the canonical orchestrator-owned backup to `.omx/campaigns/<campaign-id>/envelopes/<uow-slug>-<wave-id>.json` (§10). This write is the orchestrator's responsibility; the Codex implementer commit set MUST NOT include envelope-backup files. Downstream skills (`ctrl-tower-status`, `ctrl-tower-wave-ratify`) resolve the canonical path only — there is no `docs/evidence/...` fallback.
5. Dispatch reviewer contexts with `.claude/codex-roles/cr.md` and `.claude/codex-roles/architect.md`.
6. **After APPROVE / APPROVE_WITH_NIT + ARCHITECTURALLY_SOUND / SOUND_WITH_FOLLOWUPS**: confirm Codex closed the loop. Call `devos_record_implementation_attempt(...)` from the orchestrator lane, then verify the event landed via `devos_get_bet_events(<bet_id>)` — look for an `IMPLEMENTATION_ATTEMPT_RECORDED` event between the existing `EVIDENCE_RECORDED` and any prospective `DEV_SESSION_VERIFIED`. Without that event the UoW status only advances to `ready_for_verify` (Rule 8 — `status=passed` is never an auto-ratify).
7. Request human ratify only after both review lanes pass, the `IMPLEMENTATION_ATTEMPT_RECORDED` event is visible, and CI/Jenkins evidence is green.

## Verdict & severity schema

- code-reviewer ∈ {`APPROVE`, `APPROVE_WITH_NIT`, `REQUEST_CHANGES`}.
- architect ∈ {`ARCHITECTURALLY_SOUND`, `SOUND_WITH_FOLLOWUPS`, `RECONSIDER`}.
- Severity ∈ {`BLOCK`, `HIGH`, `MED`, `LOW`, `NIT`}. `BLOCK`/`HIGH` fix-now;
  `MED` and below land as carry-forward bundle entries.
- `max_review_rounds = 3` per SG. Round 3 returning REQUEST_CHANGES escalates
  to the operator — auto-retry on a 4th lane is forbidden.

## Graded Review Matrix (change-class → reviewer-set)

### Graded Review Matrix (change-class → reviewer-set)
- 기계적/저위험 (포맷·주석·문서 오타·단일 함수 로컬, R3, non-behavioral) → cr 단독
- 로직/기능 변경 (behavioral, 단일~소수 모듈, R2) → cr (architect optional)
- 아키텍처/계약/보안/다모듈/MCP표면/propagation-SSOT (R1) → cr + architect (둘 다 필수)
기본값(모호·판단 불가) → cr + architect.
propagation-SSOT floor 와 `devos_ratify_projection` 게이트(operator approval_ref + cr + architect)는 change-class 로 downgrade 되지 않는다 — graded selection 은 reviewer-set 만 고르며 이 최저선(operator ratify + no-self-approval)을 낮추지 못한다.

## STOP Conditions

- Missing role prompt.
- Missing or mismatched envelope backup.
- Dirty worktree before dispatch.
- Codex invoked with sandbox other than `danger-full-access`, or with a `cwd` that is not a registered git worktree.
- Codex touched vault files, pushed, amended, self-approved, or changed out-of-scope MCP tool surfaces.
- Reviewer verdict requires changes.
- After APPROVE, `devos_get_bet_events` shows no `IMPLEMENTATION_ATTEMPT_RECORDED` event — the closed-loop write-back was skipped.
