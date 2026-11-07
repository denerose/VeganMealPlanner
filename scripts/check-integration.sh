#!/usr/bin/env bash
# Hermetic integration checks: provisions a disposable veganmealplanner_test database
# (drop/create/migrate), then runs the integration suite against it. The dev database
# is never touched. Safe for routine and agent use.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

TEST_URL="$(bun run scripts/provision-test-db.ts | tail -1)" || exit 1

if ! DATABASE_URL="$TEST_URL" bunx prisma migrate deploy >/dev/null 2>&1; then
  echo "[Migrations failed against the test database]"
  exit 1
fi

out=$(DATABASE_URL="$TEST_URL" bun run test:integration 2>&1)
exit_code=$?
echo "$out" | tail -6
if [ "$exit_code" -ne 0 ]; then
  echo "[Integration tests failed]"
  echo "$out" | grep -E '\(fail\)' || true
  exit 1
fi

echo "Integration checks passed (hermetic test database; dev database untouched)."
