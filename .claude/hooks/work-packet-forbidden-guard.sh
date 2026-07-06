#!/usr/bin/env bash
# gap ③ (W2 work-packet enforcement): mcp__codex__codex PreToolUse Forbidden guard.
#
# Companion to ctrl-tower-mcp-guard.sh. Wires the machine-readable
# `get_role_tool_allowlist(role)` envelope (forbidden_tools / forbidden_paths)
# into PreToolUse ENFORCEMENT so a Codex dispatch that explicitly targets a
# tool/path forbidden for its persona is DENIED (exit 2).
#
# Safety discipline (mirrors ctrl-tower-mcp-guard.sh):
#   - Reads stdin JSON payload first, falls back to CLAUDE_TOOL_INPUT_* env.
#   - Deny ONLY on an explicit forbidden_tools / forbidden_paths match.
#   - Fail-OPEN with an audit-log line on ANY unknown shape (no payload, no
#     resolvable persona role, facade import failure, unknown role). This guard
#     never blocks legitimate work whose persona/target it cannot determine.
#   - Bypass: OMC_SKIP_HOOKS=work-packet-forbidden-guard
set -u

case ",${OMC_SKIP_HOOKS:-}," in
  *,work-packet-forbidden-guard,*) exit 0 ;;
esac

payload=""
if [ -t 0 ]; then :; else payload=$(cat 2>/dev/null || true); fi

# Resolve this hook's own directory so python imports the CO-LOCATED worktree's
# `src/context_devos` (shadowing any shared editable install pointing at a
# sibling worktree). `__file__` is unusable here (python reads from stdin).
HOOK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd 2>/dev/null || echo "")

python3 - "$payload" "$HOOK_DIR" <<'PYEOF'
import datetime
import json
import os
import sys

raw = sys.argv[1] if len(sys.argv) > 1 else ""
hook_dir = sys.argv[2] if len(sys.argv) > 2 else ""
try:
    parsed = json.loads(raw) if raw else {}
except Exception:
    parsed = {}
if not isinstance(parsed, dict):
    parsed = {}
tin = parsed.get("tool_input") or parsed.get("input") or {}
if not isinstance(tin, dict):
    tin = {}

audit = "/tmp/work-packet-forbidden-hook.log"


def log(msg):
    try:
        with open(audit, "a") as f:
            f.write(f"{datetime.datetime.utcnow().isoformat()}Z {msg}\n")
    except Exception:
        pass


def failopen(reason):
    # Unknown shape -> defer to the orchestrator, never block.
    log(f"fail-open {reason}")
    sys.exit(0)


# --- resolve persona role (env-first, then structured tool_input) ----------
role = (
    os.environ.get("WARVIS_CODEX_PERSONA", "")
    or os.environ.get("WARVIS_CODEX_ROLE", "")
    or str(tin.get("persona") or "")
    or str(tin.get("role") or "")
).strip()
if not role:
    failopen("no resolvable persona role (env/tool_input)")

# --- collect the explicitly requested tool(s) / path -----------------------
requested_tools = []
env_tool = os.environ.get("WARVIS_CODEX_REQUESTED_TOOL", "").strip()
if env_tool:
    requested_tools.append(env_tool)
rt = tin.get("requested_tool")
if isinstance(rt, str) and rt.strip():
    requested_tools.append(rt.strip())
rts = tin.get("requested_tools")
if isinstance(rts, (list, tuple)):
    requested_tools.extend(str(x).strip() for x in rts if str(x).strip())

requested_cwd = str(tin.get("cwd") or "").strip()

if not requested_tools and not requested_cwd:
    failopen(f"role={role!r} but no structured requested_tool/cwd to check")

# --- load the allowlist envelope via the read_api facade -------------------
try:
    # hook lives at <root>/.claude/hooks/ -> repo root is two levels up.
    if hook_dir:
        repo_root = os.path.abspath(os.path.join(hook_dir, "..", ".."))
        src = os.path.join(repo_root, "src")
        if os.path.isdir(src):
            # front-insert so the co-located worktree shadows any shared
            # editable install pointing at a sibling worktree.
            sys.path.insert(0, src)
    from context_devos.read_api._facades.get_role_tool_allowlist import (
        get_role_tool_allowlist,
    )
    envelope = get_role_tool_allowlist(role)
except ValueError as exc:
    # unknown role -> fail-open (cannot assert a forbidden set)
    failopen(f"unknown role {role!r}: {exc}")
except Exception as exc:  # import / runtime failure -> fail-open
    failopen(f"facade unavailable ({type(exc).__name__}: {exc})")

forbidden_tools = set(envelope.get("forbidden_tools") or [])
forbidden_paths = list(envelope.get("forbidden_paths") or [])

# --- deny ONLY on an explicit forbidden match ------------------------------
for tool in requested_tools:
    if tool in forbidden_tools:
        log(f"DENY role={role} forbidden_tool={tool}")
        sys.stderr.write(
            f"[work-packet guard] Codex persona {role!r} is FORBIDDEN from "
            f"tool {tool!r} (work-packet enforcement, gap ③). "
            f"Reassign to the sanctioned persona or obtain human approval. "
            f"Bypass: OMC_SKIP_HOOKS=work-packet-forbidden-guard\n"
        )
        sys.exit(2)

for fpath in forbidden_paths:
    if fpath and requested_cwd and (
        requested_cwd == fpath or requested_cwd.startswith(fpath.rstrip("/") + "/")
    ):
        log(f"DENY role={role} forbidden_path={fpath} cwd={requested_cwd}")
        sys.stderr.write(
            f"[work-packet guard] Codex persona {role!r} is FORBIDDEN from "
            f"path {fpath!r} (cwd={requested_cwd!r}, work-packet enforcement, "
            f"gap ③). Bypass: OMC_SKIP_HOOKS=work-packet-forbidden-guard\n"
        )
        sys.exit(2)

log(f"PASS role={role} tools={requested_tools} cwd={requested_cwd}")
sys.exit(0)
PYEOF
