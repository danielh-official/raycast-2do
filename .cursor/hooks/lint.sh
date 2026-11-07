#!/bin/bash
# Stop hook: lints the extension when the agent finishes a response. If lint fails, the agent gets
# the errors and is sent to the fix-lint skill.
input=$(cat)
[ "$(echo "$input" | jq -r '.status // "completed"')" = "completed" ] || { echo '{}'; exit 0; }

# Cursor's hook environment may not have nvm's node on PATH.
command -v npm >/dev/null || . "$HOME/Library/Application Support/Herd/config/nvm/nvm.sh" >/dev/null 2>&1

cd extension || { echo '{}'; exit 0; }
if output=$(npm run lint 2>&1); then
  echo '{}'
  exit 0
fi

errors=$(printf '%s\n' "$output" | grep -v -E '^(npm (warn|notice)|ready )|^> ' | tail -40)
jq -n --arg errors "$errors" '{
  followup_message: ("`npm run lint` in extension/ failed:\n\n" + $errors + "\n\nRead .cursor/skills/fix-lint/SKILL.md and follow it.")
}'
