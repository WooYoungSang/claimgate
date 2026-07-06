---
name: session-catchup
description: Standardize the /clear → /catchup 2-step "set-and-forget" re-entry. Emit a deterministic CATCHUP.md so a fresh context window can resume work without re-reading prior chat.
argument-hint: "[sessionId]"
---

Produce a session catchup snapshot for **{{PROMPT}}** (defaults to active session if empty — see "Empty `{sessionId}` fallback resolution" below).

## Empty `{sessionId}` fallback resolution

When `{sessionId}` arrives empty/blank, resolve via this decision tree before any other step:

1. **Most-recent-active fallback** — list `.omc/state/sessions/*/` and pick the directory with the greatest mtime. Use that directory name as the resolved `sessionId`.
2. **Cold-start fallback** — if `.omc/state/sessions/` is absent OR contains zero subdirectories, mint a new id matching the pattern `auto-YYYYMMDD-HHMMSS` (UTC) and create the directory `.omc/state/sessions/{newSessionId}/` before writing CATCHUP.md.
3. **Frontmatter contract** — the generated CATCHUP.md MUST begin with a YAML frontmatter block whose first key is `resolved_session_id: {resolvedId}` so the next session can confirm which directory was used. Frontmatter precedes the `# Catchup — {sessionId}` heading.

## Trigger

- User types `/catchup` explicitly.
- User says "세션 재시작" / "context 재진입" / "context reset".
- Context window utilization ≥ 70% — emit advisory: "Context ≥70%. Recommend `/clear` → `/catchup` 2-step before next major task."

## Protocol (2-step, set-and-forget)

### Step 1 — Recommend `/clear`

Before generating the snapshot, surface the 2-step contract:

```
Recommendation (2-step re-entry):
  1. /clear            ← wipes context window (you must run this)
  2. /catchup          ← re-loads minimal state from CATCHUP.md
```

If user has not yet cleared, still emit CATCHUP.md so the next session can read it. Do not block on `/clear`.

### Step 2 — Emit CATCHUP.md

Write to: `.omc/state/sessions/{sessionId}/CATCHUP.md`

Required sections, in order:

```markdown
---
resolved_session_id: {resolvedId}
---
# Catchup — {sessionId}
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

**Generated**: {UTC timestamp}
**Branch**: {git current branch}
**Tip SHA**: {git rev-parse HEAD}

## Last in-progress task

{Single paragraph: the one task that was actively being executed when /catchup
fired. Include: lane id / Bet id / approval_ref if applicable, current
sub-step, the next concrete command or file edit expected.}

## Recent 5 decisions

1. {decision} — {evidence_type: file_read|test_run|mcp_response|user_directive}, {data_ref}
2. ...
3. ...
4. ...
5. ...

(Decisions = irreversible choices: commits made, vault writes, approvals, scope cuts.
Skip transient tool calls.)

## Next 1 step

{One sentence. The single next action the resumed session should take.
Include exact command, file path, or agent invocation. No multi-step plans.}

## Open questions

- {Unresolved question 1 — who/what is needed to resolve}
- {Unresolved question 2}

(If none, write: "None — proceed.")
```

## Rules

- **Empty `{sessionId}` fallback (decision tree)**:
  1. If `{sessionId}` is empty/blank → resolve to the most-recently-mtime'd subdirectory of `.omc/state/sessions/`.
  2. If `.omc/state/sessions/` is missing OR has no subdirectories → mint `auto-YYYYMMDD-HHMMSS` (UTC) as the new `sessionId` and create the directory before writing.
  3. Always record the resolved id as the frontmatter key `resolved_session_id:` on the first non-comment line of CATCHUP.md.
- **Single source of truth**: CATCHUP.md is overwritten each time `/catchup` runs; do not append.
- **Minimal**: keep total file ≤ ~150 lines. The point is fast re-entry, not full history.
- **Evidence over narrative**: every "Recent decision" must cite a file path, commit SHA, idempotency_key, or `_rev`. No vague claims.
- **Read-only by default**: this skill produces a snapshot file; it must not mutate vault notes, source code, or lifecycle state.
- **No self-approval**: do not include "approved", "verified", or "shipped" claims that this session has not actually executed via the proper Single Writer / ratification path.
- **PII**: redact user emails, tokens, and any string matching `sk-*` / `ghp_*` patterns before writing.

## Verification

After writing `CATCHUP.md`:

1. `test -f .omc/state/sessions/{sessionId}/CATCHUP.md` → exists.
2. `head -n 1 CATCHUP.md` → `---` (frontmatter open) and line 2 starts with `resolved_session_id:`.
3. `grep -c '^## ' CATCHUP.md` → 4 (Last in-progress / Recent 5 decisions / Next 1 step / Open questions).
4. Section "Recent 5 decisions" has exactly 5 numbered items (or `<5` with explicit "N/A — fresh session" placeholders).
5. Section "Next 1 step" is a single sentence (no bulleted plan).

If any check fails, regenerate before reporting success.
