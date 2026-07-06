#!/usr/bin/env bash
# ClaimGate Codex PostToolUse hook (Edit|Write|MultiEdit).
# TypeScript/pnpm-aware, non-blocking. Bypass with OMC_SKIP_HOOKS=post-edit-validate.
set -euo pipefail
case ",${OMC_SKIP_HOOKS:-}," in *,post-edit-validate,*) exit 0 ;; esac
PAYLOAD="$(cat 2>/dev/null || true)"
[ -z "$PAYLOAD" ] && exit 0
f=$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print((d.get("tool_input") or {}).get("file_path", ""))' 2>/dev/null || true)
[ -z "$f" ] && exit 0
case "$f" in
  *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|package.json|pnpm-workspace.yaml|tsconfig*.json) : ;;
  *) exit 0 ;;
esac
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"
if ! command -v pnpm >/dev/null 2>&1; then
  printf '<system-reminder>ClaimGate post-edit validation skipped: pnpm is not installed.</system-reminder>\n'
  exit 0
fi
if [ ! -d node_modules ]; then
  # Scaffold phase may not have dependencies yet; do not run install from a hook.
  printf '<system-reminder>ClaimGate post-edit validation skipped: node_modules missing; run pnpm install in the lane before verification.</system-reminder>\n'
  exit 0
fi
run_script() {
  local name="$1"
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$name'] ? 0 : 1)" 2>/dev/null; then
    out=$(pnpm -s "$name" 2>&1); rc=$?
    [ $rc -ne 0 ] && printf '<system-reminder>ClaimGate post-edit %s failed (non-blocking) after %s:\n%s</system-reminder>\n' "$name" "$f" "$(printf '%s' "$out" | tail -40)"
  fi
}
case "$f" in
  *test.ts|*test.tsx|*.spec.ts|*.spec.tsx|tests/*|*/tests/*) run_script test ;;
  *) run_script typecheck ;;
esac
exit 0
