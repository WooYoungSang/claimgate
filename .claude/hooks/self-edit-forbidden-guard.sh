#!/usr/bin/env bash
# Claude Edit/Write/MultiEdit PreToolUse forbidden-path guard.
#
# Enforces the active work-packet forbidden_paths delivered by the dispatcher
# through WARVIS_WORK_PACKET_FORBIDDEN_PATHS, plus any persona facade
# forbidden_paths when a role is resolvable. Unknown shapes fail open.
#
# Safety discipline mirrors work-packet-forbidden-guard.sh:
#   - Reads stdin JSON payload first, falls back to CLAUDE_TOOL_INPUT_file_path.
#   - Front-inserts the co-located worktree src on sys.path before facade import.
#   - Denies only on an explicit forbidden path match.
#   - Fail-opens with an audit line on missing payload/path/context/imports.
#   - Bypass: OMC_SKIP_HOOKS=self-edit-forbidden-guard
set -u

case ",${OMC_SKIP_HOOKS:-}," in
  *,self-edit-forbidden-guard,*) exit 0 ;;
esac

payload=""
if [ -t 0 ]; then :; else payload=$(cat 2>/dev/null || true); fi

# Resolve this hook's own directory so python imports the co-located worktree's
# src/context_devos, shadowing any shared editable install from another tree.
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

audit = "/tmp/self-edit-forbidden-hook.log"


def log(msg):
    try:
        with open(audit, "a") as f:
            f.write(f"{datetime.datetime.utcnow().isoformat()}Z {msg}\n")
    except Exception:
        pass


def failopen(reason):
    log(f"fail-open {reason}")
    sys.exit(0)


def add_path(target, source):
    text = str(target or "").strip()
    if text and text not in forbidden_paths:
        forbidden_paths.append(text)
        log(f"forbidden-path source={source} path={text!r}")


def repo_abs(path):
    text = str(path or "").strip()
    if not text:
        return ""
    expanded = os.path.expanduser(text)
    if os.path.isabs(expanded):
        return os.path.normpath(expanded)
    return os.path.normpath(os.path.abspath(os.path.join(repo_root, expanded)))


def raw_norm(path):
    text = str(path or "").strip()
    if text != "/":
        text = text.rstrip("/")
    return text


def is_inside(candidate, root):
    candidate = raw_norm(candidate)
    root = raw_norm(root)
    if not candidate or not root:
        return False
    return candidate == root or candidate.startswith(root + "/")


repo_root = os.path.abspath(os.path.join(hook_dir, "..", "..")) if hook_dir else os.getcwd()

file_path = str(
    tin.get("file_path") or os.environ.get("CLAUDE_TOOL_INPUT_file_path", "")
).strip()
if not file_path:
    failopen("no file_path in tool_input/env")

forbidden_paths = []
for entry in os.environ.get("WARVIS_WORK_PACKET_FORBIDDEN_PATHS", "").split(os.pathsep):
    add_path(entry, "work-packet-env")

role = (
    os.environ.get("WARVIS_CODEX_PERSONA", "")
    or os.environ.get("WARVIS_CODEX_ROLE", "")
    or str(tin.get("persona") or "")
    or str(tin.get("role") or "")
).strip()

if role:
    try:
        if hook_dir:
            src = os.path.join(repo_root, "src")
            if os.path.isdir(src):
                sys.path.insert(0, src)
        from context_devos.read_api._facades.get_role_tool_allowlist import (
            get_role_tool_allowlist,
        )

        envelope = get_role_tool_allowlist(role)
        for entry in envelope.get("forbidden_paths") or []:
            add_path(entry, f"persona:{role}")
    except ValueError as exc:
        log(f"persona-forbidden-paths empty unknown-role role={role!r}: {exc}")
    except Exception as exc:
        log(f"persona-forbidden-paths empty facade-error {type(exc).__name__}: {exc}")
else:
    log("persona-forbidden-paths empty no resolvable role")

if not forbidden_paths:
    failopen("no active forbidden_paths")

abs_file = repo_abs(file_path)
raw_file = raw_norm(file_path)

for entry in forbidden_paths:
    abs_entry = repo_abs(entry)
    raw_entry = raw_norm(entry)
    if (
        is_inside(abs_file, abs_entry)
        or is_inside(raw_file, raw_entry)
        or is_inside(abs_file, raw_entry)
        or is_inside(raw_file, abs_entry)
    ):
        log(f"DENY file_path={file_path!r} forbidden_path={entry!r}")
        sys.stderr.write(
            f"[self-edit guard] Edited path {file_path!r} is FORBIDDEN by "
            f"forbidden_paths entry {entry!r}. "
            "Bypass: OMC_SKIP_HOOKS=self-edit-forbidden-guard\n"
        )
        sys.exit(2)

log(f"PASS file_path={file_path!r} forbidden_paths={forbidden_paths!r}")
sys.exit(0)
PYEOF
