---
name: transcript-audit
description: Monthly transcript scan extracting drift patterns (permission denials, user corrections, repeated failures) into a human-review queue. NEVER auto-applies changes.
argument-hint: "[--window-days N] [--month YYYYMM]"
---

Scan recent Claude Code transcripts and produce a Top-N drift report for **{{PROMPT}}**.

## Trigger

- **Cadence keyword**: `monthly transcript audit`, `transcript-audit`, `feedback loop scan`
- **Manual invoke**: `/transcript-audit [--window-days N]` (default window: 30 days)
- **Recommended cron**: monthly on day 01 — operator triggers; this skill does NOT install cron itself.

## Inputs

- Transcript root: `~/.claude/projects/*/` (per-project session logs)
- Default scan window: **last 30 days** (override via `--window-days N`)
- Reference docs: current `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`

## Steps

1. **Enumerate transcripts in window**
   - Glob `~/.claude/projects/*/` for files modified within `--window-days`.
   - Record `{project, session_id, mtime}` per file. Skip > window.

2. **Extract drift signals** (string + regex; no model inference)

   | Signal | Pattern | Counted as |
   |--------|---------|------------|
   | Permission denied | `permission denied`, `tool blocked`, `PermissionPromptDenied`, `not allowed` | drift.permissions |
   | User correction (EN) | `don't`, `stop`, `do not`, `no not that`, `that's wrong`, `wrong tool`, `try again` | drift.correction_en |
   | User correction (KO) | `그게 아니라`, `아니야`, `하지마`, `중단`, `잘못`, `다시` | drift.correction_ko |
   | Repeated failure | same tool name + same error string ≥ 3 times in one session | drift.repeated_fail |
   | Hook block | `hook blocked`, `PreToolUse blocked`, `Bash command blocked` | drift.hook_block |

3. **Anonymize before any aggregation or external send**
   - Redact: emails (`*@*`), absolute home paths (`/home/<user>/` → `/home/<redacted>/`), URLs with query strings, IP addresses.
   - **Token redaction — known-prefix whitelist ONLY** (do NOT use broad `[A-Za-z0-9_-]{20,}`; that pattern eats git SHAs, UUIDs, slugs, identifiers and destroys traceability):
     - `sk-ant-[A-Za-z0-9_-]+` — Anthropic API keys
     - `ghp_[A-Za-z0-9]{36,}` — GitHub personal access token
     - `gho_[A-Za-z0-9]{36,}` — GitHub OAuth token
     - `ghs_[A-Za-z0-9]{36,}` — GitHub server-to-server token
     - `sk-[A-Za-z0-9]{40,}` — OpenAI API key (40-char floor; real OpenAI keys are ~51 chars — a 20-char floor produces false positives on slugs/identifiers)
     - `ant-sk-[A-Za-z0-9_-]+` — Anthropic legacy `ant-sk-` prefix (separate from `sk-ant-`; Anthropic key lengths differ from OpenAI, so do not share the 40-char floor)
     - `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` — JWT (header.payload.signature)
   - **Preservation policy**: 40-char git SHAs, UUIDs, slug-based artifact IDs (`bet-warvis-ignis--*`), tool names, file paths, and other non-secret identifiers MUST be preserved verbatim — they are required for reviewer traceability.
   - **HARD RULE**: if a quote includes raw user PII (email, phone, known-prefix key), replace with `[REDACTED]` before inclusion in the output file. No exceptions. No external network send of any transcript content is allowed from this skill.

4. **Aggregate Top-N drift patterns**
   - Group by `(signal_type, tool_or_topic)`.
   - Rank by frequency × distinct-session count.
   - Take Top 10 overall + Top 5 per signal type.

5. **Map each pattern to a suggested delta** (proposal only)

   | Pattern | Suggested target | Form |
   |---------|------------------|------|
   | Repeated permission-denied on `Bash(npm:*)` | `.claude/settings.json` allowlist | Add permission rule (HUMAN REVIEW) |
   | Repeated user correction "wrong agent" for area X | `CLAUDE.md` delegation table | Refine area→agent mapping (HUMAN REVIEW) |
   | Hook block on legitimate workflow | `.claude/hooks/` rule | Relax / refine matcher (HUMAN REVIEW) |
   | Repeated tool failure same args | new skill or runbook | Draft skill/doc proposal (HUMAN REVIEW) |

