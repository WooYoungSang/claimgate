---
name: forge
description: Run the Bet-level forge pipeline (Ignite → Blueprint → Hammer → Temper → Quench) for a Bet. Blueprint decomposes the Bet into UoW work-spec contracts; Hammer implements file-disjoint UoW waves in parallel (default implementer = Codex MCP). Main session is the coordinator; subagents cannot recursively orchestrate, so orchestration MUST live in the main thread. Use after `/dev-session` (Claude) / `$dev-session` (Codex) Phase 0 identity prereq has cleared.
argument-hint: "<project_id> <bet_id> [obsidian=<vault_path>] [risk_authorized] [implementer=codex|claude] [-- <inline spec>]"
allowed-tools: Bash Read Edit Write Glob Grep Agent(warvis-initiator) Agent(warvis-planner) Agent(warvis-maker) Agent(warvis-verifier) Agent(warvis-finisher) Agent(ctrl-tower-codex-dispatcher)
model: sonnet
host_environments: [claude, codex]
---

# /forge / $forge — Bet 단위 파이프라인

## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- **Workflow 상태는 `phase` 단일 canonical** (vault-os §0.6, 2026-06-18). `shapeops_state`/`lifecycle`은 deprecated — 새 문서에 쓰지 않는다. `status`는 운영 가시성만. (런타임 전이 도구 `devos_transition_state`가 아직 동일-값 enum 시그니처를 쓰면 그 값으로 호출하되, 문서/판정의 canonical 용어는 `phase`.)
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain (per UoW dev_session, ADR §D4 — `phase`와 직교): `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

> Vault OS SSOT (mandatory · non-negotiable): `99_constitution/vault-os.md` (Obsidian, WARVIS vault). Open: `obsidian://open?vault=WARVIS&file=99_constitution%2Fvault-os`. Agent Contract §0.1 applies before any stage.

## ShapeOps 계층 (vault-os §4 정의 체인)

```
[명세 — SDD 하네스, Bet 수락 전 완비]
  Pitch → ADR(왜) → FR(무엇) → NFR(얼마나) → Bet(commit+appetite) → UoW(+Scope)
                            ══ Gate: betting decision (operator) = build commitment ══
[실행 — Shape Up 철학]
  Hill Chart 추적 · Scope hammering · Circuit breaker · UoW 내 bounded discovery
  → ship → Lesson → Distill → Evergreen
```

- **forge의 단위 = Bet**. forge는 하나의 Bet을 **N개 UoW로 분해**(Blueprint)하고 **file-disjoint wave 단위로 병렬 구현**(Hammer)한 뒤, Bet 레벨에서 검증·종결한다.
- **UoW = AI의 단위 작업 계약(work spec)** — scope + done 정의 + FR/NFR/AC 링크. 완료하면 검증 가능한 증분(deliverable)을 *산출*할 뿐, 본질은 명세 단위다. **Bet-level `hill_position`이 canonical Hill Chart source이며, Scope-level Hill은 필요 시 Bet 본문 `Scopes` 표의 보조 tracking으로만 둔다. UoW frontmatter `hill_position`은 canonical/required 필드가 아니다**.
- **각 UoW는 자기 dev_session(9-event)을 가진다.** Bet-forge는 그 위의 2계층 오케스트레이터다.
- **Bet Agent Execution Contract (AEC, 헌법 2026-06-26)**: Blueprint 산출물은 Bet 단위 실행계약으로 8요소를 명시한다 — ① Agent Assignment(구현자: codex|claude), ② Work Order(UoW set + wave 순서), ③ Ownership Boundary(Bet file-set = 하위 UoW `est_file_paths` 합집합), ④ Expected Touched Files/File-set(per-UoW disjoint + Bet 합집합), ⑤ Done Criteria(각 UoW `done_when`), ⑥ Acceptance Criteria(FR/NFR/AC 링크), ⑦ Coordination Rule(file-disjoint wave + lease), ⑧ UoW Mapping(Bet→N UoW HAS_UOW). UoW 9-event dev_session 런타임은 이 계약과 **직교/보존**된다(AEC가 UoW를 대체하지 않는다).
- **PITCH는 ship되지 않는다.** Bet의 parent Pitch는 이미 `phase: accepted`로 소비된 상태여야 한다(아니면 Stage 0에서 review item).

