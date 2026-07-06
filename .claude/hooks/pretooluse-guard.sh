#!/usr/bin/env bash
# PreToolUse hook: deny irreversible shell commands and require approval for
# deploy/push-class operations. Reads JSON from stdin, emits a JSON decision
# on stdout per Claude Code hooks contract.
#
# IMPORTANT: stdin is captured BEFORE invoking python3 with a heredoc, because
# `python3 - <<EOF` consumes stdin as the program source and would otherwise
# starve json.load() of the actual hook payload.
set -euo pipefail

HOOK_PAYLOAD="$(cat)"
export HOOK_PAYLOAD

python3 - <<'PYEOF'
import json
import os
import re

try:
    payload = json.loads(os.environ.get("HOOK_PAYLOAD", "{}"))
except Exception:
    raise SystemExit(0)

cmd = (payload.get("tool_input", {}) or {}).get("command", "") or ""

# Normalize for matching: collapse whitespace, strip leading backslash escape
# (e.g. `\rm -rf /` → `rm -rf /`), unwrap simple env-prefix `FOO=1 cmd`.
norm = re.sub(r"\s+", " ", cmd).strip()
norm = re.sub(r"^\\", "", norm)
norm = re.sub(r"^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)+", "", norm)

if re.search(r"\bcodex\s+exec\b", norm):
    has_explicit_sandbox = bool(re.search(
        r"(?:^|\s)(?:-s|--sandbox)\s+(?:read-only|workspace-write|danger-full-access)\b"
        r"|(?:^|\s)--danger-full-access\b",
        norm,
    ))
    if not has_explicit_sandbox:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "nested 'codex exec' requires an explicit sandbox (-s/--sandbox or --danger-full-access)",
            }
        }))
        raise SystemExit(0)

# Case-insensitive matching — POSIX/GNU rm accepts -R as recursive equivalent
# of -r, and force-push options may appear anywhere on the line, not adjacent.
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
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                "devos_checkpoint_bet requires Bet-level Hill evidence: "
                "hill_position=0..10 or hill_position_nochange_reason"
            ),
        }
    }))
    raise SystemExit(0)

DENY = [
    # rm with recursive+force flag in any order/case (rm -rf, -RF, -fR, -r -f, -rfv, …)
    r"\brm\b(?=(?:[^|;&]*\s)?-[A-Za-z]*[rR][A-Za-z]*[fF]\b|(?:[^|;&]*\s)?-[A-Za-z]*[fF][A-Za-z]*[rR]\b|(?:[^|;&]*\s)?-[rR]\s+-[fF]\b|(?:[^|;&]*\s)?-[fF]\s+-[rR]\b)",
    r"\bgit\s+reset\s+--hard\b",
    r"\bgit\s+clean\b(?=[^|;&]*\s-[A-Za-z]*[dfx])",
    # force-push: option may appear anywhere after `git push`, not just adjacent
    r"\bgit\s+push\b(?=[^|;&]*(?:--force\b|-f\b|--force-with-lease\b))",
    r"\bkubectl\s+delete\b",
    r"\bterraform\s+destroy\b",
    r"--no-verify\b",
    # interpreter-wrapping (sh -c, bash -lc, zsh -c) defeats most static
    # checks — block by default; legitimate uses can be approved manually.
    r"\b(?:sh|bash|zsh|dash|ksh)\s+-[A-Za-z]*c\b",
    # base64-decode-pipe-to-shell exfil/exec pattern
    r"\bbase64\s+(?:-[A-Za-z]*d|--decode)\b.*\|\s*(?:sh|bash|zsh|dash)\b",
    # piping curl/wget output directly to shell
    r"\b(?:curl|wget)\b.*\|\s*(?:sh|bash|zsh|dash)\b",
    # destructive provisioning
    r"\bdd\s+if=.*\s+of=/dev/(?:sd|nvme|hd)\w*",
    r"\bmkfs(?:\.\w+)?\b",
    # disk wipers
    r"\bshred\b",
]
ASK = [
    r"\bgit\s+push\b",
    r"\bkubectl\s+apply\b",
    r"\bterraform\s+apply\b",
    r"\bdocker\s+compose\s+down\b",
    r"\bnpm\s+publish\b",
    r"\bcargo\s+publish\b",
]

decision = None
reason = ""
if any(re.search(p, norm, re.IGNORECASE) for p in DENY):
    decision = "deny"
    reason = "Irreversible command blocked by project harness: " + cmd
elif any(re.search(p, norm, re.IGNORECASE) for p in ASK):
    decision = "ask"
    reason = "Human approval required by project harness: " + cmd

if decision:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }))
PYEOF
