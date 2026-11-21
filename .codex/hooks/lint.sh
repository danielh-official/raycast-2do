#!/bin/bash
# Stop hook: lints the extension when Claude finishes a response. If lint fails, Claude gets the
# errors and is sent to the fix-lint skill. Runs once per stop (like Cursor's loop_limit: 1).
input=$(cat)
[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

# The hook environment may not have nvm's node on PATH.
command -v npm >/dev/null || . "$HOME/Library/Application Support/Herd/config/nvm/nvm.sh" >/dev/null 2>&1

cd "${CLAUDE_PROJECT_DIR:-.}/extension" || exit 0
output=$(npm run lint 2>&1) && exit 0

errors=$(printf '%s\n' "$output" | sed $'s/\x1b\[[0-9;]*m//g' | grep -v -E '^(npm (warn|notice)|ready )|^> ' | tail -40)
jq -n --arg errors "$errors" '{
  decision: "block",
  reason: ("`npm run lint` in extension/ failed:\n\n" + $errors + "\n\nRead .claude/skills/fix-lint/SKILL.md and follow it.")
}'