6. **Emit review artifact**: `.omc/reviews/transcript-audit-YYYYMM.md`

```markdown
# Transcript Audit — {YYYYMM}
## ShapeOps Compatibility Contract (mandatory)

- Obsidian is the ShapeOps SSOT; repo harness files, reports, and local plans are evidence/cache only.
- Canonical identity is exactly `type` + `artifact_type`; `project` is grouping only.
- New project artifacts route through `20-projects/{category}/FILE.md` (depth-1 category router).
- Propose before mutate; never self-approve protected state (Bet/Gate/Handoff/Lesson/ADR/UoW).
- Every shipped or abandoned Bet needs a Lesson before closeout.
- Mandatory lifecycle event chain: `HEALTH_CHECK_REPORTED` → `DEV_SESSION_STARTED` → `DEV_SESSION_PLANNED` → `DEV_SESSION_ADVANCED` → `DEV_SESSION_UPDATED` → `EVIDENCE_RECORDED` → `DEV_SESSION_VERIFIED` → `LESSON_PREPARED` → `DEV_SESSION_ENDED`.
- 리뷰/승인/결정용 ShapeOps 문서는 한글 우선으로 작성한다.

**Window**: last {N} days ({start_iso} → {end_iso})
**Sessions scanned**: {count}
**Anonymization**: applied (emails, paths, tokens, IPs)
**Status**: HUMAN REVIEW REQUIRED — no auto-apply performed.

## Top Drift Patterns

| # | Signal | Topic / Tool | Hits | Sessions | Suggested delta target |
|---|--------|--------------|------|----------|------------------------|
| 1 | permissions | Bash(npm:*) | 14 | 4 | .claude/settings.json allowlist |
| 2 | correction_ko | wrong agent for src/mcp_server | 9 | 3 | CLAUDE.md delegation table |
| ... |

## Suggested CLAUDE.md / hook deltas

1. **(permissions)** Add `Bash(npm test:*)` to permissions allowlist — observed 14 denials across 4 sessions.
   - Target file: `.claude/settings.json`
   - Action: HUMAN REVIEW REQUIRED.

2. **(delegation)** Clarify `src/mcp_server/` → `langchain-mcp-engineer` in CLAUDE.md — observed 9 user corrections.
   - Target file: `CLAUDE.md`
   - Action: HUMAN REVIEW REQUIRED.

## Anonymized Sample Quotes (max 3 per pattern)

> "[REDACTED] don't use that tool, the agent for src/mcp_server is langchain-mcp-engineer"

## Next Action

Operator reviews this file, accepts/rejects each delta, then manually edits CLAUDE.md / settings.json / hooks. This skill MUST NOT mutate those files.
```

## Rules

- **Output is review-queue only.** This skill MUST NOT edit `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`, or any other config. Auto-apply is FORBIDDEN.
- **Anonymization before any aggregation that leaves the local process.** No external network call. No transcript content is shipped off-host by this skill.
- **Append-with-history (no overwrite)**: if `.omc/reviews/transcript-audit-YYYYMM.md` already exists, do NOT overwrite. Append a new section to the existing file with header `\n---\n## Re-scan YYYY-MM-DD HH:MM\n` (UTC), followed by the newly generated report body. This preserves prior review evidence within the same month and lets reviewers diff re-scans.
- **Size cap**: cap the emitted markdown at **5000 lines OR 500 KB**, whichever is reached first. On overflow, retain the top-ranked entries up to the cap, then append a final line `... (N additional entries elided)` recording the count of dropped rows. Header/summary sections are never elided; only the long tail of low-rank rows.
- **Cadence**: monthly recommendation. Operator triggers; cron creation is NOT in scope.
- **No concurrent runs**: do NOT trigger two scans against the same `YYYYMM` output file simultaneously — append-with-history mode means two scanners racing on the same file can interleave headers/bodies and corrupt prior review evidence. Single operator-triggered invocation is the supported mode. Automated triggers (cron, hook-driven re-runs) MUST introduce a lock file or mutex (for example `.omc/reviews/.transcript-audit-YYYYMM.lock`) before activation; until that lock is in place, automated triggers are FORBIDDEN.
- **Dry-run support**: `--window-days 7` for a 7-day smoke check to validate output format before the monthly run.
- **Evidence**: cite `{session_id, line_offset}` for each Top-N pattern so reviewers can audit; cite UNKNOWN when redaction removed the reference.
