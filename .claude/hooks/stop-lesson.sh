#!/usr/bin/env bash
# ClaimGate Claude Stop hook — non-blocking lesson hint + invariant reminder.
set -euo pipefail
cat >/dev/null 2>&1 || true
printf '<system-reminder>ClaimGate close check: if a dev_session ran, prepare Lesson via WARVIS MCP before closeout. Preserve no-self-approval. Invariants: No Anchor No Claim; AI Curator Not Judge; deterministic rule trace; Evidence Pack First; fixture-first/offline v0; Bet-level forge uses Bet IDs and isolated worktrees.</system-reminder>\n'
exit 0
