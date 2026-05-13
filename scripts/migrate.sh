#!/usr/bin/env bash
# scripts/migrate.sh — Run PostgreSQL + ClickHouse migrations
#
# Applies:
#   - SQLx migrations in services/execution-engine/src/db/migrations/ (PostgreSQL)
#   - local analytics schema in infra/clickhouse/migrations/ (ClickHouse)
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
CLICKHOUSE_HOST_LOCAL="${CLICKHOUSE_HOST_LOCAL:-localhost}"
CLICKHOUSE_PORT_LOCAL="${CLICKHOUSE_PORT_LOCAL:-${CLICKHOUSE_PORT:-8123}}"
CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"
CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-sw3_analytics}"
CLICKHOUSE_MIGRATIONS_DIR="$REPO_ROOT/infra/clickhouse/migrations"
CLICKHOUSE_URL="http://${CLICKHOUSE_HOST_LOCAL}:${CLICKHOUSE_PORT_LOCAL}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "ERROR: PostgreSQL migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi
if [[ ! -d "$CLICKHOUSE_MIGRATIONS_DIR" ]]; then
  echo "ERROR: ClickHouse migrations directory not found: $CLICKHOUSE_MIGRATIONS_DIR"
  exit 1
fi

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
echo "→ Applying ClickHouse migrations from $CLICKHOUSE_MIGRATIONS_DIR"
echo "→ Target ClickHouse: $CLICKHOUSE_URL (db=$CLICKHOUSE_DATABASE)"
echo ""

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required to run ClickHouse migrations."
  exit 1
fi

for i in $(seq 1 30); do
  if curl -sf "$CLICKHOUSE_URL/ping" >/dev/null 2>&1; then
    echo "→ ClickHouse is ready (attempt $i)"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: ClickHouse not reachable after 30 attempts. Run 'make infra' first."
    exit 1
  fi
  sleep 1
done

if [[ -n "$CLICKHOUSE_PASSWORD" ]]; then
  curl -sfS --data-binary "CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}" \
    "$CLICKHOUSE_URL/?user=$CLICKHOUSE_USER&password=$CLICKHOUSE_PASSWORD" >/dev/null
else
  curl -sfS --data-binary "CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}" \
    "$CLICKHOUSE_URL/?user=$CLICKHOUSE_USER" >/dev/null
fi

for f in "$CLICKHOUSE_MIGRATIONS_DIR"/*.sql; do
  echo "  → Applying $f..."
  if [[ -n "$CLICKHOUSE_PASSWORD" ]]; then
    curl -sfS --data-binary @"$f" \
      "$CLICKHOUSE_URL/?database=$CLICKHOUSE_DATABASE&user=$CLICKHOUSE_USER&password=$CLICKHOUSE_PASSWORD" >/dev/null
  else
    curl -sfS --data-binary @"$f" \
      "$CLICKHOUSE_URL/?database=$CLICKHOUSE_DATABASE&user=$CLICKHOUSE_USER" >/dev/null
  fi
done

echo ""
echo "✓ Migrations complete."