**You (the main Claude/Codex session) are the forge coordinator.** Spawn one specialist subagent per stage (Hammer는 UoW당 1 구현자 spawn). Do NOT write code, run tests, or modify files yourself except for the small Stage 0 harness/plan scaffolds and recovery actions explicitly listed below.

## Why main-thread orchestration

Per the [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents) and Codex native subagent routing, **subagents cannot spawn other subagents**. Each forge stage — and each parallel UoW implementer in Hammer — must therefore be a separate top-level spawn from the main session. Specialists/implementers return JSON envelopes that the main session passes forward.

## Arguments (parsed from $ARGUMENTS)

```
<project_id>  <bet_id>  [obsidian=<vault_path>]  [risk_authorized]  [implementer=codex|claude]  [-- <inline spec>]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `project_id` | yes | Project slug |
| `bet_id` | yes | Bet ID (canonical `warvis-{project}--bet-{slug}` 또는 vault id) |
| `obsidian=<path>` | no | Context hint only. Obsidian SSOT access must use approved MCP/Single Writer paths; omission does not authorize `.omc` or inline spec as SSOT. |
| `risk_authorized` | no | If present, HIGH risk UoW auto-proceeds. CRITICAL is never auto-authorized. |
| `implementer=codex\|claude` | no | Hammer 단계 UoW 구현자. **기본값 `codex`** (Codex MCP). `claude`면 `warvis-maker`(Claude Code)로 구현. |
| `-- <bet_spec>` | no | Proposal context only; cannot replace Obsidian source note/DevOS lifecycle evidence. |

**Source resolution order**: Vault OS / Ops Control / System Home / task-specific Obsidian note(Bet 노트) → DevOS indexed/queryable context → local `.omc/plans` or inline spec as evidence/cache only → ask user then stop.

## Forge Metaphor (Bet 단위)

| Stage | Meaning | Specialist | Bet `phase` 전이 |
|---|---|---|---|
| 🔥 **Ignite** | 화로에 불을 피운다 — Bet baseline + 컨텍스트 | `warvis-initiator` | (확인) `committed` |
| 📐 **Blueprint** | 설계도를 그린다 — Bet → UoW 분해 + file-disjoint wave | `warvis-planner` | `committed → building` |
| 🔨 **Hammer** | 두드려 형태를 잡는다 — wave별 UoW 병렬 구현 (기본 Codex MCP) | `ctrl-tower-codex-dispatcher` ×N (또는 `warvis-maker` ×N) | (building 유지) |
| ⚗️ **Temper** | 담금질로 강도를 본다 — UoW별 verify + Bet 통합 게이트 | `warvis-verifier` | `building → reviewing` |
| 💧 **Quench** | 식혀 굳힌다 — UoW lesson + Bet lesson + handoff | `warvis-finisher` | `reviewing → handoff` (ship=operator) |

The main session is the smith holding the tongs.

---

## Pipeline (main session executes top-to-bottom)

### Stage 0 — Pre-Forge (main session, no subagent)

1. Parse `$ARGUMENTS`. If `project_id` or `bet_id` missing → ask user, stop. Resolve `implementer` (default `codex`).
2. Read the Bet note in official read order (`99_constitution/vault-os.md` → `01-dashboard/ops-control.md` → `01-dashboard/system-home.md` → Bet 노트). `.omc/plans` and inline `--` are evidence/cache only, never SSOT.
3. **§4 정의 체인 완전성 확인** (Bet 수락/build 전제) — **hard-enforce via tool, 자기보고 금지**:
   - **필수 호출**: `mcp__warvis-mcp__devos_validate_build_eligibility({ bet_id, project_id })`. 반환 `{build_eligible, phase, checks[], blockers[]}` 가 게이트의 SSOT다.
     - `build_eligible == false` → **stop**. `blockers[]`(+ ok=false인 `checks[]`)를 review item으로 보고하고 구현 spawn 으로 진행하지 않는다(자기 accept/auto-fix 금지, Rule 8).
     - `build_eligible == null`(degraded, graph 미가용) → **경고** 후 operator 판단 대기. degraded 상태에서 자기 비준하여 build 진행 금지.
     - `build_eligible == true` → 진행. 아래 prose 항목은 보조 컨텍스트(이 도구 결과가 우선).
   - Bet의 parent Pitch가 `phase: accepted`인지 확인. 아니면 review item으로 보고하고 stop(자기 accept 금지, Rule 8).
   - dev project면 ADR/FR/NFR이 완비됐는지 확인(누락은 review finding — auto-fix/auto-kill 금지).
   - Bet `phase` 확인: `shaped`면 **operator Gate 승인 필요**(`shaped → committed`). agent는 자기 비준 금지 → operator approval_ref 없으면 stop하고 review-eligibility 보고. `committed` 이상이면 진행.
4. Quick harness scan (advisory read-only):
   ```bash
   ls .claude/agents/ .codex/agents/ 2>/dev/null | head -10
   ls .claude/skills/ .agents/skills/ 2>/dev/null | head -10
   ls pyproject.toml package.json go.mod Makefile 2>/dev/null
   git rev-parse --abbrev-ref HEAD
   ```
5. Call `mcp__warvis-mcp__devos_health_check({ project_id })`. Require `HEALTH_CHECK_REPORTED` + `identity_state="exact_match"` + `indexed=true` + `queryable=true`. Any failure blocks lifecycle execution.
6. Write or update `.omc/plans/<bet_id>-harness.md` (evidence/cache only) with: Bet ref, ADR/FR/NFR refs, 4-layer assessment, confirmed `test_cmd` / `lint_cmd` / `gate_strategy`, `implementer` choice, reusable specialists, HITL points.

### Stage 1 — 🔥 Ignite

```
Agent(
  subagent_type = "warvis-initiator",
  description = "forge stage 1 (Ignite) for bet <bet_id>",
  prompt = """
You are running Stage 1 (Ignite) of the Bet-level forge pipeline. Read your
agent definition for full scope.

Inputs:
- project_id: <id>
- bet_id: <id>
- harness_config_path: .omc/plans/<bet_id>-harness.md
- bet_spec: <inline_spec or 'see vault Bet note'>
- working_dir: <pwd>

Tasks:
1. devos_health_check (re-verify; initiator-side defensive check).
2. Baseline test + lint (record exit codes; don't block).
3. Confirm the Bet is build-eligible by calling
   `mcp__warvis-mcp__devos_validate_build_eligibility({ bet_id, project_id })`.
   Set the returned `build_eligible` into the envelope `chain_complete` field
   (do NOT self-report a boolean). `build_eligible=false` → report `blockers[]`
   and stop; `build_eligible=null` (degraded) → warn, defer to operator. Do NOT
   self-approve a Gate.
4. Create or refresh .omc/plans/<bet_id>.md evidence/cache scaffold (Bet
   problem / appetite / ADR-FR-NFR refs) from approved source context; do not
   treat it as SSOT. (UoW dev_sessions are started later, in Hammer.)

Return JSON: { stage, bet_id, build_cmd, test_cmd, lint_cmd, baseline_pass,
  baseline_notes, bet_phase, chain_complete, plan_path, harness_config_path,
  blockers }
"""
)
```

### Stage 2 — 📐 Blueprint (Bet → UoW 분해)

```
Agent(
  subagent_type = "warvis-planner",
  description = "forge stage 2 (Blueprint) for bet <bet_id>",
  prompt = """
You are running Stage 2 (Blueprint) of the Bet-level forge. Read your agent
definition.

Inputs: project_id, bet_id, harness_config_path, plan_path, bet_spec,
appetite (from Bet note).

Tasks:
1. Explore codebase (max ~12 reads) to scope the Bet's work surface.
2. Decompose the Bet into N UoW work-spec contracts (typically 2-6). Each UoW =
   {uow_id_or_slug, title, scope, done_when, fr_nfr_ac_refs, est_file_paths[],
   3-7 internal TDD milestones, risk, safety_class}. UoW is a work SPEC
   (scope + done + FR/NFR/AC links), not a deliverable.
   - Apply appetite → scope: the Bet appetite caps total UoW scope. If scope
     exceeds appetite, hammer scope DOWN (drop/shrink UoWs) — do NOT propose
     extending appetite (Shape Up circuit breaker).
3. Compute file-disjoint parallel WAVES from est_file_paths so UoWs in the same
   wave never touch overlapping files. Prefer calling
   devos_get_parallel_safe_batch(project_id, candidate_uow_ids) to derive
   file-disjoint batches; fall back to manual disjoint grouping from
   est_file_paths if the tool has no UoW nodes yet.
4. Propose the UoW set in the plan envelope — do NOT write graph nodes
   yourself (read-only Blueprint). The main coordinator materializes each UoW
   (HAS_UOW link to the Bet) via the approved Single Writer path after the
   Blueprint Gate, in shaped/planned form (Rule 8 — no self-ratify to ready).
5. Confirm verification strategy from harness gate_strategy.
6. Update plan_path with the UoW set, wave assignment, per-UoW milestones,
   Done When, Risk, safety_class.

Return JSON: { stage, bet_id, uows: [{uow_id, title, scope, done_when,
  fr_nfr_ac_refs, file_paths[], milestones[], risk, safety_class}],
  waves: [[uow_id, ...], ...], verification_steps[], scope_change_proposed,
  appetite_exceeded, plan_path, blockers }
"""
)
```

**Blueprint Gate (main thread):**
- `scope_change_proposed=true` 또는 `appetite_exceeded=true` → ask user (Scope hammer vs appetite re-shape) before Hammer.
- 어떤 UoW든 `risk=CRITICAL` → `devos_block_dev_session`-equivalent로 그 UoW를 보류하고 operator에 보고. CRITICAL은 자동 진행 금지.
- 모든 UoW가 LOW/MEDIUM, 또는 HIGH+`risk_authorized` → Hammer 진행.
- **UoW materialize (main)**: planner가 제안한 UoW set을 approved Single Writer 경로로 생성하고 Bet에 `HAS_UOW`로 링크한다(shaped/planned 상태; Rule 8 — ready 자기비준 금지). 이 UoW들이 Hammer wave의 단위가 된다.
- Bet `phase`를 `committed → building`으로 전이(operator 비준 범위 내; 자기 비준 금지).

### Stage 3 — 🔨 Hammer (wave별 UoW 병렬 구현)

main coordinator가 wave를 **순차**로, wave 내 UoW들을 **병렬**로 처리한다. wave 내 UoW는 file-disjoint이므로 동시 편집이 안전하다.

**각 wave에 대해:**

For each UoW in the wave, in parallel (single message, multiple Agent spawns):

1. main이 그 UoW의 dev_session을 시작/계획한다:
   - `devos_start_dev_session(project_id, uow_id)` → `dev_session_id`
   - `devos_plan_dev_session(project_id, dev_session_id, uow_id, milestone_strategy, verification_strategy)`
2. **구현자 spawn** (host + `implementer` 분기):

   **(기본) `implementer=codex` — Codex MCP 구현자:**
   ```
   Agent(
     subagent_type = "ctrl-tower-codex-dispatcher",
     description = "forge Hammer (Codex) for uow <uow_id>",
     prompt = """
   Dispatch ONE UoW to a Codex MCP implementer (Agent-spawn wrapper per
   CODEX-MCP-PATTERN §6 Rule 0 — never call mcp__codex__codex directly).

   Inputs: project_id, bet_id, uow_id, dev_session_id, milestones[],
   file_paths[] (this UoW's disjoint file set), build_cmd, test_cmd,
   developer-instructions = .claude/codex-roles/implementer.md (inject),
   sandbox = danger-full-access, worktree-isolated.

   Before first edit (H12/C5): acquire a file_set lease via
   devos_acquire_fencing_token(resource_kind="file_set", resource_id=uow_id,
   holder=dev_session_id, ttl_sec=1800, file_paths=[...]). On
   conflict_reason="FILE_OVERLAP" → report blocker, do NOT edit (wave
   disjointness was violated). Release after the last milestone.
   (AEC option) Bet-단위 동시성을 잡으려면 resource_kind="bet"(resource_id=bet_id,
   file_paths=Bet file-set 합집합)도 가능하다 — 충돌 검출은 (resource_kind,
   resource_id) 매치 + file_paths 교집합으로 kind-agnostic. file_set|uow|bet 중
   선택은 coordination 단위에 따른다.

   The Codex implementer executes RED→GREEN→REFACTOR per milestone (no RED
   skip, no `|| true`). Return its envelope to the main session.
   """
   )
   ```
   main이 Codex envelope를 받아 그 UoW에 대해 **대리 close-the-loop**를 기록한다:
   `devos_record_evidence` → `devos_record_implementation_attempt(status=...)`
   (fires `IMPLEMENTATION_ATTEMPT_RECORDED`; `status=passed`도 self-ratify 아님,
   UoW는 `ready_for_verify`까지만) → `devos_advance_dev_session`.

   **(선택) `implementer=claude` — warvis-maker 구현자:**
   ```
   Agent(
     subagent_type = "warvis-maker",
     description = "forge Hammer (Claude) for uow <uow_id>",
     prompt = """
   You are running Hammer for ONE UoW. Read your agent definition.
   Inputs: project_id, dev_session_id, uow_id, build_cmd, test_cmd,
   milestones[], file_paths[] (this UoW's disjoint set).
   Acquire file_set lease before first edit; RED→GREEN→REFACTOR per milestone;
   devos_record_evidence after each milestone; devos_advance_dev_session after
   the last; then return JSON. No "Now ..."/"Waiting ..." final utterances.
   """
   )
   ```

   > **Codex host (`$forge`)**: 기본 `implementer=codex`는 Codex 환경의 native implementer로 직접 구현한다(별도 dispatcher 불필요 — 이미 Codex 안). `implementer=claude`면 `warvis-maker`를 spawn한다.

3. wave의 모든 UoW가 끝나면(또는 blocker) lease를 반납하고 다음 wave로.

**Hammer 제약:**
- wave 내 file-overlap 발견(`FILE_OVERLAP`) → 그 UoW는 편집 금지, blocker 보고, Blueprint wave 재산출.
- No RED skip. No `|| true` test suppression.
- 구현자가 `status=partial`/envelope blocker 보고 시: out-of-scope pre-existing flake면 carry-forward, 실제 regression이면 그 UoW 재디스패치(max 2).

**Hammer 출력 (main이 집계):**
```json
{ "stage": "hammer", "bet_id": "<id>", "waves_completed": <n>,
  "uow_results": [{ "uow_id": "<id>", "dev_session_id": "<id>",
    "implementer": "codex|claude", "milestones_completed": <n>,
    "evidence_refs": [], "files_changed": [], "status": "passed|partial|blocked",
    "blockers": [] }] }
