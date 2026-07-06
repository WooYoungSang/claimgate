---
name: ctrl-tower-status
description: Show Control Tower worktree progress, latest envelope timestamps, and AC summary in one pass.
host_environments: [claude]
---

# ctrl-tower-status

Use this skill when a Claude Code orchestrator needs to inspect Control Tower
worktree progress, the most recent envelope timestamp per UoW, and an AC
PASS/total summary before a Wave ratify decision.

## Contract

- Read-only reporting surface — never mutates worktrees, vault, registry, or
  envelope artifacts.
- Operates by direct tool use (`Bash` for git probes, `Read` for envelope
  JSON, `Grep` for AC ledgers); does not shell out to any project-local
  helper script, does not call live Codex MCP, push to remote, or trigger
  CI jobs.
- Output is a human-readable table (or a JSON object the caller can hand
  off) that downstream ratify/critic prompts can consume.
- Surface MUST disambiguate four conditions: missing worktree, dirty
  worktree, missing envelope, stale envelope.

## Status Recipe

Perform the following steps directly with `Bash` / `Read` / `Grep`; do not
invoke any external helper script.

1. **Resolve inputs.** Operator supplies one or more UoW slugs and,
   optionally, a workspace root (default: the parent directory of the
   current repo). Compute each expected worktree path as
   `<workspace_root>/<repo>-<uow-slug>/` (or whatever convention the
   campaign uses — confirm with the operator if unclear).
2. **Probe each worktree.** For every UoW slug:
   - `Bash`: `test -d <worktree>` to confirm existence (record
     `exists=true/false`).
   - If present: `git -C <worktree> rev-parse --abbrev-ref HEAD` for branch,
     `git -C <worktree> rev-parse HEAD` for head SHA,
     `git -C <worktree> rev-list --count <base-sha>..HEAD` for commit count
     versus the operator-supplied base SHA,
     `git -C <worktree> status --porcelain | wc -l` for dirty count.
   - Record the absolute path.
3. **Locate the canonical envelope per UoW.** The envelope-backup lives at
   the canonical orchestrator-owned path (Phase 7 T1-SG-1, §10):
   `.omx/campaigns/<campaign-id>/envelopes/<uow-slug>-<wave-id>.json`.
   The operator supplies `<campaign-id>` (and optionally `<wave-id>`); the
   skill resolves one path per UoW and runs `stat -c '%Y %n'` to capture
   UTC mtime. If the canonical path is missing, mark envelope as MISSING —
   do NOT fall back to `docs/evidence/...` or Codex-side dumps; those are
   no longer authoritative under the §10 ownership contract.
4. **Summarise AC counts.** `Read` the chosen envelope JSON and tally
   `ac_results` (pass count vs total) and `open_issues` length. If the
   schema is unfamiliar, fall back to `Grep` for `"status"\s*:\s*"PASS"`
   inside the envelope and report counts plus a WARN that the schema was
   inferred.
5. **Detect stale envelopes.** If envelope mtime is older than the worktree
   HEAD commit time (`git -C <worktree> log -1 --format=%ct HEAD`) by more
   than an implausible margin (e.g. envelope predates HEAD), flag
   `stale=true`.
6. **Render the report.** Emit one row per UoW with columns:
   `uow | exists | branch | head | commits | dirty | envelope_mtime_utc |
   ac_pass/ac_total | open_issues | flags`. Surface WARN rows (missing
   envelope, dirty>0, stale=true) prominently so they are caught before a
   Wave ratify runs. Provide a JSON variant on request so the next context
   (e.g. `ctrl-tower-wave-ratify`) can consume it directly.

## STOP Conditions

- Worktree path falls outside the operator-approved workspace root.
- JSON payload would expose vault paths or `.codex` secrets.
- Status command is invoked with write intent (operator asks to mutate
  worktrees, envelopes, or vault from this skill).
- Envelope appears tampered (mtime older than the worktree HEAD commit
  timestamp by an implausible margin) — surface as BLOCK, not silent skip.

## Evidence checklist

- Output is saveable as text or JSON.
- Worktree absolute paths are correct.
- `mutate_vault: false` is preserved in any follow-up prompt.
- Envelope timestamps are surfaced in UTC.
- The skill never claims `APPROVE` / `RATIFY` on behalf of an operator.
