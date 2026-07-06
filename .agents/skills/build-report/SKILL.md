---
name: build-report
description: Generate structured Bet Progress Report with Hill Chart, acceptance criteria, and verification gate status.
argument-hint: "<bet_id> [checkpoint]"
---

Generate build progress report for **{{PROMPT}}** [checkpoint = 50 or 100, default auto].

## Trigger

`/forge:build-report <bet_id> [50|100]` or at 50% and 100% appetite milestones

## Steps

1. **Run build cmd** (from CLAUDE.md or config.toml)
   - Execute: `python -m pytest` or `npm test` or project-specific build
   - Capture: pass count, fail count, skipped count
   - Capture: coverage % if available

2. **Run test cmd**, capture coverage
   - Detailed test results per suite
   - Coverage by module
   - Any flaky test warnings

3. **Read the Bet-level `hill_position`** from the Obsidian Bet note; Scope rows are support context only
   - For each scope: current phase (no-go, research, executing, waiting, landed)
   - Days in current phase
   - Estimated days to next phase

4. **Check acceptance criteria** (from Bet spec)
   - For each must-have: is it satisfied?
   - List supporting evidence (tests passed, code reviewed, demo done)

5. **Compute verification gates**: are we on track?
   - At 50% appetite: should be ~50% complete on criteria
   - At 100% appetite: all must-haves should be landed

6. **Output: structured report**

```markdown
# Build Progress Report: {bet_id}
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

**Generated**: 2026-04-21 10:30 UTC
**Checkpoint**: 50% appetite (1 week of 2 weeks elapsed)
**Status**: ON_TRACK ✓

## Summary Table

| Metric | Value |
|--------|-------|
| Acceptance criteria | 3/4 (75% must-haves, 1/2 optional) |
| Test pass rate | 142/145 (97.9%) |
| Coverage | 78% (target: >75%) |
| Hill Chart | 2/4 scopes landed, 2/4 executing |
| Blockers | 0 critical, 1 minor (design review pending) |

## Hill Chart Status
> Bet-level `hill_position` is canonical. Scope rows are supporting context only; do not infer or require UoW frontmatter `hill_position`.


| Scope | Phase | Days in phase | Est. days remaining | Risk |
|-------|-------|---------------|-------------------|------|
| Auth | landed | 5 | - | CLEAR |
| API | executing | 3 | 2-3 | CLEAR |
| UI | executing | 3 | 4-5 | CAUTION (may slip) |
| Admin | no-go | 0 | - | BLOCKED (awaiting UI) |

## Acceptance Criteria

| Criterion | Type | Status | Evidence |
|-----------|------|--------|----------|
| Auth login functional | MUST | ✓ DONE | 23 unit tests, e2e test pass |
| API endpoints defined | MUST | ✓ DONE | 8 endpoints implemented, OpenAPI updated |
| UI responsive | MUST | ~ PARTIAL | 3/5 screens responsive, 2 pending |
| Admin dashboard | NICE | ✗ NOT_STARTED | Blocked on UI completion |

**Completion**: 2.5 / 3 must-haves = 83% (above 50% target ✓)

## Test Results

```
unit:        142 passed, 2 failed, 1 skipped
integration: 18 passed, 1 failed, 0 skipped
e2e:         5 passed, 0 failed, 1 skipped
---
Total:       165 passed, 3 failed, 2 skipped (97.9% pass rate)
```

Failed tests:
- test_ui_mobile_viewport (UI: needs refinement, not blocking)
- test_api_concurrent_requests (flaky, intermittent, retried OK)

Coverage by module:
- auth: 92%
- api: 85%
- ui: 71% (below target, but improving)
- admin: 0% (not started)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| UI completion slip past appetite | MEDIUM | HIGH | Remove admin dashboard from must-haves |
| Test flakiness | LOW | LOW | Rerun failed tests, monitor |
| Vendor API change | LOW | HIGH | Stable for past week; monitor |

## Verdict at Checkpoint

**Status**: ON_TRACK ✓

- Acceptance criteria ahead of schedule (83% vs 50% target)
- Test quality strong (98% pass rate)
- Hill Chart on track (2/4 landed vs 1.5/4 expected at 50%)
- No blockers, low risks

**Recommendation**: Continue as planned. Monitor UI scope for slip.

---

## Alternatively, at 100% appetite:

**Status**: READY_TO_SHIP ✓

All must-haves landed. Tests green. Hill Charts landed.

See `/forge:ship-or-cut {bet_id}` for final ship decision.
```

## Rules

- This report is evidence/read-only; it cannot become a second truth store or approve lifecycle state.
- Cite Obsidian source notes and actual command outputs for every status claim.

- Report at checkpoints (50%, 100%) or on-demand
- Use structured tables for readability
- Cite test output (actual numbers, not estimates)
- Flag risks with likelihood + impact assessment
- Recommend specific next action (proceed, adjust scope, unblock)
