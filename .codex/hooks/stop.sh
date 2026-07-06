#!/usr/bin/env bash
# ClaimGate Codex Stop hook — ShapeOps + ClaimGate invariant reminder.
set -euo pipefail
cat >/dev/null 2>&1 || true
python3 - <<'PYEOF'
import json
message = (
    "ClaimGate close check: confirm ShapeOps mutations followed `99_constitution/vault-os.md` "
    "read order and no-self-approval. ClaimGate invariants: No Anchor No Claim; "
    "AI Curator Not Judge; deterministic risk with rule trace; Risk-first Review; "
    "Evidence Pack First; only verified/corrected project; fixture-first/offline v0; "
    "no server/DB/OCR/real LLM extraction/real DID. Bet-level `$forge` uses Bet IDs, "
    "one Bet per worktree/session, with dependency barriers and per-UoW DevSession evidence."
)
print(json.dumps({"hookSpecificOutput":{"hookEventName":"Stop","message":message}}, ensure_ascii=False))
PYEOF
exit 0
