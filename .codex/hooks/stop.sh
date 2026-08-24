#!/usr/bin/env bash
set -euo pipefail
cat >/dev/null 2>&1 || true
python3 - <<'PYEOF'
import json
message = "ClaimGate close check: query/update context through ./kbctl; preserve core review invariants and offline fixture-first v0 boundaries. Run ./kbctl verify after KB changes."
print(json.dumps({"hookSpecificOutput":{"hookEventName":"Stop","message":message}}, ensure_ascii=False))
PYEOF
