#!/usr/bin/env bash
# ctrl-tower mcp__codex__codex PreToolUse safety guard.
#
# Enforces the orchestration-pattern §3.1/§3.2 invariants for Codex MCP
# invocations:
#   * sandbox MUST be one of {"danger-full-access", "workspace-write"}.
#   * cwd MUST be present, absolute, and match a registered git worktree.
#
# Tries stdin JSON payload first (modern Claude Code hook contract),
# falls back to CLAUDE_TOOL_INPUT_* env vars (legacy Bash route),
# fail-open with audit if neither available (cannot block unknown shape).
#
# H-6 (2026-06-02): the bash wrapper captures stdin into ``payload`` and
# passes it positionally into the python3 helper. The legacy code path
# read ``sys.argv[1]``; we keep that for back-compat AND also try the
# stdin pipe in case a caller invokes the python helper directly
# (e.g. for offline debug). Both routes are documented inline so future
# changes do not silently drop one.
set -u

payload=""
if [ -t 0 ]; then :; else payload=$(cat 2>/dev/null || true); fi

python3 - "$payload" <<'PYEOF'
import datetime
import json
import os
import subprocess
import sys

# H-6: argv-first parse mirrors how the bash wrapper invokes us today.
# The wrapper has already drained stdin into argv[1] above, so reading
# sys.stdin again here would either block or return empty — argv is
# the authoritative payload channel under the current PreToolUse hook
# contract. Documenting explicitly so future refactors do not assume
# stdin is unused.
raw = sys.argv[1] if len(sys.argv) > 1 else ""
if not raw and not sys.stdin.isatty():
    # Defensive: if a caller invokes this helper directly (bypassing
    # the bash wrapper) and pipes JSON into stdin, accept that too.
    try:
        raw = sys.stdin.read()
    except Exception:
        raw = ""
try:
    parsed = json.loads(raw) if raw else {}
except Exception:
    parsed = {}
tin = parsed.get("tool_input") or parsed.get("input") or parsed or {}

sandbox = tin.get("sandbox") or os.environ.get("CLAUDE_TOOL_INPUT_sandbox", "")
cwd = tin.get("cwd") or os.environ.get("CLAUDE_TOOL_INPUT_cwd", "")
tool = parsed.get("tool_name", "") or os.environ.get("CLAUDE_TOOL_NAME", "")

audit = "/tmp/ctrl-tower-mcp-hook.log"
def log(msg):
    try:
        with open(audit, "a") as f:
            f.write(f"{datetime.datetime.utcnow().isoformat()}Z {msg}\n")
    except Exception:
        pass

if not sandbox and not cwd:
    log(f"fail-open empty input shape unknown tool={tool!r} raw_len={len(raw)}")
    sys.stderr.write(
        "[ctrl-tower mcp guard] WARN: MCP input not exposed to hook; "
        "deferring safety to Claude orchestrator (audit /tmp/ctrl-tower-mcp-hook.log).\n"
    )
    sys.exit(0)

if sandbox not in ("danger-full-access", "workspace-write"):
    sys.stderr.write(
        f"Codex MCP sandbox invalid: {sandbox!r} (orchestration-pattern §3.1, F1).\n"
    )
    sys.exit(2)

if not cwd:
    sys.stderr.write("Codex MCP cwd missing (§3.2, F7).\n")
    sys.exit(2)

if not cwd.startswith("/"):
    sys.stderr.write(f"Codex MCP cwd must be absolute: {cwd}\n")
    sys.exit(2)

try:
    wt = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        capture_output=True, text=True, timeout=5
    ).stdout
except Exception as e:
    log(f"worktree list failed: {e}; fail-open")
    sys.exit(0)

paths = {ln[len("worktree "):] for ln in wt.splitlines() if ln.startswith("worktree ")}
if cwd not in paths:
    sys.stderr.write(f"Codex MCP cwd not in worktree list: {cwd}\n")
    sys.exit(2)

log(f"PASS tool={tool} cwd={cwd} sandbox={sandbox}")
sys.exit(0)
PYEOF
