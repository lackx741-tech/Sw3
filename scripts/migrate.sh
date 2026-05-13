#!/usr/bin/env bash
# scripts/migrate.sh — Run PostgreSQL database migrations
#
# Applies the SQLx migrations in services/execution-engine/src/db/migrations/
# directly via psql.
#
# Prerequisites:
#   - PostgreSQL running at $DATABASE_URL_LOCAL (make infra)
#   - psql available in PATH

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

DB_URL="${DATABASE_URL_LOCAL:-postgresql://sw3:sw3dev@localhost:5432/sw3_dev}"
MIGRATIONS_DIR="$REPO_ROOT/services/execution-engine/src/db/migrations"

echo "→ Applying migrations from $MIGRATIONS_DIR"
echo "→ Target DB: $DB_URL"
echo ""

# Wait for postgres
for i in $(seq 1 30); do
  if psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
    echo "→ PostgreSQL is ready (attempt $i)"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: PostgreSQL not reachable after 30 attempts. Run 'make infra' first."
    exit 1
  fi
  sleep 1
done

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  → Applying $f..."
  psql "$DB_URL" -f "$f"
done

echo ""
echo "✓ Migrations complete."
