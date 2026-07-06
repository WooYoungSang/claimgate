#!/usr/bin/env bash
# Codex CLI PreToolUse hook (Bash matcher).
# Receives JSON payload on stdin:
#   { "session_id", "cwd", "hook_event_name": "PreToolUse",
#     "tool_name": "Bash", "tool_input": { "command": "..." } }
# Emits a JSON decision: { "permissionDecision": "allow"|"deny"|"ask",
#                          "permissionDecisionReason": "..." }
# Symmetric with Claude Code's pretooluse-guard.sh.
# Self-edit forbidden-path checks are advisory-in-practice on the Codex-native
# hook surface: PreToolUse exists via config.toml, but persona/work-packet
# context is not resolved here, so that guard remains fail-open dominant.
set -euo pipefail

PAYLOAD="$(cat 2>/dev/null || true)"
[ -z "$PAYLOAD" ] && exit 0
export HOOK_PAYLOAD="$PAYLOAD"

python3 - <<'PYEOF'
import json, os, re, sys

try:
    payload = json.loads(os.environ.get("HOOK_PAYLOAD", sys.stdin.read() if not sys.stdin.isatty() else "{}"))
except Exception:
    raise SystemExit(0)

cmd = (payload.get("tool_input", {}) or {}).get("command", "") or ""
norm = re.sub(r"\s+", " ", cmd).strip()
norm = re.sub(r"^\\", "", norm)
norm = re.sub(r"^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)+", "", norm)

def _deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    raise SystemExit(0)

def _ask(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    raise SystemExit(0)

if re.search(r"\bcodex\s+exec\b", norm):
    has_explicit_sandbox = bool(re.search(
        r"(?:^|\s)(?:-s|--sandbox)\s+(?:read-only|workspace-write|danger-full-access)\b"
        r"|(?:^|\s)--danger-full-access\b",
        norm,
    ))
    if not has_explicit_sandbox:
        _deny("nested 'codex exec' requires an explicit sandbox (-s/--sandbox or --danger-full-access)")

# ShapeOps H27: Bet checkpoint/progress updates must carry Bet-level Hill evidence.
# Keep read-only searches/docs inspection usable; block only likely direct invocations.
_checkpoint_invocation = re.search(
    r"\bomx\s+call\b|\bmcp(?:\s+call|__)|\bcurl\b.*\bdevos_checkpoint_bet\b|"
    r"\bpython(?:3)?\s+-c\b.*\bdevos_checkpoint_bet\b|\bdevos_checkpoint_bet\s*\(",
    norm,
) and re.search(r"\bdevos_checkpoint_bet\b", norm)
if _checkpoint_invocation and not re.search(
    r"\bhill_position\b|\bhill_position_nochange_reason\b",
    norm,
):
    _deny(
        "devos_checkpoint_bet requires Bet-level Hill evidence: "
        "hill_position=0..10 or hill_position_nochange_reason"
    )


# Protected ShapeOps state changes require explicit human approval when invoked
# through shell wrappers. MCP direct calls are enforced server-side; this hook
# catches curl/python/omx escape hatches before they bypass operator review.
_protected_invocation = re.search(
    r"\b(devos_ratify_projection|devos_handoff_close|devos_kill_bet|devos_transition_state)\b",
    norm,
)
if _protected_invocation:
    has_approval = re.search(r"\bapproval_ref\b", norm)
    has_human_actor = re.search(r"\bhuman[:_\-A-Za-z0-9]*\b|approver_actor_class\s*[=:]\s*['\"]?human", norm)
    if not (has_approval and has_human_actor):
        _deny(
            "protected ShapeOps state changes require approval_ref and human actor; "
            "agents must not self-approve Bet/Gate/Handoff/Lesson/ADR/UoW state"
        )

DENY = [
    r"\brm\s+(?:-[a-zA-Z]*[rf]+[a-zA-Z]*|--recursive\s+--force|--force\s+--recursive)\b",
    r"\bgit\s+reset\s+--hard\b",
    r"\bgit\s+clean\s+-(?:fd|xfd|fdx)\b",
    r"\bgit\s+push\s+(?:--force|--force-with-lease|-f)\b",
    r"\bgit\s+commit\b.*--no-verify\b",
    r"\bkubectl\s+delete\b",
    r"\bterraform\s+destroy\b",
    r"\bmkfs(\.[a-z0-9]+)?\b",
    r"\bshred\b",
]
ASK = [
    r"\bgit\s+push\b",
    r"\bnpm\s+publish\b",
    r"\bdocker\s+push\b",
]

for pat in DENY:
    if re.search(pat, norm, flags=re.IGNORECASE):
        _deny(f"destructive command blocked by pretooluse-guard: {pat}")

for pat in ASK:
    if re.search(pat, norm, flags=re.IGNORECASE):
        _ask(f"command requires user confirmation: {pat}")
PYEOF
exit 0
