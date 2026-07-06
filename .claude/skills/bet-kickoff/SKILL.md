---
name: bet-kickoff
description: Validate Bet readiness and confirm spec→contract→test→code chain exists. Gate before implementation start.
argument-hint: "<bet_id>"
---

Validate Bet **{{PROMPT}}** readiness for implementation.

## Trigger

`/forge:bet-kickoff <bet_id>` or Bet state transition to Build phase

## Steps

1. **Read Bet + Pitch docs** via Obsidian MCP only for vault notes
   - Verify Bet has: appetite, problem statement, acceptance criteria, scope/hill chart
   - Verify Pitch has: design rationale, constraint summary
   - Check for: no_touch fields, escalation rules

2. **Confirm Obsidian-MCP connectivity**
   - Call devos_health_check() → must pass
   - Verify vault path accessible and readable

3. **Verify spec→contract→test→code chain** (read-only; missing artifacts become review items, not automatic writes)
   - Spec exists: FR/NFR/ADR files for this bet
   - Contract exists: OpenAPI, JSON Schema, or type stubs defined
   - Test scaffold exists: at least one test file created (even if empty)
   - Implementation skeleton exists OR package structure created

4. **Check no_touch and escalation rules**
   - Read Bet frontmatter: any no_touch fields listed?
   - Read Bet frontmatter: any escalation rules (HIGH → pause)?
   - Output: "All clear" or list of fields requiring care

5. **Verify prior-art evidence (H17/C9 — shaping→shaped gate input)**
   - The Bet's `shaping → shaped` transition is gated by the prior-art gate (`WARVIS_PRIOR_ART_GATE_ENFORCE=1` → fail-closed).
   - Check the Bet has prior-art evidence by either path:
     - **declared**: Bet frontmatter `prior_art_refs` lists ≥ `WARVIS_PRIOR_ART_MIN_REFS` (default 1) Lesson references, OR
     - **search**: `devos_get_relevant_lessons(project_id, query_text=<bet problem_statement>, top_k=5)` returns ≥1 ratified/evergreen Lesson hit.
   - If this skill is driving or preparing `devos_create_bet`, first call `devos_get_relevant_lessons(query=problem_statement)` and pre-populate the create_bet payload with `prior_art_refs` candidates from the returned Lesson refs before asking the user to confirm or sending the payload. Do not leave `prior_art_refs` manual-declare only when lesson recall returns candidates.
   - If neither path yields evidence AND the gate is enforced: output "NOT_READY: prior-art gate will block shaping→shaped — declare prior_art_refs or document why this is genuinely novel".
   - Genuinely novel work: that fact must be recorded with rationale in the Bet body; do NOT mask an empty refs list. Escalate a blocked enforce-mode gate as a review item, never auto-bypass.

6. **Run spec-auditor for initial gap scan**
   - Invoke spec-auditor agent to identify critical gaps
   - If HIGH gaps found: output "NOT_READY: fix gaps first"
   - If only MEDIUM/LOW gaps: output "READY with warnings"

7. **Output: READY / NOT_READY + missing pieces + next action**

```
# Bet Kickoff Report: {bet_id}
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

Status: READY ✓

Spec:       FR-123, NFR-456, ADR-789 ✓
Contract:   contracts/shapeup-api.openapi.json ✓
Tests:      tests/unit/lifecycle/ scaffold created ✓
Code:       src/context_devos/lifecycle/ package exists ✓
Prior-art:  prior_art_refs=[lesson-foo, lesson-bar] (declared) ✓ — shaping→shaped gate satisfied

Gaps found by spec-auditor: MEDIUM-2, LOW-1 (non-blocking)

No-touch fields: auth.tokens (handle with care)
Escalation rules: if DB schema modified → pause for review

Next action: Start red phase (tdd-red agent) for first criterion
```

OR if NOT_READY:

```
Status: NOT_READY ✗

Missing:
- Contract file (OpenAPI) — create contracts/shapeup-api.openapi.json
- Test scaffold — mkdir -p tests/unit/lifecycle/

Critical gaps (HIGH-3):
- Bet.hill_chart field not in contract schema
- Error code E_APPETITE_EXCEEDED missing from error envelope
- Endpoint PUT /api/bets missing from API contract

Next action: Fix HIGH gaps first, then re-run bet-kickoff
```

## Rules

- Gate implementation until READY
- Critical gaps (HIGH) block → NOT_READY
- Warnings (MEDIUM/LOW) allow proceed only inside already-approved lifecycle scope → READY with caution
- Missing pieces must not be auto-created unless the implementation scope is explicitly approved
