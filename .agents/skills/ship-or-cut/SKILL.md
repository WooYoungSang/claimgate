---
name: ship-or-cut
description: At 75% appetite, evaluate completion vs Hill Chart and recommend SHIP / CUT / SCOPE_HAMMER; final decision requires human Gate/HANDOFF approval.
argument-hint: "<bet_id>"
---

Evaluate ship readiness for **{{PROMPT}}** at 75% appetite.

## Trigger

`/forge:ship-or-cut <bet_id>` or manual gate at 75% elapsed days

## Steps

1. **Read Bet appetite and elapsed time**
   - Bet appetite: {n} weeks
   - Elapsed: {n} weeks
   - Days remaining: {n}

2. **Read the Bet-level `hill_position`** from the Obsidian Bet note; Scope rows are support context only
   - Which scopes are landed? (no more work needed)
   - Which scopes are executing? (work ongoing)
   - Which scopes are stuck? (blocked or no-go)

3. **Evaluate acceptance criteria completion %**
   - For each must-have criterion: is it satisfied?
   - Calculate: {satisfied} / {total} × 100%
   - Extract evidence: test pass, code review, demo

4. **Check kill conditions**
   - Any kill conditions triggered? (e.g. "if vendor unblocks after day 8, cut scope")
   - If triggered: is this a SHIP-without or a BLOCK?

5. **Output verdict with evidence**

```markdown
# Ship or Cut Decision: {bet_id}
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

**Appetite**: {n} weeks
**Elapsed**: {n} weeks (75%)
**Days remaining**: {n}
**Recommendation**: SHIP / CUT / SCOPE_HAMMER (human Gate decision required)

## Acceptance Criteria Status

| Criterion | Must-have | Status | Evidence |
|-----------|-----------|--------|----------|
| Auth login | YES | ✓ DONE | 23 tests pass |
| Payment processing | YES | ✓ DONE | 8 e2e tests pass |
| Admin dashboard | NO | ~ PARTIAL | 15/20 features complete |

**Completion**: 2/2 must-haves = 100% ✓

## Hill Chart Status
> Bet-level `hill_position` is canonical for the ship-or-cut decision. Scope rows are supporting context only; do not infer or require UoW frontmatter `hill_position`.


| Scope | Days spent | Phase | Risk |
|-------|-----------|-------|------|
| Auth | 4 | landed | CLEAR |
| Payment | 8 | landed | CLEAR |
| Admin UI | 6 | executing | CAUTION (40% appetite left, 60% work remains) |

## Kill Conditions

- "If vendor unblocks before day 8" → NOT triggered ✓
- "If auth tests drop below 90%" → NOT triggered ✓

## Verdict

### SHIP ✓

All must-haves landed. 75% appetite elapsed. Ready to ship.

Optional: Admin UI can move to next bet if timeline is tight.

---

### OR CUT ✗

1/2 must-haves still executing. Cannot land in time.

**Recommendation**: Cut lower-priority scope (Admin UI) and ship core (Auth + Payment).

---

### OR SCOPE_HAMMER ⚠

All must-haves done, but Admin UI incomplete. Appetite running out.

**Options**:
1. Ship without Admin UI (reduce scope to Auth + Payment)
2. Extend appetite (adds 1+ week, delay next bet)
3. Defer Admin UI to next bet

**Recommended**: Option 1 (ship core, defer polish)
```

## Rules

- This skill recommends; it must not self-approve SHIP, CUT, Gate waived, HANDOFF accepted, or Lesson permanent.

- SHIP: 100% must-haves, Hill Charts landed/near-landed, no kill blocks
- CUT: Critical must-haves missing, cannot finish in time, recommend reduced scope
- SCOPE_HAMMER: Must-haves done but nice-to-haves incomplete; recommend cutting optional scope to ship on time
