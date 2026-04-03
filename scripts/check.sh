#!/usr/bin/env bash
# Runs format, lint, typecheck, and unit tests only. Integration tests are not run here;
# use ./scripts/check-all.sh (or bun run check-all) to include bun run test:integration.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

CHECK_NAMES=( "Format" "Lint" "Typecheck" "Tests" )
CHECK_CMDS=( "bun run format:check" "bun run lint" "bun run typecheck" "bun run test:unit" )

for i in "${!CHECK_CMDS[@]}"; do
  name="${CHECK_NAMES[$i]}"
  cmd="${CHECK_CMDS[$i]}"
  out=$(eval "$cmd" 2>&1)
  exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    echo "[${name} failed]"
    if [ "$name" = "Tests" ]; then
      echo "$out" | grep -E '\(fail\)' || true
      echo "$out" | tail -15
      bun run db:seed > /dev/null 2>&1
    else
      echo "$out"
    fi
    exit 1
  fi
done

echo "All checks passed."