```

### Stage 4 — ⚗️ Temper (UoW verify + Bet 통합 게이트)

각 UoW를 verify한 뒤 Bet 레벨 통합 검증을 수행한다.

For each completed UoW (병렬 가능):
```
Agent(
  subagent_type = "warvis-verifier",
  description = "forge Temper for uow <uow_id>",
  prompt = """
You are running Temper for ONE UoW. Read your agent definition.
Inputs: project_id, dev_session_id, uow_id, verification_steps[],
evidence_refs[], risk, safety_class.

Gate sequence: Lint → Type → Unit → Integration → Security (HIGH/CRITICAL).
Derive safety_class typed_verification {build, test, static, fr_trace, hazard}.
class A requires all 5 (fr_trace + hazard); if a floor field is unfillable,
BLOCK and list the gap. Call devos_verify_dev_session(..., typed_verification,
safety_class). Do NOT auto-repair.

Return JSON: { stage, dev_session_id, uow_id, verdict:
  "PASS|PASS_WITH_WARN|BLOCK", safety_class, typed_verification, verify_report,
  failed_gates[], evidence_ref, blockers }
"""
)
```

**Bet 통합 게이트 (main thread):** 모든 UoW verify 후, **Bet 레벨 통합 검증**(전 UoW green + cross-UoW integration test/lint/security)을 실행한다(추가 verifier spawn 1회).

**Recovery:**
- 모든 UoW `PASS`/`PASS_WITH_WARN` + 통합 green → Bet `phase` `building → reviewing`, Stage 5로.
- 어떤 UoW `BLOCK` and retries < 2 → 그 UoW만 Hammer 재진입(`review_failures = failed_gates`) → 재verify. retry++.
- `BLOCK` and retries ≥ 2 → 그 UoW `devos_block_dev_session`, Bet은 reviewing 전이 보류, operator 보고.

### Stage 5 — 💧 Quench (UoW lesson + Bet lesson + handoff)

Only if 모든 UoW verdict이 `PASS`/`PASS_WITH_WARN` and 통합 green.

For each UoW:
```
Agent(
  subagent_type = "warvis-finisher",
  description = "forge Quench for uow <uow_id>",
  prompt = """
You are running Quench for ONE UoW. Read your agent definition.
Inputs: project_id, dev_session_id, uow_id, obsidian_vault_path?, verdict,
plan_path, files_changed[], evidence_refs[], approval_ref?.

Approval handling:
- If devos_prepare_lesson returns review_required, stop and return
  HITL_REQUIRED with the review envelope; do NOT call devos_end_dev_session.
- Missing approval_ref is not auto-waived.

Tasks:
1. devos_prepare_lesson(..., approval_ref when provided) → lesson_id OR review_required.
2. devos_end_dev_session(...) with final_summary.
3. Update local evidence/cache only; do not mark canonical Obsidian phase
   shipped/done.

Return JSON: { stage, dev_session_id, uow_id, lesson_id, lesson_status,
  final_summary, blockers }
"""
)
```

**Bet closeout (main thread):**
- 모든 UoW dev_session ended + UoW Lesson 준비 완료 후, **Bet 레벨 Lesson**을 propose한다(shipped/abandoned Bet은 Lesson 의무, vault-os §0.1 r9).
- Bet `phase`를 `reviewing → handoff`로 전이하고 HANDOFF 증거를 draft한다.
- **`phase: shipped`는 operator 비준 전용** — agent는 HANDOFF accepted / Lesson permanent / Bet shipped를 자기 비준하지 않는다(Rule 8). main은 review-eligibility만 보고한다.
- Bet이 만든 산출물은 `62-deliverables/`에 deliverable로 등록 제안(closeout 체크리스트, status: draft).

---

## Final Output (main reports to user)

```json
{
  "bet_id": "<id>",
  "project_id": "<id>",
  "bet_phase": "reviewing|handoff|building(blocked)",
  "implementer": "codex|claude",
  "uows": [{ "uow_id": "<id>", "dev_session_id": "<id>", "verdict": "PASS|BLOCK",
    "lesson_id": "<id|null>" }],
  "waves_completed": <n>,
  "harness_config_path": ".omc/plans/<bet_id>-harness.md",
  "plan_path": ".omc/plans/<bet_id>.md",
  "stages_completed": ["pre-forge", "ignite", "blueprint", "hammer", "temper", "quench"],
  "bet_lesson_id": "<id|null>",
  "handoff_ref": "<id|null>",
  "ship_pending_operator": true,
  "files_changed": [],
  "notes": ""
}
```

## Failure Recovery (main thread)

| Situation | Main thread action |
|---|---|
| 구현자(Codex/maker) mid-flight termination | Inspect evidence. Do not force lifecycle state by default. If work largely done, record evidence and confirm approved recovery before any forced transition. If incomplete, re-dispatch that UoW once; then report blocker. |
| dev_session in wrong state | Stop and repair lifecycle ordering for that UoW; `force=true` requires explicit recovery approval + evidence. |
| wave file-overlap (`FILE_OVERLAP`) | Halt that UoW, re-run Blueprint wave disjointness, do not edit. |
| Temper BLOCK ×2 on a UoW | `devos_block_dev_session` for that UoW; Bet stays `building`; report failed gates. |
| CRITICAL risk discovered any stage | Immediate block of the affected UoW (or whole Bet). No further stages on it. Wait for operator. |
| parent Pitch not `accepted` / ADR-FR-NFR 누락 | review item으로 보고하고 stop. 자기 accept/Gate 금지(Rule 8). |

## Reuse of Stage 0/2 Artifacts

`.omc/plans/<bet_id>-harness.md` / `<bet_id>.md` / 이미 생성된 UoW 노드가 이전 실패 시도에서 있으면 재사용(현재 spec 대비 재검증). 새로 덮어쓰지 말고 refresh.

## Use When

- Bet is build-eligible: parent Pitch `phase: accepted`, ADR/FR/NFR 완비(dev), Bet `phase: committed`(operator Gate).
- devos MCP server reachable + lifecycle/index evidence 생산 가능.
- 하나의 Bet을 UoW로 분해해 병렬 구현부터 종결까지 한 번에 몰고 싶을 때.

## Do Not Use When

- Bet이 아직 `shaped`이고 operator Gate 미승인 — 먼저 Gate(betting decision).
- 단일 R3/LOW-risk UoW만 빠르게 — `/forge-lite` (단, lite도 구현자 기본 Codex).
- Bet이 탐색적이라 UoW 분해가 불가 — 먼저 shaping/planning.

## Cross-environment parity

This skill is the single registry SSOT projected to both Claude (`/forge`, `.claude/skills/forge/`) and Codex (`$forge`, `.agents/skills/forge/`). Both:
- Run from the main thread (no recursive subagent orchestration).
- Decompose Bet → UoW (Blueprint) and implement file-disjoint UoW waves in parallel (Hammer).
- Default `implementer=codex`: Claude host spawns `ctrl-tower-codex-dispatcher`; Codex host uses its native implementer. `implementer=claude` uses `warvis-maker`.
- Honor the same per-UoW devos 9-event chain (ADR §D4, orthogonal to `phase`).
- Defer Vault OS SSOT enforcement to vault-os.md §0.1.

Codex host native implementer profile (Harness C): apply the Codex standalone
operating contract (`codex_operating_profile`) from `.codex/codex-roles/implementer.md`
before Hammer work (`model: gpt-5.5`, `reasoning_effort: medium`,
`verbosity: low`, brief tool preamble, batched independent reads,
action-gated early stop, Rule 8 no-self-approval, no vault write, no push).
Claude host keeps using `ctrl-tower-codex-dispatcher`; Codex host does not
require the Claude-only `ctrl-tower-dispatch` skill.

Conflicts between Claude and Codex outputs for the same Bet/UoW are resolved by re-reading vault-os.md.

## Reference

- Specialist agents: `src/context_devos/harness/registry/agents/warvis-devos/warvis-{initiator,planner,maker,verifier,finisher}.md` (registry SSOT) + `.codex/agents/warvis-*.toml` (Codex projection)
- Codex implementer dispatch: `ctrl-tower-codex-dispatcher` agent / `ctrl-tower-dispatch` skill / `docs/orchestration/CODEX-MCP-PATTERN.md` (§6 Rule 0 — Agent-spawn wrapper only) / `.claude/codex-roles/implementer.md`
- Parallel safety: `devos_get_parallel_safe_batch` (file-disjoint UoW waves) + `devos_acquire_fencing_token` (file_set lease)
- devos UoW lifecycle: `devos_start_dev_session` → `_plan_` → `_advance_` → `_record_evidence` → `_record_implementation_attempt` → `_verify_` → `_prepare_lesson` → `_end_`
- ShapeOps 계층/phase: vault-os §0.6 (phase 단일), §4 (정의 체인), §5 (UoW rules)
- Codex invocation twin: `$forge`; installed skill path: `.agents/skills/forge/SKILL.md`
