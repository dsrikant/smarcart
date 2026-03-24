#!/bin/bash
# Reads the bash command from stdin JSON, blocks any push to main/develop
INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))")

if echo "$CMD" | grep -qE "git push origin (main|develop)"; then
  echo "BLOCKED: Agents cannot push directly to main or develop. Create a PR." >&2
  exit 1
fi