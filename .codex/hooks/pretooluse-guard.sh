#!/usr/bin/env bash
set -euo pipefail
PAYLOAD="$(cat 2>/dev/null || true)"
[ -z "$PAYLOAD" ] && exit 0
export HOOK_PAYLOAD="$PAYLOAD"
python3 - <<'PYEOF'
import json, os, re
try: payload = json.loads(os.environ.get("HOOK_PAYLOAD", "{}"))
except Exception: raise SystemExit(0)
cmd = ((payload.get("tool_input") or {}).get("command") or "")
norm = re.sub(r"\s+", " ", cmd).strip()
def emit(decision, reason):
    print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":decision,"permissionDecisionReason":reason}})); raise SystemExit(0)
blocked = [r"mkfs(\.[a-z0-9]+)?", r"shred"]
confirm = [r"git\s+push", r"npm\s+publish", r"docker\s+push"]
for pat in blocked:
    if re.search(pat, norm, flags=re.I): emit("deny", f"blocked command: {pat}")
for pat in confirm:
    if re.search(pat, norm, flags=re.I): emit("ask", f"confirmation required: {pat}")
PYEOF
