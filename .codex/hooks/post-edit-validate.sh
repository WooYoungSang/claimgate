#!/usr/bin/env bash
set -euo pipefail
PAYLOAD="$(cat 2>/dev/null || true)"
[ -z "$PAYLOAD" ] && exit 0
f=$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print((d.get("tool_input") or {}).get("file_path", ""))' 2>/dev/null || true)
[ -z "$f" ] && exit 0
case "$f" in
  *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|package.json|pnpm-workspace.yaml|tsconfig*.json|governance/knowledge/claimgate-kb.json) : ;;
  *) exit 0 ;;
esac
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd); cd "$root"
if [[ "$f" == governance/knowledge/claimgate-kb.json ]]; then ./kbctl verify >/tmp/claimgate-kbctl-hook.out 2>&1 || printf '<system-reminder>kbctl verify failed:
%s</system-reminder>
' "$(tail -40 /tmp/claimgate-kbctl-hook.out)"; exit 0; fi
if command -v pnpm >/dev/null 2>&1 && [ -d node_modules ]; then pnpm -s typecheck >/tmp/claimgate-typecheck-hook.out 2>&1 || printf '<system-reminder>typecheck failed after %s:
%s</system-reminder>
' "$f" "$(tail -40 /tmp/claimgate-typecheck-hook.out)"; fi
